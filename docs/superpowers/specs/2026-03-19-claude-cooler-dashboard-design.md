# Claude Cooler Dashboard — Design Spec

## Overview

A real-time dashboard displayed on a 480x480 circular CPU cooler screen (Corsair iCUE Elite LCD / AicUsbDisplay) that monitors Claude Code session activity, rate limit usage, token consumption, and main monitor FPS.

## Target Hardware

- **Display**: 480x480px circular LCD, USB-connected (AicUsbDisplay)
- **Safe content zone**: ~340px diameter inscribed circle — all text and data must sit within this boundary
- **Ring gauges**: can extend to full 480px since partial arc clipping still reads correctly on a circular screen

## Architecture

Three components, all local, no external APIs or databases.

### 1. Backend (Node.js)

- **Session watcher**: polls `~/.claude/projects/` for active Claude Code session directories
  - Reads session metadata to determine status: active, thinking, idle, errored
  - Extracts token usage from session logs
  - Derives project/session name from directory structure
- **Rate limit estimator**: tracks token consumption over a rolling time window against known Max 5x plan ceilings. Provides a percentage estimate of remaining capacity
- **FPS collector**: reads main monitor framerate from LibreHardwareMonitor (background service). Fallback: `nvidia-smi` for NVIDIA GPUs
- **WebSocket server**: pushes updates to the frontend every ~2 seconds

### 2. Frontend (480x480 Web Page)

A single HTML page served by the backend at `localhost:<port>`. Renders the circular dashboard UI. Receives all data via WebSocket.

### 3. Launch Script (PowerShell)

Opens Chrome in kiosk mode on the cooler display:
- Detects the 480x480 display by resolution
- Calculates window position based on display arrangement
- Launches: `chrome --kiosk --window-position=X,Y --window-size=480,480 http://localhost:<port>`
- Can be added to Windows startup for always-on operation

## UI Layout

Circular design optimised for the round screen. All elements inside the safe zone.

### Concentric Rings

- **Outer ring (green)**: rate limit remaining — depletes as tokens are consumed, refills as the rolling window advances
- **Inner ring (amber)**: token usage for the current/most active session — fills as tokens accumulate

Both rings start from 12 o'clock and sweep clockwise. Stroke-linecap rounded.

### Center Content

Stacked vertically, centered:
1. **Session name** — small uppercase label (e.g. "PPM TOOL")
2. **Status** — large bold text: ACTIVE, THINKING, IDLE, ERROR
3. **Current task** — smaller text, e.g. "Editing server.ts"
4. **Duration** — time elapsed in session, e.g. "24m elapsed"

### Stats Row

Positioned above the bottom curve of the circle (inside safe zone). Three values in a horizontal row:
- **Rate %** (green, matching outer ring) — e.g. "72%"
- **Token count** (amber, matching inner ring) — e.g. "12.4k"
- **FPS** (neutral grey) — e.g. "142"

Each has a small grey label underneath: "rate", "tokens", "FPS". Colour coding matches the rings, making a legend unnecessary.

### Session Dots

Top of the circle, horizontally centered. One dot per active Claude Code session:
- **Green** with glow: active
- **Blue** with glow: thinking/processing
- **Grey**: idle

The currently displayed session's dot pulses subtly.

### Auto-Rotation

When multiple sessions are active, the center content rotates between them on a ~5 second interval. Single-session mode shows just that session with no rotation.

## Visual States

The dashboard shifts its entire colour palette based on overall health:

| State | Trigger | Effect |
|---|---|---|
| **Green (healthy)** | Sessions active, rate limit > 30% | Green rings, green status text |
| **Amber (warning)** | Rate limit < 30%, or a session thinking > 2 minutes | Outer ring shifts amber, status text amber |
| **Red (critical)** | Rate limited, or all sessions errored | Rings red, status text red, subtle pulse |
| **Grey (idle)** | No active sessions | Muted grey rings, dim center text |

Transitions between states are smooth (CSS transitions, ~500ms).

## Data Flow

```
~/.claude/projects/*  ──→  Session Watcher  ──→  WebSocket  ──→  Frontend
                                                     ↑
LibreHardwareMonitor  ──→  FPS Collector  ───────────┘
                                                     ↑
Token consumption log ──→  Rate Estimator ───────────┘
```

## Technology

- **Backend**: Node.js, `ws` (WebSocket), `chokidar` (file watching)
- **Frontend**: Vanilla HTML/CSS/JS — no framework needed for a single 480x480 page
- **FPS source**: LibreHardwareMonitor REST API or `nvidia-smi` CLI
- **Launch**: PowerShell script

## Rate Limit Estimation

Since Anthropic doesn't expose a remaining-quota endpoint for consumer Max plans:

1. Track all token consumption (input + output) with timestamps
2. Maintain a rolling window matching the known rate limit reset period
3. Compare accumulated usage against Max 5x ceiling
4. Express as percentage remaining

This is an estimate, not exact. The ring should be treated as directional ("am I close to the wall?") rather than precise.

## Session Detection Heuristics

Claude Code sessions will be detected by:
1. Scanning `~/.claude/projects/` for session directories
2. Checking for recent file modification timestamps (active vs stale)
3. Reading session log files for status indicators (tool calls in progress, waiting for input, etc.)
4. Deriving session name from the project directory path

Exact file formats and paths will be determined during implementation by inspecting the actual Claude Code session file structure.

## Non-Goals

- No API cost tracking (user is on Max plan, not API)
- No historical charts or graphs (screen too small, real-time only)
- No touch interaction (cooler screen is display-only)
- No remote access (localhost only)
- No Corsair iCUE integration (we bypass it entirely with a browser window)
