/**
 * DocMind AI - Resilient Background Daemon Supervisor
 * Keeps DocMind AI server permanently active.
 * Automatically restarts server if it ever stops or crashes.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = __dirname;
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const DAEMON_LOG = path.join(LOGS_DIR, 'daemon.log');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] [DAEMON] ${msg}\n`;
  try {
    fs.appendFileSync(DAEMON_LOG, line, 'utf8');
  } catch (_) { }
  console.log(line.trim());
}

let child = null;
let isShuttingDown = false;
let restartAttempts = 0;
const MAX_FAST_RESTARTS = 10;
let lastStartTime = Date.now();

// Kill any orphaned process listening on port 3000 before starting
function freePort3000() {
  try {
    const output = execSync('netstat -ano | findstr :3000', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (pid && pid > 0 && pid !== process.pid) {
        log(`Freeing port 3000 from orphaned PID ${pid}`);
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } catch (_) { }
      }
    }
  } catch (_) {
    // Port is clean
  }
}

function startServer() {
  if (isShuttingDown) return;

  const now = Date.now();
  if (now - lastStartTime < 3000) {
    restartAttempts++;
  } else {
    restartAttempts = 0;
  }
  lastStartTime = now;

  if (restartAttempts > MAX_FAST_RESTARTS) {
    log(`⚠️ Too many rapid restarts (${restartAttempts}). Pausing 10 seconds before retry...`);
    setTimeout(() => {
      restartAttempts = 0;
      startServer();
    }, 10000);
    return;
  }

  freePort3000();

  log('🚀 Launching DocMind AI server (server.js)...');

  child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server.js')], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    try {
      fs.appendFileSync(DAEMON_LOG, data);
    } catch (_) { }
  });

  child.stderr.on('data', (data) => {
    try {
      fs.appendFileSync(DAEMON_LOG, data);
    } catch (_) { }
  });

  child.on('error', (err) => {
    log(`❌ Failed to start server: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    log(`⚠️ Server exited (code: ${code}, signal: ${signal}).`);
    child = null;
    if (!isShuttingDown) {
      log('🔄 Auto-restarting DocMind AI server in 2 seconds...');
      setTimeout(startServer, 2000);
    }
  });
}

function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('🛑 Daemon shutting down...');
  if (child) {
    try {
      child.kill('SIGTERM');
    } catch (_) { }
  }
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

log('====================================================');
log('DocMind AI Resilient Daemon started');
log(`Node: ${process.execPath} | PID: ${process.pid}`);
log('====================================================');

startServer();
