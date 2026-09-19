/**
 * digitalTwinEngine.ts
 * 
 * Digital Twin State, Observer & Residual Engine for AeroTwin AI.
 * 
 * Architecture:
 * 1. Parallel Physical Observer: Simulates nominal "as-designed" expected state
 *    for identical throttle, load, and ambient altitude conditions.
 * 2. Residual Vector Computation:
 *    Residual_i = Measured_i - Expected_i
 * 3. Transparent Engineering Health Score (0 - 100):
 *    Weighted penalty based on normalized residual deviations.
 * 4. FDIR & Component Subsystem Isolation.
 */

import type {
  MeasuredTelemetry,
  ExpectedState,
  TelemetryResiduals,
  DigitalTwinState,
  HealthWeights,
  TrueEngineState,
  EngineConfig,
} from '../types.ts';
import { DEFAULT_HEALTH_WEIGHTS } from '../config/defaultEngineProfile.ts';

export class DigitalTwinEngine {
  private weights: HealthWeights;
  private nominalRpm: number = 5200;

  constructor(weights: HealthWeights = DEFAULT_HEALTH_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Compute expected sensor state under healthy conditions given throttle and altitude.
   */
  calculateExpectedState(
    throttle: number,
    altitude_m: number,
    ambientTemp_C: number
  ): ExpectedState {
    const clampedThrottle = Math.max(0.0, Math.min(1.0, throttle));
    // Cruise throttle (0.82-0.85) yields nominal cruise baseline (5200 RPM, 78 °C, 4.3 bar, ~13.2 L/h, ~0.8 mm/s)
    const expectedRpm = Math.round(1400 + clampedThrottle * 4630);
    const expectedMap_bar = parseFloat((0.35 + 0.63 * Math.pow(clampedThrottle, 0.85)).toFixed(2));
    const expectedFuelFlow_L_h = parseFloat((3.5 + clampedThrottle * 11.8).toFixed(2));
    const expectedCht_C = parseFloat((ambientTemp_C + 55.0 + clampedThrottle * 28.0).toFixed(1));
    const expectedEgt_C = Math.round(480.0 + clampedThrottle * 190.0);
    const expectedOilPressure_bar = parseFloat((2.5 + clampedThrottle * 2.1).toFixed(2));
    const expectedOilTemp_C = parseFloat((ambientTemp_C + 50.0 + clampedThrottle * 36.0).toFixed(1));
    const expectedVib_mm_s = parseFloat((0.45 + clampedThrottle * 0.4).toFixed(2));

    return {
      rpm: expectedRpm,
      manifoldPressure_bar: expectedMap_bar,
      fuelFlow_L_h: expectedFuelFlow_L_h,
      cht_C: expectedCht_C,
      egt_C: expectedEgt_C,
      oilPressure_bar: expectedOilPressure_bar,
      oilTemperature_C: expectedOilTemp_C,
      vibration_mm_s: expectedVib_mm_s,
    };
  }

  /**
   * Compute residual vector between measured sensor readings and healthy expected values.
   */
  computeResiduals(measured: MeasuredTelemetry, expected: ExpectedState): TelemetryResiduals {
    const rpmResidual = measured.rpm - expected.rpm;
    const fuelFlowResidual = parseFloat((measured.fuelFlow_L_h - expected.fuelFlow_L_h).toFixed(2));
    const chtResidual = parseFloat((measured.cht_C - expected.cht_C).toFixed(1));
    const egtResidual = measured.egt_C - expected.egt_C;
    const oilPressureResidual = parseFloat((measured.oilPressure_bar - expected.oilPressure_bar).toFixed(2));
    const oilTempResidual = parseFloat((measured.oilTemperature_C - expected.oilTemperature_C).toFixed(1));
    const vibrationResidual = parseFloat((measured.vibration_mm_s - expected.vibration_mm_s).toFixed(2));

    // Normalized deviations (3-sigma bounds):
    // RPM: 500 RPM, CHT: 25 °C, EGT: 80 °C, OilP: 1.5 bar, OilT: 25 °C, Vib: 2.0 mm/s, Fuel: 1.0 L/h
    const normRpm = Math.abs(rpmResidual) / 500.0;
    const normCht = Math.max(0, chtResidual) / 25.0; // Overtemp is primary penalty
    const normOilP = Math.max(0, -oilPressureResidual) / 1.5; // Pressure drop is primary penalty
    const normVib = Math.max(0, vibrationResidual) / 2.0;
    const normFuel = Math.abs(fuelFlowResidual) / 1.0;

    const normalizedScore = parseFloat(
      (normRpm * 0.15 + normCht * 0.25 + normOilP * 0.25 + normVib * 0.20 + normFuel * 0.15).toFixed(3)
    );

    return {
      rpmResidual,
      fuelFlowResidual,
      chtResidual,
      egtResidual,
      oilPressureResidual,
      oilTempResidual,
      vibrationResidual,
      normalizedResidualScore: normalizedScore,
    };
  }

  /**
   * Compute health score (0 - 100) and subsystem scores using transparent engineering weights.
   */
  evaluateHealth(
    residuals: TelemetryResiduals,
    measured: MeasuredTelemetry
  ): {
    healthScore: number;
    engineStatus: 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
    faultRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    subsystems: { cylinder: number; lubrication: number; bearing: number; cooling: number; fuel: number };
    predictive: DigitalTwinState['predictive'];
  } {
    // Component penalties
    const chtPenalty = Math.max(0, measured.cht_C - 85.0) / 25.0;
    const oilPressurePenalty = Math.max(0, 3.8 - measured.oilPressure_bar) / 2.0;
    const vibPenalty = Math.max(0, measured.vibration_mm_s - 1.8) / 3.0;
    const rpmPenalty = Math.abs(residuals.rpmResidual) / 600.0;
    const fuelPenalty = Math.abs(residuals.fuelFlowResidual) / 1.5;

    const totalPenalty =
      this.weights.chtWeight * Math.min(1.0, chtPenalty) +
      this.weights.oilPressureWeight * Math.min(1.0, oilPressurePenalty) +
      this.weights.vibrationWeight * Math.min(1.0, vibPenalty) +
      this.weights.rpmWeight * Math.min(1.0, rpmPenalty) +
      this.weights.fuelFlowWeight * Math.min(1.0, fuelPenalty);

    const rawHealth = 100.0 * (1.0 - totalPenalty);
    const healthScore = Math.max(10, Math.min(100, Math.round(rawHealth)));

    let engineStatus: 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (healthScore < 60 || measured.oilPressure_bar < 2.0 || measured.cht_C > 115) {
      engineStatus = 'CRITICAL';
    } else if (healthScore < 75 || measured.cht_C > 95 || measured.vibration_mm_s > 3.0) {
      engineStatus = 'WARNING';
    } else if (healthScore < 90) {
      engineStatus = 'ADVISORY';
    }

    let faultRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (healthScore >= 90) faultRisk = 'LOW';
    else if (healthScore >= 75) faultRisk = 'MODERATE';
    else if (healthScore >= 60) faultRisk = 'HIGH';
    else faultRisk = 'CRITICAL';

    // Subsystem calculations
    const cylinderScore = Math.round(
      Math.max(25, Math.min(100, 96 - chtPenalty * 35 - rpmPenalty * 15))
    );
    const lubScore = Math.round(
      Math.max(20, Math.min(100, 92 - oilPressurePenalty * 60 - Math.max(0, measured.oilTemperature_C - 90) * 0.5))
    );
    const bearingScore = Math.round(
      Math.max(20, Math.min(100, 94 - vibPenalty * 60 - oilPressurePenalty * 20))
    );
    const coolingScore = Math.round(
      Math.max(25, Math.min(100, 95 - chtPenalty * 55))
    );
    const fuelScore = Math.round(
      Math.max(30, Math.min(100, 93 - fuelPenalty * 40 - rpmPenalty * 10))
    );

    // Predictive states
    let bearingCondition = 'Healthy';
    let bearingColor: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (measured.vibration_mm_s > 3.5) {
      bearingCondition = 'Critical';
      bearingColor = 'rose';
    } else if (measured.vibration_mm_s > 2.0) {
      bearingCondition = 'Degraded';
      bearingColor = 'amber';
    }

    let coolingSystem = 'Normal';
    let coolingColor: 'cyan' | 'amber' | 'rose' = 'cyan';
    if (measured.cht_C > 100) {
      coolingSystem = 'Overloaded';
      coolingColor = 'rose';
    } else if (measured.cht_C > 88) {
      coolingSystem = 'Stressed';
      coolingColor = 'amber';
    }

    let maintenanceRisk = 'Low';
    let maintenanceColor: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (healthScore < 65) {
      maintenanceRisk = 'High';
      maintenanceColor = 'rose';
    } else if (healthScore < 85) {
      maintenanceRisk = 'Moderate';
      maintenanceColor = 'amber';
    }

    const nextInspectionHrs = Math.round(Math.max(5, Math.min(47, healthScore * 0.48)));
    const remainingUsefulLifeHrs = Math.round(Math.max(15, (healthScore / 100.0) * 340));

    return {
      healthScore,
      engineStatus,
      faultRisk,
      subsystems: {
        cylinder: cylinderScore,
        lubrication: lubScore,
        bearing: bearingScore,
        cooling: coolingScore,
        fuel: fuelScore,
      },
      predictive: {
        bearingCondition,
        bearingColor,
        coolingSystem,
        coolingColor,
        maintenanceRisk,
        maintenanceColor,
        nextInspectionHrs,
        remainingUsefulLifeHrs,
      },
    };
  }

  /** Assemble complete DigitalTwinState snapshot */
  synthesizeState(
    trueState: TrueEngineState,
    measured: MeasuredTelemetry,
    flightMode: string = 'CRUISE_NOMINAL'
  ): DigitalTwinState {
    const expected = this.calculateExpectedState(
      trueState.throttle,
      measured.altitude_m,
      measured.ambientTemp_C
    );

    const residuals = this.computeResiduals(measured, expected);
    const health = this.evaluateHealth(residuals, measured);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      timestamp: timeStr,
      timestamp_s: trueState.timestamp_s,
      flightMode,
      trueState,
      measured,
      expected,
      residuals,
      healthScore: health.healthScore,
      engineStatus: health.engineStatus,
      faultRisk: health.faultRisk,
      activeFaultNames: [...trueState.activeFaults],
      subsystems: health.subsystems,
      predictive: health.predictive,
    };
  }
}
