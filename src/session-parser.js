const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Parse a session JSONL file and extract state.
 * Returns { sessionId, status, task, inputTokens, outputTokens,
 *           lastUserTime, lastAssistantTime, firstTimestamp, durationMinutes }
 */
function parseSessionFile(filePath) {
  let data;
  try {
    data = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = data.trim().split('\n');
  let sessionId = null;
  let firstTimestamp = null;
  let lastUserTime = null;
  let lastAssistantTime = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let lastTask = null;
  let lastToolName = null;
  let contextTokens = 0;
  let cwd = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (!sessionId && event.sessionId) sessionId = event.sessionId;
    if (!firstTimestamp && event.timestamp) firstTimestamp = event.timestamp;
    if (!cwd && event.cwd) cwd = event.cwd;

    if (event.type === 'user') {
      lastUserTime = event.timestamp;
    }

    if (event.type === 'assistant' && event.message) {
      lastAssistantTime = event.timestamp;

      // Accumulate token usage
      const usage = event.message.usage;
      if (usage) {
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;
        // Context window = input + cache_creation + cache_read (total prompt tokens)
        const ctx = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
        if (ctx > 0) contextTokens = ctx;
      }

      // Extract current task from last tool_use in content
      const content = event.message.content;
      if (Array.isArray(content)) {
        for (let i = content.length - 1; i >= 0; i--) {
          if (content[i].type === 'tool_use') {
            lastTask = formatToolUse(content[i]);
            lastToolName = content[i].name || null;
            break;
          }
          if (content[i].type === 'text' && content[i].text && !lastTask) {
            lastTask = truncate(content[i].text, 30);
          }
        }
      }
    }
  }

  if (!sessionId) return null;

  const now = Date.now();
  const firstMs = firstTimestamp ? new Date(firstTimestamp).getTime() : now;
  const lastUserMs = lastUserTime ? new Date(lastUserTime).getTime() : 0;
  const lastAssistantMs = lastAssistantTime ? new Date(lastAssistantTime).getTime() : 0;

  // Status derivation
  let status;
  const isActiveToolRunning = lastToolName === 'Agent' || lastToolName === 'Bash' || lastToolName === 'mcp__Claude_Preview__preview_start';
  if (lastUserMs > lastAssistantMs) {
    // User sent a message, Claude hasn't responded yet — Claude is working
    status = 'THINKING';
  } else if (isActiveToolRunning && (now - lastAssistantMs) < config.SESSION_STALE_MINUTES * 60 * 1000) {
    // Last tool is still likely running (Agent, Bash, etc.) — not actually waiting
    status = 'THINKING';
  } else if (lastAssistantMs > lastUserMs && (now - lastAssistantMs) < config.SESSION_STALE_MINUTES * 60 * 1000) {
    // Claude responded last — waiting for user input
    status = 'WAITING';
  } else {
    status = 'IDLE';
  }

  return {
    sessionId,
    status,
    task: lastTask || 'Waiting...',
    inputTokens,
    outputTokens,
    lastUserTime: lastUserMs,
    lastAssistantTime: lastAssistantMs,
    lastActivity: Math.max(lastUserMs, lastAssistantMs),
    hasActiveSubagents: status === 'THINKING' && lastToolName === 'Agent',
    contextTokens,
    firstTimestamp: firstMs,
    durationMinutes: Math.round((now - firstMs) / 60000),
  };
}

/**
 * Format a tool_use content block into a readable task string.
 */
function formatToolUse(block) {
  const tool = block.name || 'Working';
  const input = block.input || {};

  if (tool === 'Edit' || tool === 'Read' || tool === 'Write') {
    const fp = input.file_path || input.path || '';
    const filename = fp ? path.basename(fp) : '';
    const verb = tool === 'Edit' ? 'Editing' : tool === 'Read' ? 'Reading' : 'Writing';
    return filename ? `${verb} ${filename}` : verb;
  }
  if (tool === 'Bash') {
    const cmd = input.command || '';
    return 'Running ' + truncate(cmd, 20);
  }
  if (tool === 'Grep' || tool === 'Glob') {
    return 'Searching files';
  }
  if (tool === 'Agent') {
    return 'Running subagent';
  }
  if (tool === 'TodoWrite') {
    return 'Updating tasks';
  }
  if (tool === 'LSP') {
    return 'Analyzing code';
  }
  // MCP tools: mcp__server__tool_name → clean up
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__');
    const toolName = parts[parts.length - 1] || tool;
    return truncate(toolName.replace(/_/g, ' '), 25);
  }
  return truncate(tool, 25);
}

function truncate(str, max) {
  str = str.replace(/\s+/g, ' ').trim();
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/**
 * Extract session name from a project directory name.
 * e.g. "C--Users-User-Documents-Projects-PPA" → "PPA"
 */
function extractSessionName(dirName) {
  const parts = dirName.replace(/^[A-Za-z]--/, '').split('-');
  // Take last non-empty segment(s) that form a meaningful name
  // Walk backwards past common path segments
  const skip = new Set(['users', 'user', 'documents', 'projects', 'home', 'src', 'code']);
  const meaningful = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].toLowerCase();
    if (skip.has(p)) break;
    meaningful.unshift(parts[i]);
  }
  return meaningful.join(' ').toUpperCase() || dirName.toUpperCase();
}

/**
 * Scan a session directory for subagent JSONL files and sum their tokens.
 */
function getSubagentTokens(sessionDir, sessionId) {
  const subDir = path.join(sessionDir, sessionId, 'subagents');
  let input = 0, output = 0;
  try {
    const files = fs.readdirSync(subDir).filter(f => f.endsWith('.jsonl'));
    for (const f of files) {
      const parsed = parseSessionFile(path.join(subDir, f));
      if (parsed) {
        input += parsed.inputTokens;
        output += parsed.outputTokens;
      }
    }
  } catch {
    // No subagents directory — fine
  }
  return { input, output };
}

module.exports = { parseSessionFile, extractSessionName, getSubagentTokens };
