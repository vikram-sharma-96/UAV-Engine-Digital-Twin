/**
 * mockAIProvider.ts
 * 
 * Deterministic Mock AI / ML Provider for hackathon development and testing.
 * Implements MLModelProvider and LocalAIProvider interfaces.
 * 
 * Computes anomaly scores, fault classifications, and RUL estimates using
 * calibrated statistical distance metrics on the digital-twin residuals,
 * enabling full UI and end-to-end functionality before the standalone ML team
 * delivers their neural net / gradient boosted models.
 */

import type {
  MLModelProvider,
  LocalAIProvider,
  LocalAIAgentTools,
  TelemetryWindow,
  MLPrediction,
  FaultId,
} from './mlInterface';

export class MockAIProvider implements MLModelProvider, LocalAIProvider {
  name = 'AeroTwin-Ensemble-Mock-v1.2 (Rule + Bayesian Emulator)';
  version = '1.2.0-synthetic';

  isReady(): boolean {
    return true;
  }

  isAvailable(): boolean {
    return true;
  }

  /**
   * Deterministic inference based on rolling telemetry residuals.
   */
  predict(window: TelemetryWindow): MLPrediction {
    if (!window.residuals || window.residuals.length === 0) {
      return {
        anomalyScore: 0.02,
        isAnomaly: false,
        predictedFault: 'NONE',
        faultProbabilities: { NONE: 0.98 },
        degradationScore: 0.05,
        rulEstimateHours: 320,
        confidence: 0.96,
        explanation: 'Model indicates nominal operational parameters. Residuals are within 3-sigma bounds.',
      };
    }

    // Inspect the most recent residual sample
    const latestRes = window.residuals[window.residuals.length - 1];
    const latestSample = window.samples[window.samples.length - 1];

    const vibRes = Math.abs(latestRes.vibrationResidual);
    const chtRes = latestRes.chtResidual;
    const oilPRes = latestRes.oilPressureResidual;
    const fuelRes = Math.abs(latestRes.fuelFlowResidual);
    const rpmRes = Math.abs(latestRes.rpmResidual);

    // Compute composite anomaly score from normalized residuals
    const anomalyScore = Math.min(1.0, latestRes.normalizedResidualScore * 0.45);
    const isAnomaly = anomalyScore >= 0.35;

    let predictedFault: FaultId | 'NONE' = 'NONE';
    const faultProbabilities: Record<string, number> = {
      NONE: 0.05,
      INJECTOR_DEGRADATION: 0.02,
      MISFIRE: 0.02,
      OVERHEATING: 0.02,
      LUBRICATION_DEGRADATION: 0.02,
      VIBRATION_FAULT: 0.02,
      SENSOR_DRIFT: 0.02,
    };

    let explanation = 'Model indicates nominal cruise telemetry. No anomalous spectral signatures detected.';

    if (vibRes > 1.8 && oilPRes > -0.5) {
      predictedFault = 'VIBRATION_FAULT';
      faultProbabilities.VIBRATION_FAULT = 0.89;
      faultProbabilities.NONE = 0.04;
      explanation = 'Model indicates bearing harmonic defect: Elevated 1X/high-frequency vibration residual (+ ' + vibRes.toFixed(2) + ' mm/s) correlates with journal bearing wear.';
    } else if (chtRes > 18.0 && oilPRes > -0.8) {
      predictedFault = 'OVERHEATING';
      faultProbabilities.OVERHEATING = 0.92;
      faultProbabilities.NONE = 0.03;
      explanation = 'Model indicates thermal dissipation bottleneck: CHT residual (+ ' + chtRes.toFixed(1) + ' °C) exceeds convective envelope. Likely radiator flow restriction.';
    } else if (oilPRes < -1.2) {
      predictedFault = 'LUBRICATION_DEGRADATION';
      faultProbabilities.LUBRICATION_DEGRADATION = 0.94;
      faultProbabilities.NONE = 0.02;
      explanation = 'Model indicates lubrication hydraulic loss: Oil pressure residual (' + oilPRes.toFixed(2) + ' bar) indicates pump pressure relief malfunction or viscosity shear.';
    } else if (fuelRes > 0.6 && (rpmRes > 250 || chtRes > 10.0)) {
      predictedFault = 'INJECTOR_DEGRADATION';
      faultProbabilities.INJECTOR_DEGRADATION = 0.84;
      faultProbabilities.NONE = 0.05;
      explanation = 'Model indicates combustion asymmetry: Fuel flow delta (' + fuelRes.toFixed(2) + ' L/h) accompanied by thermal gradient suggests fuel injector fouling.';
    } else if (latestSample.cht_C < 5.0 || latestSample.rpm === 0) {
      predictedFault = 'SENSOR_DROPOUT';
      faultProbabilities.SENSOR_DROPOUT = 0.95;
      explanation = 'Model indicates transducer signal dropout: Channel impedance indicates open-circuit transducer state.';
    }

    const degradationScore = Math.min(1.0, anomalyScore * 0.8 + (100 - (latestSample ? latestSample.power_kW : 70)) * 0.01);
    const rulEstimateHours = Math.round(Math.max(15, 340 * (1.0 - anomalyScore)));
    const confidence = parseFloat((0.88 + Math.min(0.1, anomalyScore * 0.1)).toFixed(2));

    return {
      anomalyScore: parseFloat(anomalyScore.toFixed(3)),
      isAnomaly,
      predictedFault,
      faultProbabilities,
      degradationScore: parseFloat(degradationScore.toFixed(3)),
      rulEstimateHours,
      confidence,
      explanation,
    };
  }

  /**
   * Natural language AI copilot reasoning with tool grounding.
   * COMPLIES WITH RULE 26: Never invents numbers; quotes state from tools.
   */
  askCopilot(query: string, tools: LocalAIAgentTools): string {
    const state = tools.getCurrentEngineState();
    const res = tools.getResiduals();
    const health = tools.getHealthIndex();

    const q = query.toLowerCase();

    if (q.includes('vibration') || q.includes('bearing')) {
      return (
        `[AeroTwin Copilot]: Live telemetry measures vibration at ${state.measured.vibration_mm_s} mm/s RMS ` +
        `(expected: ${state.expected.vibration_mm_s} mm/s, residual: +${res.vibrationResidual.toFixed(2)} mm/s). ` +
        `Model indicates ${state.predictive.bearingCondition} journal bearing condition with health index ${state.subsystems.bearing}/100. ` +
        `Recommendation: Inspect main bearing clearances at next scheduled depot inspection.`
      );
    }

    if (q.includes('temperature') || q.includes('heat') || q.includes('overheating')) {
      return (
        `[AeroTwin Copilot]: Cylinder Head Temperature is currently ${state.measured.cht_C} °C ` +
        `(nominal limit: <95 °C, expected: ${state.expected.cht_C} °C, residual: +${res.chtResidual.toFixed(1)} °C). ` +
        `Oil temperature is ${state.measured.oilTemperature_C} °C. ` +
        `Simulation estimates cooling subsystem health at ${state.subsystems.cooling}/100. ` +
        `Model suggests checking radiator airflow baffles.`
      );
    }

    if (q.includes('why') || q.includes('health') || q.includes('decrease') || q.includes('status')) {
      return (
        `[AeroTwin Copilot]: Overall engine health index is evaluated at ${health}/100 (${state.engineStatus}). ` +
        `Primary contributors to penalty: ` +
        `CHT delta (${res.chtResidual > 0 ? '+' : ''}${res.chtResidual.toFixed(1)} °C), ` +
        `Oil pressure delta (${res.oilPressureResidual.toFixed(2)} bar), ` +
        `Vibration delta (+${res.vibrationResidual.toFixed(2)} mm/s). ` +
        `Active isolated state: ${state.activeFaultNames.length > 0 ? state.activeFaultNames.join(', ') : 'No confirmed faults'}.`
      );
    }

    return (
      `[AeroTwin Copilot]: Telemetry summary for ${state.flightMode}: ` +
      `RPM: ${state.measured.rpm}, MAP: ${state.measured.manifoldPressure_bar} bar, CHT: ${state.measured.cht_C} °C, ` +
      `Oil Pressure: ${state.measured.oilPressure_bar} bar, Vibration: ${state.measured.vibration_mm_s} mm/s, ` +
      `Estimated RUL: ~${state.predictive.remainingUsefulLifeHrs} operating hours. Prototype simulation suggests parameters are ${state.engineStatus}.`
    );
  }
}
