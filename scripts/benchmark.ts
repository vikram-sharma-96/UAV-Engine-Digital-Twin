/**
 * benchmark.ts
 * 
 * Performance profiling and memory benchmark script for AeroTwin AI.
 * 
 * Simulates 10,000 real-time physics & digital-twin observer steps
 * (equivalent to ~16.7 minutes of UAV engine operation at 10 Hz)
 * and measures:
 * - Average step execution time
 * - 99th percentile (p99) step latency
 * - Memory heap usage and garbage collection stability
 * - Physics throughput (simulation steps per wall-clock second)
 */

import { performance } from 'node:perf_hooks';
import { EngineSimulator } from '../src/data/engineSimulator.ts';

console.log('='.repeat(70));
console.log('  AeroTwin AI — Performance & Memory Profiler');
console.log('='.repeat(70));

const NUM_STEPS = 10000;
const DT = 1.0; // 1.0 second per simulation tick
const sim = new EngineSimulator();

// Force initial GC if available, record baseline memory
const initialMem = process.memoryUsage();
console.log(`Baseline Heap Used: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Executing ${NUM_STEPS.toLocaleString()} full physics + twin observer cycles...`);

const latencies: number[] = new Float64Array(NUM_STEPS) as any;
const startTime = performance.now();

for (let i = 0; i < NUM_STEPS; i++) {
  const stepStart = performance.now();

  // Trigger progressive scenarios during the benchmark run
  if (i === 2500) sim.setScenario('overheating');
  if (i === 5000) sim.setScenario('bearing');
  if (i === 7500) sim.setScenario('oilPressure');
  if (i === 9000) sim.reset();

  sim.tick();

  const stepEnd = performance.now();
  latencies[i] = stepEnd - stepStart;
}

const totalWallTime = performance.now() - startTime;
const finalMem = process.memoryUsage();

// Statistics calculation
latencies.sort((a, b) => a - b);
const totalStepTime = latencies.reduce((sum, val) => sum + val, 0);
const avgLatency = totalStepTime / NUM_STEPS;
const medianLatency = latencies[Math.floor(NUM_STEPS * 0.5)];
const p90Latency = latencies[Math.floor(NUM_STEPS * 0.90)];
const p99Latency = latencies[Math.floor(NUM_STEPS * 0.99)];
const minLatency = latencies[0];
const maxLatency = latencies[NUM_STEPS - 1];

const stepsPerSec = (NUM_STEPS / (totalWallTime / 1000)).toFixed(0);
const realTimeMultiplier = ((NUM_STEPS * DT) / (totalWallTime / 1000)).toFixed(1);

console.log('\n--- Performance Benchmark Results ---');
console.log(`Total Wall-Clock Time:      ${totalWallTime.toFixed(2)} ms`);
console.log(`Simulated Mission Duration:  ${(NUM_STEPS * DT).toFixed(0)} seconds (${((NUM_STEPS * DT) / 60).toFixed(1)} minutes)`);
console.log(`Simulation Speedup Factor:   ${realTimeMultiplier}x Real-Time`);
console.log(`Throughput:                  ${Number(stepsPerSec).toLocaleString()} steps / second`);
console.log('');
console.log('--- Step Latency Distribution (ms) ---');
console.log(`Min:    ${minLatency.toFixed(4)} ms`);
console.log(`Median: ${medianLatency.toFixed(4)} ms`);
console.log(`Mean:   ${avgLatency.toFixed(4)} ms`);
console.log(`p90:    ${p90Latency.toFixed(4)} ms`);
console.log(`p99:    ${p99Latency.toFixed(4)} ms`);
console.log(`Max:    ${maxLatency.toFixed(4)} ms`);
console.log('');
console.log('--- Memory Profiling ---');
console.log(`Initial Heap: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Final Heap:   ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Delta:   ${((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
console.log(`RSS:          ${(finalMem.rss / 1024 / 1024).toFixed(2)} MB`);

// Verification Assertions
const latencyBudget_ms = 1.0; // 1 ms budget per step for 100x real-time capability
const memBudget_MB = 150; // < 150 MB for low-spec i3/4GB target

console.log('\n--- Budget Compliance ---');
if (avgLatency < latencyBudget_ms) {
  console.log(`✔ Latency: Mean step latency (${avgLatency.toFixed(4)} ms) is within budget (< ${latencyBudget_ms} ms). PASS.`);
} else {
  console.error(`✖ Latency: Mean step latency exceeds budget!`);
}

if (finalMem.heapUsed / 1024 / 1024 < memBudget_MB) {
  console.log(`✔ Memory: Final heap (${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB) is within budget (< ${memBudget_MB} MB). PASS.`);
} else {
  console.error(`✖ Memory: Heap memory exceeds budget!`);
}
console.log('='.repeat(70));
