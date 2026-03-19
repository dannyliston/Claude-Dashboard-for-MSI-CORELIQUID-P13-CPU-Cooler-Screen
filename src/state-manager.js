const config = require('../config');

class StateManager {
  constructor(sessionWatcher, rateEstimator, fpsCollector) {
    this.sessionWatcher = sessionWatcher;
    this.rateEstimator = rateEstimator;
    this.fpsCollector = fpsCollector;
    this.currentSessionIndex = 0;
    this._rotationTimer = null;
  }

  startRotation() {
    this._rotationTimer = setInterval(() => {
      const sessions = this.sessionWatcher.getSessions();
      if (sessions.length <= 1) { this.currentSessionIndex = 0; return; }

      // Round-robin, prefer non-idle
      const nonIdle = sessions.filter(s => s.status !== 'IDLE');
      const pool = nonIdle.length > 0 ? nonIdle : sessions;

      this.currentSessionIndex = (this.currentSessionIndex + 1) % pool.length;
    }, config.ROTATION_INTERVAL_MS);
  }

  stop() {
    if (this._rotationTimer) clearInterval(this._rotationTimer);
  }

  getState() {
    const sessions = this.sessionWatcher.getSessions();

    const totalTokens = sessions.reduce((sum, s) => sum + s.inputTokens + s.outputTokens, 0);
    const gpu = this.fpsCollector.getFps();
    const health = this._deriveHealth(sessions);

    // Current session for center display
    const idx = Math.min(this.currentSessionIndex, sessions.length - 1);
    const currentSession = sessions[idx] || null;

    return {
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        hasActiveSubagents: s.hasActiveSubagents || false,
      })),
      currentSession: currentSession ? {
        name: currentSession.name,
        status: currentSession.status,
        task: currentSession.task,
        durationMinutes: currentSession.durationMinutes,
        inputTokens: currentSession.inputTokens,
        outputTokens: currentSession.outputTokens,
        hasActiveSubagents: currentSession.hasActiveSubagents || false,
        contextTokens: currentSession.contextTokens || 0,
      } : null,
      currentSessionIndex: idx >= 0 ? idx : 0,
      totalTokens,
      rateEstimate: this.rateEstimator.getEstimate(),
      health,
      gpu,
    };
  }

  _deriveHealth(sessions) {
    if (sessions.length === 0) return 'grey';

    const allIdle = sessions.every(s => s.status === 'IDLE');
    if (allIdle) return 'grey';

    const anyError = sessions.some(s => s.status === 'ERROR');
    if (anyError) return 'red';

    const longThinking = sessions.some(s => {
      if (s.status !== 'THINKING') return false;
      const thinkingMs = Date.now() - s.lastActivity;
      return thinkingMs >= config.THINKING_THRESHOLD_MS;
    });
    if (longThinking) return 'amber';

    // Purple: subagents actively running
    const anySubagents = sessions.some(s => s.hasActiveSubagents);
    if (anySubagents) return 'purple';

    // Green: Claude is actively thinking/responding
    const anyThinking = sessions.some(s => s.status === 'THINKING');
    if (anyThinking) return 'green';

    // Blue: waiting for user input (passive, calm)
    const anyWaiting = sessions.some(s => s.status === 'WAITING');
    if (anyWaiting) return 'blue';

    return 'green';
  }
}

module.exports = StateManager;
