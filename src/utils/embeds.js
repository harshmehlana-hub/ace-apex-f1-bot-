import { EmbedBuilder } from 'discord.js';

export function createPredictionEmbed(race, prediction, user) {
  return new EmbedBuilder()
    .setColor(0xE10600) // F1 Red
    .setTitle(`🏎️ Prediction for ${race.name}`)
    .addFields(
      { name: 'User', value: user.username, inline: true },
      { name: 'Submitted', value: `<t:${Math.floor(prediction.submittedAt.getTime() / 1000)}:R>`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🥇 P1', value: prediction.p1Driver, inline: true },
      { name: '🥈 P2', value: prediction.p2Driver, inline: true },
      { name: '🥉 P3', value: prediction.p3Driver, inline: true },
    )
    .setTimestamp();
}

export function createLeaderboardEmbed(leaderboard, page = 1, perPage = 10) {
  const start = (page - 1) * perPage;
  const pageData = leaderboard.slice(start, start + perPage);
  
  const description = pageData.map((entry, index) => {
    const rank = start + index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
    return `${medal} **${entry.username}** — ${entry.totalPoints} pts`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xE10600)
    .setTitle('🏆 Season Leaderboard')
    .setDescription(description || 'No predictions yet!')
    .setFooter({ text: `Page ${page} of ${Math.ceil(leaderboard.length / perPage)}` })
    .setTimestamp();
}

export function createRankEmbed(user, rank, totalUsers) {
  return new EmbedBuilder()
    .setColor(0xE10600)
    .setTitle('📊 User Statistics')
    .addFields(
      { name: 'User', value: user.username, inline: true },
      { name: 'Rank', value: `${rank} / ${totalUsers}`, inline: true },
      { name: 'Points', value: `${user.totalPoints}`, inline: true },
      { name: 'Perfect Predictions', value: `${user.perfectPredictions}`, inline: true },
    )
    .setTimestamp();
}

export function createResultsEmbed(race, result, topPredictors) {
  const topList = topPredictors.slice(0, 5).map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} <@${p.userId}> — ${p.pointsAwarded} Points`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xE10600)
    .setTitle(`🏁 ${race.name} Results`)
    .addFields(
      { name: '🥇 P1', value: result.p1Driver, inline: true },
      { name: '🥈 P2', value: result.p2Driver, inline: true },
      { name: '🥉 P3', value: result.p3Driver, inline: true },
      { name: '\u200B', value: '\u200B' },
      { name: '🏆 Top 5 Predictors', value: topList || 'No predictions for this race' },
    )
    .setTimestamp();
}

export function createRaceAnnouncementEmbed(race) {
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(`🏁 PREDICTION TIME : ${race.name}`)
    .setDescription(
      `Predictions are now open for **${race.name}**!\n\n` +
      `Use \`/predict\` to submit your podium prediction.\n\n` +
      `⏰ **Deadline:** <t:${Math.floor(race.predictionCloseTime.getTime() / 1000)}:F>`
    )
    .setTimestamp();
}

export function createQualifyingResultsEmbed(
  qualifying,
  result,
  correctPredictions,
  totalPredictions
) {
  return new EmbedBuilder()
    .setColor(0xE10600)
    .setTitle(`🏁 ${qualifying.name} Results`)
    .addFields(
      {
        name: '🏆 Pole Position',
        value: result.poleDriver,
        inline: false,
      },
      {
        name: '🎯 Correct Predictions',
        value: `${correctPredictions}`,
        inline: true,
      },
      {
        name: '📊 Total Predictions',
        value: `${totalPredictions}`,
        inline: true,
      },
      {
        name: '⭐ Points Awarded',
        value: '5 Points',
        inline: true,
      }
    )
    .setTimestamp();
}

export function createQualifyingAnnouncementEmbed(qualifying) {
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`🏁 QUALIFYING PREDICTIONS OPEN : ${qualifying.name}`)
    .setDescription(
      `Predictions are now open for **${qualifying.name}**!\n\n` +
      `Use \`/predictqualifying\` to predict Pole Position.\n\n` +
      `⏰ **Deadline:** <t:${Math.floor(
        qualifying.predictionCloseTime.getTime() / 1000
      )}:F>`
    )
    .setTimestamp();
}
