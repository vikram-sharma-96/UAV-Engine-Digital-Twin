/**
 * dataset_generator.test.ts
 * 
 * Verifies synthetic dataset generation, metadata completeness,
 * ground truth labeling, and CSV conversion.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DatasetGenerator, type DatasetScenario } from '../src/engine/dataset/datasetGenerator.ts';

describe('Synthetic Dataset Generator', () => {
  const scenario: DatasetScenario = {
    scenarioId: 'SCENARIO-TEST-001',
    name: 'Overheating Transient Run',
    description: '10s warm-up followed by 10s radiator blockage',
    duration_s: 20,
    seed: 42,
    engineProfile: 'UAV-PT900-X1',
    faultsToInject: [
      {
        fault: {
          id: 'OVERHEATING',
          name: 'Cooling Blockage',
          description: 'Radiator obstruction',
          severity: 0.8,
          targetSubsystem: 'COOLING',
        },
        start_s: 10,
        duration_s: 10,
      },
    ],
    degradationIndex: 0.1,
  };

  it('generates correct number of samples with complete ground-truth labels', () => {
    const { metadata, samples } = DatasetGenerator.generateScenario(scenario);

    assert.strictEqual(samples.length, 20);
    assert.strictEqual(metadata.scenario_id, 'SCENARIO-TEST-001');
    assert.strictEqual(metadata.random_seed, 42);

    // Initial 10 seconds: healthy (primary fault NONE)
    assert.strictEqual(samples[5].primary_fault_label, 'NONE');

    // After 10 seconds: fault active (OVERHEATING)
    assert.strictEqual(samples[15].primary_fault_label, 'OVERHEATING');
    assert.strictEqual(samples[15].fault_severity, 0.8);
    // CHT should show increasing temperature trend during fault
    assert.ok(samples[18].true_cht_C > samples[8].true_cht_C);
  });

  it('exports valid non-empty CSV formatted data', () => {
    const { samples } = DatasetGenerator.generateScenario(scenario);
    const csv = DatasetGenerator.toCSV(samples);

    const lines = csv.split('\n');
    // Header line + 20 data rows = 21 lines
    assert.strictEqual(lines.length, 21);
    assert.ok(lines[0].includes('timestamp_s,flight_phase'));
    assert.ok(lines[0].includes('primary_fault_label,fault_severity'));
  });
});
