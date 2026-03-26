function getFitBandFromScore(score) {
  if (score >= 75) {
    return 'Strong Match';
  }

  if (score >= 45) {
    return 'Moderate Match';
  }

  return 'Low Match';
}

function formatDuration(ms) {
  const seconds = ms / 1000;

  if (seconds < 1) {
    return `${ms} ms`;
  }

  return `${seconds.toFixed(1)} sec`;
}

module.exports = {
  getFitBandFromScore,
  formatDuration
};
