const { Scenes } = require('telegraf');

const AtsAnalysis = require('../models/atsAnalyses');
const { scoreResumeAgainstJob } = require('../helpers/atsScorer');
const { generateAiAtsInsights } = require('../helpers/geminiService');
const { getTelegramFileBuffer, extractResumeText } = require('../helpers/resumeParser');

const atsScene = new Scenes.WizardScene(
  'atsScene',
  async (ctx) => {
    ctx.wizard.state.ats = {};
    await ctx.reply(
      'Send your resume as a PDF, DOCX, or TXT file.\n\nType /cancel if you want to stop.'
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.document) {
      await ctx.reply('Please upload a resume file to continue.');
      return undefined;
    }

    try {
      const document = ctx.message.document;
      const buffer = await getTelegramFileBuffer(ctx, document.file_id);
      const resumeText = await extractResumeText({
        buffer,
        fileName: document.file_name,
        mimeType: document.mime_type
      });

      if (!resumeText || !resumeText.trim()) {
        await ctx.reply('I could not read text from that file. Please try another resume.');
        return undefined;
      }

      ctx.wizard.state.ats.resumeText = resumeText;
      ctx.wizard.state.ats.fileName = document.file_name || 'resume';

      await ctx.reply('Now paste the job description text so I can calculate the ATS score.');
      return ctx.wizard.next();
    } catch (error) {
      await ctx.reply(`Resume parsing failed: ${error.message}`);
      return undefined;
    }
  },
  async (ctx) => {
    const jobDescription = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    if (!jobDescription || !jobDescription.trim()) {
      await ctx.reply('Please send the job description as plain text.');
      return undefined;
    }

    const { score, matchedKeywords, missingKeywords, suggestions } = scoreResumeAgainstJob({
      resumeText: ctx.wizard.state.ats.resumeText,
      jobDescription
    });

    let aiInsights = null;

    try {
      aiInsights = await generateAiAtsInsights({
        resumeText: ctx.wizard.state.ats.resumeText,
        jobDescription,
        score,
        matchedKeywords,
        missingKeywords
      });
    } catch (error) {
      console.log('Gemini analysis skipped:', error.message);
    }

    await AtsAnalysis.create({
      chat_id: String(ctx.chat.id),
      username: ctx.from.username || '',
      file_name: ctx.wizard.state.ats.fileName,
      job_description: jobDescription,
      ats_score: score,
      fit_band: aiInsights?.fitBand || '',
      matched_keywords: matchedKeywords,
      missing_keywords: missingKeywords,
      suggestions: aiInsights?.improvementTips?.length ? aiInsights.improvementTips : suggestions,
      resume_summary: aiInsights?.resumeSummary || '',
      strengths: aiInsights?.strengths || [],
      interview_questions: aiInsights?.interviewQuestions || [],
      ai_enabled: Boolean(aiInsights)
    });

    const fitBand = aiInsights?.fitBand || (score >= 75 ? 'Strong Match' : score >= 45 ? 'Moderate Match' : 'Low Match');
    const finalSuggestions = aiInsights?.improvementTips?.length ? aiInsights.improvementTips : suggestions;
    const keywordSuggestions = aiInsights?.keywordSuggestions || [];
    const strengths = aiInsights?.strengths || [];
    const interviewQuestions = aiInsights?.interviewQuestions || [];
    const rewrittenBullets = aiInsights?.rewrittenBullets || [];

    const response = [
      '<b>ATS Analysis Result</b>',
      '',
      `<b>Resume:</b> ${ctx.wizard.state.ats.fileName}`,
      `<b>Score:</b> ${score}/100`,
      `<b>Fit Band:</b> ${fitBand}`,
      '',
      `<b>Resume Summary:</b> ${aiInsights?.resumeSummary || 'AI summary unavailable. Basic ATS analysis was used.'}`,
      '',
      `<b>Matched Keywords:</b> ${matchedKeywords.slice(0, 12).join(', ') || 'None'}`,
      '',
      `<b>Missing Keywords:</b> ${missingKeywords.slice(0, 12).join(', ') || 'None'}`,
      '',
      '<b>Strengths:</b>',
      ...(strengths.length ? strengths.map((item, index) => `${index + 1}. ${item}`) : ['1. Resume parsing and keyword matching completed successfully.']),
      '',
      '<b>Keyword Suggestions:</b>',
      ...(keywordSuggestions.length ? keywordSuggestions.map((item, index) => `${index + 1}. ${item}`) : ['1. Add missing keywords naturally in skills, projects, or experience sections.']),
      '',
      '<b>Suggestions:</b>',
      ...finalSuggestions.map((item, index) => `${index + 1}. ${item}`),
      '',
      '<b>Better Resume Bullet Ideas:</b>',
      ...(rewrittenBullets.length ? rewrittenBullets.map((item, index) => `${index + 1}. ${item}`) : ['1. AI bullet rewriting unavailable for this run.']),
      '',
      '<b>Interview Questions:</b>',
      ...(interviewQuestions.length ? interviewQuestions.map((item, index) => `${index + 1}. ${item}`) : ['1. AI interview questions unavailable for this run.'])
    ].join('\n');

    await ctx.reply(response, { parse_mode: 'HTML' });
    return ctx.scene.leave();
  }
);

atsScene.command('cancel', async (ctx) => {
  await ctx.reply('ATS analysis cancelled.');
  return ctx.scene.leave();
});

module.exports = atsScene;
