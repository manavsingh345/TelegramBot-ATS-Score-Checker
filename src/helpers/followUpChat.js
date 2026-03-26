const AtsAnalysis = require('../models/atsAnalyses');
const { generateFollowUpAnswer } = require('./geminiService');

async function handleFollowUpChat(ctx) {
  const userMessage = ctx.message?.text?.trim();

  if (!userMessage || userMessage.startsWith('/')) {
    return;
  }

  const currentSceneId = ctx.scene?.current?.id;

  if (currentSceneId) {
    return;
  }

  const waitingMessage = await ctx.reply(
    'Thinking about your question...\n\nYou can ask about resume improvement, interview prep, missing skills, or next steps.'
  );

  try {
    const latestAnalysis = await AtsAnalysis.findOne({ chat_id: String(ctx.chat.id) })
      .sort({ created_at: -1 })
      .lean();

    const answer = await generateFollowUpAnswer({
      userMessage,
      latestAnalysis
    });

    if (answer) {
      await ctx.reply(answer);
    } else {
      await ctx.reply(
        latestAnalysis
          ? `Here is a quick fallback based on your latest ATS result:\n\nScore: ${latestAnalysis.ats_score}/100\nFit: ${latestAnalysis.fit_band}\nTop missing keywords: ${(latestAnalysis.missing_keywords || []).slice(0, 5).join(', ') || 'None'}\n\nTry asking again, or use /ats for a fresh analysis.`
          : 'Follow-up chat needs Gemini enabled. You can still use /ats, /history, /stats, and /compare.'
      );
    }
  } catch (error) {
    console.log('Follow-up chat failed:', error.message);
    await ctx.reply(
      'I could not answer that follow-up right now. Please try again, or run /ats for a fresh analysis.'
    );
  } finally {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, waitingMessage.message_id);
    } catch (error) {
      console.log('Follow-up waiting message cleanup skipped:', error.message);
    }
  }
}

module.exports = {
  handleFollowUpChat
};
