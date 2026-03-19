const config = require('../config');

class RateEstimator {
  constructor() {
    this.entries = []; // { timestamp, tokens }
    this._lastTotalTokens = 0;
  }

  /**
   * Record current total tokens across all sessions.
   * Call this on each poll cycle with the sum of all session tokens.
   */
  recordUsage(totalTokens) {
    const delta = totalTokens - this._lastTotalTokens;
    if (delta > 0) {
      this.entries.push({ timestamp: Date.now(), tokens: delta });
    }
    this._lastTotalTokens = totalTokens;
    this._prune();
  }

  /**
   * Get estimated rate limit remaining as { remaining: 0-1, known: boolean }
   */
  getEstimate() {
    this._prune();

    if (this.entries.length < 3) {
      return { remaining: 1, known: false };
    }

    const totalUsed = this.entries.reduce((sum, e) => sum + e.tokens, 0);
    const fraction = totalUsed / config.RATE_LIMIT_CEILING_TOKENS;
    const remaining = Math.max(0, Math.min(1, 1 - fraction));

    return { remaining, known: true };
  }

  _prune() {
    const cutoff = Date.now() - config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    this.entries = this.entries.filter(e => e.timestamp > cutoff);
  }
}

module.exports = RateEstimator;
