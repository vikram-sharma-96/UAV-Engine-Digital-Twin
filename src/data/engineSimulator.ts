/**
 * engineSimulator.ts
 * 
 * Centralized engine simulation engine for the UAV Digital Twin dashboard.
 * 
 * Architecture:
 * - Pure state machine with zero DOM dependencies.
 * - Each tick() call advances the simulation by one step (~1 second).
 * - State is broadcast via CustomEvent('engine-state-update') on `document`.
 * - Designed so the simulator can later be swapped for real sensor data
 *   arriving via WebSocket/API with minimal refactoring.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SimulationMode = 'normal' | 'overheating' | 'bearing' | 'oilPressure' | 'degradation';

export type EngineStatus = 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
export type FaultRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

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
}

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

// ─── Normal Baseline ─────────────────────────────────────────────────────────

const NORMAL_BASELINE = {
  rpm: 5200,
  temperature: 78,
  oilPressure: 4.3,
  vibration: 1.2,
  fuelFlow: 2.7,
} as const;

// ─── Scenario Target Profiles ────────────────────────────────────────────────

interface ScenarioProfile {
  rpm: number;
  temperature: number;
  oilPressure: number;
  vibration: number;
  fuelFlow: number;
  activeFault: string;
  faultLabel: string;
}

const SCENARIO_TARGETS: Record<SimulationMode, ScenarioProfile> = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Linear interpolation: move `current` toward `target` by factor `alpha` */
function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

/** Gaussian-ish noise using Box-Muller (approximated) */
function gaussianNoise(stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  return z * stddev;
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Format current time as HH:MM:SS */
function currentTimeStr(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Health Score Computation ────────────────────────────────────────────────

/**
 * Compute a dynamic health score based on deviation from normal baseline.
 * NOT hard-coded — calculated from live sensor values.
 * 
 * Weights: RPM (15%), Temperature (25%), Oil Pressure (25%), 
 *          Vibration (20%), Fuel Flow (15%)
 */
function computeHealthScore(state: { rpm: number; temperature: number; oilPressure: number; vibration: number; fuelFlow: number }): number {
  const rpmRange = 600;
  const tempRange = 30;
  const oilRange = 2.0;
  const vibRange = 4.0;
  const fuelRange = 1.5;

  const rpmDeviation = Math.abs(state.rpm - NORMAL_BASELINE.rpm) / rpmRange;
  const tempDeviation = Math.max(0, state.temperature - NORMAL_BASELINE.temperature) / tempRange;
  const oilDeviation = Math.max(0, NORMAL_BASELINE.oilPressure - state.oilPressure) / oilRange;
  const vibDeviation = Math.max(0, state.vibration - NORMAL_BASELINE.vibration) / vibRange;
  const fuelDeviation = Math.abs(state.fuelFlow - NORMAL_BASELINE.fuelFlow) / fuelRange;

  const penalty =
    0.15 * clamp(rpmDeviation, 0, 1) +
    0.25 * clamp(tempDeviation, 0, 1) +
    0.25 * clamp(oilDeviation, 0, 1) +
    0.20 * clamp(vibDeviation, 0, 1) +
    0.15 * clamp(fuelDeviation, 0, 1);

  const raw = 100 * (1 - penalty);
  return Math.round(clamp(raw, 0, 100));
}

function deriveEngineStatus(healthScore: number): EngineStatus {
  if (healthScore >= 90) return 'HEALTHY';
  if (healthScore >= 75) return 'ADVISORY';
  if (healthScore >= 60) return 'WARNING';
  return 'CRITICAL';
}

function deriveFaultRisk(healthScore: number): FaultRisk {
  if (healthScore >= 90) return 'LOW';
  if (healthScore >= 75) return 'MODERATE';
  if (healthScore >= 60) return 'HIGH';
  return 'CRITICAL';
}

// ─── Component Health Derivation ─────────────────────────────────────────────

function deriveComponentScores(state: { rpm: number; temperature: number; oilPressure: number; vibration: number; fuelFlow: number }): ComponentScores {
  const cylTemp = clamp((state.temperature - 78) / 30, 0, 1);
  const cylRpm = clamp(Math.abs(state.rpm - 5200) / 600, 0, 1);
  const cylinder = Math.round(clamp(96 - cylTemp * 20 - cylRpm * 8, 30, 100));

  const lubOil = clamp((4.3 - state.oilPressure) / 2.0, 0, 1);
  const lubTemp = clamp((state.temperature - 78) / 35, 0, 1);
  const lubrication = Math.round(clamp(92 - lubOil * 55 - lubTemp * 10, 20, 100));

  const brgVib = clamp((state.vibration - 1.2) / 4.0, 0, 1);
  const brgOil = clamp((4.3 - state.oilPressure) / 2.5, 0, 1);
  const bearing = Math.round(clamp(94 - brgVib * 50 - brgOil * 15, 20, 100));

  const coolTemp = clamp((state.temperature - 78) / 28, 0, 1);
  const cooling = Math.round(clamp(95 - coolTemp * 42, 25, 100));

  const fuelDev = clamp(Math.abs(state.fuelFlow - 2.7) / 1.5, 0, 1);
  const fuelRpm = clamp(Math.abs(state.rpm - 5200) / 700, 0, 1);
  const fuel = Math.round(clamp(93 - fuelDev * 28 - fuelRpm * 8, 30, 100));

  return { cylinder, lubrication, bearing, cooling, fuel };
}

// ─── Predictive State Derivation ─────────────────────────────────────────────

function derivePredictiveState(state: { vibration: number; temperature: number }, healthScore: number): PredictiveState {
  let bearingCondition: string;
  let bearingColor: 'emerald' | 'amber' | 'rose';
  if (state.vibration <= 2.0) {
    bearingCondition = 'Healthy';
    bearingColor = 'emerald';
  } else if (state.vibration <= 3.5) {
    bearingCondition = 'Degraded';
    bearingColor = 'amber';
  } else {
    bearingCondition = 'Critical';
    bearingColor = 'rose';
  }

  let coolingSystem: string;
  let coolingColor: 'cyan' | 'amber' | 'rose';
  if (state.temperature <= 85) {
    coolingSystem = 'Normal';
    coolingColor = 'cyan';
  } else if (state.temperature <= 95) {
    coolingSystem = 'Stressed';
    coolingColor = 'amber';
  } else {
    coolingSystem = 'Overloaded';
    coolingColor = 'rose';
  }

  let maintenanceRisk: string;
  let maintenanceColor: 'emerald' | 'amber' | 'rose';
  if (healthScore >= 85) {
    maintenanceRisk = 'Low';
    maintenanceColor = 'emerald';
  } else if (healthScore >= 65) {
    maintenanceRisk = 'Moderate';
    maintenanceColor = 'amber';
  } else {
    maintenanceRisk = 'High';
    maintenanceColor = 'rose';
  }

  const nextInspectionHrs = Math.round(clamp(healthScore * 0.5, 5, 47));

  return { bearingCondition, bearingColor, coolingSystem, coolingColor, maintenanceRisk, maintenanceColor, nextInspectionHrs };
}

// ─── Simulator Class ─────────────────────────────────────────────────────────

const MAX_HISTORY = 30;
const LERP_ALPHA = 0.18;

type StateCallback = (state: EngineState) => void;

class EngineSimulator {
  private currentMode: SimulationMode = 'normal';
  private tickCount = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers: Set<StateCallback> = new Set();

  private rpm = NORMAL_BASELINE.rpm;
  private temperature = NORMAL_BASELINE.temperature;
  private oilPressure = NORMAL_BASELINE.oilPressure;
  private vibration = NORMAL_BASELINE.vibration;
  private fuelFlow = NORMAL_BASELINE.fuelFlow;

  private history: HistoryPoint[] = [];

  constructor() {
    // Seed initial history with slight variation
    for (let i = 0; i < 11; i++) {
      this.history.push({
        time: `15:${String(i).padStart(2, '0')}`,
        rpm: Math.round(5200 + gaussianNoise(10)),
        temperature: parseFloat((78 + gaussianNoise(0.5)).toFixed(1)),
        vibration: parseFloat((1.2 + gaussianNoise(0.05)).toFixed(1)),
        oilPressure: parseFloat((4.3 + gaussianNoise(0.03)).toFixed(1)),
      });
    }
  }

  /** Switch the active simulation scenario */
  setScenario(mode: SimulationMode): void {
    this.currentMode = mode;
    this.tickCount = 0;

    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000);
    }

    // Immediate first tick
    this.tick();
  }

  /** Advance simulation by one step */
  tick(): void {
    this.tickCount++;
    const target = SCENARIO_TARGETS[this.currentMode];

    this.rpm = lerp(this.rpm, target.rpm, LERP_ALPHA) + gaussianNoise(8);
    this.temperature = lerp(this.temperature, target.temperature, LERP_ALPHA) + gaussianNoise(0.3);
    this.oilPressure = lerp(this.oilPressure, target.oilPressure, LERP_ALPHA) + gaussianNoise(0.02);
    this.vibration = lerp(this.vibration, target.vibration, LERP_ALPHA) + gaussianNoise(0.04);
    this.fuelFlow = lerp(this.fuelFlow, target.fuelFlow, LERP_ALPHA) + gaussianNoise(0.03);

    this.rpm = clamp(Math.round(this.rpm), 3000, 6500);
    this.temperature = clamp(parseFloat(this.temperature.toFixed(1)), 40, 150);
    this.oilPressure = clamp(parseFloat(this.oilPressure.toFixed(1)), 0.5, 6.0);
    this.vibration = clamp(parseFloat(this.vibration.toFixed(1)), 0.3, 8.0);
    this.fuelFlow = clamp(parseFloat(this.fuelFlow.toFixed(1)), 1.0, 6.0);

    const point: HistoryPoint = {
      time: currentTimeStr(),
      rpm: this.rpm,
      temperature: this.temperature,
      vibration: this.vibration,
      oilPressure: this.oilPressure,
    };
    this.history.push(point);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

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
    const sensorValues = {
      rpm: this.rpm,
      temperature: this.temperature,
      oilPressure: this.oilPressure,
      vibration: this.vibration,
      fuelFlow: this.fuelFlow,
    };

    const healthScore = computeHealthScore(sensorValues);
    const engineStatus = deriveEngineStatus(healthScore);
    const faultRisk = deriveFaultRisk(healthScore);
    const target = SCENARIO_TARGETS[this.currentMode];
    const components = deriveComponentScores(sensorValues);
    const predictive = derivePredictiveState(sensorValues, healthScore);

    return {
      ...sensorValues,
      healthScore,
      engineStatus,
      activeFault: target.activeFault,
      faultRisk,
      simulationMode: this.currentMode,
      tickCount: this.tickCount,
      components,
      predictive,
    };
  }

  /** Get rolling chart history */
  getHistory(): HistoryPoint[] {
    return [...this.history];
  }

  /** Reset to normal operation */
  reset(): void {
    this.setScenario('normal');
  }

  /** Subscribe to state changes */
  subscribe(callback: StateCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /** Stop the simulation loop */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Check if simulation is running */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

/** Global singleton — all dashboard panels share this one instance */
export const simulator = new EngineSimulator();

export { NORMAL_BASELINE, SCENARIO_TARGETS, computeHealthScore };
