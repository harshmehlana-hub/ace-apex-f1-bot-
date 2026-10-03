import { auditAdminCommand } from '../services/auditService.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { handlePurchaseInteraction, handlePurchaseModal, purchasePrefixes } from '../services/purchaseMembershipService.js';

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isButton()) {
      const purchaseButton = Object.values(purchasePrefixes).some(prefix =>
        interaction.customId?.startsWith(prefix + ':')
      );
      if (!purchaseButton) return;

      try {
        await handlePurchaseInteraction(interaction, client);
      } catch (error) {
        console.error('Error handling membership purchase button:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
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
    // Handle slash commands.
    // Discord requires an interaction to be acknowledged quickly. If a command
    // takes longer than the normal response window, automatically defer it so
    // the user never gets "The application did not respond".
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`Command ${interaction.commandName} not found`);
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
          console.log(`[Interaction] Auto-deferred /${interaction.commandName}`);
        } catch (error) {
          console.error(`Failed to auto-defer /${interaction.commandName}:`, error);
        }
      }, 2000);

      try {
        await command.execute(interaction, client);
        if (adminAction) await auditAdminCommand(interaction, 'completed');
      } catch (error) {
        if (adminAction) await auditAdminCommand(interaction, 'failed', error);
        console.error(`Error executing ${interaction.commandName}:`, error);

        const errorMessage = {
          content: '❌ An error occurred while executing this command.',
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

    // Handle button interactions (for confirmation dialogs, etc.)
    if (interaction.isButton()) {
      // Button handling is done within individual commands
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      // Select menu handling is done within individual commands
    }
  },
};
