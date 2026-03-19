const path = require('path');
const os = require('os');

module.exports = {
  // Server
  PORT: 7891,

  // Claude Code session data
  CLAUDE_DIR: path.join(os.homedir(), '.claude'),
  POLL_INTERVAL_MS: 2000,
  SESSION_STALE_MINUTES: 30,
  THINKING_THRESHOLD_MS: 120000, // 2 minutes before "thinking" triggers amber

  // UI
  MAX_SESSION_DOTS: 5,
  ROTATION_INTERVAL_MS: 5000,

  // Rate limit estimation (Max 5x plan)
  RATE_LIMIT_WINDOW_MINUTES: 60,
  RATE_LIMIT_CEILING_TOKENS: 25000000, // Max 5x plan — tune based on observed throttling

  // FPS source — LibreHardwareMonitor web server
  LHM_URL: 'http://localhost:8085/data.json',
};
