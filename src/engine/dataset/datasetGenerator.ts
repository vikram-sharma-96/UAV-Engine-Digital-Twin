/**
 * datasetGenerator.ts
 * 
 * Synthetic Dataset Generator for Machine Learning Model Training.
 * 
 * Generates labeled time-series datasets containing:
 * - Timestamps & operational phases
 * - True physical engine states
 * - Measured noisy sensor values
 * - Ambient environment states
 * - Digital twin residuals
 * - Ground truth fault labels & severity
 * - Degradation index
 * - Scenario metadata (seed, engine profile, software version)
 * 
 * Export formats: CSV & JSON
 */

import type {
  EngineConfig,
  FaultDefinition,
  MeasuredTelemetry,
  TelemetryResiduals,
  TrueEngineState,
  EnvironmentConditions,
  FaultId,
} from '../types.ts';
import { DEFAULT_ENGINE_PROFILE } from '../config/defaultEngineProfile.ts';
import { PRNG } from '../utils/prng.ts';
import { AtmosphereModel } from '../environment/atmosphere.ts';
import { IntakeCombustionModel } from '../physics/intakeCombustion.ts';
import { EngineDynamicsModel } from '../physics/dynamics.ts';
import { ThermalModel, type ThermalState } from '../physics/thermal.ts';
import { LubricationModel } from '../physics/lubrication.ts';
import { VibrationModel } from '../physics/vibration.ts';
import { SensorTransducerModel } from '../sensors/sensorTransducer.ts';
import { FaultEngine } from '../faults/faultEngine.ts';
import { DigitalTwinEngine } from '../twin/digitalTwinEngine.ts';

export interface DatasetSample {
  timestamp_s: number;
  flight_phase: string;
  // Environment
  altitude_m: number;
  ambient_temp_C: number;
  air_density_kg_m3: number;
  // Control
  throttle: number;
  engine_load: number;
  // True Engine State (Ground Truth)
  true_rpm: number;
  true_cht_C: number;
  true_egt_C: number;
  true_oil_pressure_bar: number;
  true_oil_temp_C: number;
  true_fuel_flow_L_h: number;
  true_vibration_mm_s: number;
  true_torque_Nm: number;
  true_power_kW: number;
  // Measured Sensor Telemetry (with noise, bias, drift)
  measured_rpm: number;
  measured_map_bar: number;
  measured_cht_C: number;
  measured_egt_C: number;
  measured_oil_pressure_bar: number;
  measured_oil_temp_C: number;
  measured_fuel_flow_L_h: number;
  measured_vibration_mm_s: number;
  // Residuals (Measured - Expected)
  res_rpm: number;
  res_cht: number;
  res_egt: number;
  res_oil_pressure: number;
  res_oil_temp: number;
  res_fuel_flow: number;
  res_vibration: number;
  res_normalized_score: number;
  // Health & Ground Truth Labels for ML
  health_score: number;
  degradation_index: number;
  primary_fault_label: string;
  fault_severity: number;
  active_faults_list: string;
}

export interface DatasetScenario {
  scenarioId: string;
  name: string;
  description: string;
  duration_s: number;
  seed: number;
  engineProfile: string;
  faultsToInject: {
    fault: FaultDefinition;
    start_s: number;
    duration_s: number;
  }[];
  degradationIndex: number;
  altitudeProfile?: (t: number) => number;
  throttleProfile?: (t: number) => number;
}

export class DatasetGenerator {
  static readonly VERSION = '1.0.0-aero-twin';

  /**
   * Run a simulation scenario and collect every time step into a labeled dataset.
   */
  static generateScenario(
    scenario: DatasetScenario,
    config: EngineConfig = DEFAULT_ENGINE_PROFILE
  ): { metadata: Record<string, unknown>; samples: DatasetSample[] } {
    const prng = new PRNG(scenario.seed);
    const faultEngine = new FaultEngine();
    faultEngine.setDegradation(scenario.degradationIndex);

    const sensorTransducer = new SensorTransducerModel();
    const twinEngine = new DigitalTwinEngine();

    // Initial warm engine state
    let thermalState: ThermalState = ThermalModel.getBaselineState();
    let currentRpm = 5200;
    const samples: DatasetSample[] = [];

    const dt = 1.0; // 1 sample per second

    for (let t = 0; t < scenario.duration_s; t++) {
      // 1. Check fault schedule
      for (const item of scenario.faultsToInject) {
        if (t === item.start_s) {
          faultEngine.injectFault(item.fault);
        } else if (t === item.start_s + item.duration_s) {
          faultEngine.removeFault(item.fault.id);
        }
      }

      const faultState = faultEngine.evaluate();

      // 2. Flight regime parameters
      const altitude_m = scenario.altitudeProfile ? scenario.altitudeProfile(t) : 2400;
      const throttle = scenario.throttleProfile ? scenario.throttleProfile(t) : 0.82;

      const env = AtmosphereModel.calculate(altitude_m);

      // 3. True physics step
      const combustion = IntakeCombustionModel.calculate(
        config,
        env,
        throttle,
        currentRpm,
        faultState.afrMultiplier,
        faultState.combustionEfficiencyMultiplier
      );

      const dyn = EngineDynamicsModel.step(
        currentRpm,
        combustion.brakeTorque_Nm,
        env.airDensity_kg_per_m3,
        dt,
        config,
        1.0
      );
      currentRpm = dyn.nextRpm;

      thermalState = ThermalModel.step(
        thermalState,
        combustion.combustionHeatRate_W,
        combustion.effectiveAfr,
        currentRpm,
        72.0,
        env,
        dt,
        faultState.coolingEfficiencyMultiplier,
        faultState.cylinderThermalImbalance
      );

      const lub = LubricationModel.calculatePressure(
        currentRpm,
        thermalState.oilTemperature_K,
        config,
        faultState.oilPumpEfficiencyMultiplier
      );

      const vib = VibrationModel.calculate(
        currentRpm,
        dyn.loadRatio,
        faultState.bearingVibrationSeverity,
        faultState.misfireSeverity,
        faultState.progressiveDegradationIndex,
        prng
      );

      const trueState: TrueEngineState = {
        timestamp_s: t,
        rpm: currentRpm,
        angularVelocity_rad_s: (currentRpm * 2 * Math.PI) / 60,
        throttle,
        engineLoad: dyn.loadRatio,
        manifoldPressure_Pa: combustion.manifoldPressure_Pa,
        airMassFlow_kg_s: combustion.airMassFlow_kg_s,
        fuelMassFlow_kg_s: combustion.fuelMassFlow_kg_s,
        fuelConsumption_L_h: combustion.fuelConsumption_L_h,
        actualAfr: combustion.effectiveAfr,
        combustionEfficiency: combustion.volumetricEfficiency,
        torque_Nm: combustion.brakeTorque_Nm,
        brakePower_W: combustion.brakePower_W,
        cht_K: thermalState.cht_K,
        egt_K: thermalState.egt_K,
        oilTemperature_K: thermalState.oilTemperature_K,
        oilPressure_Pa: lub.oilPressure_Pa,
        vibration_mm_s: vib.totalRms_mm_s,
        alternatorVoltage_V: 14.2,
        degradationIndex: faultState.progressiveDegradationIndex,
        activeFaults: faultState.activeFaultIds,
        cylinderTemperatures_K: thermalState.cylinderTemperatures_K,
      };

      // 4. Measured transducer telemetry
      const measured = sensorTransducer.measure(trueState, env, dt, prng);

      // 5. Digital twin observer & residuals
      const expected = twinEngine.calculateExpectedState(throttle, altitude_m, AtmosphereModel.kelvinToCelsius(env.ambientTemperature_K));
      const residuals = twinEngine.computeResiduals(measured, expected);
      const health = twinEngine.evaluateHealth(residuals, measured);

      const primaryFault = faultState.activeFaultIds.length > 0 ? faultState.activeFaultIds[0] : 'NONE';

      samples.push({
        timestamp_s: t,
        flight_phase: altitude_m < 500 ? 'TAKEOFF_APPROACH' : 'CRUISE',
        altitude_m,
        ambient_temp_C: parseFloat(AtmosphereModel.kelvinToCelsius(env.ambientTemperature_K).toFixed(1)),
        air_density_kg_m3: parseFloat(env.airDensity_kg_per_m3.toFixed(3)),
        throttle,
        engine_load: parseFloat(dyn.loadRatio.toFixed(2)),
        true_rpm: Math.round(trueState.rpm),
        true_cht_C: parseFloat(AtmosphereModel.kelvinToCelsius(trueState.cht_K).toFixed(1)),
        true_egt_C: Math.round(AtmosphereModel.kelvinToCelsius(trueState.egt_K)),
        true_oil_pressure_bar: parseFloat(AtmosphereModel.paToBar(trueState.oilPressure_Pa).toFixed(2)),
        true_oil_temp_C: parseFloat(AtmosphereModel.kelvinToCelsius(trueState.oilTemperature_K).toFixed(1)),
        true_fuel_flow_L_h: parseFloat(trueState.fuelConsumption_L_h.toFixed(2)),
        true_vibration_mm_s: trueState.vibration_mm_s,
        true_torque_Nm: parseFloat(trueState.torque_Nm.toFixed(1)),
        true_power_kW: parseFloat((trueState.brakePower_W / 1000).toFixed(1)),
        measured_rpm: measured.rpm,
        measured_map_bar: measured.manifoldPressure_bar,
        measured_cht_C: measured.cht_C,
        measured_egt_C: measured.egt_C,
        measured_oil_pressure_bar: measured.oilPressure_bar,
        measured_oil_temp_C: measured.oilTemperature_C,
        measured_fuel_flow_L_h: measured.fuelFlow_L_h,
        measured_vibration_mm_s: measured.vibration_mm_s,
        res_rpm: residuals.rpmResidual,
        res_cht: residuals.chtResidual,
        res_egt: residuals.egtResidual,
        res_oil_pressure: residuals.oilPressureResidual,
        res_oil_temp: residuals.oilTempResidual,
        res_fuel_flow: residuals.fuelFlowResidual,
        res_vibration: residuals.vibrationResidual,
        res_normalized_score: residuals.normalizedResidualScore,
        health_score: health.healthScore,
        degradation_index: faultState.progressiveDegradationIndex,
        primary_fault_label: primaryFault,
        fault_severity: faultState.highestSeverity,
        active_faults_list: faultState.activeFaultIds.join(';') || 'NONE',
      });
    }

    const metadata = {
      scenario_id: scenario.scenarioId,
      scenario_name: scenario.name,
      engine_profile: config.id,
      random_seed: scenario.seed,
      simulation_version: this.VERSION,
      sample_count: samples.length,
      duration_seconds: scenario.duration_s,
      generated_at: new Date().toISOString(),
    };

    return { metadata, samples };
  }

  /** Convert sample array to standard CSV string */
  static toCSV(samples: DatasetSample[]): string {
    if (samples.length === 0) return '';
    const headers = Object.keys(samples[0]).join(',');
    const rows = samples.map(s => Object.values(s).join(','));
    return [headers, ...rows].join('\n');
  }
}
