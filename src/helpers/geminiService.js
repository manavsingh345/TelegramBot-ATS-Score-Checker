const { normalizeText } = require('./atsScorer');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);
const ATS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    fitBand: {
      type: 'string',
      enum: ['Low Match', 'Moderate Match', 'Strong Match']
    },
    resumeSummary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' }
    },
    keywordSuggestions: {
      type: 'array',
      items: { type: 'string' }
    },
    improvementTips: {
      type: 'array',
      items: { type: 'string' }
    },
    rewrittenBullets: {
      type: 'array',
      items: { type: 'string' }
    },
    interviewQuestions: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: [
    'fitBand',
    'resumeSummary',
    'strengths',
    'keywordSuggestions',
    'improvementTips',
    'rewrittenBullets',
    'interviewQuestions'
  ]
};

function stripCodeFence(text = '') {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function getResponseText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('') || ''
  );
}

function extractJsonObject(text = '') {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return '';
  }

  return text.slice(start, end + 1);
}

function sanitizeInsights(data) {
  return {
    fitBand: ['Low Match', 'Moderate Match', 'Strong Match'].includes(data?.fitBand)
      ? data.fitBand
      : 'Moderate Match',
    resumeSummary: typeof data?.resumeSummary === 'string' ? data.resumeSummary : '',
    strengths: Array.isArray(data?.strengths) ? data.strengths.filter(Boolean).slice(0, 5) : [],
    keywordSuggestions: Array.isArray(data?.keywordSuggestions) ? data.keywordSuggestions.filter(Boolean).slice(0, 5) : [],
    improvementTips: Array.isArray(data?.improvementTips) ? data.improvementTips.filter(Boolean).slice(0, 5) : [],
    rewrittenBullets: Array.isArray(data?.rewrittenBullets) ? data.rewrittenBullets.filter(Boolean).slice(0, 5) : [],
    interviewQuestions: Array.isArray(data?.interviewQuestions) ? data.interviewQuestions.filter(Boolean).slice(0, 5) : []
  };
}

async function callGeminiJson(prompt, responseSchema) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2200,
          responseMimeType: 'application/json',
          responseSchema
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const rawText = stripCodeFence(getResponseText(data));
  const candidateText = rawText || extractJsonObject(JSON.stringify(data));

  if (!candidateText) {
    throw new Error('Gemini API returned an empty response.');
  }

  return JSON.parse(candidateText);
}

async function callGeminiText(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini chat failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = getResponseText(data).trim();

  if (!text) {
    throw new Error('Gemini chat returned empty content.');
  }

  return text;
}

async function generateAiAtsInsights({ resumeText, jobDescription, score, matchedKeywords, missingKeywords }) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const trimmedResume = normalizeText(resumeText).slice(0, 12000);
  const trimmedJobDescription = normalizeText(jobDescription).slice(0, 8000);

  const prompt = `
You are helping build a Telegram bot for ATS resume analysis.

Rules:
- Keep each array at exactly 3 items.
- Keep resumeSummary under 45 words.
- Keep each bullet under 18 words.
- Base the answer on the resume text, the job description, and the keyword gaps.
- Keep suggestions truthful and practical.
- rewrittenBullets must be concise improved resume bullets aligned to the job description.
- interviewQuestions must be tailored to the role.

ATS score: ${score}
Matched keywords: ${matchedKeywords.join(', ') || 'none'}
Missing keywords: ${missingKeywords.join(', ') || 'none'}

Resume text:
${trimmedResume}

Job description:
${trimmedJobDescription}
`.trim();

  try {
    return sanitizeInsights(await callGeminiJson(prompt, ATS_RESPONSE_SCHEMA));
  } catch (error) {
    const fallbackResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2200,
            responseMimeType: 'application/json',
            responseSchema: ATS_RESPONSE_SCHEMA
          }
        })
      }
    );

    const fallbackData = await fallbackResponse.json();
    const fallbackRawText = stripCodeFence(getResponseText(fallbackData));
    const extracted = extractJsonObject(fallbackRawText || JSON.stringify(fallbackData));

    if (extracted) {
      return sanitizeInsights(JSON.parse(extracted));
    }

    throw new Error(`Gemini JSON parse failed: ${error.message}`);
  }
}

async function generateFollowUpAnswer({ userMessage, latestAnalysis }) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const lowerMessage = userMessage.toLowerCase();
  const wantsInterviewQuestions =
    lowerMessage.includes('interview') || lowerMessage.includes('question');
  const wantsAtsImprovement =
    lowerMessage.includes('ats score') || lowerMessage.includes('improve my ats') || lowerMessage.includes('improve ats');

  const analysisContext = latestAnalysis
    ? `
Latest ATS analysis context:
- Resume file: ${latestAnalysis.file_name}
- Score: ${latestAnalysis.ats_score}/100
- Fit band: ${latestAnalysis.fit_band}
- Matched keywords: ${(latestAnalysis.matched_keywords || []).join(', ') || 'none'}
- Missing keywords: ${(latestAnalysis.missing_keywords || []).join(', ') || 'none'}
- Suggestions: ${(latestAnalysis.suggestions || []).join(' | ') || 'none'}
- Resume summary: ${latestAnalysis.resume_summary || 'none'}
`.trim()
    : 'No prior ATS analysis is available for this user yet.';

  const prompt = `
You are a Telegram ATS career assistant. Answer the user's follow-up question in a helpful, practical, well-structured way.

Rules:
- Answer in plain text.
- Give a complete answer, not a one-line answer.
- Prefer 4 to 7 concrete points when the user asks for ideas, questions, or improvements.
- Keep the total answer under 450 words.
- If the user asks about resume improvement, use the ATS context.
- If the user asks something unrelated, still respond helpfully.
- If there is no ATS context, suggest using /ats for a tailored analysis.
- If the user asks for interview questions, provide 5 interview questions tailored to the job/resume, each with a short reason why it matters.
- If the user asks how to improve ATS score, provide a clear step-by-step list based on the missing keywords and ATS context.
- Do not stop after one point.

${analysisContext}

Conversation intent:
- Interview questions requested: ${wantsInterviewQuestions ? 'yes' : 'no'}
- ATS improvement requested: ${wantsAtsImprovement ? 'yes' : 'no'}

User question:
${userMessage}
`.trim();

  return callGeminiText(prompt);
}

module.exports = {
  generateAiAtsInsights,
  generateFollowUpAnswer
};
