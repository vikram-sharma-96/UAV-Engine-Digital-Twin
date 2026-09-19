/**
 * counterfactualSim.ts
 * 
 * Counterfactual "What-If?" Simulation Engine.
 * 
 * Evaluates hypothetical engineering interventions:
 * - "What if aerodynamic load increases by 15%?"
 * - "What if ambient temperature increases by 10 °C?"
 * - "What if injector efficiency drops by 20%?"
 * - "What if engine is throttled back to 60%?"
 * 
 * CRITICAL RULE:
 * Must NEVER mutate the active live digital twin state.
 * Clones state into an isolated lightweight numerical sandbox, steps forward,
 * and computes trajectory differences.
 */

import type {
  TrueEngineState,
  EnvironmentConditions,
  CounterfactualIntervention,
  CounterfactualResult,
  MeasuredTelemetry,
  EngineConfig,
} from '../types.ts';
import { IntakeCombustionModel } from '../physics/intakeCombustion.ts';
import { EngineDynamicsModel } from '../physics/dynamics.ts';
import { ThermalModel, type ThermalState } from '../physics/thermal.ts';
import { LubricationModel } from '../physics/lubrication.ts';
import { VibrationModel } from '../physics/vibration.ts';
import { AtmosphereModel } from '../environment/atmosphere.ts';
import { SensorTransducerModel } from '../sensors/sensorTransducer.ts';
import { PRNG } from '../utils/prng.ts';
import { DEFAULT_ENGINE_PROFILE } from '../config/defaultEngineProfile.ts';

export class CounterfactualEngine {
  /**
   * Run isolated forward simulation comparing baseline to counterfactual.
   * 
   * @param liveState Current snapshot of true engine state (unmutated)
   * @param liveEnv Current ambient environment
   * @param intervention "What-If" parameter modifications
   * @param steps Number of future seconds to simulate (e.g. 15s to 30s)
   * @param config Engine configuration profile
   */
  static evaluate(
    liveState: TrueEngineState,
    liveEnv: EnvironmentConditions,
    intervention: CounterfactualIntervention,
    steps: number = 20,
    config: EngineConfig = DEFAULT_ENGINE_PROFILE
  ): CounterfactualResult {
    // 1. Create independent baseline clone
    const simBaselineState = JSON.parse(JSON.stringify(liveState)) as TrueEngineState;
    const simBaselineEnv = { ...liveEnv };

    // 2. Create independent counterfactual clone
    const simCfState = JSON.parse(JSON.stringify(liveState)) as TrueEngineState;
    const simCfEnv: EnvironmentConditions = {
      ...liveEnv,
      ambientTemperature_K: liveEnv.ambientTemperature_K + (intervention.ambientTempDeltaC || 0),
      altitude_m: liveEnv.altitude_m + (intervention.altitudeDelta_m || 0),
    };
    // Recalculate counterfactual air density if temp or altitude changed
    if (intervention.ambientTempDeltaC || intervention.altitudeDelta_m) {
      const recalculated = AtmosphereModel.calculate(
        simCfEnv.altitude_m,
        simCfEnv.ambientTemperature_K - 288.15
      );
      simCfEnv.ambientPressure_Pa = recalculated.ambientPressure_Pa;
      simCfEnv.airDensity_kg_per_m3 = recalculated.airDensity_kg_per_m3;
    }

    const baselineSensor = new SensorTransducerModel();
    const cfSensor = new SensorTransducerModel();
    const prng = new PRNG(1337); // Fixed seed for comparability

    let baselineThermal: ThermalState = {
      cht_K: simBaselineState.cht_K,
      egt_K: simBaselineState.egt_K,
      oilTemperature_K: simBaselineState.oilTemperature_K,
      cylinderTemperatures_K: [...simBaselineState.cylinderTemperatures_K],
    };

    let cfThermal: ThermalState = {
      cht_K: simCfState.cht_K,
      egt_K: simCfState.egt_K,
      oilTemperature_K: simCfState.oilTemperature_K,
      cylinderTemperatures_K: [...simCfState.cylinderTemperatures_K],
    };

    const loadMultiplier = 1.0 + (intervention.loadDeltaPct || 0) / 100.0;
    const cfThrottle = Math.max(0.0, Math.min(1.0, simCfState.throttle + (intervention.throttleDelta || 0)));
    const injectorEfficiencyFactor = 1.0 - (intervention.injectorEfficiencyDeltaPct || 0) / 100.0;

    let baselineMeasured!: MeasuredTelemetry;
    let cfMeasured!: MeasuredTelemetry;

    const dt = 1.0; // 1 second step

    // Run forward numerical loop
    for (let t = 0; t < steps; t++) {
      // ── Step Baseline ───────────────────────────────────────────────────
      const baseCombustion = IntakeCombustionModel.calculate(
        config,
        simBaselineEnv,
        simBaselineState.throttle,
        simBaselineState.rpm,
        1.0,
        1.0
      );

      const baseDyn = EngineDynamicsModel.step(
        simBaselineState.rpm,
        baseCombustion.brakeTorque_Nm,
        simBaselineEnv.airDensity_kg_per_m3,
        dt,
        config,
        1.0
      );
      simBaselineState.rpm = baseDyn.nextRpm;

      baselineThermal = ThermalModel.step(
        baselineThermal,
        baseCombustion.combustionHeatRate_W,
        baseCombustion.effectiveAfr,
        simBaselineState.rpm,
        72.0,
        simBaselineEnv,
        dt
      );

      const baseLub = LubricationModel.calculatePressure(
        simBaselineState.rpm,
        baselineThermal.oilTemperature_K,
        config
      );

      const baseVib = VibrationModel.calculate(
        simBaselineState.rpm,
        baseDyn.loadRatio,
        0,
        0,
        0,
        prng
      );

      simBaselineState.manifoldPressure_Pa = baseCombustion.manifoldPressure_Pa;
      simBaselineState.fuelConsumption_L_h = baseCombustion.fuelConsumption_L_h;
      simBaselineState.torque_Nm = baseCombustion.brakeTorque_Nm;
      simBaselineState.brakePower_W = baseCombustion.brakePower_W;
      simBaselineState.cht_K = baselineThermal.cht_K;
      simBaselineState.egt_K = baselineThermal.egt_K;
      simBaselineState.oilTemperature_K = baselineThermal.oilTemperature_K;
      simBaselineState.oilPressure_Pa = baseLub.oilPressure_Pa;
      simBaselineState.vibration_mm_s = baseVib.totalRms_mm_s;

      baselineMeasured = baselineSensor.measure(simBaselineState, simBaselineEnv, dt, prng);

      // ── Step Counterfactual ─────────────────────────────────────────────
      const cfCombustion = IntakeCombustionModel.calculate(
        config,
        simCfEnv,
        cfThrottle,
        simCfState.rpm,
        1.0 + (intervention.injectorEfficiencyDeltaPct ? 0.15 : 0),
        injectorEfficiencyFactor
      );

      const cfDyn = EngineDynamicsModel.step(
        simCfState.rpm,
        cfCombustion.brakeTorque_Nm,
        simCfEnv.airDensity_kg_per_m3,
        dt,
        config,
        loadMultiplier
      );
      simCfState.rpm = cfDyn.nextRpm;

      cfThermal = ThermalModel.step(
        cfThermal,
        cfCombustion.combustionHeatRate_W,
        cfCombustion.effectiveAfr,
        simCfState.rpm,
        72.0,
        simCfEnv,
        dt,
        1.0
      );

      const cfLub = LubricationModel.calculatePressure(
        simCfState.rpm,
        cfThermal.oilTemperature_K,
        config
      );

      const cfVib = VibrationModel.calculate(
        simCfState.rpm,
        cfDyn.loadRatio,
        0,
        0,
        0,
        prng
      );

      simCfState.manifoldPressure_Pa = cfCombustion.manifoldPressure_Pa;
      simCfState.fuelConsumption_L_h = cfCombustion.fuelConsumption_L_h;
      simCfState.torque_Nm = cfCombustion.brakeTorque_Nm;
      simCfState.brakePower_W = cfCombustion.brakePower_W;
      simCfState.cht_K = cfThermal.cht_K;
      simCfState.egt_K = cfThermal.egt_K;
      simCfState.oilTemperature_K = cfThermal.oilTemperature_K;
      simCfState.oilPressure_Pa = cfLub.oilPressure_Pa;
      simCfState.vibration_mm_s = cfVib.totalRms_mm_s;

      cfMeasured = cfSensor.measure(simCfState, simCfEnv, dt, prng);
    }

    // Compute deltas between baseline trajectory and counterfactual trajectory
    const deltas = {
      rpmDelta: cfMeasured.rpm - baselineMeasured.rpm,
      chtDelta_C: parseFloat((cfMeasured.cht_C - baselineMeasured.cht_C).toFixed(1)),
      egtDelta_C: cfMeasured.egt_C - baselineMeasured.egt_C,
      oilPressureDelta_bar: parseFloat((cfMeasured.oilPressure_bar - baselineMeasured.oilPressure_bar).toFixed(2)),
      fuelFlowDelta_L_h: parseFloat((cfMeasured.fuelFlow_L_h - baselineMeasured.fuelFlow_L_h).toFixed(2)),
      healthScoreDelta: (cfMeasured.cht_C > 95 ? -15 : 0) + (cfMeasured.oilPressure_bar < 3.2 ? -15 : 0),
    };

    let riskAssessment = 'LOW RISK';
    let recommendation = 'Intervention maintains parameters within nominal certified envelope.';

    if (cfMeasured.cht_C > 110 || cfMeasured.oilPressure_bar < 2.5) {
      riskAssessment = 'CRITICAL MARGIN EXCEEDED';
      recommendation = 'Prohibit flight envelope modification. Thermal or lubrication limit exceeded.';
    } else if (cfMeasured.cht_C > 95 || cfMeasured.oilPressure_bar < 3.2 || Math.abs(deltas.rpmDelta) > 400) {
      riskAssessment = 'ELEVATED RISK';
      recommendation = 'Permissible for transient loiter only; continuous operation will accelerate thermal fatigue.';
    }

    return {
      durationSimulated_s: steps,
      baselineFinal: baselineMeasured,
      counterfactualFinal: cfMeasured,
      deltas,
      riskAssessment,
      recommendation,
    };
  }
}
