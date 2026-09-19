/**
 * mlInterface.ts
 * 
 * Clean Decoupled Machine Learning & AI Provider Interface.
 * 
 * Allows a separately trained ML model (XGBoost / LSTM / Autoencoder)
 * to be plugged in without modifying the simulation, digital twin, or UI.
 */

import type {
  TelemetryWindow,
  MLPrediction,
  DigitalTwinState,
  MeasuredTelemetry,
  TelemetryResiduals,
  CounterfactualIntervention,
  CounterfactualResult,
} from '../types';

export interface MLModelProvider {
  name: string;
  version: string;
  isReady(): boolean;
  predict(window: TelemetryWindow): Promise<MLPrediction> | MLPrediction;
}

export interface LocalAIAgentTools {
  getCurrentEngineState(): DigitalTwinState;
  getRecentTelemetry(count?: number): MeasuredTelemetry[];
  getResiduals(): TelemetryResiduals;
  getHealthIndex(): number;
  runCounterfactual(intervention: CounterfactualIntervention): CounterfactualResult;
  generateEngineeringReport(): string;
}

export interface LocalAIProvider {
  name: string;
  isAvailable(): boolean;
  askCopilot(query: string, tools: LocalAIAgentTools): Promise<string> | string;
}
