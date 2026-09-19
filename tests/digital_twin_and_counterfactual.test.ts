/**
 * digital_twin_and_counterfactual.test.ts
 * 
 * Verifies:
 * - Digital twin observer expected state calculations
 * - Telemetry residual computation (measured - expected)
 * - Deterministic health score evaluation
 * - Counterfactual simulation isolation (verifying live engine state is NOT mutated)
 * - Seedable PRNG reproducibility
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DigitalTwinEngine } from '../src/engine/twin/digitalTwinEngine.ts';
import { CounterfactualEngine } from '../src/engine/counterfactual/counterfactualSim.ts';
import { AtmosphereModel } from '../src/engine/environment/atmosphere.ts';
import { PRNG } from '../src/engine/utils/prng.ts';
import type { TrueEngineState, MeasuredTelemetry } from '../src/engine/types.ts';

describe('Digital Twin Observer and Residuals', () => {
  const twin = new DigitalTwinEngine();

  const nominalMeasured: MeasuredTelemetry = {
    timestamp_ms: 1000,
    rpm: 5200,
    manifoldPressure_bar: 0.95,
    fuelFlow_L_h: 13.2,
    cht_C: 78.0,
    egt_C: 642,
    oilPressure_bar: 4.3,
    oilTemperature_C: 80.0,
    vibration_mm_s: 1.2,
    alternatorVoltage_V: 14.2,
    throttle_pct: 85,
    engineLoad_pct: 82,
    altitude_m: 2400,
    ambientTemp_C: -0.6,
    airDensity_kg_per_m3: 0.95,
    torque_Nm: 115,
    power_kW: 62.5,
    sensorDropoutFlags: {},
  };

  it('computes small residuals and high health score for nominal telemetry', () => {
    const expected = twin.calculateExpectedState(0.85, 2400, -0.6);
    const residuals = twin.computeResiduals(nominalMeasured, expected);
    const health = twin.evaluateHealth(residuals, nominalMeasured);

    assert.ok(health.healthScore >= 90);
    assert.strictEqual(health.engineStatus, 'HEALTHY');
    assert.strictEqual(health.faultRisk, 'LOW');
    assert.ok(Math.abs(residuals.chtResidual) < 15);
  });

  it('penalizes health score transparently when residuals deviate severely', () => {
    const faultyMeasured: MeasuredTelemetry = {
      ...nominalMeasured,
      cht_C: 115.0, // High CHT
      oilPressure_bar: 1.8, // Low oil pressure
      vibration_mm_s: 4.2, // High vibration
    };

    const expected = twin.calculateExpectedState(0.85, 2400, -0.6);
    const residuals = twin.computeResiduals(faultyMeasured, expected);
    const health = twin.evaluateHealth(residuals, faultyMeasured);

    assert.ok(health.healthScore < 60);
    assert.strictEqual(health.engineStatus, 'CRITICAL');
    assert.strictEqual(health.faultRisk, 'CRITICAL');
    assert.ok(residuals.chtResidual > 25);
    assert.ok(residuals.oilPressureResidual < -1.5);
  });
});

describe('Counterfactual Simulation Isolation', () => {
  const env = AtmosphereModel.calculate(2400);
  const liveState: TrueEngineState = {
    timestamp_s: 100,
    rpm: 5200,
    angularVelocity_rad_s: (5200 * 2 * Math.PI) / 60,
    throttle: 0.82,
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

  it('NEVER mutates live engine state when evaluating a counterfactual scenario', () => {
    // Snapshot of live state before counterfactual
    const liveSnapshotBefore = JSON.stringify(liveState);

    // Run counterfactual with ambient temperature increase
    const result = CounterfactualEngine.evaluate(
      liveState,
      env,
      {
        ambientTempDeltaC: +15,
      },
      15
    );

    // Check that counterfactual produced meaningful delta predictions (higher ambient yields higher CHT)
    assert.ok(result.deltas.chtDelta_C > 0);
    assert.ok(result.counterfactualFinal.cht_C > result.baselineFinal.cht_C);

    // Verify live state remains 100% UNMUTATED
    const liveSnapshotAfter = JSON.stringify(liveState);
    assert.strictEqual(liveSnapshotBefore, liveSnapshotAfter);
  });
});

describe('PRNG Reproducibility', () => {
  it('produces identical sequences given the same seed', () => {
    const prng1 = new PRNG(999);
    const prng2 = new PRNG(999);

    for (let i = 0; i < 50; i++) {
      assert.strictEqual(prng1.random(), prng2.random());
      assert.strictEqual(prng1.gaussian(0, 1), prng2.gaussian(0, 1));
    }
  });

  it('produces different sequences given different seeds', () => {
    const prng1 = new PRNG(100);
    const prng2 = new PRNG(200);

    assert.notStrictEqual(prng1.random(), prng2.random());
  });
});
