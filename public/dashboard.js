(function () {
  'use strict';

  const OUTER_CIRCUMFERENCE = 2 * Math.PI * 220;
  const INNER_CIRCUMFERENCE = 2 * Math.PI * 194;
  const WS_URL = 'ws://' + location.host;
  const RECONNECT_MS = 3000;
  const MAX_DOTS = 5;

  const $ = (sel) => document.querySelector(sel);
  const dashboard = $('#dashboard');
  const ringOuter = $('#ringOuter');
  const ringInner = $('#ringInner');
  const connectionState = $('#connectionState');
  const connectionLabel = connectionState.querySelector('.label');

  let ws = null;

  // ── WebSocket ──

  function connect() {
    showConnection('connecting');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      hideConnection();
    };

    ws.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        render(state);
      } catch { /* ignore bad messages */ }
    };

    ws.onclose = () => {
      showConnection('offline');
      setTimeout(connect, RECONNECT_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function showConnection(type) {
    connectionState.classList.add('visible');
    $('#centerContent').style.display = 'none';
    $('#statsRow').style.display = 'none';

    if (type === 'connecting') {
      connectionLabel.textContent = 'CONNECTING...';
      connectionLabel.className = 'label connecting';
    } else {
      connectionLabel.textContent = 'OFFLINE';
      connectionLabel.className = 'label error';
    }
  }

  function hideConnection() {
    connectionState.classList.remove('visible');
    $('#centerContent').style.display = '';
    $('#statsRow').style.display = '';
  }

  // ── Rendering ──

  function render(state) {
    // Health state
    dashboard.className = 'dashboard health-' + (state.health || 'grey');

    const session = state.currentSession;

    if (!session) {
      $('#sessionName').textContent = '';
      $('#statusText').textContent = 'NO SESSIONS';
      $('#currentTask').textContent = '';
      $('#duration').textContent = '';
      setRing(ringOuter, OUTER_CIRCUMFERENCE, 0);
      setRing(ringInner, INNER_CIRCUMFERENCE, 0);
      $('#statSession').textContent = '--';
      $('#statAll').textContent = '--';
    } else {
      $('#sessionName').textContent = session.name || '';
      $('#statusText').textContent = session.status || 'IDLE';
      $('#currentTask').textContent = session.task || 'Waiting...';
      $('#duration').textContent = formatDuration(session.durationMinutes || 0) + ' elapsed';

      // Current session tokens — inner ring
      const sessionTok = (session.inputTokens || 0) + (session.outputTokens || 0);
      const sessionFraction = Math.min(1, sessionTok / 1000000);
      setRing(ringInner, INNER_CIRCUMFERENCE, sessionFraction);
      $('#statSession').textContent = formatTokens(sessionTok);

      // All sessions tokens — outer ring
      const allTok = state.totalTokens || 0;
      const allFraction = Math.min(1, allTok / 5000000); // 5M visual ceiling for all sessions
      setRing(ringOuter, OUTER_CIRCUMFERENCE, allFraction);
      ringOuter.classList.remove('unknown');
      $('#statAll').textContent = formatTokens(allTok);
    }

    // GPU
    $('#statGpu').textContent = state.gpu != null ? state.gpu + '%' : '--';

    // Session dots
    renderDots(state.sessions || [], state.currentSessionIndex || 0);
  }

  function setRing(el, circumference, fraction) {
    const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
    el.style.strokeDashoffset = offset;
  }

  function renderDots(sessions, currentIndex) {
    const container = $('#sessionDots');
    container.innerHTML = '';

    const visible = sessions.slice(0, MAX_DOTS);
    visible.forEach((s, i) => {
      const dot = document.createElement('div');
      dot.className = 'session-dot ' + (s.status || 'idle').toLowerCase();
      if (i === currentIndex) dot.classList.add('current');
      container.appendChild(dot);
    });

    if (sessions.length > MAX_DOTS) {
      const overflow = document.createElement('span');
      overflow.className = 'overflow';
      overflow.textContent = '+' + (sessions.length - MAX_DOTS);
      container.appendChild(overflow);
    }
  }

  function formatTokens(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(1) + 'k';
    return (n / 1000000).toFixed(1) + 'M';
  }

  function formatDuration(minutes) {
    if (minutes < 60) return Math.round(minutes) + 'm';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
  }

  // ── Start ──
  connect();
})();
