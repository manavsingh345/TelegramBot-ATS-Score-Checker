const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'has', 'have', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'that', 'the',
  'their', 'this', 'to', 'was', 'were', 'will', 'with', 'you', 'your',
  'our', 'we', 'they', 'them', 'he', 'she', 'his', 'her', 'than', 'then',
  'not', 'job', 'role', 'work', 'working', 'candidate', 'experience',
  'years', 'year', 'using', 'should', 'must', 'can', 'able', 'good'
]);

const IMPORTANT_PHRASES = [
  'full stack',
  'front end',
  'frontend',
  'back end',
  'backend',
  'node js',
  'nodejs',
  'react js',
  'reactjs',
  'rest api',
  'mongodb',
  'sql',
  'aws',
  'docker',
  'kubernetes',
  'microservices',
  'javascript',
  'typescript',
  'python',
  'java',
  'machine learning',
  'data analysis',
  'problem solving',
  'system design'
];

function normalizeText(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text = '') {
  return normalizeText(text)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function getTopKeywords(text, limit = 25) {
  const frequency = new Map();
  const normalized = normalizeText(text);

  tokenize(text).forEach((word) => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });

  IMPORTANT_PHRASES.forEach((phrase) => {
    if (normalized.includes(phrase)) {
      frequency.set(phrase, (frequency.get(phrase) || 0) + 3);
    }
  });

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function scoreResumeAgainstJob({ resumeText, jobDescription }) {
  const normalizedResume = normalizeText(resumeText);
  const resumeTokens = new Set(tokenize(resumeText));
  const keywords = getTopKeywords(jobDescription);

  if (keywords.length === 0) {
    return {
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ['Add a clearer job description to generate ATS feedback.']
    };
  }

  const matchedKeywords = keywords.filter((keyword) => {
    if (keyword.includes(' ')) {
      return normalizedResume.includes(keyword);
    }

    return resumeTokens.has(keyword);
  });

  const missingKeywords = keywords.filter((keyword) => !matchedKeywords.includes(keyword));
  const rawScore = Math.round((matchedKeywords.length / keywords.length) * 100);
  const bonus = matchedKeywords.some((keyword) => keyword.includes(' ')) ? 5 : 0;
  const score = Math.min(100, Math.max(15, rawScore + bonus));

  const suggestions = [
    missingKeywords.length
      ? `Add these missing keywords where truthful: ${missingKeywords.slice(0, 8).join(', ')}.`
      : 'Keyword coverage looks strong for this job description.',
    'Align your skills, projects, and experience bullets with the job description wording.',
    'Use measurable outcomes in project and work experience bullets.'
  ];

  return {
    score,
    matchedKeywords,
    missingKeywords,
    suggestions
  };
}

module.exports = {
  normalizeText,
  scoreResumeAgainstJob
};
