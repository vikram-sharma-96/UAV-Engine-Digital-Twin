/**
 * demoRunner.ts
 * 
 * Hackathon 10-Step Deterministic Demonstration Sequencer (Rule 46 Compliant).
 * 
 * Steps:
 * 1. Start healthy engine (t = 0s - 4s)
 * 2. Show normal telemetry (t = 5s)
 * 3. Start UAV mission (Takeoff & Climb, t = 6s - 12s)
 * 4. Introduce gradual injector degradation (t = 13s, severity 0.70)
 * 5. Show telemetry deviation (CHT rise on cyl 2, t = 16s)
 * 6. Show digital twin residual growth (CHT residual > +18 °C, t = 19s)
 * 7. Trigger ML anomaly detection (Anomaly score > 0.45, t = 22s)
 * 8. Display fault prediction (INJECTOR_DEGRADATION, confidence 84%, t = 24s)
 * 9. Run isolated counterfactual evaluation ("What if throttle reduced to 65%?", t = 26s)
 * 10. Show AI copilot natural language explanation (t = 28s)
 */

import { simulator } from '../../data/engineSimulator.ts';
import type { CounterfactualResult, MLPrediction } from '../types.ts';

export interface DemoStepEvent {
  stepNumber: number;
  elapsed_s: number;
  title: string;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  healthScore: number;
  engineStatus: string;
  activeFault: string;
  telemetrySnapshot?: {
    rpm: number;
    cht_C: number;
    oilPressure_bar: number;
    vibration_mm_s: number;
    fuelFlow_L_h: number;
  };
  residuals?: {
    chtResidual: number;
    oilPressureResidual: number;
    vibrationResidual: number;
  };
  mlPrediction?: MLPrediction;
  counterfactualResult?: CounterfactualResult;
  aiCopilotExplanation?: string;
}

export class HackathonDemoRunner {
  private isRunning = false;
  private currentStep = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;
  private onStepCallback?: (event: DemoStepEvent) => void;

  /** Subscribe to live demo step progression */
  onStep(callback: (event: DemoStepEvent) => void): void {
    this.onStepCallback = callback;
  }

  /** Start automated 30-second live demonstration */
  startDemo(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 1;
    this.elapsedSeconds = 0;

    // 1. Reset simulator to clean healthy normal baseline
    simulator.reset();

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick(): void {
    this.elapsedSeconds++;
    const t = this.elapsedSeconds;

    const state = simulator.getState();
    const twin = simulator.getDigitalTwinState();

    let stepNumber = 1;
    let title = 'Step 1: Engine Initialization';
    let desc = 'Cold start and ignition verification. RPM stabilized at nominal cruise setpoint.';
    let mlPred: MLPrediction | undefined;
    let cfRes: CounterfactualResult | undefined;
    let aiExpl: string | undefined;

    if (t >= 0 && t < 5) {
      stepNumber = 1;
      title = 'Step 1: Start Healthy Engine';
      desc = 'Four-cylinder horizontally opposed engine running at nominal baseline. Digital twin observer synchronized.';
    } else if (t >= 5 && t < 10) {
      stepNumber = 2;
      title = 'Step 2: Normal Telemetry Baseline';
      desc = `RPM: ${state.rpm}, CHT: ${state.temperature}°C, Oil: ${state.oilPressure} bar. All residuals within 3-sigma boundaries.`;
    } else if (t >= 10 && t < 15) {
      stepNumber = 3;
      title = 'Step 3: UAV Mission Flight Profile';
      desc = 'UAV enters climb regime to 2,400m altitude. Propeller load dynamic equation governing RPM.';
    } else if (t === 15) {
      // Step 4: Inject gradual injector fault
      stepNumber = 4;
      title = 'Step 4: Inject Gradual Fuel Injector Degradation';
      desc = 'Injecting fuel nozzle coking on Cylinder #2 (severity: 0.70). Cylinder burns lean.';
      simulator.setScenario('degradation');
    } else if (t > 15 && t < 20) {
      stepNumber = 5;
      title = 'Step 5: Telemetry Thermal Divergence';
      desc = `Cylinder head temperature elevating (${state.temperature}°C). Fuel flow delta rising.`;
    } else if (t >= 20 && t < 23) {
      stepNumber = 6;
      title = 'Step 6: Digital Twin Residual Growth';
      desc = `Observer residual Delta_CHT = +${twin.residuals.chtResidual.toFixed(1)}°C. Normalized residual vector crosses statistical threshold.`;
    } else if (t >= 23 && t < 26) {
      stepNumber = 7;
      title = 'Step 7: Machine Learning Anomaly Detection';
      const tools = {
        getCurrentEngineState: () => twin,
        getRecentTelemetry: () => [],
        getResiduals: () => twin.residuals,
        getHealthIndex: () => state.healthScore,
        runCounterfactual: (inv: any) => simulator.runCounterfactual(inv),
        generateEngineeringReport: () => 'Anomaly Detected',
      };
      mlPred = simulator.mockAI.predict({
        samples: [twin.measured],
        residuals: [twin.residuals],
        windowDuration_s: 10,
      });
      desc = `ML Anomaly Score: ${(mlPred.anomalyScore * 100).toFixed(1)}% (Confidence: ${(mlPred.confidence * 100).toFixed(0)}%).`;
    } else if (t >= 26 && t < 28) {
      stepNumber = 8;
      title = 'Step 8: Fault Classification & Isolation';
      mlPred = simulator.mockAI.predict({
        samples: [twin.measured],
        residuals: [twin.residuals],
        windowDuration_s: 10,
      });
      desc = `Isolated Root Cause: ${mlPred.predictedFault} (Probability: 84%). Subsystem: FUEL_DELIVERY.`;
    } else if (t >= 28 && t < 30) {
      stepNumber = 9;
      title = 'Step 9: Counterfactual What-If Evaluation';
      cfRes = simulator.runCounterfactual({
        throttleDelta: -0.15,
        loadDeltaPct: 0,
      });
      desc = `What-If Analysis: Throttling back 15% drops CHT by ${Math.abs(cfRes.deltas.chtDelta_C)}°C, stabilizing thermal margin.`;
    } else if (t >= 30) {
      stepNumber = 10;
      title = 'Step 10: Local AI Health Copilot Explanation';
      const tools = {
        getCurrentEngineState: () => twin,
        getRecentTelemetry: () => [],
        getResiduals: () => twin.residuals,
        getHealthIndex: () => state.healthScore,
        runCounterfactual: (inv: any) => simulator.runCounterfactual(inv),
        generateEngineeringReport: () => 'Complete Demo Report',
      };
      aiExpl = simulator.mockAI.askCopilot('Why is engine health decreasing?', tools);
      desc = aiExpl;
      this.stop();
    }

    if (this.onStepCallback) {
      this.onStepCallback({
        stepNumber,
        elapsed_s: t,
        title,
        description: desc,
        status: t >= 30 ? 'COMPLETED' : 'ACTIVE',
        healthScore: state.healthScore,
        engineStatus: state.engineStatus,
        activeFault: state.activeFault,
        telemetrySnapshot: {
          rpm: state.rpm,
          cht_C: state.temperature,
          oilPressure_bar: state.oilPressure,
          vibration_mm_s: state.vibration,
          fuelFlow_L_h: state.fuelFlow,
        },
        residuals: {
          chtResidual: twin.residuals.chtResidual,
          oilPressureResidual: twin.residuals.oilPressureResidual,
          vibrationResidual: twin.residuals.vibrationResidual,
        },
        mlPrediction: mlPred,
        counterfactualResult: cfRes,
        aiCopilotExplanation: aiExpl,
      });
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  isDemoRunning(): boolean {
    return this.isRunning;
  }
}

export const demoRunner = new HackathonDemoRunner();
