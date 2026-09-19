/**
 * engineSimulator.ts
 * 
 * Centralized Engine Simulation & Digital Twin Runtime for AeroTwin AI.
 * 
 * Powered by:
 * - Physics-informed mean-value engine model (intake, combustion, torque, thermal, lubrication, vibration)
 * - True State vs Measured Transducer separation (noise, bias, drift, dropout)
 * - Fault injection framework (progressive severity across 10 failure modes)
 * - Parallel Digital Twin observer and real-time residual analysis
 * - Seedable PRNG for scientific reproducibility
 * 
 * Preserves 100% backward-compatibility with all existing dashboard components:
 * - Broadcasts CustomEvent('engine-state-update') on `document`
 * - Maintains exact EngineState, ComponentScores, PredictiveState, and HistoryPoint shapes
 * - Supports seamless scenario triggering ('normal', 'overheating', 'bearing', 'oilPressure', 'degradation')
 */

import type {
  EngineConfig,
  TrueEngineState,
  MeasuredTelemetry,
  TelemetryResiduals,
  DigitalTwinState,
  FaultId,
  CounterfactualIntervention,
  CounterfactualResult,
} from '../engine/types.ts';

import { DEFAULT_ENGINE_PROFILE } from '../engine/config/defaultEngineProfile.ts';
import { PRNG } from '../engine/utils/prng.ts';
import { AtmosphereModel } from '../engine/environment/atmosphere.ts';
import { IntakeCombustionModel } from '../engine/physics/intakeCombustion.ts';
import { EngineDynamicsModel } from '../engine/physics/dynamics.ts';
import { ThermalModel, type ThermalState } from '../engine/physics/thermal.ts';
import { LubricationModel } from '../engine/physics/lubrication.ts';
import { VibrationModel } from '../engine/physics/vibration.ts';
import { SensorTransducerModel } from '../engine/sensors/sensorTransducer.ts';
import { FaultEngine } from '../engine/faults/faultEngine.ts';
import { DigitalTwinEngine } from '../engine/twin/digitalTwinEngine.ts';
import { CounterfactualEngine } from '../engine/counterfactual/counterfactualSim.ts';
import { MockAIProvider } from '../engine/ai/mockAIProvider.ts';

// ─── Public Types (Fully backward-compatible with existing UI) ────────────────

export type SimulationMode = 'normal' | 'overheating' | 'bearing' | 'oilPressure' | 'degradation';

export type EngineStatus = 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
export type FaultRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface ComponentScores {
  cylinder: number;
  lubrication: number;
  bearing: number;
  cooling: number;
  fuel: number;
}

export interface PredictiveState {
  bearingCondition: string;
  bearingColor: 'emerald' | 'amber' | 'rose';
  coolingSystem: string;
  coolingColor: 'cyan' | 'amber' | 'rose';
  maintenanceRisk: string;
  maintenanceColor: 'emerald' | 'amber' | 'rose';
  nextInspectionHrs: number;
}

export interface HistoryPoint {
  time: string;
  rpm: number;
  temperature: number;
  vibration: number;
  oilPressure: number;
}

export interface EngineState {
  rpm: number;
  temperature: number;
  oilPressure: number;
  vibration: number;
  fuelFlow: number;
  healthScore: number;
  engineStatus: EngineStatus;
  activeFault: string;
  faultRisk: FaultRisk;
  simulationMode: SimulationMode;
  tickCount: number;
  components: ComponentScores;
  predictive: PredictiveState;
  // Extended telemetry channels for advanced displays
  exhaustGasTemp?: number;
  manifoldAirPressure?: number;
  torque_Nm?: number;
  power_kW?: number;
  residuals?: TelemetryResiduals;
  altitude_m?: number;
  airDensity?: number;
}

// ─── Presets and Baselines ───────────────────────────────────────────────────

export const NORMAL_BASELINE = {
  rpm: 5200,
  temperature: 78,
  oilPressure: 4.3,
  vibration: 1.2,
  fuelFlow: 2.7,
} as const;

export const SCENARIO_TARGETS: Record<SimulationMode, { rpm: number; temperature: number; oilPressure: number; vibration: number; fuelFlow: number; activeFault: string; faultLabel: string }> = {
  normal: {
    rpm: 5200,
    temperature: 78,
    oilPressure: 4.3,
    vibration: 1.2,
    fuelFlow: 2.7,
    activeFault: 'None',
    faultLabel: 'Normal Operation',
  },
  overheating: {
    rpm: 5280,
    temperature: 105,
    oilPressure: 3.6,
    vibration: 1.8,
    fuelFlow: 3.4,
    activeFault: 'Engine Overheating',
    faultLabel: 'Simulate Overheating',
  },
  bearing: {
    rpm: 4750,
    temperature: 89,
    oilPressure: 3.2,
    vibration: 5.1,
    fuelFlow: 3.1,
    activeFault: 'Bearing Degradation',
    faultLabel: 'Simulate Bearing Fault',
  },
  oilPressure: {
    rpm: 4850,
    temperature: 92,
    oilPressure: 2.4,
    vibration: 2.4,
    fuelFlow: 2.9,
    activeFault: 'Low Oil Pressure',
    faultLabel: 'Simulate Low Oil Pressure',
  },
  degradation: {
    rpm: 4680,
    temperature: 84,
    oilPressure: 3.9,
    vibration: 2.1,
    fuelFlow: 3.6,
    activeFault: 'Engine Performance Degradation',
    faultLabel: 'Simulate Performance Degradation',
  },
};

/** Compute health score from values (exposed for backward-compatibility) */
export function computeHealthScore(state: { rpm: number; temperature: number; oilPressure: number; vibration: number; fuelFlow: number }): number {
  const twin = new DigitalTwinEngine();
  const res = twin.computeResiduals(
    {
      timestamp_ms: 0,
      rpm: state.rpm,
      manifoldPressure_bar: 0.95,
      fuelFlow_L_h: state.fuelFlow,
      cht_C: state.temperature,
      egt_C: 640,
      oilPressure_bar: state.oilPressure,
      oilTemperature_C: 80,
      vibration_mm_s: state.vibration,
      alternatorVoltage_V: 14.2,
      throttle_pct: 85,
      engineLoad_pct: 82,
      altitude_m: 2400,
      ambientTemp_C: -0.6,
      airDensity_kg_per_m3: 0.95,
      torque_Nm: 115,
      power_kW: 62.5,
      sensorDropoutFlags: {},
    },
    twin.calculateExpectedState(0.85, 2400, -0.6)
  );
  return twin.evaluateHealth(res, {
    timestamp_ms: 0,
    rpm: state.rpm,
    manifoldPressure_bar: 0.95,
    fuelFlow_L_h: state.fuelFlow,
    cht_C: state.temperature,
    egt_C: 640,
    oilPressure_bar: state.oilPressure,
    oilTemperature_C: 80,
    vibration_mm_s: state.vibration,
    alternatorVoltage_V: 14.2,
    throttle_pct: 85,
    engineLoad_pct: 82,
    altitude_m: 2400,
    ambientTemp_C: -0.6,
    airDensity_kg_per_m3: 0.95,
    torque_Nm: 115,
    power_kW: 62.5,
    sensorDropoutFlags: {},
  }).healthScore;
}

// ─── Engine Simulator Class ──────────────────────────────────────────────────

const MAX_HISTORY = 30;
type StateCallback = (state: EngineState) => void;

export class EngineSimulator {
  private config: EngineConfig = DEFAULT_ENGINE_PROFILE;
  private prng: PRNG = new PRNG(42);
  private faultEngine: FaultEngine = new FaultEngine();
  private sensorTransducer: SensorTransducerModel = new SensorTransducerModel();
  private twinEngine: DigitalTwinEngine = new DigitalTwinEngine();
  public mockAI: MockAIProvider = new MockAIProvider();

  private currentMode: SimulationMode = 'normal';
  private tickCount: number = 0;
  private simTime_s: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers: Set<StateCallback> = new Set();

  // Physics runtime state
  private currentRpm: number = 5200;
  private throttle: number = 0.82; // Nominal cruise throttle
  private altitude_m: number = 2400; // 2,400m MSL cruise ceiling
  private thermalState: ThermalState = ThermalModel.getBaselineState();
  private history: HistoryPoint[] = [];

  // Cached latest outputs
  private latestTrueState!: TrueEngineState;
  private latestMeasured!: MeasuredTelemetry;
  private latestTwinState!: DigitalTwinState;

  constructor() {
    this.initPhysics();
    // Seed initial history
    const now = new Date();
    for (let i = 10; i >= 0; i--) {
      const past = new Date(now.getTime() - i * 60000);
      const timeStr = past.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      this.history.push({
        time: timeStr,
        rpm: Math.round(5200 + this.prng.gaussian(0, 8)),
        temperature: parseFloat((78 + this.prng.gaussian(0, 0.4)).toFixed(1)),
        vibration: parseFloat((1.2 + this.prng.gaussian(0, 0.04)).toFixed(1)),
        oilPressure: parseFloat((4.3 + this.prng.gaussian(0, 0.02)).toFixed(1)),
      });
    }
  }

  private initPhysics(): void {
    const env = AtmosphereModel.calculate(this.altitude_m);
    const combustion = IntakeCombustionModel.calculate(this.config, env, this.throttle, this.currentRpm);
    const lub = LubricationModel.calculatePressure(this.currentRpm, this.thermalState.oilTemperature_K, this.config);
    const vib = VibrationModel.calculate(this.currentRpm, 0.82, 0, 0, 0, this.prng);

    this.latestTrueState = {
      timestamp_s: 0,
      rpm: this.currentRpm,
      angularVelocity_rad_s: (this.currentRpm * 2 * Math.PI) / 60,
      throttle: this.throttle,
      engineLoad: 0.82,
      manifoldPressure_Pa: combustion.manifoldPressure_Pa,
      airMassFlow_kg_s: combustion.airMassFlow_kg_s,
      fuelMassFlow_kg_s: combustion.fuelMassFlow_kg_s,
      fuelConsumption_L_h: combustion.fuelConsumption_L_h,
      actualAfr: combustion.effectiveAfr,
      combustionEfficiency: combustion.volumetricEfficiency,
      torque_Nm: combustion.brakeTorque_Nm,
      brakePower_W: combustion.brakePower_W,
      cht_K: this.thermalState.cht_K,
      egt_K: this.thermalState.egt_K,
      oilTemperature_K: this.thermalState.oilTemperature_K,
      oilPressure_Pa: lub.oilPressure_Pa,
      vibration_mm_s: vib.totalRms_mm_s,
      alternatorVoltage_V: 14.2,
      degradationIndex: 0,
      activeFaults: [],
      cylinderTemperatures_K: this.thermalState.cylinderTemperatures_K,
    };

    this.latestMeasured = this.sensorTransducer.measure(this.latestTrueState, env, 1.0, this.prng);
    this.latestTwinState = this.twinEngine.synthesizeState(this.latestTrueState, this.latestMeasured);
  }

  /** Start simulation loop (or resume from sessionStorage) */
  startAuto(): void {
    if (typeof window !== 'undefined') {
      try {
        const savedMode = sessionStorage.getItem('uav_sim_mode') as SimulationMode;
        if (savedMode && SCENARIO_TARGETS[savedMode]) {
          this.currentMode = savedMode;
          this.applyModeFaults(savedMode);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000);
      if (typeof (this.intervalId as any)?.unref === 'function') {
        (this.intervalId as any).unref();
      }
    }

    const state = this.getState();
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('engine-state-update', { detail: state }));
    }
  }

  /** Switch active simulation scenario and configure appropriate physical fault */
  setScenario(mode: SimulationMode): void {
    this.currentMode = mode;
    this.tickCount = 0;

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('uav_sim_mode', mode);
      } catch (e) {
        // ignore
      }
    }

    this.applyModeFaults(mode);

    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000);
      if (typeof (this.intervalId as any)?.unref === 'function') {
        (this.intervalId as any).unref();
      }
    }

    this.tick();
  }

  /** Map preset scenario modes to physical fault injection configurations */
  private applyModeFaults(mode: SimulationMode): void {
    this.faultEngine.clearAllFaults();

    switch (mode) {
      case 'normal':
        this.faultEngine.clearAllFaults();
        this.faultEngine.setDegradation(0.0);
        break;

      case 'overheating':
        this.faultEngine.injectFault({
          id: 'OVERHEATING',
          name: 'Cooling Radiator Airflow Restriction',
          description: 'Cylinder head and oil heat rejection compromised due to core blockage',
          severity: 0.85,
          targetSubsystem: 'COOLING',
        });
        break;

      case 'bearing':
        this.faultEngine.injectFault({
          id: 'VIBRATION_FAULT',
          name: 'Journal Bearing Spalling & Clearance Degrade',
          description: 'High-frequency vibration harmonic anomaly on crankshaft main journal #2',
          severity: 0.90,
          targetSubsystem: 'BEARING',
        });
        break;

      case 'oilPressure':
        this.faultEngine.injectFault({
          id: 'LUBRICATION_DEGRADATION',
          name: 'Oil Pressure Relief Malfunction',
          description: 'Severe pump cavitation / pressure relief valve leak',
          severity: 0.82,
          targetSubsystem: 'LUBRICATION',
        });
        break;

      case 'degradation':
        this.faultEngine.setDegradation(0.65);
        this.faultEngine.injectFault({
          id: 'INJECTOR_DEGRADATION',
          name: 'Fuel Injector Nozzle Fouling',
          description: 'Combustion asymmetry and specific fuel consumption degradation',
          severity: 0.60,
          targetSubsystem: 'FUEL',
          targetCylinder: 2,
        });
        break;
    }
  }

  /** Advance physical simulation by one second */
  tick(): void {
    this.tickCount++;
    this.simTime_s += 1.0;
    const dt = 1.0;

    // 1. Environmental calculations at altitude
    const env = AtmosphereModel.calculate(this.altitude_m);

    // 2. Evaluate active faults & degradation
    const faultState = this.faultEngine.evaluate();

    // 3. Intake and combustion calculations
    const combustion = IntakeCombustionModel.calculate(
      this.config,
      env,
      this.throttle,
      this.currentRpm,
      faultState.afrMultiplier,
      faultState.combustionEfficiencyMultiplier
    );

    // 4. Rotational dynamics
    const dyn = EngineDynamicsModel.step(
      this.currentRpm,
      combustion.brakeTorque_Nm,
      env.airDensity_kg_per_m3,
      dt,
      this.config,
      1.0
    );
    this.currentRpm = dyn.nextRpm;

    // 5. Thermal dynamic balance
    this.thermalState = ThermalModel.step(
      this.thermalState,
      combustion.combustionHeatRate_W,
      combustion.effectiveAfr,
      this.currentRpm,
      72.0, // UAV cruise airspeed in m/s (~140 knots)
      env,
      dt,
      faultState.coolingEfficiencyMultiplier,
      faultState.cylinderThermalImbalance
    );

    // 6. Lubrication pressure
    const lub = LubricationModel.calculatePressure(
      this.currentRpm,
      this.thermalState.oilTemperature_K,
      this.config,
      faultState.oilPumpEfficiencyMultiplier
    );

    // 7. Physics-correlated vibration
    const vib = VibrationModel.calculate(
      this.currentRpm,
      dyn.loadRatio,
      faultState.bearingVibrationSeverity,
      faultState.misfireSeverity,
      faultState.progressiveDegradationIndex,
      this.prng
    );

    // 8. Ground truth physical state
    this.latestTrueState = {
      timestamp_s: this.simTime_s,
      rpm: this.currentRpm,
      angularVelocity_rad_s: (this.currentRpm * 2 * Math.PI) / 60,
      throttle: this.throttle,
      engineLoad: dyn.loadRatio,
      manifoldPressure_Pa: combustion.manifoldPressure_Pa,
      airMassFlow_kg_s: combustion.airMassFlow_kg_s,
      fuelMassFlow_kg_s: combustion.fuelMassFlow_kg_s,
      fuelConsumption_L_h: combustion.fuelConsumption_L_h,
      actualAfr: combustion.effectiveAfr,
      combustionEfficiency: combustion.volumetricEfficiency,
      torque_Nm: combustion.brakeTorque_Nm,
      brakePower_W: combustion.brakePower_W,
      cht_K: this.thermalState.cht_K,
      egt_K: this.thermalState.egt_K,
      oilTemperature_K: this.thermalState.oilTemperature_K,
      oilPressure_Pa: lub.oilPressure_Pa,
      vibration_mm_s: vib.totalRms_mm_s,
      alternatorVoltage_V: 14.2,
      degradationIndex: faultState.progressiveDegradationIndex,
      activeFaults: faultState.activeFaultIds,
      cylinderTemperatures_K: this.thermalState.cylinderTemperatures_K,
    };

    // 9. Measured transducer telemetry (True State -> Transducer -> Measured)
    this.latestMeasured = this.sensorTransducer.measure(this.latestTrueState, env, dt, this.prng);

    // 10. Digital Twin observer & residual synthesis
    this.latestTwinState = this.twinEngine.synthesizeState(this.latestTrueState, this.latestMeasured);

    // 11. Append to rolling historical buffer
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    this.history.push({
      time: timeStr,
      rpm: this.latestMeasured.rpm,
      temperature: this.latestMeasured.cht_C,
      vibration: this.latestMeasured.vibration_mm_s,
      oilPressure: this.latestMeasured.oilPressure_bar,
    });
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    const state = this.getState();

    // Broadcast update via standard CustomEvent
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('engine-state-update', { detail: state }));
    }

    for (const cb of this.subscribers) {
      cb(state);
    }
  }

  /**
   * Return EngineState matching the exact shape expected by existing UI components.
   */
  getState(): EngineState {
    const twin = this.latestTwinState;
    const meas = this.latestMeasured;
    const target = SCENARIO_TARGETS[this.currentMode];

    return {
      rpm: meas.rpm,
      temperature: meas.cht_C,
      oilPressure: meas.oilPressure_bar,
      vibration: meas.vibration_mm_s,
      fuelFlow: meas.fuelFlow_L_h,
      healthScore: twin.healthScore,
      engineStatus: twin.engineStatus,
      activeFault: twin.activeFaultNames.length > 0 ? twin.activeFaultNames.join(', ') : target.activeFault,
      faultRisk: twin.faultRisk,
      simulationMode: this.currentMode,
      tickCount: this.tickCount,
      components: twin.subsystems,
      predictive: twin.predictive,
      // Extended channels
      exhaustGasTemp: meas.egt_C,
      manifoldAirPressure: meas.manifoldPressure_bar,
      torque_Nm: meas.torque_Nm,
      power_kW: meas.power_kW,
      residuals: twin.residuals,
      altitude_m: meas.altitude_m,
      airDensity: meas.airDensity_kg_per_m3,
    };
  }

  /** Get rolling historical chart samples */
  getHistory(): HistoryPoint[] {
    return [...this.history];
  }

  /** Get underlying true ground-truth physical state */
  getTrueState(): TrueEngineState {
    return this.latestTrueState;
  }

  /** Get underlying Digital Twin observer state with residuals */
  getDigitalTwinState(): DigitalTwinState {
    return this.latestTwinState;
  }

  /** Run an isolated counterfactual "what-if" branch */
  runCounterfactual(intervention: CounterfactualIntervention, steps: number = 20): CounterfactualResult {
    const env = AtmosphereModel.calculate(this.altitude_m);
    return CounterfactualEngine.evaluate(this.latestTrueState, env, intervention, steps, this.config);
  }

  /** Reset simulator to normal state */
  reset(): void {
    this.setScenario('normal');
  }

  /** Subscribe to state updates */
  subscribe(callback: StateCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /** Stop simulation loop */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Check running status */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

// Global Singleton instance shared by all Astro pages and client components
export const simulator = new EngineSimulator();

if (typeof window !== 'undefined') {
  simulator.startAuto();
  document.addEventListener('astro:page-load', () => {
    simulator.startAuto();
  });
}
