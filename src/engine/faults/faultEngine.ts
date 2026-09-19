/**
 * faultEngine.ts
 * 
 * Comprehensive, Reusable Fault Injection & Progressive Degradation Framework.
 * 
 * Supports:
 * 1. INJECTOR_DEGRADATION: Localized fuel starvation, lean mixture on specific cylinder, CHT spike
 * 2. MISFIRE: Intermittent power stroke loss, periodic torque dip, high vibration
 * 3. OVERHEATING: Coolant/oil radiator blockage, thermal dissipation loss
 * 4. LUBRICATION_DEGRADATION: Oil pump cavitation/wear, pressure drop, viscosity loss
 * 5. VIBRATION_FAULT: Main journal bearing harmonic fault (BPFO/BPFI defect frequency)
 * 6. SENSOR_DRIFT: Progressive calibration offset on chosen sensor
 * 7. SENSOR_DROPOUT: Transducer disconnect / stuck at zero
 * 8. COMBUSTION_INSTABILITY: High cyclic coefficient of variation (COV_imep)
 * 9. AIR_FUEL_IMBALANCE: Carburetion / manifold air leak (overall lean shift)
 * 10. PROGRESSIVE_DEGRADATION: Continuous mechanical wear over engine operational hours
 */

import type { FaultId, FaultDefinition } from '../types';

export interface ActiveFaultState {
  afrMultiplier: number;
  combustionEfficiencyMultiplier: number;
  coolingEfficiencyMultiplier: number;
  oilPumpEfficiencyMultiplier: number;
  bearingVibrationSeverity: number;
  misfireSeverity: number;
  progressiveDegradationIndex: number;
  cylinderThermalImbalance: [number, number, number, number];
  sensorDrifts: Record<string, number>;
  sensorDropouts: Record<string, boolean>;
  activeFaultIds: FaultId[];
  highestSeverity: number;
}

export class FaultEngine {
  private activeFaults: Map<FaultId, FaultDefinition> = new Map();
  private progressiveDegradation: number = 0.0; // 0.0 = new, 1.0 = fully worn

  /** Inject or update a fault with configurable severity */
  injectFault(fault: FaultDefinition): void {
    const clampedSeverity = Math.max(0.0, Math.min(1.0, fault.severity));
    if (clampedSeverity === 0.0) {
      this.removeFault(fault.id);
      return;
    }
    this.activeFaults.set(fault.id, {
      ...fault,
      severity: clampedSeverity,
    });
  }

  /** Remove an active fault by ID */
  removeFault(id: FaultId): void {
    this.activeFaults.delete(id);
  }

  /** Clear all active faults */
  clearAllFaults(): void {
    this.activeFaults.clear();
  }

  /** Set progressive engine degradation index (0.0 to 1.0) */
  setDegradation(index: number): void {
    this.progressiveDegradation = Math.max(0.0, Math.min(1.0, index));
  }

  /** Get list of currently active fault definitions */
  getActiveFaults(): FaultDefinition[] {
    return Array.from(this.activeFaults.values());
  }

  /**
   * Evaluate all active faults and degradation to compute composite physical modifiers.
   */
  evaluate(): ActiveFaultState {
    let afrMultiplier = 1.0;
    let combustionEfficiencyMultiplier = 1.0;
    let coolingEfficiencyMultiplier = 1.0;
    let oilPumpEfficiencyMultiplier = 1.0;
    let bearingVibrationSeverity = 0.0;
    let misfireSeverity = 0.0;
    const cylinderThermalImbalance: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];
    const sensorDrifts: Record<string, number> = {};
    const sensorDropouts: Record<string, boolean> = {};

    let highestSeverity = this.progressiveDegradation * 0.5;

    // Apply baseline progressive degradation effects
    if (this.progressiveDegradation > 0.0) {
      const d = this.progressiveDegradation;
      combustionEfficiencyMultiplier *= (1.0 - 0.12 * d); // loss of compression
      coolingEfficiencyMultiplier *= (1.0 - 0.15 * d); // fouling of fins/radiator
      oilPumpEfficiencyMultiplier *= (1.0 - 0.20 * d); // bearing clearances widen
      bearingVibrationSeverity = Math.max(bearingVibrationSeverity, d * 0.4);
    }

    for (const [id, fault] of this.activeFaults.entries()) {
      const s = fault.severity;
      highestSeverity = Math.max(highestSeverity, s);

      switch (id) {
        case 'INJECTOR_DEGRADATION': {
          // Fuel starvation on target cylinder (default cyl 2)
          const targetCyl = (fault.targetCylinder || 2) - 1;
          cylinderThermalImbalance[targetCyl] += s * 0.45; // Lean combustion creates hot cylinder
          afrMultiplier *= (1.0 + 0.18 * s); // Overall AFR shifts leaner
          combustionEfficiencyMultiplier *= (1.0 - 0.15 * s);
          break;
        }

        case 'MISFIRE': {
          misfireSeverity = Math.max(misfireSeverity, s);
          combustionEfficiencyMultiplier *= (1.0 - 0.35 * s);
          break;
        }

        case 'OVERHEATING': {
          coolingEfficiencyMultiplier *= Math.max(0.15, 1.0 - 0.75 * s);
          break;
        }

        case 'LUBRICATION_DEGRADATION': {
          oilPumpEfficiencyMultiplier *= Math.max(0.1, 1.0 - 0.75 * s);
          break;
        }

        case 'VIBRATION_FAULT': {
          bearingVibrationSeverity = Math.max(bearingVibrationSeverity, s);
          break;
        }

        case 'SENSOR_DRIFT': {
          const sensorKey = fault.targetSensor || 'cht';
          // e.g. drift rate of up to +0.8 °C/sec at full severity
          sensorDrifts[sensorKey] = s * 0.6;
          break;
        }

        case 'SENSOR_DROPOUT': {
          const sensorKey = fault.targetSensor || 'rpm';
          sensorDropouts[sensorKey] = true;
          break;
        }

        case 'COMBUSTION_INSTABILITY': {
          combustionEfficiencyMultiplier *= (1.0 - 0.18 * s);
          misfireSeverity = Math.max(misfireSeverity, s * 0.35);
          break;
        }

        case 'AIR_FUEL_IMBALANCE': {
          afrMultiplier *= (1.0 + 0.25 * s); // Intake air leak creates lean burn
          combustionEfficiencyMultiplier *= (1.0 - 0.12 * s);
          break;
        }

        case 'PROGRESSIVE_DEGRADATION': {
          this.setDegradation(s);
          break;
        }
      }
    }

    return {
      afrMultiplier,
      combustionEfficiencyMultiplier,
      coolingEfficiencyMultiplier,
      oilPumpEfficiencyMultiplier,
      bearingVibrationSeverity,
      misfireSeverity,
      progressiveDegradationIndex: this.progressiveDegradation,
      cylinderThermalImbalance,
      sensorDrifts,
      sensorDropouts,
      activeFaultIds: Array.from(this.activeFaults.keys()),
      highestSeverity,
    };
  }
}
