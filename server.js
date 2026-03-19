const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const SessionWatcher = require('./src/session-watcher');
const RateEstimator = require('./src/rate-estimator');
const FpsCollector = require('./src/fps-collector');
const StateManager = require('./src/state-manager');

const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

// HTTP server for static files
const server = http.createServer((req, res) => {
  const filePath = path.join(PUBLIC, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// WebSocket server on same port
const wss = new WebSocketServer({ server });

// Components
const sessionWatcher = new SessionWatcher();
const rateEstimator = new RateEstimator();
const fpsCollector = new FpsCollector();
const stateManager = new StateManager(sessionWatcher, rateEstimator, fpsCollector);

// Start watching sessions
sessionWatcher.start();
stateManager.startRotation();

// Broadcast state to all connected clients
setInterval(() => {
  // Feed rate estimator before getting state
  const sessions = sessionWatcher.getSessions();
  const totalTokens = sessions.reduce((sum, s) => sum + s.inputTokens + s.outputTokens, 0);
  rateEstimator.recordUsage(totalTokens);

  const state = stateManager.getState();
  const payload = JSON.stringify(state);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}, config.POLL_INTERVAL_MS);

// Poll GPU utilization every 10 seconds (nvidia-smi is expensive to spawn)
setInterval(() => fpsCollector.poll(), 10000);

// Start
const port = process.env.PORT || config.PORT;
server.listen(port, () => {
  console.log(`Claude Dashboard running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  sessionWatcher.stop();
  stateManager.stop();
  wss.close();
  server.close();
  process.exit(0);
});
