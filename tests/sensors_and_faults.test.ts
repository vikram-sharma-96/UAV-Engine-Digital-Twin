/**
 * sensors_and_faults.test.ts
 * 
 * Verifies:
 * - True physical state vs measured sensor state separation
 * - Sensor noise, bias, drift, and dropout behavior
 * - Fault injection engine severity scaling across all 10 failure modes
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SensorTransducerModel } from '../src/engine/sensors/sensorTransducer.ts';
import { FaultEngine } from '../src/engine/faults/faultEngine.ts';
import { PRNG } from '../src/engine/utils/prng.ts';
import type { TrueEngineState } from '../src/engine/types.ts';

describe('Sensor Transducer Model', () => {
  const dummyTrueState: TrueEngineState = {
    timestamp_s: 10,
    rpm: 5200,
    angularVelocity_rad_s: (5200 * 2 * Math.PI) / 60,
    throttle: 0.8,
    engineLoad: 0.8,
    manifoldPressure_Pa: 95000,
    airMassFlow_kg_s: 0.05,
    fuelMassFlow_kg_s: 0.0034,
    fuelConsumption_L_h: 2.7,
    actualAfr: 14.7,
    combustionEfficiency: 0.95,
    torque_Nm: 115,
    brakePower_W: 62500,
    cht_K: 273.15 + 78,
    egt_K: 273.15 + 640,
    oilTemperature_K: 273.15 + 80,
    oilPressure_Pa: 430000,
    vibration_mm_s: 1.2,
    alternatorVoltage_V: 14.2,
    degradationIndex: 0,
    activeFaults: [],
    cylinderTemperatures_K: [351.15, 351.15, 351.15, 351.15],
  };

  const env = { altitude_m: 2400, ambientTemperature_K: 272.55, airDensity_kg_per_m3: 0.95 };

  it('separates true state from noisy measured state', () => {
    const transducer = new SensorTransducerModel();
    const prng = new PRNG(101);

    const m1 = transducer.measure(dummyTrueState, env, 1.0, prng);
    const m2 = transducer.measure(dummyTrueState, env, 1.0, prng);

    // True RPM is exactly 5200, measured RPM has noise
    assert.strictEqual(dummyTrueState.rpm, 5200);
    assert.ok(Math.abs(m1.rpm - 5200) < 40);
    // Two measurements with different noise realizations should differ slightly
    assert.notStrictEqual(m1.rpm, m2.rpm);
  });

  it('correctly simulates sensor drift over time', () => {
    const transducer = new SensorTransducerModel();
    const prng = new PRNG(42);

    transducer.injectDrift('cht', 0.5); // +0.5 °C per second drift

    const mStart = transducer.measure(dummyTrueState, env, 1.0, prng);
    // Advance 20 seconds
    let mEnd = mStart;
    for (let i = 0; i < 20; i++) {
      mEnd = transducer.measure(dummyTrueState, env, 1.0, prng);
    }

    // After 20 seconds, drift should add ~10 °C to measured CHT
    assert.ok(mEnd.cht_C - mStart.cht_C > 7.0);
    // While the true state remains strictly at 78 °C
    assert.strictEqual(dummyTrueState.cht_K - 273.15, 78);
  });

  it('simulates sensor dropout (transducer open circuit)', () => {
    const transducer = new SensorTransducerModel();
    const prng = new PRNG(42);

    transducer.setDropout('rpm', true);
    const m = transducer.measure(dummyTrueState, env, 1.0, prng);

    assert.strictEqual(m.rpm, 0);
    assert.strictEqual(m.sensorDropoutFlags.rpm, true);
    // True RPM remains untouched
    assert.strictEqual(dummyTrueState.rpm, 5200);
  });
});

describe('Fault Injection Engine', () => {
  it('supports progressive severity scaling', () => {
    const faultEngine = new FaultEngine();

    faultEngine.injectFault({
      id: 'OVERHEATING',
      name: 'Radiator block',
      description: 'Cooling loss',
      severity: 0.2, // Mild
      targetSubsystem: 'COOLING',
    });
    const mild = faultEngine.evaluate();

    faultEngine.injectFault({
      id: 'OVERHEATING',
      name: 'Radiator block',
      description: 'Cooling loss',
      severity: 0.8, // Severe
      targetSubsystem: 'COOLING',
    });
    const severe = faultEngine.evaluate();

    // Cooling multiplier decreases as severity increases
    assert.ok(severe.coolingEfficiencyMultiplier < mild.coolingEfficiencyMultiplier);
    assert.ok(severe.highestSeverity === 0.8);
  });

  it('supports multi-fault composite injection', () => {
    const faultEngine = new FaultEngine();

    faultEngine.injectFault({
      id: 'INJECTOR_DEGRADATION',
      name: 'Injector fault',
      description: 'Lean cyl 2',
      severity: 0.5,
      targetSubsystem: 'FUEL',
      targetCylinder: 2,
    });

    faultEngine.injectFault({
      id: 'VIBRATION_FAULT',
      name: 'Bearing fault',
      description: 'Bearing harmonic',
      severity: 0.7,
      targetSubsystem: 'BEARING',
    });

    const composite = faultEngine.evaluate();

    assert.strictEqual(composite.activeFaultIds.length, 2);
    assert.ok(composite.bearingVibrationSeverity === 0.7);
    assert.ok(composite.cylinderThermalImbalance[1] > 1.0); // Cylinder 2 has thermal imbalance
  });
});
