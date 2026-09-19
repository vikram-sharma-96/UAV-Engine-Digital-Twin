/**
 * lubrication.ts
 * 
 * Simplified Engine Lubrication & Oil Pressure Model.
 * 
 * Equations:
 * 1. Viscosity-Temperature Relationship (ASTM Walther equation / Vogel approximation):
 *    mu(T) = mu_ref * exp(b / (T - T_freeze))
 * 2. Positive Displacement Pump Pressure:
 *    P_raw = k_pump * (RPM / RPM_nom) * (mu / mu_ref)
 * 3. Pressure Relief Valve (PRV) Limiter:
 *    P_oil = min(P_relief, P_raw)
 * 
 * Influenced by:
 * - Engine RPM
 * - Oil temperature
 * - Pump wear / cavitation
 * - Lubrication degradation fault
 */

import type { EngineConfig } from '../types';

export class LubricationModel {
  // Pressure relief valve setpoint: 5.2 bar (520,000 Pa)
  private static readonly PRV_SETPOINT_PA = 520000.0;
  // Minimum idle relief pressure: 1.5 bar (150,000 Pa)
  private static readonly MIN_SAFE_PRESSURE_PA = 150000.0;

  /**
   * Calculate dynamic oil pressure based on engine speed, oil temperature, and pump health.
   * 
   * @param rpm Engine speed in RPM
   * @param oilTemp_K Oil temperature in Kelvin
   * @param config Engine structural configuration
   * @param pumpDegradationFactor Multiplier for pump condition [0.0 (total failure) to 1.0 (nominal)]
   * @param filterClogged True if oil filter bypass is restricted
   */
  static calculatePressure(
    rpm: number,
    oilTemp_K: number,
    config: EngineConfig,
    pumpDegradationFactor: number = 1.0,
    filterClogged: boolean = false
  ): { oilPressure_Pa: number; oilPressure_bar: number; viscosityRatio: number } {
    const clampedRpm = Math.max(0, rpm);

    // Reference oil temp: 80 °C = 353.15 K
    const refTemp_K = 353.15;
    // Viscosity index: hotter oil has lower viscosity, colder oil has higher viscosity
    // Normalized to 1.0 at 80 °C
    const deltaT = oilTemp_K - refTemp_K;
    const viscosityRatio = Math.max(0.4, Math.min(2.5, Math.exp(-0.018 * deltaT)));

    // Pump delivery scaling: rises with RPM up to relief valve clamp
    const rpmFraction = clampedRpm / config.nominalCruiseRpm;
    // At idle (1400 RPM), pressure is ~2.0-2.5 bar; at cruise (5200 RPM), pressure is ~4.3 bar
    const basePressure_Pa = 200000.0 + 230000.0 * Math.pow(Math.min(1.2, rpmFraction), 0.75);

    // Combine pump displacement, oil viscosity, and wear factor
    const filterFactor = filterClogged ? 0.7 : 1.0;
    const rawPressure_Pa = basePressure_Pa * Math.pow(viscosityRatio, 0.4) * pumpDegradationFactor * filterFactor;

    // Apply pressure relief valve ceiling
    const oilPressure_Pa = Math.max(20000.0, Math.min(this.PRV_SETPOINT_PA, rawPressure_Pa));
    const oilPressure_bar = oilPressure_Pa / 100000.0;

    return {
      oilPressure_Pa,
      oilPressure_bar: parseFloat(oilPressure_bar.toFixed(2)),
      viscosityRatio,
    };
  }
}
