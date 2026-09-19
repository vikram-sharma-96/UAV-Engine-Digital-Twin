/**
 * generate_dataset.ts
 * 
 * Standalone CLI dataset generator for AeroTwin AI.
 * 
 * Generates labeled CSV training datasets containing:
 * - True physics states (ground truth)
 * - Measured noisy sensor telemetry
 * - Atmospheric conditions (ISA)
 * - Digital twin residuals
 * - Fault classifications and severity
 * 
 * Usage:
 *   npm run dataset
 *   node scripts/generate_dataset.ts --scenario=OVERHEATING_RUN --duration=300 --out=dataset.csv
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DatasetGenerator } from '../src/engine/dataset/datasetGenerator.ts';
import { DEFAULT_ENGINE_PROFILE } from '../src/engine/config/defaultEngineProfile.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI args
const args = process.argv.slice(2);
const scenarioArg = args.find(a => a.startsWith('--scenario='))?.split('=')[1] || 'CRUISE_NOMINAL_RUN';
const durationArg = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '600');
const seedArg = parseInt(args.find(a => a.startsWith('--seed='))?.split('=')[1] || '42');
const outArg = args.find(a => a.startsWith('--out='))?.split('=')[1] || `telemetry_${scenarioArg.toLowerCase()}_${durationArg}s.csv`;

console.log('='.repeat(70));
console.log('  AeroTwin AI — Synthetic Telemetry Dataset Generator');
console.log('='.repeat(70));
console.log(`Scenario ID: ${scenarioArg}`);
console.log(`Duration:    ${durationArg} seconds (${(durationArg / 60).toFixed(1)} minutes)`);
console.log(`PRNG Seed:   ${seedArg}`);
console.log(`Output File: ${outArg}`);
console.log('\nGenerating time-series samples...');

const startTime = performance.now();

const dataset = DatasetGenerator.generateScenario({
  scenarioId: scenarioArg,
  name: `Exported ${scenarioArg} Run`,
  description: 'Synthetic UAV aero engine telemetry with ground truth physics and residuals',
  duration_s: durationArg,
  seed: seedArg,
  engineProfile: DEFAULT_ENGINE_PROFILE.id,
  degradationIndex: 0.05,
  faultsToInject: scenarioArg.includes('FAULT') || scenarioArg.includes('OVERHEATING') ? [
    {
      time_s: Math.floor(durationArg * 0.4),
      faultId: 'COOLING_SYSTEM_RESTRICTION',
      severity: 0.75,
      duration_s: Math.floor(durationArg * 0.5),
    }
  ] : [],
});

const csvContent = DatasetGenerator.toCSV(dataset.samples);
const outPath = path.resolve(process.cwd(), outArg);
fs.writeFileSync(outPath, csvContent, 'utf-8');

const duration_ms = performance.now() - startTime;
const stats = fs.statSync(outPath);

console.log(`\n✔ Generation Complete!`);
console.log(`- Samples Generated: ${dataset.samples.length.toLocaleString()}`);
console.log(`- File Size:         ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`- Generation Time:   ${duration_ms.toFixed(2)} ms`);
console.log(`- Saved To:          ${outPath}`);
console.log('='.repeat(70));
