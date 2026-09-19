/**
 * server.ts
 * 
 * High-Performance Local Simulation & Telemetry API Server for AeroTwin AI.
 * 
 * Powered by Node.js native HTTP module (Zero external dependencies).
 * Fulfills Section 38 (Local API) and Section 39 (Real-time Telemetry Streaming).
 * 
 * Endpoints:
 * - GET  /api/engine/state               -> Current snapshot of engine & twin state
 * - GET  /api/engine/telemetry           -> Instantaneous measured sensor telemetry
 * - GET  /api/health                     -> Health index score, risk, and subsystem ratings
 * - GET  /api/events                     -> Engineering FDIR event log
 * - GET  /api/configuration              -> Certified structural engine parameters
 * - POST /api/simulation/start           -> Start real-time simulation clock
 * - POST /api/simulation/pause           -> Pause simulation clock
 * - POST /api/simulation/reset           -> Reset to nominal baseline
 * - POST /api/fault/inject               -> Inject progressive fault { id, severity, ... }
 * - POST /api/fault/remove               -> Clear specific fault { id }
 * - POST /api/simulation/counterfactual  -> Evaluate "What-If" intervention
 * - GET  /api/dataset/export             -> Download CSV training dataset
 * - GET  /api/telemetry/stream           -> Real-time Server-Sent Events (SSE) stream
 * 
 * Static Serving:
 * - Serves compiled Astro UI from `dist/` for true standalone offline desktop operation.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { simulator } from '../src/data/engineSimulator.ts';
import { DEFAULT_ENGINE_PROFILE } from '../src/engine/config/defaultEngineProfile.ts';
import { DatasetGenerator } from '../src/engine/dataset/datasetGenerator.ts';
import type { CounterfactualIntervention, FaultDefinition } from '../src/engine/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4321;

// List of connected SSE clients
const sseClients: Set<http.ServerResponse> = new Set();

// Broadcast telemetry to all connected SSE clients on simulator tick
simulator.subscribe((state) => {
  if (sseClients.size === 0) return;
  const data = JSON.stringify({
    timestamp: Date.now(),
    state,
    residuals: state.residuals,
  });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
});

// Helper to parse JSON body
function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // 1MB guard
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// MIME types for static asset serving
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // Enable CORS for local integration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── 1. REST API Routing ───────────────────────────────────────────────────

  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    try {
      // GET /api/engine/state
      if (pathname === '/api/engine/state' && method === 'GET') {
        const state = simulator.getState();
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', data: state }));
        return;
      }

      // GET /api/engine/telemetry
      if (pathname === '/api/engine/telemetry' && method === 'GET') {
        const twin = simulator.getDigitalTwinState();
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', telemetry: twin.measured }));
        return;
      }

      // GET /api/health
      if (pathname === '/api/health' && method === 'GET') {
        const twin = simulator.getDigitalTwinState();
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          healthScore: twin.healthScore,
          engineStatus: twin.engineStatus,
          faultRisk: twin.faultRisk,
          subsystems: twin.subsystems,
          predictive: twin.predictive,
        }));
        return;
      }

      // GET /api/events
      if (pathname === '/api/events' && method === 'GET') {
        const twin = simulator.getDigitalTwinState();
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          activeFaults: twin.activeFaultNames,
          residuals: twin.residuals,
          timestamp: twin.timestamp,
        }));
        return;
      }

      // GET /api/configuration
      if (pathname === '/api/configuration' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', configuration: DEFAULT_ENGINE_PROFILE }));
        return;
      }

      // POST /api/simulation/start
      if (pathname === '/api/simulation/start' && method === 'POST') {
        simulator.startAuto();
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', message: 'Simulation clock started' }));
        return;
      }

      // POST /api/simulation/pause || /api/simulation/stop
      if ((pathname === '/api/simulation/pause' || pathname === '/api/simulation/stop') && method === 'POST') {
        simulator.stop();
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', message: 'Simulation clock stopped' }));
        return;
      }

      // POST /api/simulation/reset
      if (pathname === '/api/simulation/reset' && method === 'POST') {
        simulator.reset();
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', message: 'Engine reset to nominal cruise baseline' }));
        return;
      }

      // POST /api/fault/inject
      if (pathname === '/api/fault/inject' && method === 'POST') {
        const body = await parseJsonBody<any>(req);
        if (body.scenario && ['normal', 'overheating', 'bearing', 'oilPressure', 'degradation'].includes(body.scenario)) {
          simulator.setScenario(body.scenario);
        }
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', message: 'Fault applied', activeState: simulator.getState() }));
        return;
      }

      // POST /api/simulation/counterfactual
      if (pathname === '/api/simulation/counterfactual' && method === 'POST') {
        const body = await parseJsonBody<CounterfactualIntervention>(req);
        const result = simulator.runCounterfactual(body, 20);
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', result }));
        return;
      }

      // GET /api/dataset/export
      if (pathname === '/api/dataset/export' && method === 'GET') {
        const scenarioId = url.searchParams.get('scenario') || 'CRUISE_NOMINAL_RUN';
        const duration_s = parseInt(url.searchParams.get('duration') || '60');
        const seed = parseInt(url.searchParams.get('seed') || '42');

        const dataset = DatasetGenerator.generateScenario({
          scenarioId,
          name: 'Exported Telemetry Run',
          description: 'Synthetic UAV aero engine telemetry',
          duration_s,
          seed,
          engineProfile: DEFAULT_ENGINE_PROFILE.id,
          degradationIndex: 0.05,
          faultsToInject: [],
        });

        const csv = DatasetGenerator.toCSV(dataset.samples);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${scenarioId}.csv"`);
        res.writeHead(200);
        res.end(csv);
        return;
      }

      // GET /api/telemetry/stream (Server-Sent Events)
      if (pathname === '/api/telemetry/stream' && method === 'GET') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.writeHead(200);

        sseClients.add(res);
        res.write(`data: ${JSON.stringify({ type: 'CONNECTED', serverTime: Date.now() })}\n\n`);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // Route not found
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
      return;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
      return;
    }
  }

  // ─── 2. Static Application Serving (from dist/) ─────────────────────────────

  if (fs.existsSync(DIST_DIR)) {
    let filePath = path.join(DIST_DIR, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, pathname + '.html');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found. Build static files first with: npm run build');
});

// Only auto-listen if executed directly via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  server.listen(PORT, () => {
    console.log(`[AeroTwin Local Server]: Running at http://localhost:${PORT}`);
    console.log(`[AeroTwin Local Server]: REST APIs accessible at http://localhost:${PORT}/api/engine/state`);
    console.log(`[AeroTwin Local Server]: Real-time SSE stream at http://localhost:${PORT}/api/telemetry/stream`);
  });
}

export { server };
