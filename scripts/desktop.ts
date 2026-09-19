/**
 * desktop.ts
 * 
 * AeroTwin AI Desktop Launcher Script.
 * 
 * Boots the zero-dependency local simulation server and opens the application
 * in an isolated native desktop application window (Chromium/Edge App Mode)
 * without address bar or browser chrome, providing an authentic desktop app experience.
 */

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { server } from './server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4321;
const APP_URL = `http://localhost:${PORT}`;

console.log('='.repeat(70));
console.log('  AeroTwin AI — Desktop Application Launcher');
console.log('='.repeat(70));
console.log(`[Desktop Launcher]: Initializing local physics simulation server on port ${PORT}...`);

server.listen(PORT, () => {
  console.log(`[Desktop Launcher]: Server listening at ${APP_URL}`);
  console.log(`[Desktop Launcher]: Launching application window...`);

  const platform = os.platform();
  const appArg = `--app=${APP_URL}`;
  let browserProcess: any = null;

  if (platform === 'win32') {
    // Try Edge app mode first (built into every Windows 10/11 system)
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ];

    let launched = false;
    for (const exe of edgePaths) {
      try {
        browserProcess = spawn(exe, [appArg, '--window-size=1440,900'], {
          detached: true,
          stdio: 'ignore',
        });
        browserProcess.unref();
        launched = true;
        console.log(`[Desktop Launcher]: Application launched via ${path.basename(exe)} in App Mode.`);
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!launched) {
      // Fallback to default system browser via shell start
      spawn('cmd.exe', ['/c', 'start', APP_URL], { detached: true, stdio: 'ignore' });
      console.log(`[Desktop Launcher]: Opened in default browser via shell start.`);
    }
  } else if (platform === 'darwin') {
    // macOS
    spawn('open', ['-na', 'Google Chrome', '--args', appArg], { detached: true, stdio: 'ignore' });
  } else {
    // Linux
    spawn('xdg-open', [APP_URL], { detached: true, stdio: 'ignore' });
  }

  console.log('\n[Desktop Launcher]: AeroTwin AI is active.');
  console.log('[Desktop Launcher]: Press Ctrl+C in this terminal to shut down the server.');
});

// Handle graceful shutdown
function handleShutdown() {
  console.log('\n[Desktop Launcher]: Shutting down AeroTwin AI server...');
  if (typeof (server as any).closeAllConnections === 'function') {
    (server as any).closeAllConnections();
  }
  server.close(() => {
    console.log('[Desktop Launcher]: Server closed cleanly. Goodbye.');
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
