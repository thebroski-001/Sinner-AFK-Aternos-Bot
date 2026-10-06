"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");
const https = require("https");

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: [],
  wasThrottled: false,
};

// Health check endpoint for monitoring
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          :root {
            color-scheme: light;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f3f7f1;
            color: #193326;
            font-synthesis: none;
            text-rendering: optimizeLegibility;
          }

          body {
            margin: 0;
            min-width: 320px;
            min-height: 100vh;
            padding: 48px 24px;
            background:
              radial-gradient(ellipse at 8% 0%, rgba(207, 231, 203, .55), transparent 36rem),
              #f3f7f1;
          }

          button, a { font: inherit; }
          .dashboard { width: min(100%, 760px); margin: 0 auto; }
          .dashboard-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 28px;
          }
          .eyebrow {
            margin: 0 0 8px;
            color: #668071;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: .14em;
            text-transform: uppercase;
          }
          h1 { margin: 0; color: #193326; font-size: clamp(27px, 5vw, 36px); line-height: 1.12; letter-spacing: -.04em; }
          .subtitle { margin: 9px 0 0; color: #708276; font-size: 14px; line-height: 1.5; }
          .live-badge {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            flex: 0 0 auto;
            margin-top: 8px;
            padding: 9px 13px;
            border: 1px solid #d8e5d8;
            border-radius: 999px;
            background: rgba(255, 255, 255, .75);
            color: #68796d;
            font-size: 12px;
            font-weight: 700;
          }
          .live-badge::before { width: 8px; height: 8px; border-radius: 50%; background: #a1afa3; content: ""; }
          .live-badge.online { border-color: #bce2c2; background: #edf8ee; color: #24713b; }
          .live-badge.online::before { background: #35a853; box-shadow: 0 0 0 3px #d6efda; }
          .live-badge.offline { border-color: #f0ceca; background: #fff4f2; color: #a4433b; }
          .live-badge.offline::before { background: #d95d51; box-shadow: 0 0 0 3px #fce0dc; }

          .status-card {
            display: flex;
            align-items: center;
            gap: 17px;
            min-height: 126px;
            padding: 25px 28px;
            border: 1px solid #dce8dc;
            border-radius: 20px;
            background: rgba(255, 255, 255, .88);
            box-shadow: 0 14px 34px rgba(38, 77, 48, .06);
            transition: border-color .2s ease, background .2s ease;
          }
          .status-card.online { border-color: #c4e5c9; background: linear-gradient(110deg, #f6fcf5, #fff 65%); }
          .status-card.offline { border-color: #edd6d2; }
          .status-icon {
            display: grid;
            width: 54px;
            height: 54px;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 17px;
            background: #eef2ed;
            color: #78887b;
            font-size: 25px;
            font-weight: 700;
          }
          .status-icon.online { background: #e1f4e4; color: #278344; }
          .status-icon.offline { background: #fff0ed; color: #c14f45; }
          .status-label { margin: 0; color: #233c2d; font-size: 21px; font-weight: 750; letter-spacing: -.02em; }
          .status-detail { margin: 5px 0 0; color: #718176; font-size: 13px; }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 13px;
            margin: 16px 0;
          }
          .stat-card {
            min-width: 0;
            padding: 19px 20px;
            border: 1px solid #e0e9df;
            border-radius: 16px;
            background: rgba(255, 255, 255, .82);
          }
          .stat-label { margin: 0 0 11px; color: #748579; font-size: 12px; font-weight: 650; }
          .stat-value { margin: 0; overflow-wrap: anywhere; color: #203a2b; font-size: clamp(17px, 2.6vw, 21px); font-weight: 720; line-height: 1.3; letter-spacing: -.025em; }
          #coords-text { font-variant-numeric: tabular-nums; }
          .stat-detail { margin: 6px 0 0; color: #93a095; font-size: 11px; line-height: 1.45; }

          .controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 21px;
          }
          .btn-primary {
            min-height: 54px;
            border: 1px solid transparent;
            border-radius: 13px;
            color: white;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
            transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
          }
          .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(24, 54, 34, .13); }
          .btn-primary:active:not(:disabled) { transform: translateY(0); }
          .btn-primary:focus-visible, .text-link:focus-visible { outline: 3px solid #80bd8d; outline-offset: 3px; }
          .btn-primary:disabled { cursor: wait; opacity: .62; }
          .btn-start { background: #2d914d; }
          .btn-stop { background: #cf5146; }
          .action-feedback { grid-column: 1 / -1; min-height: 18px; margin: 0; color: #688071; text-align: center; font-size: 12px; }
          .action-feedback.error { color: #b4453d; }
          .page-footer {
            display: flex;
            justify-content: center;
            gap: 19px;
            margin-top: 12px;
          }
          .text-link { color: #688071; font-size: 12px; font-weight: 650; text-decoration: none; }
          .text-link:hover { color: #287544; text-decoration: underline; }
          .refresh-note { margin: 20px 0 0; color: #9aa79b; font-size: 11px; text-align: center; }

          @media (max-width: 600px) {
            body { padding: 32px 17px; }
            .dashboard-header { margin-bottom: 21px; }
            .live-badge { gap: 7px; padding: 8px 10px; font-size: 11px; }
            .status-card { min-height: 112px; padding: 21px 19px; border-radius: 17px; }
            .status-icon { width: 48px; height: 48px; border-radius: 15px; }
            .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
            .stat-card { padding: 16px; border-radius: 14px; }
            .stat-card:last-child { grid-column: 1 / -1; }
            .controls { gap: 9px; }
            .btn-primary { min-height: 51px; border-radius: 12px; font-size: 13px; }
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
          }
        </style>
      </head>
      <body>
        <main class="dashboard" aria-label="Bot dashboard">
          <header class="dashboard-header">
            <div>
              <p class="eyebrow">Bot dashboard</p>
              <h1>${config.name}</h1>
              <p class="subtitle">Minecraft server · Live connection status</p>
            </div>
            <div id="live-badge" class="live-badge offline" aria-live="polite">Offline</div>
          </header>

          <section id="status-section" class="status-card offline" aria-label="Bot connection status">
            <div id="status-icon" class="status-icon offline" aria-hidden="true">—</div>
            <div>
              <h2 id="status-label" class="status-label">Connecting…</h2>
              <p id="status-detail" class="status-detail">Checking the bot connection</p>
            </div>
          </section>

          <section class="stats-grid" aria-label="Bot details">
            <article class="stat-card">
              <p class="stat-label">Uptime</p>
              <p id="uptime-text" class="stat-value" aria-live="polite">—</p>
              <p class="stat-detail">Time since this bot process started</p>
            </article>
            <article class="stat-card">
              <p class="stat-label">Coordinates</p>
              <p id="coords-text" class="stat-value" aria-live="polite">Waiting for spawn</p>
              <p class="stat-detail">Current in-game position</p>
            </article>
            <article class="stat-card">
              <p class="stat-label">Server</p>
              <p class="stat-value">${config.server.ip}</p>
              <p class="stat-detail">Minecraft server address</p>
            </article>
          </section>

          <section class="controls" aria-label="Bot controls">
            <button id="start-button" class="btn-primary btn-start" onclick="controlBot('start')" aria-label="Start bot">Start bot</button>
            <button id="stop-button" class="btn-primary btn-stop" onclick="controlBot('stop')" aria-label="Stop bot">Stop bot</button>
            <p id="action-feedback" class="action-feedback" role="status" aria-live="polite"></p>
          </section>

          <footer class="page-footer">
            <a href="/tutorial" class="text-link">Setup guide</a>
            <a href="/logs" class="text-link">View logs</a>
          </footer>
          <p class="refresh-note">Status refreshes automatically every 5 seconds</p>
        </main>

        <script>
          function formatUptime(s) {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
            if (m > 0) return m + 'm ' + sec + 's';
            return sec + ' seconds';
          }

          async function update() {
            try {
              const r = await fetch('/health');
              if (!r.ok) throw new Error('Status request failed');
              const data = await r.json();
              const online = data.status === 'connected';

              const section = document.getElementById('status-section');
              const icon    = document.getElementById('status-icon');
              const label   = document.getElementById('status-label');
              const detail  = document.getElementById('status-detail');
              const badge   = document.getElementById('live-badge');

              section.className = 'status-card ' + (online ? 'online' : 'offline');
              icon.className    = 'status-icon '    + (online ? 'online' : 'offline');
              icon.textContent  = online ? '✓' : '✗';
              label.textContent = online ? 'Bot is online' : 'Bot is offline';
              detail.textContent = online ? 'Connected and active on the server' : 'Not currently connected to the server';
              badge.className = 'live-badge ' + (online ? 'online' : 'offline');
              badge.textContent = online ? 'Online' : 'Offline';

              document.getElementById('uptime-text').textContent = formatUptime(data.uptime);

              if (data.coords) {
                const x = Math.floor(data.coords.x);
                const y = Math.floor(data.coords.y);
                const z = Math.floor(data.coords.z);
                document.getElementById('coords-text').textContent = 'X ' + x + ' · Y ' + y + ' · Z ' + z;
              } else {
                document.getElementById('coords-text').textContent = 'Waiting for spawn';
              }
            } catch (e) {
              const label = document.getElementById('status-label');
              label.textContent = 'Status unavailable';
              document.getElementById('status-detail').textContent = 'Could not reach the bot status service';
              document.getElementById('status-section').className = 'status-card offline';
              document.getElementById('status-icon').className = 'status-icon offline';
              document.getElementById('status-icon').textContent = '!';
              document.getElementById('live-badge').className = 'live-badge offline';
              document.getElementById('live-badge').textContent = 'Unavailable';
            }
          }

          async function controlBot(action) {
            const buttons = [
              document.getElementById('start-button'),
              document.getElementById('stop-button')
            ];
            const feedback = document.getElementById('action-feedback');
            buttons.forEach((button) => { button.disabled = true; });
            feedback.className = 'action-feedback';
            feedback.textContent = action === 'start' ? 'Sending start request…' : 'Sending stop request…';
            try {
              const r = await fetch('/' + action, { method: 'POST' });
              const data = await r.json();
              if (!r.ok || !data.success) throw new Error(data.msg || 'Request failed');
              feedback.textContent = action === 'start'
                ? 'Start requested. Waiting for the bot to connect…'
                : 'Bot stopped.';
              await update();
            } catch (error) {
              feedback.className = 'action-feedback error';
              feedback.textContent = error.message || 'Could not send the request.';
            } finally {
              buttons.forEach((button) => { button.disabled = false; });
            }
          }

          setInterval(update, 5000);
          update();
        </script>
      </body>
    </html>
  `);
});
app.get("/tutorial", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Setup Guide</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 40px 24px;
          }

          main {
            width: 100%;
            max-width: 560px;
            margin: 0 auto;
          }

          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #8b949e;
            text-decoration: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 8px;
            padding: 7px 14px;
            margin-bottom: 32px;
            transition: color 0.2s, background 0.2s;
          }
          .back-btn:hover { background: #21262d; color: #c9d1d9; }

          header { margin-bottom: 32px; }
          header h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          header p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
            line-height: 1.5;
          }

          .step-card {
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 16px;
          }

          .step-header {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 18px;
          }

          .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #0d2218;
            border: 2px solid #238636;
            color: #3fb950;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .step-title {
            font-size: 16px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
          }

          ol {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          li {
            font-size: 14px;
            color: #8b949e;
            line-height: 1.6;
            padding-left: 20px;
            position: relative;
          }

          li::before {
            content: "·";
            position: absolute;
            left: 6px;
            color: #3fb950;
            font-weight: 700;
          }

          li strong { color: #e6edf3; font-weight: 600; }

          code {
            background: #21262d;
            border: 1px solid #30363d;
            padding: 2px 7px;
            border-radius: 5px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 12px;
            color: #e6edf3;
          }

          a { color: #58a6ff; text-decoration: none; }
          a:hover { text-decoration: underline; }

          footer {
            margin-top: 32px;
            text-align: center;
          }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>

          <header>
            <h1>Setup Guide</h1>
            <p>Get your AFK bot running in under 15 minutes</p>
          </header>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">1</div>
              <h2 class="step-title">Configure Aternos</h2>
            </div>
            <ol>
              <li>Go to <strong>Aternos</strong> and open your server.</li>
              <li>Install <strong>Paper/Bukkit</strong> as your server software.</li>
              <li>Enable <strong>Cracked</strong> mode using the green switch.</li>
              <li>Install these plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code></li>
            </ol>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">2</div>
              <h2 class="step-title">GitHub Setup</h2>
            </div>
            <ol>
              <li>Download this project as a ZIP and extract it.</li>
              <li>Edit <code>settings.json</code> with your server IP and port.</li>
              <li>Upload all files to a new <strong>GitHub Repository</strong>.</li>
            </ol>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">3</div>
              <h2 class="step-title">Deploy on Replit (Free 24/7)</h2>
            </div>
            <ol>
              <li>Import your GitHub repo into <strong>Replit</strong>.</li>
              <li>Set the run command to <code>npm start</code>.</li>
              <li>Hit <strong>Run</strong> — the bot connects automatically.</li>
              <li>The bot pings itself every 10 minutes to stay alive.</li>
            </ol>
          </div>

          <footer>
            <p>AFK Bot Dashboard &middot; ${config.name}</p>
          </footer>
        </main>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/logs", (req, res) => {
  const logs = getLogs();

  const escapeHTML = (str) =>
    str.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );

  const logCount = logs.length;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Logs</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 40px 24px;
          }

          main {
            width: 100%;
            max-width: 760px;
            margin: 0 auto;
          }

          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #8b949e;
            text-decoration: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 8px;
            padding: 7px 14px;
            margin-bottom: 32px;
            transition: color 0.2s, background 0.2s;
          }
          .back-btn:hover { background: #21262d; color: #c9d1d9; }

          .page-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 12px;
            flex-wrap: wrap;
          }

          .page-header-left h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          .page-header-left p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
          }

          .badge {
            font-size: 12px;
            font-weight: 600;
            color: #8b949e;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 20px;
            padding: 4px 12px;
            white-space: nowrap;
          }

          .log-card {
            background: #0d1117;
            border: 1px solid #21262d;
            border-radius: 12px;
            overflow: hidden;
          }

          .log-card-header {
            background: #161b22;
            border-bottom: 1px solid #21262d;
            padding: 12px 18px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot-red   { background: #ff5f57; }
          .dot-yellow{ background: #ffbd2e; }
          .dot-green { background: #28c840; }

          .log-card-title {
            font-size: 12px;
            font-weight: 500;
            color: #484f58;
            margin-left: 4px;
          }

          .log-body {
            padding: 16px 18px;
            max-height: 560px;
            overflow-y: auto;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            line-height: 1.7;
          }

          .log-entry { display: block; padding: 1px 0; white-space: pre-wrap; word-break: break-all; }
          .log-entry.error   { color: #ff7b72; }
          .log-entry.warn    { color: #e3b341; }
          .log-entry.success { color: #3fb950; }
          .log-entry.control { color: #58a6ff; }
          .log-entry.default { color: #8b949e; }

          .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #484f58;
            font-size: 13px;
          }

          .refresh-bar {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            margin-top: 12px;
            font-size: 12px;
            color: #484f58;
          }
          .refresh-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: #3fb950;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }

          .console-row {
            display: flex;
            align-items: center;
            border-top: 1px solid #21262d;
            background: #0d1117;
            padding: 10px 18px;
            gap: 10px;
          }

          .console-prompt {
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
            color: #3fb950;
            font-weight: 700;
            flex-shrink: 0;
            user-select: none;
          }

          .console-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            color: #e6edf3;
            caret-color: #3fb950;
          }

          .console-input::placeholder { color: #484f58; }

          .console-send {
            background: #0d2218;
            border: 1px solid #238636;
            color: #3fb950;
            font-size: 12px;
            font-weight: 600;
            padding: 5px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.2s;
            flex-shrink: 0;
          }
          .console-send:hover { background: #122d1a; }
          .console-send:disabled { opacity: 0.5; cursor: default; }

          .console-wrap {
            position: relative;
          }

          .cmd-suggestions {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 0; right: 0;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 10;
          }

          .cmd-suggestions.visible { display: block; }

          .cmd-item {
            display: flex;
            align-items: baseline;
            gap: 12px;
            padding: 9px 16px;
            cursor: pointer;
            transition: background 0.12s;
            border-bottom: 1px solid #21262d;
          }
          .cmd-item:last-child { border-bottom: none; }
          .cmd-item:hover, .cmd-item.active {
            background: #21262d;
          }

          .cmd-name {
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            font-weight: 700;
            color: #3fb950;
            flex-shrink: 0;
            min-width: 90px;
          }

          .cmd-desc {
            font-size: 12px;
            color: #6e7681;
          }

          footer { margin-top: 32px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>

          <div class="page-header">
            <div class="page-header-left">
              <h1>Bot Logs</h1>
              <p>Live output from the AFK bot</p>
            </div>
            <span class="badge">${logCount} ${logCount === 1 ? "entry" : "entries"}</span>
          </div>

          <div class="log-card">
            <div class="log-card-header">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
              <span class="log-card-title">bot.log</span>
            </div>
            <div class="log-body" id="log-body">
              ${logCount === 0
                ? `<div class="empty-state">No log entries yet. Start the bot to see output.</div>`
                : logs.map((l) => {
                    const escaped = escapeHTML(l);
                    const lower = l.toLowerCase();
                    let cls = "default";
                    if (lower.includes("error") || lower.includes("fail")) cls = "error";
                    else if (lower.includes("warn")) cls = "warn";
                    else if (lower.includes("[control]")) cls = "control";
                    else if (lower.includes("connect") || lower.includes("join") || lower.includes("spawn")) cls = "success";
                    return `<span class="log-entry ${cls}">${escaped}</span>`;
                  }).join("")
              }
            </div>
            <div class="console-wrap">
              <div class="cmd-suggestions" id="cmd-suggestions"></div>
              <div class="console-row">
                <span class="console-prompt">&gt;</span>
                <input
                  id="console-input"
                  class="console-input"
                  type="text"
                  placeholder="Type / for commands, or any message…"
                  autocomplete="off"
                  spellcheck="false"
                >
                <button id="console-send" class="console-send">Send</button>
              </div>
            </div>
          </div>

          <div class="refresh-bar">
            <span class="refresh-dot"></span>
            <span id="refresh-label">Auto-refreshing every 5 seconds</span>
          </div>

          <footer>
            <p>AFK Bot Dashboard &middot; ${config.name}</p>
          </footer>
        </main>

        <script>
          (function() {
            var logBody  = document.getElementById('log-body');
            var input    = document.getElementById('console-input');
            var sendBtn  = document.getElementById('console-send');
            var label    = document.getElementById('refresh-label');
            var sugBox   = document.getElementById('cmd-suggestions');
            var refreshTimer = null;
            var typing = false;
            var activeIdx = -1;

            var COMMANDS = [
              { name: '/help',   desc: 'Show all available commands' },
              { name: '/pos',    desc: "Show bot's current coordinates" },
              { name: '/status', desc: 'Show connection status & uptime' },
              { name: '/list',   desc: 'List players on the server' },
              { name: '/say',    desc: 'Send a chat message in-game' },
            ];

            function scrollBottom() {
              if (logBody) logBody.scrollTop = logBody.scrollHeight;
            }

            function scheduleRefresh() {
              clearTimeout(refreshTimer);
              if (!typing) {
                refreshTimer = setTimeout(function() { location.reload(); }, 5000);
              }
            }

            function appendLocalEntry(text, cls) {
              var span = document.createElement('span');
              span.className = 'log-entry ' + (cls || 'control');
              span.textContent = text;
              logBody.appendChild(span);
              scrollBottom();
            }

            function hideSuggestions() {
              sugBox.classList.remove('visible');
              sugBox.innerHTML = '';
              activeIdx = -1;
            }

            function setActive(idx) {
              var items = sugBox.querySelectorAll('.cmd-item');
              items.forEach(function(el, i) {
                el.classList.toggle('active', i === idx);
              });
              activeIdx = idx;
            }

            function showSuggestions(val) {
              var query = val.toLowerCase();
              var matches = COMMANDS.filter(function(c) {
                return c.name.startsWith(query);
              });

              if (!matches.length) { hideSuggestions(); return; }

              sugBox.innerHTML = matches.map(function(c, i) {
                return '<div class="cmd-item" data-cmd="' + c.name + '">' +
                  '<span class="cmd-name">' + c.name + '</span>' +
                  '<span class="cmd-desc">' + c.desc + '</span>' +
                '</div>';
              }).join('');

              sugBox.querySelectorAll('.cmd-item').forEach(function(el) {
                el.addEventListener('mousedown', function(e) {
                  e.preventDefault();
                  input.value = el.dataset.cmd + ' ';
                  hideSuggestions();
                  input.focus();
                });
              });

              activeIdx = -1;
              sugBox.classList.add('visible');
            }

            input.addEventListener('input', function() {
              var val = input.value;
              if (val.startsWith('/')) {
                showSuggestions(val);
              } else {
                hideSuggestions();
              }
            });

            input.addEventListener('keydown', function(e) {
              var items = sugBox.querySelectorAll('.cmd-item');
              if (sugBox.classList.contains('visible') && items.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive(Math.min(activeIdx + 1, items.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive(Math.max(activeIdx - 1, 0));
                  return;
                }
                if (e.key === 'Tab' || (e.key === 'Enter' && activeIdx >= 0)) {
                  e.preventDefault();
                  var chosen = items[activeIdx >= 0 ? activeIdx : 0];
                  input.value = chosen.dataset.cmd + ' ';
                  hideSuggestions();
                  return;
                }
                if (e.key === 'Escape') {
                  hideSuggestions();
                  return;
                }
              }
              if (e.key === 'Enter') sendCommand();
            });

            function sendCommand() {
              var cmd = input.value.trim();
              if (!cmd) return;
              hideSuggestions();
              input.value = '';
              sendBtn.disabled = true;
              appendLocalEntry('> ' + cmd, 'control');

              fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
              })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.msg) {
                  data.msg.split('\\n').forEach(function(line) {
                    appendLocalEntry(line, data.success ? 'default' : 'error');
                  });
                }
              })
              .catch(function() {
                appendLocalEntry('Failed to send command.', 'error');
              })
              .finally(function() {
                sendBtn.disabled = false;
                input.focus();
                scheduleRefresh();
              });
            }

            sendBtn.addEventListener('click', sendCommand);

            input.addEventListener('focus', function() {
              typing = true;
              clearTimeout(refreshTimer);
              label.textContent = 'Auto-refresh paused while typing';
            });
            input.addEventListener('blur', function() {
              setTimeout(function() {
                hideSuggestions();
                typing = false;
                label.textContent = 'Auto-refreshing every 5 seconds';
                scheduleRefresh();
              }, 150);
            });

            scrollBottom();
            scheduleRefresh();
          })();
        </script>
      </body>
    </html>
  `);
});

let botRunning = true;

app.post("/start", (req, res) => {
  if (botRunning) return res.json({ success: false, msg: "Already running" });

  botRunning = true;
  createBot();
  addLog("[Control] Bot started");

  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (!botRunning) return res.json({ success: false, msg: "Already stopped" });

  botRunning = false;

  if (bot) {
    bot.end();
    bot = null;
  }

  clearAllIntervals();
  addLog("[Control] Bot stopped");

  res.json({ success: true });
});

app.post("/command", express.json(), (req, res) => {
  const cmd = (req.body.command || "").trim();
  if (!cmd) return res.json({ success: false, msg: "Empty command." });

  addLog(`[Console] > ${cmd}`);

  if (cmd === "/help") {
    const lines = [
      "Available commands:",
      "  /help          - Show this help message",
      "  /pos           - Show bot's current coordinates",
      "  /status        - Show bot connection status",
      "  /list          - Ask server for player list",
      "  /say <message> - Send a chat message in-game",
      "  /<anything>    - Send any Minecraft command directly",
      "  <text>         - Send plain chat (no slash needed)",
    ];
    lines.forEach((l) => addLog(`[Console] ${l}`));
    return res.json({ success: true, msg: lines.join("\n") });
  }

  if (cmd === "/pos" || cmd === "/coords") {
    const pos = bot && bot.entity ? bot.entity.position : null;
    const msg = pos
      ? `Position: X=${Math.floor(pos.x)}  Y=${Math.floor(pos.y)}  Z=${Math.floor(pos.z)}`
      : "Position unavailable (bot not spawned).";
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (cmd === "/status") {
    const status = botState.connected ? "Connected" : "Disconnected";
    const uptime = Math.floor((Date.now() - botState.startTime) / 1000);
    const msg = `Status: ${status} | Uptime: ${uptime}s | Reconnects: ${botState.reconnectAttempts}`;
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (!bot || typeof bot.chat !== "function") {
    const msg = bot
      ? "Bot is still connecting — try again in a moment."
      : "Bot is not running.";
    addLog(`[Console] ${msg}`);
    return res.json({ success: false, msg });
  }

  try {
    bot.chat(cmd);
    addLog(`[Console] Sent to server: ${cmd}`);
    return res.json({ success: true, msg: `Sent: ${cmd}` });
  } catch (err) {
    addLog(`[Console] Error: ${err.message}`);
    return res.json({ success: false, msg: err.message });
  }
});

// ============================================================
//                    END OF WEB TOOLS
//============================================================

// FIX: handle port conflict gracefully - try next port if taken
const server = app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] HTTP server started on port ${server.address().port} `);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallbackPort = PORT + 1;
    addLog(`[Server] Port ${PORT} in use - trying port ${fallbackPort} `);
    server.listen(fallbackPort, "0.0.0.0");
  } else {
    addLog(`[Server] HTTP server error: ${err.message} `);
  }
});

// FIX: only one definition of formatUptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s} s`;
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// FIX: only ping if RENDER_EXTERNAL_URL is set (skip useless localhost ping)
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000;

function startSelfPing() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (!renderUrl) {
    addLog(
      "[KeepAlive] No RENDER_EXTERNAL_URL set - self-ping disabled (running locally)",
    );
    return;
  }
  setInterval(() => {
    const protocol = renderUrl.startsWith("https") ? https : http;
    protocol
      .get(`${renderUrl}/ping`, (res) => {
        // Silent success
      })
      .on("error", (err) => {
        addLog(`[KeepAlive] Self-ping failed: ${err.message}`);
      });
  }, SELF_PING_INTERVAL);
  addLog("[KeepAlive] Self-ping system started (every 10 min)");
}

startSelfPing();

// ============================================================
// MEMORY MONITORING
// ============================================================
setInterval(
  () => {
    const mem = process.memoryUsage();
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
    addLog(`[Memory] Heap: ${heapMB} MB`);
  },
  5 * 60 * 1000,
);

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
// ============================================================
// RECONNECTION & TIMEOUT MANAGEMENT
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeoutId = null;
let connectionTimeoutId = null;
let isReconnecting = false;

function clearBotTimeouts() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  if (connectionTimeoutId) {
    clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }
}

// FIX: Discord rate limiting - track last send time
let lastDiscordSend = 0;
const DISCORD_RATE_LIMIT_MS = 5000; // min 5s between webhook calls

function clearAllIntervals() {
  addLog(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach((id) => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  if (botState.wasThrottled) {
    botState.wasThrottled = false;
    const throttleDelay = 60000 + Math.floor(Math.random() * 60000);
    addLog(
      `[Bot] Throttle detected - using extended delay: ${throttleDelay / 1000}s`,
    );
    return throttleDelay;
  }

  // FIX: read auto-reconnect-delay from settings as base delay
  const baseDelay = config.utils["auto-reconnect-delay"] || 3000;
  const maxDelay = config.utils["max-reconnect-delay"] || 30000;
  const delay = Math.min(
    baseDelay * Math.pow(2, botState.reconnectAttempts),
    maxDelay,
  );
  const jitter = Math.floor(Math.random() * 2000);
  return delay + jitter;
}

function createBot() {
  if (isReconnecting) {
    addLog("[Bot] Already reconnecting, skipping...");
    return;
  }

  // Cleanup previous bot properly to avoid ghost bots
  if (bot) {
    clearAllIntervals();
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      addLog("[Cleanup] Error ending previous bot:", e.message);
    }
    bot = null;
  }

  addLog(`[Bot] Creating bot instance...`);
  addLog(`[Bot] Connecting to ${config.server.ip}:${config.server.port}`);

  try {
    // FIX: use version:false to auto-detect server version so the bot can join any server.
    // If the user explicitly sets a version in settings.json it is still respected.
    const botVersion =
      config.server.version && config.server.version.trim() !== ""
        ? config.server.version
        : false;
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      password: config["bot-account"].password || undefined,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: botVersion,
      hideErrors: false,
      checkTimeoutInterval: 600000,
    });

    bot.loadPlugin(pathfinder);

    // FIX: connection timeout - end the old bot before reconnecting to avoid ghost bots
    clearBotTimeouts();
    connectionTimeoutId = setTimeout(() => {
      if (!botState.connected) {
        addLog("[Bot] Connection timeout - no spawn received");
        try {
          bot.removeAllListeners();
          bot.end();
        } catch (e) {
          /* ignore */
        }
        bot = null;
        scheduleReconnect();
      }
    }, 150000); // 150s - Aternos servers can take 90-120s to finish spawning a player

    // FIX: guard against spawn firing twice (can happen on some servers)
    let spawnHandled = false;

    bot.once("spawn", () => {
      if (spawnHandled) return;
      spawnHandled = true;

      clearBotTimeouts();
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      addLog(
        `[Bot] [+] Successfully spawned on server! (Version: ${bot.version})`,
      );
      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.connect
      ) {
        sendDiscordWebhook(
          `[+] **Connected** to \`${config.server.ip}\``,
          0x4ade80,
        );
      }

      // FIX: use bot.version (auto-detected) instead of config value so minecraft-data always matches
      const mcData = require("minecraft-data")(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      initializeModules(bot, mcData, defaultMove);

      // Attempt creative mode (only works if bot has OP and enabled in settings)
      setTimeout(() => {
        if (bot && botState.connected && config.server["try-creative"]) {
          bot.chat("/gamemode creative");
          addLog("[INFO] Attempted to set creative mode (requires OP)");
        }
      }, 3000);

      bot.on("messagestr", (message) => {
        if (
          message.includes("commands.gamemode.success.self") ||
          message.includes("Set own game mode to Creative Mode")
        ) {
          addLog("[INFO] Bot is now in Creative Mode.");
        }
      });
    });

    // FIX: 'kicked' fires before 'end'. Remove the scheduleReconnect from 'kicked'
    // so that 'end' is the single source of reconnect truth, preventing double-trigger.
    bot.on("kicked", (reason) => {
      // FIX: stringify reason if it's an object to make it readable in logs
      const kickReason =
        typeof reason === "object" ? JSON.stringify(reason) : reason;
      addLog(`[Bot] Kicked: ${kickReason}`);
      botState.connected = false;
      botState.errors.push({
        type: "kicked",
        reason: kickReason,
        time: Date.now(),
      });
      clearAllIntervals();

      const reasonStr = String(kickReason).toLowerCase();
      if (
        reasonStr.includes("throttl") ||
        reasonStr.includes("wait before reconnect") ||
        reasonStr.includes("too fast")
      ) {
        addLog(
          "[Bot] Throttle kick detected - will use extended reconnect delay",
        );
        botState.wasThrottled = true;
      }

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect
      ) {
        sendDiscordWebhook(`[!] **Kicked**: ${kickReason}`, 0xff0000);
      }
      // NOTE: do NOT call scheduleReconnect() here - 'end' will fire right after 'kicked' and handle it
    });

    // FIX: 'end' is the single reconnect trigger
    bot.on("end", (reason) => {
      addLog(`[Bot] Disconnected: ${reason || "Unknown reason"}`);
      botState.connected = false;
      clearAllIntervals();
      spawnHandled = false; // reset for next connection

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect
      ) {
        sendDiscordWebhook(
          `[-] **Disconnected**: ${reason || "Unknown"}`,
          0xf87171,
        );
      }

      // ALWAYS reconnect — bot must never leave the server
      scheduleReconnect();
    });

    bot.on("error", (err) => {
      const msg = err.message || "";
      addLog(`[Bot] Error: ${msg}`);
      botState.errors.push({ type: "error", message: msg, time: Date.now() });
      // Don't reconnect on error - let 'end' event handle it
    });
  } catch (err) {
    addLog(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearBotTimeouts();

  // FIX: don't stack reconnect if already waiting
  if (isReconnecting) {
    addLog("[Bot] Reconnect already scheduled, skipping duplicate.");
    return;
  }

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  addLog(
    `[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts})`,
  );

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  addLog("[Modules] Initializing all modules...");

  // ---------- AUTO AUTH (REACTIVE) ----------
  if (config.utils["auto-auth"] && config.utils["auto-auth"].enabled) {
    const password = config.utils["auto-auth"].password;
    let authHandled = false;

    const tryAuth = (type) => {
      if (authHandled || !bot || !botState.connected) return;
      authHandled = true;
      if (type === "register") {
        bot.chat(`/register ${password} ${password}`);
        addLog("[Auth] Detected register prompt - sent /register");
      } else {
        bot.chat(`/login ${password}`);
        addLog("[Auth] Detected login prompt - sent /login");
      }
    };

    bot.on("messagestr", (message) => {
      if (authHandled) return;
      const msg = message.toLowerCase();
      if (
        msg.includes("/register") ||
        msg.includes("register ") ||
        msg.includes("지정된 비밀번호")
      ) {
        tryAuth("register");
      } else if (
        msg.includes("/login") ||
        msg.includes("login ") ||
        msg.includes("로그인")
      ) {
        tryAuth("login");
      }
    });

    // Failsafe: if no prompt after 10s, try login anyway
    setTimeout(() => {
      if (!authHandled && bot && botState.connected) {
        addLog(
          "[Auth] No prompt detected after 10s, sending /login as failsafe",
        );
        bot.chat(`/login ${password}`);
        authHandled = true;
      }
    }, 10000);
  }

  // ---------- CHAT MESSAGES ----------
  if (config.utils["chat-messages"] && config.utils["chat-messages"].enabled) {
    const messages = config.utils["chat-messages"].messages;
    if (config.utils["chat-messages"].repeat) {
      let i = 0;
      addInterval(() => {
        if (bot && botState.connected) {
          bot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, config.utils["chat-messages"]["repeat-delay"] * 1000);
    } else {
      messages.forEach((msg, idx) => {
        setTimeout(() => {
          if (bot && botState.connected) bot.chat(msg);
        }, idx * 1000);
      });
    }
  }

  // ---------- MOVE TO POSITION ----------
  // FIX: only use position goal if circle-walk is NOT enabled (they fight over pathfinder)
  if (
    config.position &&
    config.position.enabled &&
    !(
      config.movement &&
      config.movement["circle-walk"] &&
      config.movement["circle-walk"].enabled
    )
  ) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(
      new GoalBlock(config.position.x, config.position.y, config.position.z),
    );
    addLog("[Position] Navigating to configured position...");
  }

  // ---------- ANTI-AFK ----------
  if (config.utils["anti-afk"] && config.utils["anti-afk"].enabled) {
    // Arm swinging
    addInterval(
      () => {
        if (!bot || !botState.connected) return;
        try {
          bot.swingArm();
        } catch (e) {}
      },
      10000 + Math.floor(Math.random() * 50000),
    );

    // Hotbar cycling
    addInterval(
      () => {
        if (!bot || !botState.connected) return;
        try {
          const slot = Math.floor(Math.random() * 9);
          bot.setQuickBarSlot(slot);
        } catch (e) {}
      },
      30000 + Math.floor(Math.random() * 90000),
    );

    // Teabagging
    addInterval(
      () => {
        if (
          !bot ||
          !botState.connected ||
          typeof bot.setControlState !== "function"
        )
          return;
        if (Math.random() > 0.9) {
          let count = 2 + Math.floor(Math.random() * 4);
          const doTeabag = () => {
            if (count <= 0 || !bot || typeof bot.setControlState !== "function")
              return;
            try {
              bot.setControlState("sneak", true);
              setTimeout(() => {
                if (bot && typeof bot.setControlState === "function")
                  bot.setControlState("sneak", false);
                count--;
                setTimeout(doTeabag, 150);
              }, 150);
            } catch (e) {}
          };
          doTeabag();
        }
      },
      120000 + Math.floor(Math.random() * 180000),
    );

    // FIX: micro-walk only when circle-walk is NOT running, to avoid interrupting pathfinder
    if (
      !(
        config.movement &&
        config.movement["circle-walk"] &&
        config.movement["circle-walk"].enabled
      )
    ) {
      addInterval(
        () => {
          if (
            !bot ||
            !botState.connected ||
            typeof bot.setControlState !== "function"
          )
            return;
          try {
            const yaw = Math.random() * Math.PI * 2;
            bot.look(yaw, 0, true);
            bot.setControlState("forward", true);
            setTimeout(
              () => {
                if (bot && typeof bot.setControlState === "function")
                  bot.setControlState("forward", false);
              },
              500 + Math.floor(Math.random() * 1500),
            );
            botState.lastActivity = Date.now();
          } catch (e) {
            addLog("[AntiAFK] Walk error:", e.message);
          }
        },
        120000 + Math.floor(Math.random() * 360000),
      );
    }

    if (config.utils["anti-afk"].sneak) {
      try {
        if (typeof bot.setControlState === "function")
          bot.setControlState("sneak", true);
      } catch (e) {}
    }
  }

  // ---------- MOVEMENT MODULES ----------
  // FIX: check top-level movement.enabled flag
  if (config.movement && config.movement.enabled !== false) {
    // FIX: circle-walk and random-jump both jump - only run one jumping mechanism
    // random-jump is skipped if anti-afk jump is handled elsewhere; we only use random-jump here
    if (
      config.movement["circle-walk"] &&
      config.movement["circle-walk"].enabled
    ) {
      startCircleWalk(bot, defaultMove);
    }
    // FIX: only run random-jump if circle-walk is NOT running (circle-walk also keeps bot moving)
    if (
      config.movement["random-jump"] &&
      config.movement["random-jump"].enabled &&
      !(
        config.movement["circle-walk"] && config.movement["circle-walk"].enabled
      )
    ) {
      startRandomJump(bot);
    }
    if (
      config.movement["look-around"] &&
      config.movement["look-around"].enabled
    ) {
      startLookAround(bot);
    }
  }

  // ---------- CUSTOM MODULES ----------
  // FIX: avoidMobs AND combatModule conflict - if combat is enabled, don't run avoidMobs at the same time
  if (config.modules.avoidMobs && !config.modules.combat) {
    avoidMobs(bot);
  }
  if (config.modules.combat) {
    combatModule(bot, mcData);
  }
  if (config.modules.beds) {
    bedModule(bot, mcData);
  }
  if (config.modules.chat) {
    chatModule(bot);
  }

  addLog("[Modules] All modules initialized!");
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement["circle-walk"].radius;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!bot || !botState.connected) return;
    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;
    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(
        new GoalBlock(
          Math.floor(x),
          Math.floor(bot.entity.position.y),
          Math.floor(z),
        ),
      );
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[CircleWalk] Error:", e.message);
    }
  }, config.movement["circle-walk"].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      typeof bot.setControlState !== "function"
    )
      return;
    try {
      bot.setControlState("jump", true);
      setTimeout(() => {
        if (bot && typeof bot.setControlState === "function")
          bot.setControlState("jump", false);
      }, 300);
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[RandomJump] Error:", e.message);
    }
  }, config.movement["random-jump"].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() * Math.PI) / 2 - Math.PI / 4;
      bot.look(yaw, pitch, false);
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[LookAround] Error:", e.message);
    }
  }, config.movement["look-around"].interval);
}

// ============================================================
// CUSTOM MODULES
// ============================================================

// Avoid mobs/players
// FIX: e.username only exists on players; use e.name for mobs - now handled properly
function avoidMobs(bot) {
  const safeDistance = 5;
  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      typeof bot.setControlState !== "function"
    )
      return;
    try {
      const entities = Object.values(bot.entities).filter(
        (e) =>
          e.type === "mob" ||
          (e.type === "player" && e.username !== bot.username),
      );
      for (const e of entities) {
        if (!e.position) continue;
        const distance = bot.entity.position.distanceTo(e.position);
        if (distance < safeDistance) {
          bot.setControlState("back", true);
          setTimeout(() => {
            if (bot && typeof bot.setControlState === "function")
              bot.setControlState("back", false);
          }, 500);
          break;
        }
      }
    } catch (e) {
      addLog("[AvoidMobs] Error:", e.message);
    }
  }, 2000);
}

// Combat module
// FIX: attack cooldown for 1.9+ (600ms minimum between attacks)
// FIX: lock onto a target for multiple ticks instead of randomly switching every tick
// FIX: autoEat - use i.foodPoints directly (mineflayer item property) instead of broken mcData lookup
function combatModule(bot, mcData) {
  let lastAttackTime = 0;
  let lockedTarget = null;
  let lockedTargetExpiry = 0;

  // FIX: use physicsTick (not the deprecated physicTick)
  bot.on("physicsTick", () => {
    if (!bot || !botState.connected) return;
    if (!config.combat["attack-mobs"]) return;

    const now = Date.now();
    // FIX: 1.9+ attack cooldown - respect at least 600ms between swings
    if (now - lastAttackTime < 620) return;

    try {
      // FIX: only pick a new target if current one is gone or lock expired
      if (
        lockedTarget &&
        now < lockedTargetExpiry &&
        bot.entities[lockedTarget.id] &&
        lockedTarget.position
      ) {
        const dist = bot.entity.position.distanceTo(lockedTarget.position);
        if (dist < 4) {
          bot.attack(lockedTarget);
          lastAttackTime = now;
          return;
        } else {
          lockedTarget = null;
        }
      }

      // Pick a new target
      const mobs = Object.values(bot.entities).filter(
        (e) =>
          e.type === "mob" &&
          e.position &&
          bot.entity.position.distanceTo(e.position) < 4,
      );
      if (mobs.length > 0) {
        lockedTarget = mobs[0];
        lockedTargetExpiry = now + 3000; // stick to same mob for 3 seconds
        bot.attack(lockedTarget);
        lastAttackTime = now;
      }
    } catch (e) {
      addLog("[Combat] Error:", e.message);
    }
  });

  // FIX: autoEat - check foodPoints property on the item directly (works reliably)
  bot.on("health", () => {
    if (!config.combat["auto-eat"]) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory
          .items()
          .find((i) => i.foodPoints && i.foodPoints > 0);
        if (food) {
          bot
            .equip(food, "hand")
            .then(() => bot.consume())
            .catch((e) => addLog("[AutoEat] Error:", e.message));
        }
      }
    } catch (e) {
      addLog("[AutoEat] Error:", e.message);
    }
  });
}

// Bed module
// FIX: bot.isSleeping can be stale; use a local isTryingToSleep guard to prevent double-sleep errors
// FIX: place-night was false in default settings - documentation note added
function bedModule(bot, mcData) {
  let isTryingToSleep = false;

  addInterval(async () => {
    if (!bot || !botState.connected) return;
    if (!config.beds["place-night"]) return; // FIX: check flag (was always skipping before)

    try {
      const isNight =
        bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;

      // FIX: use local guard instead of stale bot.isSleeping
      if (isNight && !isTryingToSleep) {
        const bedBlock = bot.findBlock({
          matching: (block) => block.name.includes("bed"),
          maxDistance: 8,
        });

        if (bedBlock) {
          isTryingToSleep = true;
          try {
            await bot.sleep(bedBlock);
            addLog("[Bed] Sleeping...");
          } catch (e) {
            // Can't sleep - maybe not night enough or monsters nearby
          } finally {
            isTryingToSleep = false;
          }
        }
      }
    } catch (e) {
      isTryingToSleep = false;
      addLog("[Bed] Error:", e.message);
    }
  }, 10000);
}

// Chat module
// FIX: wire up discord.events.chat flag
function chatModule(bot) {
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      // FIX: send chat events to Discord if enabled
      if (
        config.discord &&
        config.discord.enabled &&
        config.discord.events &&
        config.discord.events.chat
      ) {
        sendDiscordWebhook(`💬 **${username}**: ${message}`, 0x7289da);
      }

      if (config.chat && config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith("!tp ")) {
          const target = message.split(" ")[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      addLog("[Chat] Error:", e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  if (!bot || !botState.connected) {
    addLog("[Console] Bot not connected");
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith("say ")) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith("cmd ")) {
    bot.chat("/" + trimmed.slice(4));
  } else if (trimmed === "status") {
    addLog(
      `Connected: ${botState.connected}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`,
    );
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// FIX: use Buffer.byteLength for Content-Length (handles non-ASCII usernames correctly)
// FIX: rate limiting to avoid spam when bot is flapping
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (
    !config.discord ||
    !config.discord.enabled ||
    !config.discord.webhookUrl ||
    config.discord.webhookUrl.includes("YOUR_DISCORD")
  )
    return;

  // FIX: Discord rate limiting - skip if sent too recently
  const now = Date.now();
  if (now - lastDiscordSend < DISCORD_RATE_LIMIT_MS) {
    addLog("[Discord] Rate limited - skipping webhook");
    return;
  }
  lastDiscordSend = now;

  const protocol = config.discord.webhookUrl.startsWith("https") ? https : http;
  const urlParts = new URL(config.discord.webhookUrl);

  const payload = JSON.stringify({
    username: config.name,
    embeds: [
      {
        description: content,
        color: color,
        timestamp: new Date().toISOString(),
        footer: { text: "Slobos AFK Bot" },
      },
    ],
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // FIX: use Buffer.byteLength instead of payload.length - handles non-ASCII (e.g. usernames with accents/emoji)
      "Content-Length": Buffer.byteLength(payload, "utf8"),
    },
  };

  const req = protocol.request(options, (res) => {
    // Silent success
  });

  req.on("error", (e) => {
    addLog(`[Discord] Error sending webhook: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// ============================================================
// CRASH RECOVERY - IMMORTAL MODE
// FIX: guard against uncaughtException stacking reconnects when isReconnecting is already true
// ============================================================
process.on("uncaughtException", (err) => {
  const msg = err.message || "Unknown";
  addLog(`[FATAL] Uncaught Exception: ${msg}`);
  botState.errors.push({ type: "uncaught", message: msg, time: Date.now() });

  // Cap errors array to prevent memory leak over long uptimes
  if (botState.errors.length > 100) {
    botState.errors = botState.errors.slice(-50);
  }

  const isNetworkError =
    msg.includes("PartialReadError") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EPIPE") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("timed out") ||
    msg.includes("write after end") ||
    msg.includes("This socket has been ended");

  if (isNetworkError) {
    addLog("[FATAL] Known network/protocol error - recovering gracefully...");
  }

  // ALWAYS recover — bot must never stay disconnected
  clearAllIntervals();
  botState.connected = false;

  // FIX: reset isReconnecting if it was stuck, then schedule reconnect
  if (isReconnecting) {
    addLog(
      "[FATAL] isReconnecting was stuck - resetting before crash recovery",
    );
    isReconnecting = false;
    // BUG FIX: was referencing non-existent 'reconnectTimeout' — correct name is 'reconnectTimeoutId'
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }

  setTimeout(
    () => {
      scheduleReconnect();
    },
    isNetworkError ? 5000 : 10000,
  );
});

process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  addLog(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: "rejection", message: msg, time: Date.now() });
  if (botState.errors.length > 100) {
    botState.errors = botState.errors.slice(-50);
  }

  const isNetworkError =
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EPIPE") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("timed out") ||
    msg.includes("PartialReadError");

  if (isNetworkError && !isReconnecting) {
    addLog("[FATAL] Network rejection — triggering reconnect...");
    clearAllIntervals();
    botState.connected = false;
    if (bot) {
      try { bot.end(); } catch (_) {}
      bot = null;
    }
    scheduleReconnect();
  }
});

process.on("SIGTERM", () => {
  addLog("[System] SIGTERM received — ignoring, bot will stay alive.");
});

process.on("SIGINT", () => {
  addLog("[System] SIGINT received — ignoring, bot will stay alive.");
});

// =============================
//===============================
// START THE BOT
// ============================================================
addLog("=".repeat(50));
addLog("  Minecraft AFK Bot v2.5 - Bug-Fixed Edition");
addLog("=".repeat(50));
addLog(`Server: ${config.server.ip}:${config.server.port}`);
addLog(`Version: ${config.server.version}`);
addLog(
  `Auto-Reconnect: ${config.utils["auto-reconnect"] ? "Enabled" : "Disabled"}`,
);
addLog("=".repeat(50));

createBot();
