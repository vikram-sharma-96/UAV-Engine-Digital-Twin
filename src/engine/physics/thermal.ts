/**
 * thermal.ts
 * 
 * Dynamic Thermal Model with Thermal Inertia for CHT, EGT, and Oil Temperature.
 * 
 * Fundamental Heat Balance:
 *   C_thermal * (dT / dt) = Q_dot_in - Q_dot_cooling
 * 
 * Subsystems:
 * 1. Cylinder Head Temperature (CHT):
 *    - Heat input: fraction of combustion thermal energy (conduction from flame/gas)
 *    - Heat rejection: convective heat transfer from airspeed & cooling air:
 *      Q_dot_cool = h_cool * A * (T_CHT - T_ambient)
 *    - Thermal mass: C_th_cyl (~1200 J/K per cylinder) gives realistic ~25-45s time constant.
 * 2. Exhaust Gas Temperature (EGT):
 *    - Governed by flame temperature, AFR (peaks slightly lean of stoichiometric), and expansion work.
 *    - Fast thermal response (probe time constant ~1.5s).
 * 3. Oil Sump Temperature:
 *    - Heat input: Mechanical friction + heat conduction from cylinder sleeve.
 *    - Heat rejection: Oil radiator cooling: Q_dot_rad = k_oil_rad * (T_oil - T_amb).
 *    - Slower thermal mass (~3500 J/K) gives ~60-120s thermal inertia.
 */

import type { EngineConfig, EnvironmentConditions } from '../types';

export interface ThermalState {
  cht_K: number;
  egt_K: number;
  oilTemperature_K: number;
  cylinderTemperatures_K: [number, number, number, number];
}

export class ThermalModel {
  // Thermal capacitances (J/K)
  private static readonly C_TH_CYL = 1400.0; // Cylinder head thermal mass
  private static readonly C_TH_OIL = 3800.0; // Oil sump thermal mass
  private static readonly TAU_EGT = 1.8; // EGT thermocouple response time constant (seconds)

  /**
   * Advance thermal state by time step dt.
   * 
   * @param current Current temperatures
   * @param combustionHeatRate_W Total chemical heat release rate
   * @param effectiveAfr Air-to-Fuel ratio
   * @param rpm Engine speed
   * @param airspeed_m_s Estimated UAV flight speed (m/s)
   * @param env Ambient conditions
   * @param dt Time step (seconds)
   * @param coolingDegradationFactor Radiator/cooling fault factor [0.0 - 1.0] (1.0 = normal, 0.5 = 50% blocked)
   * @param cylinderImbalances Optional thermal imbalances for individual cylinders
   */
  static step(
    current: ThermalState,
    combustionHeatRate_W: number,
    effectiveAfr: number,
    rpm: number,
    airspeed_m_s: number,
    env: EnvironmentConditions,
    dt: number,
    coolingDegradationFactor: number = 1.0,
    cylinderImbalances: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0]
  ): ThermalState {
    const safeDt = Math.min(1.0, dt);

    // ─── 1. EGT Calculation (Quasi-Steady with Thermocouple Lag) ───────────
    // Theoretical flame temperature peaks at slightly rich/stoichiometric (~14.2 AFR)
    // Nominal cruise EGT is ~640 °C (913 K), max limit ~850 °C (1123 K)
    const afrDeviation = effectiveAfr - 14.7;
    // Lean mixture (+afrDeviation) raises EGT up to peak, very lean decreases it
    const afrTempOffset = -25.0 * Math.pow(afrDeviation, 2) + 20.0 * afrDeviation;
    const loadFactor = Math.min(1.0, (rpm / 5200.0) * 0.95);
    const targetEgt_K = 273.15 + 480.0 + loadFactor * 220.0 + afrTempOffset;

    // First-order sensor response: dT/dt = (T_target - T) / tau
    const nextEgt_K = current.egt_K + ((targetEgt_K - current.egt_K) / this.TAU_EGT) * safeDt;

    // ─── 2. CHT Calculation (Dynamic Heat Balance) ─────────────────────────
    // Fraction of fuel energy rejected into cylinder head: ~14%
    const q_in_cht = combustionHeatRate_W * 0.14;

    // Cooling convection coefficient rises with airspeed and propeller wash
    const propWash_m_s = (rpm / 5200.0) * 12.0;
    const effectiveAirspeed = Math.max(10.0, airspeed_m_s + propWash_m_s);
    const h_cool = (22.0 + 1.2 * effectiveAirspeed) * Math.max(0.2, coolingDegradationFactor);

    // Heat rejection: Q_out = h * (T_cht - T_amb)
    const q_out_cht = h_cool * (current.cht_K - env.ambientTemperature_K);

    // dT/dt = (Q_in - Q_out) / C_thermal
    const dCht_dt = (q_in_cht - q_out_cht) / this.C_TH_CYL;
    const meanCht_K = Math.max(env.ambientTemperature_K, current.cht_K + dCht_dt * safeDt);

    // Individual cylinder temperatures with slight geometry variation & fault offsets
    // Rear cylinders (3 & 4) typically run 2-4 K warmer due to airflow baffling
    const baseCylOffsets = [-1.5, +1.0, +2.5, -2.0];
    const cylinderTemperatures_K: [number, number, number, number] = [
      meanCht_K + baseCylOffsets[0] + (cylinderImbalances[0] - 1.0) * 45.0,
      meanCht_K + baseCylOffsets[1] + (cylinderImbalances[1] - 1.0) * 45.0,
      meanCht_K + baseCylOffsets[2] + (cylinderImbalances[2] - 1.0) * 45.0,
      meanCht_K + baseCylOffsets[3] + (cylinderImbalances[3] - 1.0) * 45.0,
    ];

    // ─── 3. Oil Temperature Calculation ────────────────────────────────────
    // Heat from engine friction + conduction from cylinder
    const frictionHeat_W = 1200.0 * (rpm / 5200.0);
    const cylinderCouplingHeat_W = 8.0 * (meanCht_K - current.oilTemperature_K);
    const q_in_oil = frictionHeat_W + cylinderCouplingHeat_W;

    // Heat loss through oil cooler radiator
    const k_oil_cooler = 28.0 * Math.max(0.3, coolingDegradationFactor);
    const q_out_oil = k_oil_cooler * (current.oilTemperature_K - env.ambientTemperature_K);

    const dOilTemp_dt = (q_in_oil - q_out_oil) / this.C_TH_OIL;
    const nextOilTemp_K = Math.max(
      env.ambientTemperature_K,
      current.oilTemperature_K + dOilTemp_dt * safeDt
    );

    return {
      cht_K: meanCht_K,
      egt_K: nextEgt_K,
      oilTemperature_K: nextOilTemp_K,
      cylinderTemperatures_K,
    };
  }

  /** Initial warm engine baseline thermal state */
  static getBaselineState(ambient_K: number = 288.15): ThermalState {
    const nominalCht_K = 273.15 + 78.0; // 78 °C
    const nominalEgt_K = 273.15 + 642.0; // 642 °C
    const nominalOilTemp_K = 273.15 + 82.0; // 82 °C

    return {
      cht_K: Math.max(ambient_K, nominalCht_K),
      egt_K: Math.max(ambient_K, nominalEgt_K),
      oilTemperature_K: Math.max(ambient_K, nominalOilTemp_K),
      cylinderTemperatures_K: [
        nominalCht_K - 1.5,
        nominalCht_K + 1.0,
        nominalCht_K + 2.5,
        nominalCht_K - 2.0,
      ],
    };
  }
}
