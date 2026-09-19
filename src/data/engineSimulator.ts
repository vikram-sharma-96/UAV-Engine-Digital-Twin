/**
 * engineSimulator.ts
 * 
 * Centralized Engine Simulation & Digital Twin Runtime for AeroTwin AI.
 * 
 * Combines:
 * 1. Physics-informed mean-value engine model (intake, combustion, dynamics, thermal, lubrication, vibration)
 * 2. True State vs Measured Transducer separation (noise, bias, drift, dropout)
 * 3. Fault injection framework (progressive severity across 10 failure modes)
 * 4. Parallel Digital Twin observer and real-time residual analysis
 * 5. Counterfactual simulation sandbox ("What-If" evaluation without live mutation)
 * 6. Grounded offline AI Copilot reasoning
 * 7. Real ML Backend integration (asynchronous queries to FastAPI at http://localhost:8000/predict)
 * 8. Backward-compatibility with all existing dashboard panels
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

// ─── Public Types ────────────────────────────────────────────────────────────

export type SimulationMode = 'normal' | 'overheating' | 'bearing' | 'oilPressure' | 'degradation';
export type EngineStatus = 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
export type FaultRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type MLModelStatus = 'ONLINE' | 'OFFLINE';

export interface ComponentScores {
  cylinder: number;
  lubrication: number;
  bearing: number;
  cooling: number;
  fuel: number;
}

export interface PredictiveState {
  bearingCondition: string;
  coolingSystem: string;
  maintenanceRisk: string;
  nextInspectionHours: number;
  hoursRemaining: number;
  rulHours: number;
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
  // ML Backend predictions
  mlFault: string;
  mlConfidence: number;
  mlProbabilities: Record<string, number>;
  mlStatus: MLModelStatus;
  // Extended telemetry channels
  exhaustGasTemp?: number;
  manifoldAirPressure?: number;
  torque_Nm?: number;
  power_kW?: number;
  residuals?: TelemetryResiduals;
  altitude_m?: number;
  airDensity?: number;
  trueState?: TrueEngineState;
  measured?: MeasuredTelemetry;
}

// ─── Scenario Targets & Baselines ───────────────────────────────────────────

export interface ScenarioTarget {
  rpm: number;
  temperature: number;
  oilPressure: number;
  vibration: number;
  fuelFlow: number;
  activeFault: string;
  faultLabel: string;
}

export const NORMAL_BASELINE: ScenarioTarget = {
  rpm: 5200,
  temperature: 78,
  oilPressure: 4.3,
  vibration: 0.8,
  fuelFlow: 3.2,
  activeFault: 'None',
  faultLabel: 'Normal Operation',
};

export const SCENARIO_TARGETS: Record<SimulationMode, ScenarioTarget> = {
  normal: { ...NORMAL_BASELINE },
  overheating: {
    rpm: 5180,
    temperature: 118,
    oilPressure: 3.4,
    vibration: 1.2,
    fuelFlow: 3.5,
    activeFault: 'Coolant Restriction / Thermal Runaway',
    faultLabel: 'Simulate Thermal Anomaly',
  },
  bearing: {
    rpm: 5050,
    temperature: 88,
    oilPressure: 3.8,
    vibration: 3.4,
    fuelFlow: 3.4,
    activeFault: 'Crankshaft Bearing Degradation',
    faultLabel: 'Simulate Bearing Wear',
  },
  oilPressure: {
    rpm: 5120,
    temperature: 92,
    oilPressure: 1.6,
    vibration: 1.5,
    fuelFlow: 3.3,
    activeFault: 'Low Oil Pressure / Scavenge Leak',
    faultLabel: 'Simulate Oil Pressure Loss',
  },
  degradation: {
    rpm: 4920,
    temperature: 84,
    oilPressure: 3.9,
    vibration: 2.1,
    fuelFlow: 3.6,
    activeFault: 'Engine Performance Degradation',
    faultLabel: 'Simulate Performance Degradation',
  },
};

const API_PREDICT_URL = 'http://localhost:8000/predict';
const MAX_HISTORY = 30;
type StateCallback = (state: EngineState) => void;

// ─── Helper Mathematical Functions ──────────────────────────────────────────

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
    {
      rpm: 5200,
      manifoldPressure_bar: 0.95,
      fuelFlow_L_h: 3.2,
      cht_C: 78,
      egt_C: 640,
      oilPressure_bar: 4.3,
      oilTemperature_C: 80,
      vibration_mm_s: 0.8,
      alternatorVoltage_V: 14.2,
      torque_Nm: 115,
      power_kW: 62.5,
    }
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

export function deriveComponentScores(state: { temperature: number; oilPressure: number; vibration: number }): ComponentScores {
  const cylinder = Math.max(20, Math.min(99, Math.round(98 - Math.max(0, state.temperature - 80) * 1.5)));
  const lubrication = Math.max(15, Math.min(99, Math.round(97 - Math.max(0, 4.3 - state.oilPressure) * 22)));
  const bearing = Math.max(10, Math.min(99, Math.round(98 - Math.max(0, state.vibration - 0.8) * 25)));
  const cooling = Math.max(20, Math.min(99, Math.round(96 - Math.max(0, state.temperature - 78) * 1.8)));
  const fuel = Math.max(40, Math.min(99, Math.round(95 - Math.max(0, state.temperature - 90) * 0.5)));

  return { cylinder, lubrication, bearing, cooling, fuel };
}

export function derivePredictiveState(sensorValues: { vibration: number; temperature: number }, healthScore: number): PredictiveState {
  const bearingCondition = sensorValues.vibration > 2.5 ? 'CRITICAL DEFECT' : sensorValues.vibration > 1.8 ? 'ACCELERATED WEAR' : 'NOMINAL';
  const coolingSystem = sensorValues.temperature > 105 ? 'THERMAL RUNAWAY' : sensorValues.temperature > 90 ? 'MARGINAL HEAT REMOVAL' : 'OPTIMAL';
  const maintenanceRisk = healthScore < 50 ? 'IMMEDIATE AOG' : healthScore < 70 ? 'SCHEDULE INSPECTION' : 'MINIMAL';
  const rulHours = Math.max(2, Math.round(healthScore * 5.2));
  const nextInspectionHours = Math.max(1, Math.round(healthScore * 0.45));

  return {
    bearingCondition,
    coolingSystem,
    maintenanceRisk,
    nextInspectionHours,
    hoursRemaining: rulHours,
    rulHours,
  };
}

export function deriveEngineStatus(healthScore: number): EngineStatus {
  if (healthScore >= 80) return 'HEALTHY';
  if (healthScore >= 65) return 'ADVISORY';
  if (healthScore >= 45) return 'WARNING';
  return 'CRITICAL';
}

export function deriveFaultRisk(healthScore: number): FaultRisk {
  if (healthScore >= 80) return 'LOW';
  if (healthScore >= 65) return 'MODERATE';
  if (healthScore >= 45) return 'HIGH';
  return 'CRITICAL';
}

// ─── Engine Simulator Runtime Class ──────────────────────────────────────────

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

  // ML Backend state (from FastAPI)
  private mlFault: string = 'Normal';
  private mlConfidence: number = 0.95;
  private mlProbabilities: Record<string, number> = {};
  private mlStatus: MLModelStatus = 'OFFLINE';
  private isFetchingML: boolean = false;

  // Cached latest outputs
  private latestTrueState!: TrueEngineState;
  private latestMeasured!: MeasuredTelemetry;
  private latestTwinState!: DigitalTwinState;

  constructor() {
    this.initPhysics();
    this.initHistory();
  }

  private initHistory(): void {
    const now = new Date();
    for (let i = 15; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 2000);
      this.history.push({
        time: pastTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rpm: Math.round(5200 + this.prng.gaussian(0, 15)),
        temperature: parseFloat((78 + this.prng.gaussian(0, 0.4)).toFixed(1)),
        vibration: parseFloat((0.8 + this.prng.gaussian(0, 0.04)).toFixed(2)),
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

  /** Start simulation loop */
  start(): void {
    this.startAuto();
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

    this.broadcastState();
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

  /** Query FastAPI ML backend with current sensor values */
  private async queryMLBackend(sensorValues: {
    rpm: number;
    temperature: number;
    oilPressure: number;
    vibration: number;
    fuelFlow: number;
  }): Promise<void> {
    if (typeof window === 'undefined' || this.isFetchingML) return;

    this.isFetchingML = true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const response = await fetch(API_PREDICT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rpm: sensorValues.rpm,
          temperature: sensorValues.temperature,
          oil_pressure: sensorValues.oilPressure,
          vibration: sensorValues.vibration,
          fuel_flow: sensorValues.fuelFlow,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.mlStatus = 'ONLINE';
        this.mlFault = data.fault || 'Normal';
        this.mlConfidence = typeof data.confidence === 'number' ? data.confidence : 0.95;
        this.mlProbabilities = data.probabilities || {};
        this.broadcastState();
      } else {
        this.mlStatus = 'OFFLINE';
      }
    } catch {
      this.mlStatus = 'OFFLINE';
    } finally {
      this.isFetchingML = false;
    }
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
          id: 'COOLING_SYSTEM_RESTRICTION',
          name: 'Cooling Fin Airflow Restriction',
          description: 'Progressive thermal runaway due to ram-air blockage',
          severity: 0.85,
          targetSubsystem: 'COOLING',
        });
        break;

      case 'bearing':
        this.faultEngine.injectFault({
          id: 'MAIN_BEARING_DEGRADATION',
          name: 'Crankshaft Bearing Spalling',
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

    // 5. Dynamic Thermal calculations (lumped capacitance thermal inertia)
    this.thermalState = ThermalModel.step(
      this.thermalState,
      combustion.combustionHeatRate_W,
      combustion.effectiveAfr,
      this.currentRpm,
      40,
      env,
      dt,
      faultState.coolingEffectivenessMultiplier
    );

    // 6. Lubrication calculations
    const lub = LubricationModel.calculatePressure(
      this.currentRpm,
      this.thermalState.oilTemperature_K,
      this.config,
      faultState.oilPressureMultiplier
    );

    // 7. Vibration calculations
    const vib = VibrationModel.calculate(
      this.currentRpm,
      this.throttle,
      faultState.bearingWearSeverity,
      faultState.unbalanceSeverity,
      faultState.misfireCylinder ?? 0,
      this.prng
    );

    // 8. Ground truth physical state
    this.latestTrueState = {
      timestamp_s: this.simTime_s,
      rpm: this.currentRpm,
      angularVelocity_rad_s: (this.currentRpm * 2 * Math.PI) / 60,
      throttle: this.throttle,
      engineLoad: combustion.volumetricEfficiency,
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

    // 12. Query external ML backend asynchronously if available
    this.queryMLBackend({
      rpm: this.latestMeasured.rpm,
      temperature: this.latestMeasured.cht_C,
      oilPressure: this.latestMeasured.oilPressure_bar,
      vibration: this.latestMeasured.vibration_mm_s,
      fuelFlow: this.latestMeasured.fuelFlow_L_h,
    });

    this.broadcastState();
  }

  /** Broadcast current state to all subscribers and document listeners */
  private broadcastState(): void {
    const state = this.getState();

    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('engine-state-update', { detail: state }));
    }

    for (const cb of this.subscribers) {
      cb(state);
    }
  }

  /** Get current state snapshot */
  getState(): EngineState {
    const twin = this.latestTwinState;
    const meas = this.latestMeasured;
    const target = SCENARIO_TARGETS[this.currentMode];

    // If ML backend is ONLINE, active fault and engine status are enriched with real ML prediction
    let activeFault: string;
    let engineStatus: EngineStatus;
    let faultRisk: FaultRisk;

    if (this.mlStatus === 'ONLINE') {
      activeFault = this.mlFault === 'Normal' ? 'None' : this.mlFault;
      if (this.mlFault === 'Normal') {
        engineStatus = 'HEALTHY';
        faultRisk = 'LOW';
      } else if (this.mlFault === 'Bearing Degradation') {
        engineStatus = 'CRITICAL';
        faultRisk = 'CRITICAL';
      } else if (this.mlFault === 'Overheating' || this.mlFault === 'Low Oil Pressure') {
        engineStatus = 'WARNING';
        faultRisk = 'HIGH';
      } else {
        engineStatus = 'ADVISORY';
        faultRisk = 'MODERATE';
      }
    } else {
      activeFault = twin.activeFaultNames.length > 0 ? twin.activeFaultNames.join(', ') : target.activeFault;
      engineStatus = twin.engineStatus;
      faultRisk = twin.faultRisk;
    }

    return {
      rpm: meas.rpm,
      temperature: meas.cht_C,
      oilPressure: meas.oilPressure_bar,
      vibration: meas.vibration_mm_s,
      fuelFlow: meas.fuelFlow_L_h,
      healthScore: twin.healthScore,
      engineStatus,
      activeFault,
      faultRisk,
      simulationMode: this.currentMode,
      tickCount: this.tickCount,
      components: twin.subsystems,
      predictive: twin.predictive,
      mlFault: this.mlFault,
      mlConfidence: this.mlConfidence,
      mlProbabilities: this.mlProbabilities,
      mlStatus: this.mlStatus,
      // Extended channels
      exhaustGasTemp: meas.egt_C,
      manifoldAirPressure: meas.manifoldPressure_bar,
      torque_Nm: meas.torque_Nm,
      power_kW: meas.power_kW,
      residuals: twin.residuals,
      altitude_m: meas.altitude_m,
      airDensity: meas.airDensity_kg_per_m3,
      trueState: this.latestTrueState,
      measured: this.latestMeasured,
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
    callback(this.getState());
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

// ─── Singleton Export ────────────────────────────────────────────────────────

export const simulator = new EngineSimulator();

if (typeof window !== 'undefined') {
  simulator.startAuto();
  document.addEventListener('astro:page-load', () => {
    simulator.startAuto();
  });
}

// Singleton export already done above
