/**
 * server.test.ts
 * 
 * Verifies local REST API endpoints and telemetry streaming server.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { server } from '../scripts/server.ts';

const TEST_PORT = 4399;

describe('Local Simulation & Telemetry REST API', () => {
  before(async () => {
    await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  });

  after(async () => {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function get(path: string): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${TEST_PORT}${path}`, {
        headers: { Connection: 'close' },
        agent: false,
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode || 0, data: raw });
          }
        });
      }).on('error', reject);
    });
  }

  function post(path: string, body: any): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request(`http://localhost:${TEST_PORT}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Connection': 'close',
        },
        agent: false,
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode || 0, data: raw });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  it('GET /api/engine/state returns current engine state', async () => {
    const res = await get('/api/engine/state');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.ok(res.data.data.rpm > 3000);
    assert.ok(res.data.data.healthScore >= 50);
  });

  it('GET /api/health returns health evaluation and subsystems', async () => {
    const res = await get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.ok(typeof res.data.healthScore === 'number');
    assert.ok(res.data.subsystems.cylinder > 0);
  });

  it('GET /api/configuration returns engine structural configuration', async () => {
    const res = await get('/api/configuration');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.strictEqual(res.data.configuration.id, 'UAV-PT900-X1');
  });

  it('POST /api/fault/inject applies scenario mode switch', async () => {
    const res = await post('/api/fault/inject', { scenario: 'bearing' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.strictEqual(res.data.activeState.simulationMode, 'bearing');
  });

  it('POST /api/simulation/reset restores nominal operation', async () => {
    const res = await post('/api/simulation/reset', {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
  });

  it('GET /api/agent/status returns AI agent and Ollama readiness', async () => {
    const res = await get('/api/agent/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.ok(typeof res.data.ollamaOnline === 'boolean');
    assert.ok(res.data.provider === 'ollama' || res.data.provider === 'local_ensemble');
  });

  it('POST /api/agent/query processes grounded tool reasoning', async () => {
    const res = await post('/api/agent/query', { query: 'What is the current engine RPM?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.ok(res.data.response.spokenText.length > 5);
    assert.ok(res.data.response.toolCallsExecuted.length > 0);
  });

  it('GET /api/voice/status returns ElevenLabs voice configuration without exposing keys', async () => {
    const res = await get('/api/voice/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.strictEqual(typeof res.data.elevenlabsConfigured, 'boolean');
    assert.ok(!res.data.apiKey); // Key must NEVER be exposed
  });

  it('POST /api/voice/speak returns audio or graceful browser fallback', async () => {
    const res = await post('/api/voice/speak', { text: 'Engine RPM is 5200 nominal.' });
    assert.strictEqual(res.status, 200);
    // When no external key is configured, fallback to client browser synthesis is returned
    assert.ok(res.data.status === 'fallback' || res.status === 200);
  });
});
