import { auditAdminCommand } from '../services/auditService.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { handlePurchaseInteraction, handlePurchaseModal, purchasePrefixes } from '../services/purchaseMembershipService.js';
import { handleFeedbackInteraction, handleFeedbackModal, handleFeedbackStatsInteraction, handleFeedbackAdminInteraction } from '../services/feedbackService.js';

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      if (interaction.customId?.startsWith('feedback:')) {
        try {
          const handled = await handleFeedbackInteraction(interaction);
          if (handled) return;

          const adminHandled = await handleFeedbackAdminInteraction(interaction);
          if (adminHandled) return;
        } catch (error) {
          console.error('Error handling feedback interaction:', error);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Something went wrong with the feedback form.', ephemeral: true }).catch(() => {});
        }
      }
      if (interaction.customId?.startsWith('feedbackstats:')) {
        try {
          const handled = await handleFeedbackStatsInteraction(interaction);
          if (handled) return;
        } catch (error) {
          console.error('Error handling feedback stats interaction:', error);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Something went wrong while viewing feedback.', ephemeral: true }).catch(() => {});
        }
      }
      const purchaseInteraction = Object.values(purchasePrefixes).some(prefix =>
        interaction.customId?.startsWith(prefix + ':')
      );

      if (purchaseInteraction) {
        try {
          await handlePurchaseInteraction(interaction, client);
        } catch (error) {
          console.error('Error handling membership purchase interaction:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId?.startsWith('feedback:modal:')) {
        try {
          await handleFeedbackModal(interaction);
        } catch (error) {
          console.error('Error handling feedback modal:', error);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Something went wrong while submitting feedback.', ephemeral: true }).catch(() => {});
        }
        return;
      }

      const purchaseModal = interaction.customId?.startsWith(purchasePrefixes.PAID_PREFIX + ':');
      if (!purchaseModal) return;

      try {
        await handlePurchaseModal(interaction, client);
      } catch (error) {
        console.error('Error handling membership purchase modal:', error);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ Something went wrong while submitting your payment details.' }).catch(() => {});
        } else {
          await interaction.reply({ content: '❌ Something went wrong while submitting your payment details.', ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      if (!interaction.inGuild() && ['predict', 'predictqualifying'].includes(interaction.commandName)) {
        await interaction.reply({ content: 'Use the bot commands in server please, Thanks :)' }).catch(() => {});
        return;
      }

      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error('Command ' + interaction.commandName + ' not found');
        return;
      }

      const adminAction = interaction.inGuild() && isAdmin(interaction.member, config.roles.admin);
      if (adminAction) await auditAdminCommand(interaction, 'started');

      const originalReply = interaction.reply.bind(interaction);
      let autoDeferred = false;
      let responseTimer;

      interaction.reply = async (options) => {
        if (interaction.deferred) {
          if (autoDeferred) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp(options);
          }
          return interaction.editReply(options);
        }

        if (interaction.replied) {
          return interaction.followUp(options);
        }

        if (responseTimer) clearTimeout(responseTimer);
        return originalReply(options);
      };

      responseTimer = setTimeout(async () => {
        if (interaction.replied || interaction.deferred) return;

        try {
          await interaction.deferReply();
          autoDeferred = true;
          console.log('[Interaction] Auto-deferred /' + interaction.commandName);
        } catch (error) {
          console.error('Failed to auto-defer /' + interaction.commandName + ':', error);
        }
      }, 2000);

      try {
        await command.execute(interaction, client);
        if (adminAction) await auditAdminCommand(interaction, 'completed');
      } catch (error) {
        if (adminAction) await auditAdminCommand(interaction, 'failed', error);
        console.error('Error executing /' + interaction.commandName + ':', error);

        const errorMessage = {
          content: '❌ An error occurred while executing the command.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } finally {
        if (responseTimer) clearTimeout(responseTimer);
        interaction.reply = originalReply;
      }
    }
  },
};
