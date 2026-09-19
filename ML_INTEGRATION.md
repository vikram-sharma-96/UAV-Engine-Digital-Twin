# AeroTwin AI — Machine Learning Integration Guide

## 1. Overview & Separation of Concerns

AeroTwin AI isolates **engineering simulation** from **machine learning**:
* The simulator produces ground truth physical states and simulated sensor transducer readings.
* The digital twin computes residual vectors ($\Delta = \text{Measured} - \text{Expected}$).
* The ML system ingests the telemetry window and residual features to predict anomalies, classify faults, and estimate Remaining Useful Life (RUL).

The simulation and UI will function with the included `MockAIProvider` until your trained model is ready.

---

## 2. Implementing `MLModelProvider`

To integrate your model, create a class implementing `MLModelProvider` (`src/engine/ai/mlInterface.ts`):

```ts
import type { MLModelProvider, TelemetryWindow, MLPrediction } from './src/engine/ai/mlInterface.ts';

export class RealXGBoostModelProvider implements MLModelProvider {
  name = 'UAV-XGBoost-Fault-Classifier-v2.1';
  version = '2.1.0';

  isReady(): boolean {
    return true;
  }

  async predict(window: TelemetryWindow): Promise<MLPrediction> {
    // 1. Extract feature vector from window (e.g. rolling mean of residuals, gradients)
    const latestRes = window.residuals[window.residuals.length - 1];
    const latestSample = window.samples[window.samples.length - 1];

    // 2. Call local Python model API or ONNX runtime
    // const response = await fetch('http://localhost:8000/predict', { ... });
    
    return {
      anomalyScore: 0.88,
      isAnomaly: true,
      predictedFault: 'OVERHEATING',
      faultProbabilities: {
        NONE: 0.02,
        OVERHEATING: 0.88,
        LUBRICATION_DEGRADATION: 0.08,
        VIBRATION_FAULT: 0.02,
      },
      degradationScore: 0.65,
      rulEstimateHours: 42,
      confidence: 0.94,
      explanation: 'Rapid CHT growth without load change indicates severe cooling airflow blockage.',
    };
  }
}
```

---

## 3. Recommended Feature Set for ML Training

Do NOT train solely on raw sensor readings. The most informative features provided in the telemetry stream are:
1. **Normalized Residuals**: $\frac{|\text{Measured} - \text{Expected}|}{3\sigma}$
2. **Temperature Gradient**: $\frac{d(\text{CHT})}{dt}$ over a 5-second rolling window
3. **Oil Viscosity Indicator**: Ratio of Oil Pressure to Engine RPM ($\frac{P_{oil}}{\text{RPM}}$)
4. **Combustion Asymmetry**: Temperature delta between hottest and coldest cylinder ($\max(T_{cyl}) - \min(T_{cyl})$)
5. **RPM-Normalized Vibration**: $\frac{\text{Vibration RMS}}{\text{RPM} / 60}$
