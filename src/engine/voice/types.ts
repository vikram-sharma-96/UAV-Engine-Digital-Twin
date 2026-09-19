/**
 * types.ts
 * 
 * Core type definitions for AeroTwin AI Voice and Agent subsystem.
 * 
 * Defines provider abstractions, voice state machine, tool specifications,
 * and audio configuration for decoupled, local-first engineering voice copilot.
 */

import type { DigitalTwinState, MeasuredTelemetry, TelemetryResiduals, CounterfactualIntervention, CounterfactualResult } from '../types.ts';

// ─── Voice State Machine ──────────────────────────────────────────────────────

export type VoiceState = 
  | 'IDLE'        // Agent ready, waiting for input
  | 'LISTENING'   // Recording user speech via microphone
  | 'PROCESSING'  // Transcribing speech or parsing command
  | 'THINKING'    // AI Agent executing tools and generating response
  | 'SPEAKING'    // Playing synthetic speech through speaker
  | 'ERROR'       // Transitory error state (e.g. microphone denied, quota exceeded)
  | 'OFFLINE';    // Voice services completely disabled/unavailable

export type VoiceEvent = 
  | 'voice_input_started'
  | 'voice_input_completed'
  | 'agent_request_started'
  | 'agent_tool_called'
  | 'agent_tool_completed'
  | 'agent_response_generated'
  | 'tts_started'
  | 'tts_completed'
  | 'tts_failed'
  | 'voice_interrupted'
  | 'voice_error';

export type VoiceEventCallback = (event: VoiceEvent, payload?: any) => void;

// ─── Voice Configuration ─────────────────────────────────────────────────────

export interface VoiceConfig {
  provider: 'elevenlabs' | 'browser' | 'disabled';
  voiceId: string;
  ttsModel: string;
  stability: number;       // 0.0 to 1.0 (default 0.50)
  similarityBoost: number; // 0.0 to 1.0 (default 0.75)
  style: number;           // 0.0 to 1.0 (default 0.0)
  speakingRate: number;    // 0.5 to 2.0 (default 1.0)
  enableVoiceAlerts: boolean;
  alertCooldownSeconds: number;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  provider: 'elevenlabs',
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel (Calm, Professional Avionics Voice)
  ttsModel: 'eleven_turbo_v2_5',
  stability: 0.50,
  similarityBoost: 0.75,
  style: 0.0,
  speakingRate: 1.0,
  enableVoiceAlerts: true,
  alertCooldownSeconds: 60,
};

// ─── Provider Interfaces ─────────────────────────────────────────────────────

export interface TTSStreamOptions {
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface VoiceOutputProvider {
  name: string;
  isAvailable(): Promise<boolean> | boolean;
  synthesizeSpeech(text: string, options?: TTSStreamOptions): Promise<ReadableStream<Uint8Array> | ArrayBuffer | null>;
}

export interface VoiceInputProvider {
  name: string;
  isAvailable(): boolean;
  startListening(onTranscript: (text: string, isFinal: boolean) => void, onError: (err: string) => void): void;
  stopListening(): void;
}

// ─── Tool-Using AI Agent Specifications ──────────────────────────────────────

export type ToolAccessLevel = 'READ_ONLY' | 'SIMULATION_ACTION';

export interface AgentToolDefinition {
  name: string;
  description: string;
  accessLevel: ToolAccessLevel;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
    }>;
    required?: string[];
  };
  execute: (args: Record<string, any>) => Promise<any> | any;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AgentToolResult {
  toolCallId: string;
  name: string;
  result: any;
  error?: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export interface AgentQueryResponse {
  spokenText: string;
  visualText: string;
  toolCallsExecuted: string[];
  affectedParameters?: string[];
  confidence?: number;
  provider: 'ollama' | 'local_ensemble' | 'mock';
  model: string;
}

export interface AIAgentProvider {
  name: string;
  isAvailable(): Promise<boolean> | boolean;
  query(
    userPrompt: string, 
    conversationHistory: AgentMessage[], 
    tools: AgentToolDefinition[]
  ): Promise<AgentQueryResponse>;
}
