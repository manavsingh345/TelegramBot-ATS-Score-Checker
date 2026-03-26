const { normalizeText } = require('./atsScorer');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);

const RESUME_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
    experienceBullets: { type: 'array', items: { type: 'string' } },
    projects: { type: 'array', items: { type: 'string' } },
    keywordHighlights: { type: 'array', items: { type: 'string' } }
  },
  required: [
    'headline',
    'summary',
    'skills',
    'experienceBullets',
    'projects',
    'keywordHighlights'
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

function sanitizeDraft(data, fileName) {
  const defaultHeadline = `${fileName.replace(/\.[^.]+$/, '')} | ATS Optimized Resume Draft`;

  return {
    headline: typeof data?.headline === 'string' && data.headline.trim() ? data.headline : defaultHeadline,
    summary: typeof data?.summary === 'string' ? data.summary : '',
    skills: Array.isArray(data?.skills) ? data.skills.filter(Boolean).slice(0, 8) : [],
    experienceBullets: Array.isArray(data?.experienceBullets) ? data.experienceBullets.filter(Boolean).slice(0, 6) : [],
    projects: Array.isArray(data?.projects) ? data.projects.filter(Boolean).slice(0, 4) : [],
    keywordHighlights: Array.isArray(data?.keywordHighlights) ? data.keywordHighlights.filter(Boolean).slice(0, 6) : []
  };
}

async function generateOptimizedResumeDraft({
  fileName,
  resumeText,
  jobDescription,
  matchedKeywords,
  missingKeywords,
  aiInsights
}) {
  const safeFileName = fileName || 'resume';
  const fallbackDraft = {
    headline: `${safeFileName.replace(/\.[^.]+$/, '')} | ATS Optimized Resume Draft`,
    summary: aiInsights?.resumeSummary || 'ATS-optimized draft generated from the current resume and job description.',
    skills: [...new Set([...(matchedKeywords || []), ...(aiInsights?.keywordSuggestions || []), ...(missingKeywords || [])])].slice(0, 8),
    experienceBullets: (aiInsights?.rewrittenBullets || []).slice(0, 3),
    projects: (aiInsights?.improvementTips || []).slice(0, 3),
    keywordHighlights: (missingKeywords || []).slice(0, 6)
  };

  if (!fallbackDraft.experienceBullets.length) {
    fallbackDraft.experienceBullets = [
      'Tailored this resume draft to align more closely with the target job description.',
      'Highlighted relevant technical strengths, project impact, and ATS-friendly phrasing.',
      'Focused on role-fit keywords that should be added truthfully to the final resume.'
    ];
  }

  if (!fallbackDraft.projects.length) {
    fallbackDraft.projects = [
      'Rewrite project bullets using measurable outcomes and stronger action verbs.',
      'Highlight debugging, deployment, and collaboration responsibilities where accurate.',
      'Bring missing target keywords into skills, projects, and experience sections naturally.'
    ];
  }

  if (!GEMINI_API_KEY) {
    return fallbackDraft;
  }

  const prompt = `
You are generating an ATS-optimized resume draft for a Telegram bot user.

Return valid JSON only.

Rules:
- Keep summary under 70 words.
- skills: 6 to 8 items.
- experienceBullets: 4 to 6 concise bullets.
- projects: 3 to 4 concise bullets.
- keywordHighlights: 4 to 6 items.
- Do not invent fake companies or fake degrees.
- Use the resume text plus job description to rewrite content into stronger ATS-friendly wording.
- Keep the draft truthful and generic when data is missing.

Resume filename: ${safeFileName}
Matched keywords: ${(matchedKeywords || []).join(', ') || 'none'}
Missing keywords to target: ${(missingKeywords || []).join(', ') || 'none'}
Existing AI suggestions: ${(aiInsights?.improvementTips || []).join(' | ') || 'none'}
Existing rewritten bullets: ${(aiInsights?.rewrittenBullets || []).join(' | ') || 'none'}

Resume text:
${normalizeText(resumeText).slice(0, 14000)}

Job description:
${normalizeText(jobDescription).slice(0, 9000)}
`.trim();

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
          responseSchema: RESUME_DRAFT_SCHEMA
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini resume draft failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const rawText = stripCodeFence(getResponseText(data));
  const candidateText = rawText || extractJsonObject(JSON.stringify(data));

  if (!candidateText) {
    throw new Error('Gemini resume draft returned empty content.');
  }

  try {
    return sanitizeDraft(JSON.parse(candidateText), safeFileName);
  } catch (error) {
    const extracted = extractJsonObject(candidateText);

    if (extracted) {
      return sanitizeDraft(JSON.parse(extracted), safeFileName);
    }

    return fallbackDraft;
  }
}

module.exports = {
  generateOptimizedResumeDraft
};
