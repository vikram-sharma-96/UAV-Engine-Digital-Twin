/**
 * missionProfile.ts
 * 
 * UAV Operational Mission Profile Sequencer.
 * 
 * Standard Reconnaissance / Surveillance UAV Flight Regime:
 * 1. STARTUP_IDLE: Ground warm-up & systems check (1400 RPM, 0m MSL, 15s)
 * 2. TAKEOFF: Maximum continuous power (Full throttle, 0 to 300m MSL, 20s)
 * 3. CLIMB: Climb power to cruise ceiling (85% throttle, 300m to 2400m MSL, 30s)
 * 4. CRUISE: Nominal economical cruise (72% throttle, 2400m MSL, 60s)
 * 5. HIGH_LOAD: Dash / evasive maneuver / headwind (95% throttle, high load, 2400m MSL, 20s)
 * 6. LOITER: Maximum endurance loiter (55% throttle, 2000m MSL, 40s)
 * 7. DESCENT: Controlled descent (30% throttle, 2000m to 300m MSL, 25s)
 * 8. LANDING: Approach & touchdown (20% throttle, 0m MSL, 15s)
 */

import type { MissionPhase, MissionPhaseName } from '../types';

export const DEFAULT_UAV_MISSION: MissionPhase[] = [
  { name: 'STARTUP_IDLE', duration_s: 15, targetAltitude_m: 0, throttle: 0.15, loadMultiplier: 0.8 },
  { name: 'TAKEOFF', duration_s: 20, targetAltitude_m: 350, throttle: 1.0, loadMultiplier: 1.15 },
  { name: 'CLIMB', duration_s: 30, targetAltitude_m: 2400, throttle: 0.85, loadMultiplier: 1.05 },
  { name: 'CRUISE', duration_s: 60, targetAltitude_m: 2400, throttle: 0.72, loadMultiplier: 1.0 },
  { name: 'HIGH_LOAD', duration_s: 20, targetAltitude_m: 2400, throttle: 0.95, loadMultiplier: 1.25 },
  { name: 'LOITER', duration_s: 40, targetAltitude_m: 2000, throttle: 0.55, loadMultiplier: 0.9 },
  { name: 'DESCENT', duration_s: 25, targetAltitude_m: 300, throttle: 0.30, loadMultiplier: 0.85 },
  { name: 'LANDING', duration_s: 15, targetAltitude_m: 0, throttle: 0.18, loadMultiplier: 0.8 },
];

export class MissionProfileRunner {
  private phases: MissionPhase[];
  private currentPhaseIndex: number = 0;
  private phaseElapsedTime_s: number = 0;
  private totalElapsedTime_s: number = 0;
  private isLooping: boolean = true;

  constructor(phases: MissionPhase[] = DEFAULT_UAV_MISSION) {
    this.phases = phases;
  }

  /** Reset mission to beginning */
  reset(): void {
    this.currentPhaseIndex = 0;
    this.phaseElapsedTime_s = 0;
    this.totalElapsedTime_s = 0;
  }

  /** Advance mission time by dt seconds and return active targets */
  step(dt: number): {
    phase: MissionPhaseName;
    phaseIndex: number;
    totalPhases: number;
    targetAltitude_m: number;
    targetThrottle: number;
    loadMultiplier: number;
    phaseProgressPct: number;
  } {
    this.phaseElapsedTime_s += dt;
    this.totalElapsedTime_s += dt;

    const currentPhase = this.phases[this.currentPhaseIndex];

    if (this.phaseElapsedTime_s >= currentPhase.duration_s) {
      this.phaseElapsedTime_s = 0;
      this.currentPhaseIndex++;
      if (this.currentPhaseIndex >= this.phases.length) {
        this.currentPhaseIndex = this.isLooping ? 3 : this.phases.length - 1; // Loop back to CRUISE
      }
    }

    const active = this.phases[this.currentPhaseIndex];
    const progress = Math.min(100, Math.round((this.phaseElapsedTime_s / active.duration_s) * 100));

    return {
      phase: active.name,
      phaseIndex: this.currentPhaseIndex + 1,
      totalPhases: this.phases.length,
      targetAltitude_m: active.targetAltitude_m,
      targetThrottle: active.throttle,
      loadMultiplier: active.loadMultiplier,
      phaseProgressPct: progress,
    };
  }

  getCurrentPhase(): MissionPhase {
    return this.phases[this.currentPhaseIndex];
  }
}
