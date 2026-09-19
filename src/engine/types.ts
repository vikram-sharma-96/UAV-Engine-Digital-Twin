/**
 * types.ts
 * 
 * Core domain types and interfaces for AeroTwin AI.
 * Follows strict SI units internally for all physical calculations:
 * - Pressure: Pa (gauge / absolute as noted)
 * - Temperature: K (Kelvin) internally, displayed in °C
 * - Mass flow: kg/s
 * - Volume: m³
 * - Time: seconds
 * - Torque: N·m
 * - Power: W (Watts)
 * - Angular velocity: rad/s
 * - Acceleration / Vibration: m/s² (or mm/s RMS for display)
 */

// ─── Engine Configuration ───────────────────────────────────────────────────

export interface EngineConfig {
  id: string;
  name: string;
  type: string; // e.g. "4-Stroke 4-Cylinder Boxer UAV Engine"
  displacement_m3: number; // e.g. 0.001211 m³ (1211 cc)
  cylinderCount: number; // 4
  bore_m: number; // 0.0795 m (79.5 mm)
  stroke_m: number; // 0.0610 m (61.0 mm)
  compressionRatio: number; // 10.5
  maxRpm: number; // 5800 RPM
  idleRpm: number; // 1400 RPM
  nominalCruiseRpm: number; // 5200 RPM
  nominalPower_W: number; // 73500 W (100 hp)
  nominalTorque_Nm: number; // 124 N·m @ 4500 RPM
  fuelType: string; // "Avgas 100LL / 95 Octane Mogas"
  fuelLowerHeatingValue_J_per_kg: number; // 43.5e6 J/kg
  stoichiometricAfr: number; // 14.7
  oilCapacity_kg: number; // ~2.8 kg
  nominalOilPressure_Pa: number; // 430,000 Pa (4.3 bar)
  maxAllowedCht_K: number; // 413.15 K (140 °C)
  maxAllowedEgt_K: number; // 1153.15 K (880 °C)
  maxAllowedOilTemp_K: number; // 403.15 K (130 °C)
  minOilPressure_Pa: number; // 150,000 Pa (1.5 bar)
  inertia_kg_m2: number; // 0.085 kg·m² (crankshaft + flywheel + prop hub equivalent)
}

// ─── Environment ────────────────────────────────────────────────────────────

export interface EnvironmentConditions {
  altitude_m: number; // meters above sea level
  ambientPressure_Pa: number; // Pascals
  ambientTemperature_K: number; // Kelvin
  airDensity_kg_per_m3: number; // kg/m³
  relativeHumidity: number; // 0.0 - 1.0 (fraction)
}

// ─── Operating Control Inputs ────────────────────────────────────────────────

export interface ControlInputs {
  throttle: number; // 0.0 (idle) to 1.0 (full)
  propellerPitch?: number; // 0.0 to 1.0 (fixed or constant speed pitch)
  mixture?: number; // 1.0 = stoichiometric, <1 lean, >1 rich
  starterEngaged?: boolean;
}

// ─── Ground Truth Physical State ─────────────────────────────────────────────

export interface TrueEngineState {
  timestamp_s: number; // Monotonic simulation time
  rpm: number;
  angularVelocity_rad_s: number;
  throttle: number;
  engineLoad: number; // 0.0 to 1.0 (effective torque ratio)
  manifoldPressure_Pa: number; // Manifold absolute pressure (MAP)
  airMassFlow_kg_s: number;
  fuelMassFlow_kg_s: number;
  fuelConsumption_L_h: number;
  actualAfr: number;
  combustionEfficiency: number; // 0.0 to 1.0
  torque_Nm: number;
  brakePower_W: number;
  cht_K: number; // Cylinder head temperature (Kelvin)
  egt_K: number; // Exhaust gas temperature (Kelvin)
  oilTemperature_K: number;
  oilPressure_Pa: number;
  vibration_mm_s: number; // RMS vibration velocity
  alternatorVoltage_V: number;
  degradationIndex: number; // 0.0 (new) to 1.0 (completely degraded)
  activeFaults: string[];
  cylinderTemperatures_K: [number, number, number, number];
}

// ─── Sensor Transducer Specifications ───────────────────────────────────────

export interface SensorSpec {
  name: string;
  bias: number; // Fixed calibration offset
  noiseStdDev: number; // Additive Gaussian white noise
  driftRatePerSec: number; // Progressive drift
  dropoutProbability: number; // Probability of 0 or disconnect per tick
  minRange: number;
  maxRange: number;
  quantizationStep?: number;
}

// ─── Measured Sensor Telemetry (Transducer Output) ───────────────────────────

export interface MeasuredTelemetry {
  timestamp_ms: number;
  rpm: number;
  manifoldPressure_bar: number;
  fuelFlow_L_h: number;
  cht_C: number; // Cylinder Head Temp in °C
  egt_C: number; // Exhaust Gas Temp in °C
  oilPressure_bar: number; // Oil pressure in bar
  oilTemperature_C: number; // Oil temp in °C
  vibration_mm_s: number; // Vibration RMS in mm/s
  alternatorVoltage_V: number;
  throttle_pct: number;
  engineLoad_pct: number;
  altitude_m: number;
  ambientTemp_C: number;
  airDensity_kg_per_m3: number;
  torque_Nm: number;
  power_kW: number;
  sensorDropoutFlags: Record<string, boolean>;
}

// ─── Faults and Degradation ─────────────────────────────────────────────────

export type FaultId =
  | 'INJECTOR_DEGRADATION'
  | 'MISFIRE'
  | 'OVERHEATING'
  | 'LUBRICATION_DEGRADATION'
  | 'VIBRATION_FAULT'
  | 'SENSOR_DRIFT'
  | 'SENSOR_DROPOUT'
  | 'COMBUSTION_INSTABILITY'
  | 'AIR_FUEL_IMBALANCE'
  | 'PROGRESSIVE_DEGRADATION';

export interface FaultDefinition {
  id: FaultId;
  name: string;
  description: string;
  severity: number; // 0.0 (inactive) to 1.0 (maximum critical severity)
  targetSubsystem: 'FUEL' | 'THERMAL' | 'LUBRICATION' | 'BEARING' | 'CORE' | 'SENSOR';
  targetCylinder?: 1 | 2 | 3 | 4;
  targetSensor?: string;
  startTime_s?: number;
  duration_s?: number;
}

// ─── Digital Twin Expected State & Residuals ────────────────────────────────

export interface ExpectedState {
  rpm: number;
  manifoldPressure_bar: number;
  fuelFlow_L_h: number;
  cht_C: number;
  egt_C: number;
  oilPressure_bar: number;
  oilTemperature_C: number;
  vibration_mm_s: number;
}

export interface TelemetryResiduals {
  rpmResidual: number; // measured - expected
  fuelFlowResidual: number;
  chtResidual: number;
  egtResidual: number;
  oilPressureResidual: number;
  oilTempResidual: number;
  vibrationResidual: number;
  normalizedResidualScore: number; // 0.0 (nominal) to 1.0+ (severe deviation)
}

// ─── Digital Twin Health Index & Subsystem Scores ───────────────────────────

export interface HealthWeights {
  chtWeight: number; // default 0.25
  oilPressureWeight: number; // default 0.25
  vibrationWeight: number; // default 0.20
  rpmWeight: number; // default 0.15
  fuelFlowWeight: number; // default 0.15
}

export interface DigitalTwinState {
  timestamp: string;
  timestamp_s: number;
  flightMode: string;
  trueState: TrueEngineState;
  measured: MeasuredTelemetry;
  expected: ExpectedState;
  residuals: TelemetryResiduals;
  healthScore: number; // 0 - 100
  engineStatus: 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
  faultRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  activeFaultNames: string[];
  subsystems: {
    cylinder: number; // 0 - 100
    lubrication: number;
    bearing: number;
    cooling: number;
    fuel: number;
  };
  predictive: {
    bearingCondition: string;
    bearingColor: 'emerald' | 'amber' | 'rose';
    coolingSystem: string;
    coolingColor: 'cyan' | 'amber' | 'rose';
    maintenanceRisk: string;
    maintenanceColor: 'emerald' | 'amber' | 'rose';
    nextInspectionHrs: number;
    remainingUsefulLifeHrs: number;
  };
}

// ─── Mission Profile ────────────────────────────────────────────────────────

export type MissionPhaseName =
  | 'STARTUP_IDLE'
  | 'TAKEOFF'
  | 'CLIMB'
  | 'CRUISE'
  | 'HIGH_LOAD'
  | 'LOITER'
  | 'DESCENT'
  | 'LANDING';

export interface MissionPhase {
  name: MissionPhaseName;
  duration_s: number;
  targetAltitude_m: number;
  throttle: number;
  loadMultiplier: number;
}

// ─── Machine Learning Interfaces ────────────────────────────────────────────

export interface TelemetryWindow {
  samples: MeasuredTelemetry[];
  residuals: TelemetryResiduals[];
  windowDuration_s: number;
}

export interface MLPrediction {
  anomalyScore: number; // 0.0 to 1.0
  isAnomaly: boolean;
  predictedFault: FaultId | 'NONE';
  faultProbabilities: Record<string, number>;
  degradationScore: number; // 0.0 to 1.0
  rulEstimateHours: number;
  confidence: number; // 0.0 to 1.0
  explanation: string;
}

// ─── Counterfactual Simulation ──────────────────────────────────────────────

export interface CounterfactualIntervention {
  loadDeltaPct?: number; // e.g. +15%
  ambientTempDeltaC?: number; // e.g. +10 °C
  throttleDelta?: number; // e.g. -0.1
  altitudeDelta_m?: number;
  injectorEfficiencyDeltaPct?: number; // e.g. -20%
  oilViscosityDegradationPct?: number;
}

export interface CounterfactualResult {
  durationSimulated_s: number;
  baselineFinal: MeasuredTelemetry;
  counterfactualFinal: MeasuredTelemetry;
  deltas: {
    rpmDelta: number;
    chtDelta_C: number;
    egtDelta_C: number;
    oilPressureDelta_bar: number;
    fuelFlowDelta_L_h: number;
    healthScoreDelta: number;
  };
  riskAssessment: string;
  recommendation: string;
}
