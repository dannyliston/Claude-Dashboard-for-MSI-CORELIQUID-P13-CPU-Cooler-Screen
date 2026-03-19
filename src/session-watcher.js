const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const config = require('../config');
const { parseSessionFile, extractSessionName, getSubagentTokens } = require('./session-parser');

class SessionWatcher {
  constructor() {
    this.sessions = new Map(); // sessionId → session state
    this.projectsDir = path.join(config.CLAUDE_DIR, 'projects');
    this.watcher = null;
  }

  start() {
    // Initial scan
    this._scanAll();

    // Watch for changes
    this.watcher = chokidar.watch(path.join(this.projectsDir, '**/*.jsonl'), {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 200 },
    });

    this.watcher.on('add', (fp) => this._processFile(fp));
    this.watcher.on('change', (fp) => this._processFile(fp));

    // Periodic full rescan to catch stale sessions
    setInterval(() => this._scanAll(), config.POLL_INTERVAL_MS);
  }

  stop() {
    if (this.watcher) this.watcher.close();
  }

  getSessions() {
    // Return sessions sorted by most recent activity
    return [...this.sessions.values()]
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }

  _scanAll() {
    try {
      const projectDirs = fs.readdirSync(this.projectsDir);
      for (const dir of projectDirs) {
        const fullDir = path.join(this.projectsDir, dir);
        let stat;
        try { stat = fs.statSync(fullDir); } catch { continue; }
        if (!stat.isDirectory()) continue;

        const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.jsonl'));
        for (const f of files) {
          this._processFile(path.join(fullDir, f), dir);
        }
      }
    } catch {
      // projects dir may not exist yet
    }

    // Prune stale sessions
    const now = Date.now();
    const staleMs = config.SESSION_STALE_MINUTES * 60 * 1000;
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > staleMs * 2) {
        this.sessions.delete(id);
      }
    }
  }

  _processFile(filePath, dirName) {
    // Skip subagent files for top-level session list
    if (filePath.includes('subagents')) return;

    if (!dirName) {
      // Extract project dir name from path
      const rel = path.relative(this.projectsDir, filePath);
      dirName = rel.split(path.sep)[0];
    }

    const parsed = parseSessionFile(filePath);
    if (!parsed) return;

    // Add subagent tokens
    const parentDir = path.dirname(filePath);
    const sub = getSubagentTokens(parentDir, parsed.sessionId);
    parsed.inputTokens += sub.input;
    parsed.outputTokens += sub.output;

    // Derive name from project directory
    const name = extractSessionName(dirName);

    this.sessions.set(parsed.sessionId, {
      id: parsed.sessionId,
      name,
      status: parsed.status,
      task: parsed.task,
      durationMinutes: parsed.durationMinutes,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      lastActivity: parsed.lastActivity,
    });
  }
}

module.exports = SessionWatcher;
