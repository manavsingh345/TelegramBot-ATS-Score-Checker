const { Scenes } = require('telegraf');

const AtsAnalysis = require('../models/atsAnalyses');
const { scoreResumeAgainstJob } = require('../helpers/atsScorer');
const { generateAiAtsInsights } = require('../helpers/geminiService');
const { formatDuration, getFitBandFromScore } = require('../helpers/atsMetrics');
const { generateOptimizedResumeDraft } = require('../helpers/resumeDraftService');
const { createResumePdf } = require('../helpers/resumePdfBuilder');
const { getTelegramFileBuffer, extractResumeText } = require('../helpers/resumeParser');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const atsScene = new Scenes.WizardScene(
  'atsScene',
  async (ctx) => {
    ctx.wizard.state.ats = {};
    ctx.wizard.state.ats.startedAt = Date.now();
    await ctx.reply(
      'Send your resume as a PDF, DOCX, or TXT file.\n\nType /cancel if you want to stop.'
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.document) {
      await ctx.reply('Please upload a resume file to continue. PDF, DOCX, and TXT are supported.');
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
        await ctx.reply('I could not read text from that file. Please try another resume with selectable text.');
        return undefined;
      }

      ctx.wizard.state.ats.resumeText = resumeText;
      ctx.wizard.state.ats.fileName = document.file_name || 'resume';

      await ctx.reply('Now paste the job description text so I can calculate the ATS score.');
      return ctx.wizard.next();
    } catch (error) {
      await ctx.reply(`Resume parsing failed: ${error.message}\n\nPlease try another file or run /ats again.`);
      return undefined;
    }
  },
  async (ctx) => {
    let progressMessage = null;

    try {
      const jobDescription = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

      if (!jobDescription || !jobDescription.trim()) {
        await ctx.reply('Please send the job description as plain text.');
        return undefined;
      }

      progressMessage = await ctx.reply(
        'Analyzing your resume against the job description...\n\nThis can take a few seconds because keyword scoring and AI review are running.'
      );

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

      let generatedResumePath = '';
      let resumeDraftCreated = false;

      try {
        const draft = await generateOptimizedResumeDraft({
          fileName: ctx.wizard.state.ats.fileName,
          resumeText: ctx.wizard.state.ats.resumeText,
          jobDescription,
          matchedKeywords,
          missingKeywords,
          aiInsights
        });

        generatedResumePath = await createResumePdf({
          baseFileName: ctx.wizard.state.ats.fileName,
          draft,
          analysis: {
            score,
            fitBand: getFitBandFromScore(score),
            matchedKeywords
          }
        });

        resumeDraftCreated = true;
      } catch (error) {
        console.log('Resume PDF generation skipped:', error.message);
      }

      const fitBand = getFitBandFromScore(score);
      const processingTimeMs = Date.now() - (ctx.wizard.state.ats.startedAt || Date.now());
      const processingTimeLabel = formatDuration(processingTimeMs);
      const analysisNumber = (await AtsAnalysis.countDocuments()) + 1;

      await AtsAnalysis.create({
        chat_id: String(ctx.chat.id),
        username: ctx.from.username || '',
        file_name: ctx.wizard.state.ats.fileName,
        job_description: jobDescription,
        ats_score: score,
        analysis_number: analysisNumber,
        fit_band: fitBand,
        matched_keywords: matchedKeywords,
        missing_keywords: missingKeywords,
        suggestions: aiInsights?.improvementTips?.length ? aiInsights.improvementTips : suggestions,
        resume_summary: aiInsights?.resumeSummary || '',
        strengths: aiInsights?.strengths || [],
        interview_questions: aiInsights?.interviewQuestions || [],
        generated_resume_path: generatedResumePath,
        ai_enabled: Boolean(aiInsights),
        processing_time_ms: processingTimeMs,
        processing_time_label: processingTimeLabel
      });

      const finalSuggestions = aiInsights?.improvementTips?.length ? aiInsights.improvementTips : suggestions;
      const keywordSuggestions = aiInsights?.keywordSuggestions || [];
      const strengths = aiInsights?.strengths || [];
      const interviewQuestions = aiInsights?.interviewQuestions || [];
      const rewrittenBullets = aiInsights?.rewrittenBullets || [];

      const response = [
        '<b>ATS Analysis Result</b>',
        '',
        `<b>Analysis #:</b> ${analysisNumber}`,
        `<b>Resume:</b> ${escapeHtml(ctx.wizard.state.ats.fileName)}`,
        `<b>Score:</b> ${score}/100`,
        `<b>Fit Band:</b> ${escapeHtml(fitBand)}`,
        `<b>Processing Time:</b> ${escapeHtml(processingTimeLabel)}`,
        `<b>AI Mode:</b> ${aiInsights ? 'Gemini Enabled' : 'Fallback ATS'}`,
        `<b>Updated Resume PDF:</b> ${resumeDraftCreated ? 'Ready to download below' : 'Could not generate in this run'}`,
        ...(aiInsights ? [] : ['', '<b>Note:</b> Gemini suggestions were unavailable for this run, so a safe ATS fallback was used.']),
        '',
        `<b>Resume Summary:</b> ${escapeHtml(aiInsights?.resumeSummary || 'AI summary unavailable. Basic ATS analysis was used.')}`,
        '',
        `<b>Matched Keywords:</b> ${escapeHtml(matchedKeywords.slice(0, 12).join(', ') || 'None')}`,
        '',
        `<b>Missing Keywords:</b> ${escapeHtml(missingKeywords.slice(0, 12).join(', ') || 'None')}`,
        '',
        '<b>Strengths:</b>',
        ...(strengths.length ? strengths.map((item, index) => `${index + 1}. ${escapeHtml(item)}`) : ['1. Resume parsing and keyword matching completed successfully.']),
        '',
        '<b>Keyword Suggestions:</b>',
        ...(keywordSuggestions.length ? keywordSuggestions.map((item, index) => `${index + 1}. ${escapeHtml(item)}`) : ['1. Add missing keywords naturally in skills, projects, or experience sections.']),
        '',
        '<b>Suggestions:</b>',
        ...finalSuggestions.map((item, index) => `${index + 1}. ${escapeHtml(item)}`),
        '',
        '<b>Better Resume Bullet Ideas:</b>',
        ...(rewrittenBullets.length ? rewrittenBullets.map((item, index) => `${index + 1}. ${escapeHtml(item)}`) : ['1. AI bullet rewriting unavailable for this run.']),
        '',
        '<b>Interview Questions:</b>',
        ...(interviewQuestions.length ? interviewQuestions.map((item, index) => `${index + 1}. ${escapeHtml(item)}`) : ['1. AI interview questions unavailable for this run.']),
        '',
        '<b>Next:</b> You can now ask follow-up questions in chat, like "improve my summary", "what skills should I learn next?", or "ask me interview questions".'
      ].join('\n');

      if (progressMessage) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);
        } catch (error) {
          console.log('Progress message cleanup skipped:', error.message);
        }
      }

      await ctx.reply(response, { parse_mode: 'HTML' });

      if (generatedResumePath) {
        await ctx.replyWithDocument({
          source: generatedResumePath,
          filename: `${ctx.wizard.state.ats.fileName.replace(/\.[^.]+$/, '')}_ats_resume.pdf`
        }, {
          caption: 'Your ATS-optimized resume draft is ready. Review it and customize it before applying.'
        });
      }

      return ctx.scene.leave();
    } catch (error) {
      console.log('ATS analysis failed:', error);

      if (progressMessage) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);
        } catch (cleanupError) {
          console.log('Progress message cleanup skipped:', cleanupError.message);
        }
      }

      await ctx.reply(
        'Analysis failed on the final step.\n\nPlease try /ats again. If it keeps happening, try a smaller job description or a clearer resume file.'
      );
      return ctx.scene.leave();
    }
  }
);

atsScene.command('cancel', async (ctx) => {
  await ctx.reply('ATS analysis cancelled.');
  return ctx.scene.leave();
});

module.exports = atsScene;
