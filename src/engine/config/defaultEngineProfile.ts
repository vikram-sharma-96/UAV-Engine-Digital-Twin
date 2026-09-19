/**
 * defaultEngineProfile.ts
 * 
 * Default configurable engineering parameters for a representative 4-cylinder boxer 
 * 4-stroke UAV aero piston engine (Rotax 912 / PT900 class).
 * 
 * NOTE: As per engineering integrity guidelines, this is a prototype engineering
 * model based on representative general aviation specifications, not certified OEM data.
 */

import type { EngineConfig, HealthWeights, SensorSpec } from '../types';

export const DEFAULT_ENGINE_PROFILE: EngineConfig = {
  id: 'UAV-PT900-X1',
  name: 'Rotax-Type Aero 4-Cylinder Boxer UAV Engine',
  type: '4-Stroke Spark-Ignition Reciprocating Piston Engine',
  displacement_m3: 0.001211, // 1211 cc (1.211 liters)
  cylinderCount: 4,
  bore_m: 0.0795, // 79.5 mm
  stroke_m: 0.0610, // 61.0 mm
  compressionRatio: 10.5,
  maxRpm: 5800,
  idleRpm: 1400,
  nominalCruiseRpm: 5200,
  nominalPower_W: 73500, // 73.5 kW (~100 hp) @ 5800 RPM
  nominalTorque_Nm: 124, // 124 N·m @ 4500-5200 RPM
  fuelType: 'Avgas 100LL / 95 Octane Mogas (Density 0.74 kg/L)',
  fuelLowerHeatingValue_J_per_kg: 43.5e6, // 43.5 MJ/kg
  stoichiometricAfr: 14.7,
  oilCapacity_kg: 2.8, // 3.0 Liters @ ~0.88 kg/L
  nominalOilPressure_Pa: 430000, // 4.3 bar (430 kPa)
  maxAllowedCht_K: 413.15, // 140 °C
  maxAllowedEgt_K: 1153.15, // 880 °C
  maxAllowedOilTemp_K: 403.15, // 130 °C
  minOilPressure_Pa: 150000, // 1.5 bar minimum operating threshold
  inertia_kg_m2: 0.085, // Crankshaft + propeller equivalent inertia
};

export const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  chtWeight: 0.25,
  oilPressureWeight: 0.25,
  vibrationWeight: 0.20,
  rpmWeight: 0.15,
  fuelFlowWeight: 0.15,
};

export const DEFAULT_SENSOR_SPECS: Record<string, SensorSpec> = {
  rpm: {
    name: 'Engine RPM Sensor (Hall Effect Reluctor)',
    bias: 0,
    noiseStdDev: 8.0, // ±8 RPM jitter
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: 0,
    maxRange: 7000,
    quantizationStep: 1,
  },
  cht: {
    name: 'Cylinder Head Temperature Transducer (K-Type Thermocouple)',
    bias: 0.2, // °C
    noiseStdDev: 0.4, // °C
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: -40,
    maxRange: 200,
    quantizationStep: 0.1,
  },
  egt: {
    name: 'Exhaust Gas Temperature Transducer (N-Type Thermocouple)',
    bias: 1.0, // °C
    noiseStdDev: 2.5, // °C
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: 0,
    maxRange: 1000,
    quantizationStep: 1,
  },
  oilPressure: {
    name: 'Piezoresistive Oil Pressure Transducer',
    bias: 0.02, // bar
    noiseStdDev: 0.03, // bar
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: 0,
    maxRange: 10.0,
    quantizationStep: 0.05,
  },
  oilTemperature: {
    name: 'Oil Sump RTD (Pt100 Resistance Thermometer)',
    bias: 0.1, // °C
    noiseStdDev: 0.2, // °C
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: -20,
    maxRange: 150,
    quantizationStep: 0.1,
  },
  vibration: {
    name: 'Piezoelectric Tri-Axial Accelerometer (RMS Velocity)',
    bias: 0.05, // mm/s
    noiseStdDev: 0.06, // mm/s
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: 0,
    maxRange: 25.0,
    quantizationStep: 0.01,
  },
  fuelFlow: {
    name: 'Turbine Fuel Flow Transducer',
    bias: 0.01, // L/h
    noiseStdDev: 0.04, // L/h
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: 0,
    maxRange: 25.0,
    quantizationStep: 0.05,
  },
  manifoldPressure: {
    name: 'Manifold Absolute Pressure Transducer (MAP)',
    bias: 0.005, // bar
    noiseStdDev: 0.01, // bar
    driftRatePerSec: 0,
    dropoutProbability: 0,
    minRange: 0.2,
    maxRange: 2.5,
    quantizationStep: 0.01,
  },
};
