const AtsAnalysis = require('../models/atsAnalyses');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendHistory(ctx) {
  const chatId = String(ctx.chat.id);
  const analyses = await AtsAnalysis.find({ chat_id: chatId })
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  if (!analyses.length) {
    await ctx.reply('No ATS history found yet. Run /ats to create your first analysis.');
    return;
  }

  const lines = ['<b>Your Recent ATS History</b>', ''];

  analyses.forEach((item, index) => {
    lines.push(`${index + 1}. <b>${escapeHtml(item.file_name)}</b>`);
    lines.push(`Score: ${item.ats_score}/100 | Fit: ${escapeHtml(item.fit_band || 'Unknown')}`);
    lines.push(`AI: ${item.ai_enabled ? 'Enabled' : 'Fallback'} | Time: ${escapeHtml(item.processing_time_label || 'N/A')}`);
    lines.push(`Date: ${new Date(item.created_at).toLocaleString('en-IN')}`);
    lines.push('');
  });

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

async function sendStats(ctx) {
  const chatId = String(ctx.chat.id);

  const [totalAnalyses, userAnalyses, latestAnalysis] = await Promise.all([
    AtsAnalysis.countDocuments(),
    AtsAnalysis.countDocuments({ chat_id: chatId }),
    AtsAnalysis.findOne({ chat_id: chatId }).sort({ created_at: -1 }).lean()
  ]);

  const lines = [
    '<b>ATS Bot Stats</b>',
    '',
    `<b>Total Analyses:</b> ${totalAnalyses}`,
    `<b>Your Analyses:</b> ${userAnalyses}`,
    `<b>Latest Score:</b> ${latestAnalysis ? `${latestAnalysis.ats_score}/100` : 'No analysis yet'}`,
    `<b>Latest Fit Band:</b> ${escapeHtml(latestAnalysis?.fit_band || 'No analysis yet')}`,
    `<b>Latest Processing Time:</b> ${escapeHtml(latestAnalysis?.processing_time_label || 'N/A')}`
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

async function sendCompare(ctx) {
  const chatId = String(ctx.chat.id);
  const analyses = await AtsAnalysis.find({ chat_id: chatId })
    .sort({ created_at: -1 })
    .limit(2)
    .lean();

  if (analyses.length < 2) {
    await ctx.reply('Need at least 2 ATS analyses to compare. Run /ats a couple of times first.');
    return;
  }

  const latest = analyses[0];
  const previous = analyses[1];
  const scoreDiff = latest.ats_score - previous.ats_score;
  const direction = scoreDiff > 0 ? 'improved' : scoreDiff < 0 ? 'dropped' : 'stayed the same';

  const lines = [
    '<b>ATS Comparison</b>',
    '',
    `<b>Latest Resume:</b> ${escapeHtml(latest.file_name)} (${latest.ats_score}/100)`,
    `<b>Previous Resume:</b> ${escapeHtml(previous.file_name)} (${previous.ats_score}/100)`,
    `<b>Change:</b> ${direction} by ${Math.abs(scoreDiff)} points`,
    `<b>Latest Time:</b> ${escapeHtml(latest.processing_time_label || 'N/A')}`,
    `<b>Previous Time:</b> ${escapeHtml(previous.processing_time_label || 'N/A')}`
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

module.exports = {
  sendCompare,
  sendHistory,
  sendStats
};
