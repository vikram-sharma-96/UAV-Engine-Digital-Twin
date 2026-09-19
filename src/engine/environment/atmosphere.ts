/**
 * atmosphere.ts
 * 
 * Environmental & Atmospheric Model based on International Standard Atmosphere (ISA).
 * Computes altitude-dependent ambient pressure, temperature, and air density.
 * 
 * Equations:
 * 1. Temperature Lapse: T(h) = T_0 - L * h
 * 2. Barometric Pressure: P(h) = P_0 * (1 - (L * h) / T_0)^(g0 * M / (R * L))
 * 3. Ideal Gas Law: rho = P / (R_spec * T)
 * 
 * Units:
 * - Altitude: meters (m)
 * - Pressure: Pascals (Pa)
 * - Temperature: Kelvin (K)
 * - Density: kg/m³
 */

import type { EnvironmentConditions } from '../types';

// Physical constants for dry air (ISA)
export const ISA_CONSTANTS = {
  P0_Pa: 101325.0, // Standard sea level pressure (Pa)
  T0_K: 288.15, // Standard sea level temperature (15 °C in K)
  L_K_per_m: 0.0065, // Troposphere temperature lapse rate (6.5 K/km)
  g0_m_per_s2: 9.80665, // Standard acceleration due to gravity (m/s²)
  M_kg_per_mol: 0.0289644, // Molar mass of Earth's air (kg/mol)
  R_univ_J_per_mol_K: 8.3144598, // Universal gas constant (J/(mol·K))
  R_specific_J_per_kg_K: 287.058, // Specific gas constant for dry air (J/(kg·K))
  exponent: 5.25588, // (g0 * M) / (R_univ * L)
} as const;

export class AtmosphereModel {
  /**
   * Calculate environmental conditions at a given geometric altitude and optional ground temperature offset.
   * 
   * @param altitude_m Geometric altitude in meters (-500m to 12,000m troposphere)
   * @param seaLevelTempOffset_K Temperature offset from ISA standard (e.g. +10 K for a hot day)
   * @param relativeHumidity Relative humidity fraction (0.0 to 1.0)
   */
  static calculate(
    altitude_m: number,
    seaLevelTempOffset_K: number = 0,
    relativeHumidity: number = 0.5
  ): EnvironmentConditions {
    // Clamp altitude to standard tropospheric bounds
    const h = Math.max(-500, Math.min(12000, altitude_m));

    const T0 = ISA_CONSTANTS.T0_K + seaLevelTempOffset_K;
    const P0 = ISA_CONSTANTS.P0_Pa;

    // Temperature at altitude (K)
    const T = Math.max(180, T0 - ISA_CONSTANTS.L_K_per_m * h);

    // Pressure at altitude (Pa) using barometric formula
    const pressureRatio = Math.max(0.01, 1.0 - (ISA_CONSTANTS.L_K_per_m * h) / ISA_CONSTANTS.T0_K);
    const P = P0 * Math.pow(pressureRatio, ISA_CONSTANTS.exponent);

    // Air density from ideal gas equation: rho = P / (R_spec * T)
    const rho = P / (ISA_CONSTANTS.R_specific_J_per_kg_K * T);

    return {
      altitude_m: h,
      ambientPressure_Pa: P,
      ambientTemperature_K: T,
      airDensity_kg_per_m3: Math.max(0.1, rho),
      relativeHumidity: Math.max(0, Math.min(1, relativeHumidity)),
    };
  }

  /** Convert Kelvin to Celsius */
  static kelvinToCelsius(k: number): number {
    return k - 273.15;
  }

  /** Convert Celsius to Kelvin */
  static celsiusToKelvin(c: number): number {
    return c + 273.15;
  }

  /** Convert Pascals to bar */
  static paToBar(pa: number): number {
    return pa / 100000.0;
  }

  /** Convert bar to Pascals */
  static barToPa(bar: number): number {
    return bar * 100000.0;
  }
}
