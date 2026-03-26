const mongoose = require('mongoose');

const atsAnalysisSchema = new mongoose.Schema({
  chat_id: {
    type: String,
    required: true
  },
  username: {
    type: String,
    default: ''
  },
  file_name: {
    type: String,
    required: true
  },
  job_description: {
    type: String,
    required: true
  },
  ats_score: {
    type: Number,
    required: true
  },
  fit_band: {
    type: String,
    default: ''
  },
  matched_keywords: {
    type: [String],
    default: []
  },
  missing_keywords: {
    type: [String],
    default: []
  },
  suggestions: {
    type: [String],
    default: []
  },
  resume_summary: {
    type: String,
    default: ''
  },
  strengths: {
    type: [String],
    default: []
  },
  interview_questions: {
    type: [String],
    default: []
  },
  ai_enabled: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AtsAnalysis', atsAnalysisSchema);
