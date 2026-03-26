const { normalizeText } = require('./atsScorer');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

async function generateAiAtsInsights({ resumeText, jobDescription, score, matchedKeywords, missingKeywords }) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const trimmedResume = normalizeText(resumeText).slice(0, 12000);
  const trimmedJobDescription = normalizeText(jobDescription).slice(0, 8000);

  const prompt = `
You are helping build a Telegram bot for ATS resume analysis.

Return valid JSON only with this exact shape:
{
  "fitBand": "Low Match | Moderate Match | Strong Match",
  "resumeSummary": "short summary",
  "strengths": ["..."],
  "keywordSuggestions": ["..."],
  "improvementTips": ["..."],
  "rewrittenBullets": ["..."],
  "interviewQuestions": ["..."]
}

Rules:
- Keep each array between 3 and 5 items.
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
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
          maxOutputTokens: 1200,
          responseMimeType: 'application/json'
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

  if (!rawText) {
    throw new Error('Gemini API returned an empty response.');
  }

  return JSON.parse(rawText);
}

module.exports = {
  generateAiAtsInsights
};
