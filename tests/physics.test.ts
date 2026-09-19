/**
 * physics.test.ts
 * 
 * Automated verification of core physical laws, dimensional consistency,
 * ISA atmosphere equations, and thermal dynamics.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AtmosphereModel } from '../src/engine/environment/atmosphere.ts';
import { IntakeCombustionModel } from '../src/engine/physics/intakeCombustion.ts';
import { EngineDynamicsModel } from '../src/engine/physics/dynamics.ts';
import { ThermalModel } from '../src/engine/physics/thermal.ts';
import { LubricationModel } from '../src/engine/physics/lubrication.ts';
import { VibrationModel } from '../src/engine/physics/vibration.ts';
import { DEFAULT_ENGINE_PROFILE } from '../src/engine/config/defaultEngineProfile.ts';

describe('Atmosphere Model (ISA Equations)', () => {
  it('calculates standard sea-level pressure and temperature correctly', () => {
    const sl = AtmosphereModel.calculate(0);
    assert.strictEqual(Math.round(sl.ambientPressure_Pa), 101325);
    assert.strictEqual(parseFloat(sl.ambientTemperature_K.toFixed(2)), 288.15);
    assert.ok(Math.abs(sl.airDensity_kg_per_m3 - 1.225) < 0.01);
  });

  it('calculates decreasing pressure and density with altitude', () => {
    const sl = AtmosphereModel.calculate(0);
    const alt2400 = AtmosphereModel.calculate(2400); // 2400m cruise

    assert.ok(alt2400.ambientPressure_Pa < sl.ambientPressure_Pa);
    assert.ok(alt2400.airDensity_kg_per_m3 < sl.airDensity_kg_per_m3);
    assert.ok(alt2400.ambientTemperature_K < sl.ambientTemperature_K);
    // At 2400m: P ~ 75 kPa, rho ~ 0.95 kg/m³, T ~ 272.55 K (-0.6 °C)
    assert.ok(alt2400.ambientPressure_Pa > 70000 && alt2400.ambientPressure_Pa < 80000);
  });
});

describe('Intake and Combustion Model', () => {
  const env = AtmosphereModel.calculate(2400);

  it('maintains dimensional consistency between power, torque, and angular velocity (P = tau * omega)', () => {
    const slEnv = AtmosphereModel.calculate(0);
    const slResult = IntakeCombustionModel.calculate(DEFAULT_ENGINE_PROFILE, slEnv, 1.0, 5800);
    const omegaSl = (5800 * 2 * Math.PI) / 60;
    // At sea-level max power, power = torque * omega ~ 58-75 kW
    assert.ok(Math.abs(slResult.brakePower_W - slResult.brakeTorque_Nm * omegaSl) < 1.0);
    assert.ok(slResult.brakePower_W > 50000 && slResult.brakePower_W < 78000);

    // At 2400m cruise (0.82 throttle), power is lower due to altitude density
    const altResult = IntakeCombustionModel.calculate(DEFAULT_ENGINE_PROFILE, env, 0.82, 5200);
    const omegaAlt = (5200 * 2 * Math.PI) / 60;
    assert.ok(Math.abs(altResult.brakePower_W - altResult.brakeTorque_Nm * omegaAlt) < 1.0);
    assert.ok(altResult.brakePower_W > 25000 && altResult.brakePower_W < 60000);
  });

  it('increases MAP and airflow as throttle increases', () => {
    const idle = IntakeCombustionModel.calculate(DEFAULT_ENGINE_PROFILE, env, 0.1, 1400);
    const cruise = IntakeCombustionModel.calculate(DEFAULT_ENGINE_PROFILE, env, 0.8, 5200);

    assert.ok(cruise.manifoldPressure_Pa > idle.manifoldPressure_Pa);
    assert.ok(cruise.airMassFlow_kg_s > idle.airMassFlow_kg_s);
    assert.ok(cruise.fuelConsumption_L_h > idle.fuelConsumption_L_h);
  });

  it('fails safely against invalid/negative inputs', () => {
    const result = IntakeCombustionModel.calculate(DEFAULT_ENGINE_PROFILE, env, -0.5, -500);
    assert.ok(result.brakeTorque_Nm >= 0);
    assert.ok(result.fuelConsumption_L_h >= 0);
    assert.ok(!isNaN(result.brakePower_W));
  });
});

describe('Engine Rotational Dynamics', () => {
  it('decelerates when propeller load exceeds engine torque and accelerates when engine torque is higher', () => {
    const env = AtmosphereModel.calculate(2400);
    // High engine torque at low RPM accelerates
    const acc = EngineDynamicsModel.step(2000, 120, env.airDensity_kg_per_m3, 0.1, DEFAULT_ENGINE_PROFILE);
    assert.ok(acc.nextRpm > 2000);

    // Zero engine torque at high RPM decelerates
    const dec = EngineDynamicsModel.step(5500, 0, env.airDensity_kg_per_m3, 0.1, DEFAULT_ENGINE_PROFILE);
    assert.ok(dec.nextRpm < 5500);
  });
});

describe('Dynamic Thermal Model', () => {
  const env = AtmosphereModel.calculate(2400);

  it('exhibits thermal inertia: temperatures smoothly transition over time', () => {
    const initial = ThermalModel.getBaselineState(env.ambientTemperature_K);
    // Step forward with heat input
    const next1 = ThermalModel.step(initial, 60000, 14.7, 5200, 72.0, env, 1.0);
    const deltaT1 = Math.abs(next1.cht_K - initial.cht_K);

    // In 1 second, CHT should change smoothly by a realistic delta (~0.05 - 3 K), NOT jump instantly
    assert.ok(deltaT1 > 0.05 && deltaT1 < 3.0);
  });
});

describe('Lubrication and Vibration Models', () => {
  it('decreases oil pressure when oil temperature increases (viscosity thinning)', () => {
    const cold = LubricationModel.calculatePressure(5200, 273.15 + 40, DEFAULT_ENGINE_PROFILE);
    const hot = LubricationModel.calculatePressure(5200, 273.15 + 110, DEFAULT_ENGINE_PROFILE);

    assert.ok(hot.oilPressure_bar < cold.oilPressure_bar);
    assert.ok(hot.oilPressure_bar >= 2.0); // Safe minimum
  });

  it('correlates vibration with RPM and bearing defect states', () => {
    const normal = VibrationModel.calculate(5200, 0.8, 0, 0, 0);
    const bearingFault = VibrationModel.calculate(5200, 0.8, 0.9, 0, 0);

    assert.ok(bearingFault.totalRms_mm_s > normal.totalRms_mm_s);
    assert.ok(bearingFault.bearingHighFreq_mm_s > 2.0);
  });
});
