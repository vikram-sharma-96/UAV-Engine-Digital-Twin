/**
 * intakeCombustion.ts
 * 
 * Physics-informed approximation of 4-stroke spark-ignition engine intake, 
 * fuel metering, and combustion energy release.
 * 
 * Equations:
 * 1. Manifold Absolute Pressure (MAP):
 *    MAP = P_amb * (throttleMinMapRatio + (1 - throttleMinMapRatio) * throttle)
 * 2. Air Mass Flow Rate (4-stroke, 2 revolutions per intake stroke):
 *    m_dot_air = (RPM / 120) * V_disp * rho_manifold * eta_volumetric
 * 3. Fuel Mass Flow Rate:
 *    m_dot_fuel = m_dot_air / AFR_actual
 * 4. Combustion Thermal Power:
 *    Q_dot_comb = m_dot_fuel * LHV_fuel * eta_combustion
 * 5. Indicated & Brake Torque:
 *    Torque_ind = (Q_dot_comb * eta_thermal) / omega
 *    Torque_brake = Torque_ind - Torque_friction
 * 6. Brake Power:
 *    Power_brake = Torque_brake * omega
 * 
 * Assumptions & Simplifications:
 * - 0D lumped parameter mean-value engine model (MVEM).
 * - Mean volumetric efficiency modeled with speed and throttle dependence.
 * - Internal units strictly SI (kg/s, Pa, W, N·m, rad/s).
 */

import type { EngineConfig, EnvironmentConditions } from '../types';

export interface CombustionResult {
  manifoldPressure_Pa: number;
  airMassFlow_kg_s: number;
  fuelMassFlow_kg_s: number;
  fuelConsumption_L_h: number;
  indicatedTorque_Nm: number;
  brakeTorque_Nm: number;
  brakePower_W: number;
  combustionHeatRate_W: number;
  effectiveAfr: number;
  volumetricEfficiency: number;
}

export class IntakeCombustionModel {
  /**
   * Compute intake airflow, fuel flow, and combustion torque for a four-stroke engine.
   * 
   * @param config Engine structural parameters
   * @param env Ambient atmospheric conditions
   * @param throttle Throttle position [0.0 - 1.0]
   * @param rpm Current engine speed [RPM]
   * @param afrFactor Mixture multiplier (1.0 = nominal, <1.0 = rich, >1.0 = lean)
   * @param combustionEfficiencyFactor Degradation/fault multiplier on combustion [0.0 - 1.0]
   */
  static calculate(
    config: EngineConfig,
    env: EnvironmentConditions,
    throttle: number,
    rpm: number,
    afrFactor: number = 1.0,
    combustionEfficiencyFactor: number = 1.0
  ): CombustionResult {
    const clampedThrottle = Math.max(0.0, Math.min(1.0, throttle));
    const clampedRpm = Math.max(0.0, rpm);
    const omega = (clampedRpm * 2.0 * Math.PI) / 60.0; // rad/s

    // 1. Manifold Absolute Pressure (MAP)
    // Idle throttle produces ~0.35 bar at sea level, WOT produces ~0.98 bar (losses through air filter/throttle body)
    const throttleMinMapRatio = 0.35;
    const throttleMaxMapRatio = 0.98;
    const mapRatio = throttleMinMapRatio + (throttleMaxMapRatio - throttleMinMapRatio) * Math.pow(clampedThrottle, 0.85);
    const map_Pa = env.ambientPressure_Pa * mapRatio;

    // Manifold air density using ideal gas law (assuming manifold temp is ambient + ~5 K heating)
    const T_manifold_K = env.ambientTemperature_K + 5.0;
    const rho_manifold = map_Pa / (287.058 * T_manifold_K);

    // 2. Volumetric Efficiency (eta_v)
    // Tuned intake runner resonance yields peak volumetric efficiency near 5000-5800 RPM
    const rpmNorm = clampedRpm / config.nominalCruiseRpm;
    const eta_v_base = 0.95 * Math.max(0.6, 1.0 - 0.12 * Math.pow(rpmNorm - 1.05, 2));
    const eta_v = Math.max(0.45, Math.min(0.98, eta_v_base * (0.75 + 0.25 * clampedThrottle)));

    // 3. Air Mass Flow Rate (kg/s)
    // For a 4-stroke engine, displacement volume is aspirated every 2 crank revolutions:
    // Frequency of aspiration = RPM / 120 (revolutions / 2 / 60)
    const airMassFlow_kg_s = (clampedRpm / 120.0) * config.displacement_m3 * rho_manifold * eta_v;

    // 4. Fuel Mass Flow Rate (kg/s)
    const effectiveAfr = config.stoichiometricAfr * afrFactor;
    const fuelMassFlow_kg_s = airMassFlow_kg_s / Math.max(8.0, effectiveAfr);

    // Fuel volumetric consumption in L/h (Avgas density ~ 0.74 kg/L)
    const fuelDensity_kg_per_L = 0.74;
    const fuelConsumption_L_h = (fuelMassFlow_kg_s / fuelDensity_kg_per_L) * 3600.0;

    // 5. Combustion Heat Release Rate (W)
    const eta_comb = Math.max(0.1, Math.min(0.99, 0.98 * combustionEfficiencyFactor));
    const combustionHeatRate_W = fuelMassFlow_kg_s * config.fuelLowerHeatingValue_J_per_kg * eta_comb;

    // 6. Indicated Thermal Efficiency (eta_th)
    // Theoretical Otto cycle efficiency: eta_th = 1 - (1 / r^(gamma - 1))
    // Real aero-piston indicated efficiency is ~34-37% of fuel chemical energy
    const eta_th = 0.36 * Math.min(1.0, 0.75 + 0.25 * clampedThrottle);

    // Indicated Power (W) and Indicated Torque (N·m)
    const indicatedPower_W = combustionHeatRate_W * eta_th;
    const indicatedTorque_Nm = omega > 10.0 ? indicatedPower_W / omega : 0.0;

    // 7. Friction & Pumping Losses (FMEP)
    // Hydrodynamic journal friction + piston ring friction
    const frictionTorque_Nm = 8.0 + 0.0016 * clampedRpm + 10.0 * Math.pow(1.0 - clampedThrottle, 1.5);
    const brakeTorque_Nm = Math.max(0.0, indicatedTorque_Nm - frictionTorque_Nm);
    const brakePower_W = brakeTorque_Nm * omega;

    return {
      manifoldPressure_Pa: map_Pa,
      airMassFlow_kg_s,
      fuelMassFlow_kg_s,
      fuelConsumption_L_h,
      indicatedTorque_Nm,
      brakeTorque_Nm,
      brakePower_W,
      combustionHeatRate_W,
      effectiveAfr,
      volumetricEfficiency: eta_v,
    };
  }
}
