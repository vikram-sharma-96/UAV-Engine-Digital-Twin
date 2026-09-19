/**
 * vibration.ts
 * 
 * Physics-Correlated Engine Vibration Model.
 * 
 * Vibration Signal Synthesis:
 *   V_rms = V_baseline(RPM) + V_combustion(load, misfire) + V_bearing(wear) + noise
 * 
 * Harmonics:
 * 1. 1X Shaft Fundamental: Unbalance harmonic directly proportional to RPM^2.
 * 2. 2X Combustion Harmonic: 4-stroke 4-cylinder engine fires twice per crank revolution.
 * 3. Bearing Defect (BPFO/BPFI): High-frequency impulsive harmonics triggered by bearing wear.
 * 4. Misfire Asymmetry: Dynamic torque imbalance causing large low-frequency rocking vibration.
 * 
 * Standard display metric: RMS vibration velocity in mm/s (compliant with ISO 10816/20816 UAV vibration bounds).
 */

import type { PRNG } from '../utils/prng';

export interface VibrationComponents {
  totalRms_mm_s: number;
  shaft1x_mm_s: number;
  combustion2x_mm_s: number;
  bearingHighFreq_mm_s: number;
  misfireImpulse_mm_s: number;
}

export class VibrationModel {
  /**
   * Compute correlated engine vibration RMS based on engine speed, load, and fault states.
   * 
   * @param rpm Engine speed in RPM
   * @param engineLoad Engine load fraction [0.0 - 1.0]
   * @param bearingFaultSeverity Bearing degradation severity [0.0 - 1.0]
   * @param misfireSeverity Misfire severity [0.0 - 1.0]
   * @param generalDegradation General engine wear index [0.0 - 1.0]
   * @param prng Seeded random number generator
   */
  static calculate(
    rpm: number,
    engineLoad: number,
    bearingFaultSeverity: number = 0.0,
    misfireSeverity: number = 0.0,
    generalDegradation: number = 0.0,
    prng?: PRNG
  ): VibrationComponents {
    const clampedRpm = Math.max(0, rpm);
    const rpmRatio = clampedRpm / 5200.0;

    // 1. Fundamental 1X rotational unbalance (rises with RPM squared)
    const shaft1x_mm_s = 0.65 * Math.pow(rpmRatio, 1.4);

    // 2. 2X Combustion harmonic (rises with cylinder peak pressure / load)
    const combustion2x_mm_s = 0.45 * (0.5 + 0.5 * engineLoad) * rpmRatio;

    // 3. Bearing defect harmonics (exponential rise under bearing spalling/wear)
    // At severity 1.0, bearing vibration can spike up to 4.5 mm/s
    const bearingHighFreq_mm_s = bearingFaultSeverity > 0.0
      ? 3.8 * Math.pow(bearingFaultSeverity, 1.5) * (0.7 + 0.3 * rpmRatio)
      : generalDegradation * 0.4;

    // 4. Misfire torque asymmetry
    // Misfires cause severe cyclic torque disturbance
    const misfireImpulse_mm_s = misfireSeverity > 0.0
      ? 2.2 * misfireSeverity * (0.8 + 0.2 * Math.sin(clampedRpm * 0.01))
      : 0.0;

    // Gaussian jitter
    const noise = prng ? prng.gaussian(0, 0.04) : 0.0;

    // Total RMS combines orthogonal harmonic components via square root of sum of squares (RSS)
    const totalRss = Math.sqrt(
      Math.pow(shaft1x_mm_s, 2) +
      Math.pow(combustion2x_mm_s, 2) +
      Math.pow(bearingHighFreq_mm_s, 2) +
      Math.pow(misfireImpulse_mm_s, 2)
    );

    const totalRms_mm_s = Math.max(0.3, Math.min(15.0, totalRss + noise));

    return {
      totalRms_mm_s: parseFloat(totalRms_mm_s.toFixed(2)),
      shaft1x_mm_s: parseFloat(shaft1x_mm_s.toFixed(2)),
      combustion2x_mm_s: parseFloat(combustion2x_mm_s.toFixed(2)),
      bearingHighFreq_mm_s: parseFloat(bearingHighFreq_mm_s.toFixed(2)),
      misfireImpulse_mm_s: parseFloat(misfireImpulse_mm_s.toFixed(2)),
    };
  }
}
