"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const config = require("./settings.json");
const express = require("express");

// ============================================================
// EXPRESS SERVER SETUP
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

let bot = null;
let chatInterval = null;

let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: [],
  wasThrottled: false,
};

// Main Dashboard Endpoint
app.get("/", (req, res) => {
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
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
            background: #f3f7f1;
            color: #193326;
          }
          body { margin: 0; min-width: 320px; min-height: 100vh; padding: 48px 24px; }
          .dashboard { width: min(100%, 760px); margin: 0 auto; }
          .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
          .eyebrow { margin: 0 0 8px; color: #668071; font-size: 11px; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; }
          h1 { margin: 0; color: #193326; font-size: clamp(27px, 5vw, 36px); line-height: 1.12; }
          .subtitle { margin: 9px 0 0; color: #708276; font-size: 14px; }
          .live-badge { display: inline-flex; align-items: center; gap: 9px; padding: 9px 13px; border: 1px solid #d8e5d8; border-radius: 999px; background: rgba(255, 255, 255, .75); color: #68796d; font-size: 12px; font-weight: 700; }
          .live-badge::before { width: 8px; height: 8px; border-radius: 50%; background: #a1afa3; content: ""; }
          .live-badge.online { border-color: #bce2c2; background: #edf8ee; color: #24713b; }
          .live-badge.online::before { background: #35a853; box-shadow: 0 0 0 3px #d6efda; }
          .live-badge.offline { border-color: #f0ceca; background: #fff4f2; color: #a4433b; }
          .live-badge.offline::before { background: #d95d51; box-shadow: 0 0 0 3px #fce0dc; }
          .status-card { display: flex; align-items: center; gap: 17px; min-height: 126px; padding: 25px 28px; border: 1px solid #dce8dc; border-radius: 20px; background: rgba(255, 255, 255, .88); }
          .status-card.online { border-color: #c4e5c9; background: linear-gradient(110deg, #f6fcf5, #fff 65%); }
          .status-card.offline { border-color: #edd6d2; }
          .status-icon { display: grid; width: 54px; height: 54px; place-items: center; border-radius: 17px; background: #eef2ed; color: #78887b; font-size: 25px; font-weight: 700; }
          .status-icon.online { background: #e1f4e4; color: #278344; }
          .status-icon.offline { background: #fff0ed; color: #c14f45; }
          .status-label { margin: 0; color: #233c2d; font-size: 21px; font-weight: 750; }
          .status-detail { margin: 5px 0 0; color: #718176; font-size: 13px; }
          .stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; margin: 16px 0; }
          .stat-card { padding: 19px 20px; border: 1px solid #e0e9df; border-radius: 16px; background: rgba(255, 255, 255, .82); }
          .stat-label { margin: 0 0 11px; color: #748579; font-size: 12px; font-weight: 650; }
          .stat-value { margin: 0; color: #203a2b; font-size: clamp(17px, 2.6vw, 21px); font-weight: 720; }
          .stat-detail { margin: 6px 0 0; color: #93a095; font-size: 11px; }
          .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 21px; }
          .btn-primary { min-height: 54px; border: 1px solid transparent; border-radius: 13px; color: white; font-size: 14px; font-weight: 750; cursor: pointer; }
          .btn-start { background: #2d914d; }
          .btn-stop { background: #cf5146; }
          .action-feedback { grid-column: 1 / -1; min-height: 18px; margin: 0; color: #688071; text-align: center; font-size: 12px; }
          .action-feedback.error { color: #b4453d; }
          .page-footer { display: flex; justify-content: center; gap: 19px; margin-top: 12px; }
          .text-link { color: #688071; font-size: 12px; font-weight: 650; text-decoration: none; }
          .refresh-note { margin: 20px 0 0; color: #9aa79b; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <main class="dashboard">
          <header class="dashboard-header">
            <div>
              <p class="eyebrow">Bot dashboard</p>
              <h1>${config.name}</h1>
              <p class="subtitle">Minecraft server · Live connection status</p>
            </div>
            <div id="live-badge" class="live-badge offline">Offline</div>
          </header>

          <section id="status-section" class="status-card offline">
            <div id="status-icon" class="status-icon offline">—</div>
            <div>
              <h2 id="status-label" class="status-label">Connecting…</h2>
              <p id="status-detail" class="status-detail">Checking connection</p>
            </div>
          </section>

          <section class="stats-grid">
            <article class="stat-card">
              <p class="stat-label">Uptime</p>
              <p id="uptime-text" class="stat-value">—</p>
              <p class="stat-detail">Process running time</p>
            </article>
            <article class="stat-card">
              <p class="stat-label">Coordinates</p>
              <p id="coords-text" class="stat-value">Waiting</p>
              <p class="stat-detail">In-game position</p>
            </article>
            <article class="stat-card">
              <p class="stat-label">Server</p>
              <p class="stat-value">${config.server.ip}</p>
              <p class="stat-detail">Address</p>
            </article>
          </section>

          <section class="controls">
            <button id="start-button" class="btn-primary btn-start" onclick="controlBot('start')">Start bot</button>
            <button id="stop-button" class="btn-primary btn-stop" onclick="controlBot('stop')">Stop bot</button>
            <p id="action-feedback" class="action-feedback"></p>
          </section>

          <footer class="page-footer">
            <a href="/tutorial" class="text-link">Setup guide</a>
            <a href="/logs" class="text-link">View logs</a>
          </footer>
          <p class="refresh-note">Auto-refreshes every 5 seconds</p>
        </main>

        <script>
          function formatUptime(s) {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
            if (m > 0) return m + 'm ' + sec + 's';
            return sec + 's';
          }

          async function update() {
            try {
              const r = await fetch('/health');
              if (!r.ok) throw new Error();
              const data = await r.json();
              const online = data.status === 'connected';

              document.getElementById('status-section').className = 'status-card ' + (online ? 'online' : 'offline');
              document.getElementById('status-icon').className = 'status-icon ' + (online ? 'online' : 'offline');
              document.getElementById('status-icon').textContent = online ? '✓' : '✗';
              document.getElementById('status-label').textContent = online ? 'Bot is online' : 'Bot is offline';
              document.getElementById('status-detail').textContent = online ? 'Connected to server' : 'Not connected';
              document.getElementById('live-badge').className = 'live-badge ' + (online ? 'online' : 'offline');
              document.getElementById('live-badge').textContent = online ? 'Online' : 'Offline';
              document.getElementById('uptime-text').textContent = formatUptime(data.uptime);

              if (data.coords) {
                document.getElementById('coords-text').textContent = 'X ' + Math.floor(data.coords.x) + ' · Y ' + Math.floor(data.coords.y) + ' · Z ' + Math.floor(data.coords.z);
              } else {
                document.getElementById('coords-text').textContent = 'Waiting';
              }
            } catch (e) {
              document.getElementById('status-label').textContent = 'Offline';
            }
          }

          async function controlBot(action) {
            const feedback = document.getElementById('action-feedback');
            feedback.textContent = 'Processing request...';
            try {
              const r = await fetch('/' + action, { method: 'POST' });
              const data = await r.json();
              feedback.textContent = data.msg;
              await update();
            } catch (error) {
              feedback.textContent = 'Request failed.';
            }
          }

          setInterval(update, 5000);
          update();
        </script>
      </body>
    </html>
  `);
});

// Logs Endpoint
app.get("/logs", (req, res) => {
  const logs = getLogs();
  const escapeHTML = (str) =>
    str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Logs</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; background: #0d1117; color: #e6edf3; padding: 20px; margin: 0; }
          main { max-width: 760px; margin: 0 auto; }
          .back-btn { display: inline-block; color: #8b949e; text-decoration: none; margin-bottom: 20px; background: #161b22; padding: 6px 12px; border-radius: 6px; }
          .log-card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
          .log-body { padding: 16px; max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 13px; line-height: 1.6; }
          .log-entry { display: block; }
          .log-entry.error { color: #ff7b72; }
          .log-entry.warn { color: #e3b341; }
          .log-entry.success { color: #3fb950; }
          .log-entry.default { color: #8b949e; }
          .console-row { display: flex; border-top: 1px solid #21262d; padding: 10px; background: #0d1117; }
          .console-input { flex: 1; background: transparent; border: none; outline: none; color: #e6edf3; font-family: monospace; }
          .console-send { background: #238636; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>
          <h1>Bot Logs</h1>
          <div class="log-card">
            <div class="log-body" id="log-body">
              ${logs.map(l => `<span class="log-entry default">${escapeHTML(l)}</span>`).join('')}
            </div>
            <div class="console-row">
              <input id="console-input" class="console-input" type="text" placeholder="Send chat or command...">
              <button id="console-send" class="console-send" onclick="sendCmd()">Send</button>
            </div>
          </div>
        </main>
        <script>
          async function sendCmd() {
            const input = document.getElementById('console-input');
            const msg = input.value;
            if (!msg) return;
            await fetch('/send-command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: msg })
            });
            input.value = '';
            setTimeout(() => location.reload(), 500);
          }
        </script>
      </body>
    </html>
  `);
});

// API Endpoints
app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.post("/start", (req, res) => {
  if (!botState.connected) {
    initBot();
    res.json({ success: true, msg: "Starting bot..." });
  } else {
    res.json({ success: true, msg: "Bot is already running." });
  }
});

app.post("/stop", (req, res) => {
  if (bot) {
    bot.quit();
    bot = null;
    botState.connected = false;
    clearInterval(chatInterval);
    addLog("[CONTROL] Bot manually stopped.");
    res.json({ success: true, msg: "Bot stopped." });
  } else {
    res.json({ success: true, msg: "Bot is not online." });
  }
});

app.post("/send-command", (req, res) => {
  const { command } = req.body;
  if (bot && botState.connected && command) {
    bot.chat(command);
    addLog(`[CONSOLE] > ${command}`);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, msg: "Bot is offline or command empty" });
  }
});

// ============================================================
// MINEFLAYER BOT LOGIC
// ============================================================
function initBot() {
  if (bot) return;

  addLog(`Attempting connection to ${config.server.ip}:${config.server.port}...`);

  bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config["bot-account"].username,
    connectTimeout: 10000,          // Times out in 10s if server is offline (prevents hanging)
    physicsEnabled: false,          // Keeps RAM usage ultra-low
    viewDistance: "tiny",
    checkTimeoutInterval: 60 * 1000,
    plugins: {
      time: false,
      health: false
    }
  });

  bot.on("spawn", () => {
    botState.connected = true;
    addLog(`[SUCCESS] ${config["bot-account"].username} joined Aternos successfully!`);

    // Anti-AFK: Swing arm every 30 seconds to prevent Aternos idle kicks
    clearInterval(chatInterval);
    chatInterval = setInterval(() => {
      if (bot && botState.connected) {
        bot.swingArm("right");
      }
    }, 30000);
  });

  bot.on("end", (reason) => {
    cleanupAndReconnect(`Disconnected (${reason})`);
  });

  bot.on("error", (err) => {
    cleanupAndReconnect(`Connection error (${err.message})`);
  });
}

function cleanupAndReconnect(logMsg) {
  botState.connected = false;
  clearInterval(chatInterval);
  if (bot) {
    bot.removeAllListeners();
    bot = null;
  }
  addLog(`[RETRY] ${logMsg}. Retrying in 5 seconds...`);

  // Fast 5-second retry loop to catch Aternos the moment it finishes loading
  setTimeout(() => {
    if (!botState.connected) initBot();
  }, 5000);
}

// Start Server & Bot
app.listen(PORT, () => {
  addLog(`Dashboard listening on port ${PORT}`);
  initBot();
});
