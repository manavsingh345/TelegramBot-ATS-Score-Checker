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
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AtsAnalysis', atsAnalysisSchema);
