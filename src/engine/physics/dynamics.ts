/**
 * dynamics.ts
 * 
 * Rotational dynamics of the crankshaft and propeller assembly.
 * 
 * Equation of Motion:
 *   I_total * (d(omega) / dt) = Torque_engine - Torque_propeller_load
 * 
 * Propeller Load Model:
 *   Torque_prop = k_prop * rho_air * omega^2
 *   Power_prop = Torque_prop * omega = k_prop * rho_air * omega^3
 * 
 * Where:
 * - I_total: Total rotational moment of inertia (kg·m²)
 * - omega: Crankshaft angular velocity (rad/s), omega = (2 * pi * RPM) / 60
 * - rho_air: Air density at altitude (kg/m³)
 * - k_prop: Aerodynamic propeller absorption coefficient (m^5)
 * 
 * Dimensional consistency:
 * - Torque: N·m (kg·m²/s²)
 * - I: kg·m²
 * - d(omega)/dt: rad/s²
 * - N·m / (kg·m²) = (kg·m²/s²) / (kg·m²) = 1/s² = rad/s² (Consistent)
 */

import type { EngineConfig } from '../types';

export class EngineDynamicsModel {
  /**
   * Calculate calibrated propeller absorption coefficient (k_prop) such that
   * at nominal cruise RPM and sea level air density, engine brake torque equals propeller torque.
   */
  static getPropellerCoefficient(config: EngineConfig, nominalAirDensity: number = 0.967): number {
    const nominalOmega = (config.nominalCruiseRpm * 2.0 * Math.PI) / 60.0;
    // At nominal cruise altitude (2400m MSL, 5200 RPM), cruise brake torque is ~56 N·m
    const nominalCruiseTorque = 56.0;
    return nominalCruiseTorque / (nominalAirDensity * Math.pow(nominalOmega, 2));
  }

  /**
   * Advance rotational dynamics by one time step dt.
   * 
   * @param currentRpm Current engine speed in RPM
   * @param engineBrakeTorque_Nm Net torque output from combustion
   * @param airDensity_kg_m3 Ambient air density
   * @param dt Time step in seconds (e.g. 0.05s to 1.0s)
   * @param config Engine structural parameters
   * @param externalLoadMultiplier Multiplier for mission load / counterfactuals (nominal = 1.0)
   */
  static step(
    currentRpm: number,
    engineBrakeTorque_Nm: number,
    airDensity_kg_m3: number,
    dt: number,
    config: EngineConfig,
    externalLoadMultiplier: number = 1.0
  ): { nextRpm: number; loadTorque_Nm: number; netTorque_Nm: number; loadRatio: number } {
    const currentOmega = (Math.max(100, currentRpm) * 2.0 * Math.PI) / 60.0;
    const k_prop = this.getPropellerCoefficient(config);

    // Propeller opposing aerodynamic torque
    const loadTorque_Nm = k_prop * airDensity_kg_m3 * Math.pow(currentOmega, 2) * externalLoadMultiplier;

    // Net torque accelerating the drivetrain
    const netTorque_Nm = engineBrakeTorque_Nm - loadTorque_Nm;

    // Angular acceleration: alpha = netTorque / I
    const alpha_rad_s2 = netTorque_Nm / config.inertia_kg_m2;

    // Numerical integration with dampening for stability at larger dt
    const safeDt = Math.min(0.2, dt);
    const dampening = 0.85; // Prevents numerical oscillation across discrete 1Hz sampling
    const nextOmega = Math.max(
      (config.idleRpm * 2.0 * Math.PI) / 60.0 * 0.8,
      currentOmega + alpha_rad_s2 * safeDt * dampening
    );

    const nextRpm = Math.round((nextOmega * 60.0) / (2.0 * Math.PI));
    const clampedRpm = Math.max(config.idleRpm, Math.min(config.maxRpm + 200, nextRpm));

    // Load ratio: fraction of nominal capacity
    const loadRatio = Math.min(1.0, loadTorque_Nm / (config.nominalTorque_Nm || 124.0));

    return {
      nextRpm: clampedRpm,
      loadTorque_Nm,
      netTorque_Nm,
      loadRatio,
    };
  }
}
