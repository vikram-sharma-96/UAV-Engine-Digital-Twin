/**
 * sensorTransducer.ts
 * 
 * Sensor Transducer & Measurement Pipeline.
 * 
 * Architecture:
 *   TrueEngineState  -->  Transducer Model  -->  MeasuredTelemetry
 * 
 * Transducer Effects:
 * 1. Fixed Calibration Bias: offset_true = val + bias
 * 2. Additive Gaussian Measurement Noise: val_noisy = val + N(0, sigma)
 * 3. Cumulative Sensor Drift: drift_t = drift_rate * dt
 * 4. Discretization / ADC Quantization
 * 5. Sensor Saturation (min/max physical range clamping)
 * 6. Intermittent or Persistent Sensor Dropout (e.g. open-circuit = 0.0 or frozen)
 */

import type { TrueEngineState, MeasuredTelemetry, SensorSpec } from '../types.ts';
import { DEFAULT_SENSOR_SPECS } from '../config/defaultEngineProfile.ts';
import { AtmosphereModel } from '../environment/atmosphere.ts';
import type { PRNG } from '../utils/prng.ts';

export class SensorTransducerModel {
  private specs: Record<string, SensorSpec>;
  private cumulativeDrift: Record<string, number> = {};
  private dropoutStates: Record<string, boolean> = {};

  constructor(customSpecs?: Partial<Record<string, SensorSpec>>) {
    this.specs = { ...DEFAULT_SENSOR_SPECS, ...customSpecs };
    for (const key of Object.keys(this.specs)) {
      this.cumulativeDrift[key] = 0.0;
      this.dropoutStates[key] = false;
    }
  }

  /** Reset all drift and dropout states */
  reset(): void {
    for (const key of Object.keys(this.specs)) {
      this.cumulativeDrift[key] = 0.0;
      this.dropoutStates[key] = false;
    }
  }

  /** Apply artificial sensor drift fault */
  injectDrift(sensorKey: string, driftRatePerSec: number): void {
    if (this.specs[sensorKey]) {
      this.specs[sensorKey].driftRatePerSec = driftRatePerSec;
    }
  }

  /** Force sensor dropout / disconnection */
  setDropout(sensorKey: string, active: boolean): void {
    this.dropoutStates[sensorKey] = active;
  }

  /**
   * Convert True Engine State to Measured Telemetry through physical transducer simulations.
   * 
   * @param trueState True ground-truth physical engine state
   * @param env Ambient environmental state
   * @param dt Time step in seconds
   * @param prng Seeded random number generator
   */
  measure(
    trueState: TrueEngineState,
    env: { altitude_m: number; ambientTemperature_K: number; airDensity_kg_per_m3: number },
    dt: number,
    prng: PRNG
  ): MeasuredTelemetry {
    // Helper to process individual transducer channel
    const processChannel = (
      sensorKey: string,
      trueVal: number,
      unitDecimals: number = 1
    ): number => {
      const spec = this.specs[sensorKey] || {
        name: sensorKey,
        bias: 0,
        noiseStdDev: 0,
        driftRatePerSec: 0,
        dropoutProbability: 0,
        minRange: -Infinity,
        maxRange: Infinity,
      };

      // Check dropout
      if (this.dropoutStates[sensorKey]) {
        return 0.0; // Open circuit reading
      }

      // Check stochastic dropout
      if (spec.dropoutProbability > 0 && prng.random() < spec.dropoutProbability) {
        this.dropoutStates[sensorKey] = true;
        return 0.0;
      }

      // Accumulate drift
      this.cumulativeDrift[sensorKey] = (this.cumulativeDrift[sensorKey] || 0) + spec.driftRatePerSec * dt;

      // Add bias + noise + drift
      const noise = prng.gaussian(0, spec.noiseStdDev);
      let measured = trueVal + spec.bias + noise + this.cumulativeDrift[sensorKey];

      // Clamp to physical transducer saturation limits
      measured = Math.max(spec.minRange, Math.min(spec.maxRange, measured));

      // Quantization
      if (spec.quantizationStep && spec.quantizationStep > 0) {
        measured = Math.round(measured / spec.quantizationStep) * spec.quantizationStep;
      }

      return parseFloat(measured.toFixed(unitDecimals));
    };

    // Convert internal SI units to display engineering units
    const rawCht_C = AtmosphereModel.kelvinToCelsius(trueState.cht_K);
    const rawEgt_C = AtmosphereModel.kelvinToCelsius(trueState.egt_K);
    const rawOilTemp_C = AtmosphereModel.kelvinToCelsius(trueState.oilTemperature_K);
    const rawOilPressure_bar = AtmosphereModel.paToBar(trueState.oilPressure_Pa);
    const rawMap_bar = AtmosphereModel.paToBar(trueState.manifoldPressure_Pa);

    const measuredRpm = Math.round(processChannel('rpm', trueState.rpm, 0));
    const measuredCht_C = processChannel('cht', rawCht_C, 1);
    const measuredEgt_C = Math.round(processChannel('egt', rawEgt_C, 0));
    const measuredOilPressure_bar = processChannel('oilPressure', rawOilPressure_bar, 2);
    const measuredOilTemp_C = processChannel('oilTemperature', rawOilTemp_C, 1);
    const measuredVibration_mm_s = processChannel('vibration', trueState.vibration_mm_s, 2);
    const measuredFuelFlow_L_h = processChannel('fuelFlow', trueState.fuelConsumption_L_h, 2);
    const measuredMap_bar = processChannel('manifoldPressure', rawMap_bar, 2);

    return {
      timestamp_ms: Math.round(trueState.timestamp_s * 1000),
      rpm: measuredRpm,
      manifoldPressure_bar: measuredMap_bar,
      fuelFlow_L_h: measuredFuelFlow_L_h,
      cht_C: measuredCht_C,
      egt_C: measuredEgt_C,
      oilPressure_bar: measuredOilPressure_bar,
      oilTemperature_C: measuredOilTemp_C,
      vibration_mm_s: measuredVibration_mm_s,
      alternatorVoltage_V: parseFloat((trueState.alternatorVoltage_V + prng.gaussian(0, 0.05)).toFixed(2)),
      throttle_pct: Math.round(trueState.throttle * 100),
      engineLoad_pct: Math.round(trueState.engineLoad * 100),
      altitude_m: Math.round(env.altitude_m),
      ambientTemp_C: parseFloat(AtmosphereModel.kelvinToCelsius(env.ambientTemperature_K).toFixed(1)),
      airDensity_kg_per_m3: parseFloat(env.airDensity_kg_per_m3.toFixed(3)),
      torque_Nm: parseFloat(trueState.torque_Nm.toFixed(1)),
      power_kW: parseFloat((trueState.brakePower_W / 1000.0).toFixed(1)),
      sensorDropoutFlags: { ...this.dropoutStates },
    };
  }
}
