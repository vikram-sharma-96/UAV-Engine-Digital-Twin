/**
 * ollamaProvider.ts
 * 
 * Local Ollama LLM Provider with Tool-Calling & Offline Fallback.
 * 
 * Interacts with Ollama daemon on http://localhost:11434.
 * Implements tool-calling loop, grounded system prompt injection, and
 * automatic fallback to local rule/Bayesian emulator (MockAIProvider) when offline.
 */

import { AEROTWIN_SYSTEM_PROMPT } from './systemPrompt.ts';
import { toolRegistry } from './toolRegistry.ts';
import { MockAIProvider } from './mockAIProvider.ts';
import type { AIAgentProvider, AgentMessage, AgentQueryResponse } from '../voice/types.ts';
import { simulator } from '../../data/engineSimulator.ts';

export class OllamaAgentProvider implements AIAgentProvider {
  name = 'Ollama-Local-LLM';
  private baseUrl: string;
  private configuredModel: string;
  private fallbackProvider: MockAIProvider;

  constructor() {
    this.baseUrl = (typeof process !== 'undefined' && process.env?.OLLAMA_BASE_URL) || 'http://localhost:11434';
    this.configuredModel = (typeof process !== 'undefined' && process.env?.OLLAMA_MODEL) || '';
    this.fallbackProvider = new MockAIProvider();
  }

  /**
   * Check if Ollama daemon is active and responsive.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of locally installed Ollama models.
   */
  async getInstalledModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name || m.model);
    } catch {
      return [];
    }
  }

  /**
   * Execute user query against Ollama or fallback to local rule engine.
   */
  async query(
    userPrompt: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentQueryResponse> {
    const isOllamaUp = await this.isAvailable();

    if (!isOllamaUp) {
      // Local-First Fallback: Use deterministic rule/Bayesian emulator
      return this.executeFallback(userPrompt);
    }

    try {
      const models = await this.getInstalledModels();
      const activeModel = this.configuredModel || models[0] || 'llama3:latest';

      const messages: AgentMessage[] = [
        { role: 'system', content: AEROTWIN_SYSTEM_PROMPT },
        ...conversationHistory.slice(-6), // Keep recent conversation window
        { role: 'user', content: userPrompt },
      ];

      const tools = toolRegistry.getToolDefinitionsForLLM();

      // Step 1: Initial call to Ollama with tools
      const initialRes = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          messages,
          tools,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for deterministic engineering facts
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!initialRes.ok) {
        return this.executeFallback(userPrompt);
      }

      const initialData = await initialRes.json();
      const assistantMessage = initialData.message;
      const toolCallsExecuted: string[] = [];

      // Step 2: If model requested tool calls, execute them and follow up
      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push(assistantMessage);

        for (const tc of assistantMessage.tool_calls) {
          const fnName = tc.function?.name;
          let fnArgs: Record<string, any> = {};
          try {
            fnArgs = typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function?.arguments || {};
          } catch {
            fnArgs = {};
          }

          toolCallsExecuted.push(fnName);
          const toolResult = await toolRegistry.executeTool(fnName, fnArgs);

          messages.push({
            role: 'tool',
            name: fnName,
            content: JSON.stringify(toolResult),
          });
        }

        // Final synthesis call with tool results
        const finalRes = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel,
            messages,
            stream: false,
            options: { temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (finalRes.ok) {
          const finalData = await finalRes.json();
          const rawReply = finalData.message?.content || '';
          return this.parseResponse(rawReply, toolCallsExecuted, 'ollama', activeModel);
        }
      }

      // No tool calls needed or single response returned
      const reply = assistantMessage?.content || '';
      return this.parseResponse(reply, toolCallsExecuted, 'ollama', activeModel);
    } catch {
      return this.executeFallback(userPrompt);
    }
  }

  /**
   * Deterministic local fallback using MockAIProvider and real digital twin tools.
   */
  private executeFallback(query: string): AgentQueryResponse {
    const twin = simulator.getDigitalTwinState();
    const tools = {
      getCurrentEngineState: () => twin,
      getRecentTelemetry: () => [twin.measured],
      getResiduals: () => twin.residuals,
      getHealthIndex: () => twin.healthScore,
      runCounterfactual: (inv: any) => simulator.runCounterfactual(inv),
      generateEngineeringReport: () => `AeroTwin Diagnostic Report: Health ${twin.healthScore}%, Status ${twin.engineStatus}`,
    };

    // Check if query is a counterfactual request
    const qLower = query.toLowerCase();
    const toolCallsExecuted: string[] = ['get_current_engine_state', 'get_sensor_residuals'];

    let spokenText = '';
    let visualText = '';

    if (qLower.includes('increase') && (qLower.includes('load') || qLower.includes('simulate'))) {
      toolCallsExecuted.push('run_counterfactual_simulation');
      const loadMatch = query.match(/(\d+)\s*(percent|%)/i);
      const loadPct = loadMatch ? parseInt(loadMatch[1]) : 15;
      
      const cfResult = toolRegistry.getTool('run_counterfactual_simulation')?.execute({
        load_change_pct: loadPct,
        duration_seconds: 20,
      });

      spokenText = `Counterfactual simulation complete. A ${loadPct} percent load increase produces an estimated temperature increase of ${Math.abs(cfResult.chtDelta_C).toFixed(1)} degrees Celsius, with vibration delta of ${cfResult.vibrationDelta_mm_s.toFixed(2)} millimeters per second.`;
      
      visualText = `[SIMULATION RESULT]\nSTATUS: Counterfactual Intervention Executed\nINTERVENTION: Load ${loadPct > 0 ? '+' : ''}${loadPct}% for 20s\nRPM DELTA: ${cfResult.simulatedFinalRpm - cfResult.baselineRpm} RPM\nCHT DELTA: +${Math.abs(cfResult.chtDelta_C).toFixed(1)} °C\nVIBRATION DELTA: +${cfResult.vibrationDelta_mm_s.toFixed(2)} mm/s\nESTIMATED HEALTH IMPACT: ${cfResult.estimatedHealthDelta} points\nCONCLUSION: ${cfResult.conclusions.join(' ')}`;
    } else {
      const reply = this.fallbackProvider.askCopilot(query, tools);
      
      // Generate clean spoken summary
      if (twin.activeFaultNames.length > 0) {
        spokenText = `Warning. Active fault detected: ${twin.activeFaultNames.join(', ')}. Engine health is evaluated at ${twin.healthScore} percent with status ${twin.engineStatus}.`;
      } else {
        spokenText = `Current engine health is ${twin.healthScore} percent under nominal cruise conditions. RPM is ${twin.measured.rpm}, and all monitored residuals are within standard limits.`;
      }

      visualText = reply;
    }

    return {
      spokenText,
      visualText,
      toolCallsExecuted,
      confidence: 0.94,
      provider: 'local_ensemble',
      model: 'AeroTwin-Bayesian-Rule-Engine',
    };
  }

  /**
   * Parse dual-format response ([SPOKEN] and [VISUAL]) from model output.
   */
  private parseResponse(
    rawText: string,
    toolCalls: string[],
    provider: 'ollama' | 'local_ensemble',
    model: string
  ): AgentQueryResponse {
    let spokenText = '';
    let visualText = rawText;

    if (rawText.includes('[SPOKEN]') && rawText.includes('[VISUAL]')) {
      const parts = rawText.split('[VISUAL]');
      spokenText = parts[0].replace('[SPOKEN]', '').trim();
      visualText = parts[1].trim();
    } else {
      // Auto-extract first 2 sentences for spoken audio
      const sentences = rawText.replace(/[#*`_]/g, '').split(/(?<=[.?!])\s+/);
      spokenText = sentences.slice(0, 2).join(' ').trim();
      visualText = rawText;
    }

    return {
      spokenText,
      visualText,
      toolCallsExecuted: toolCalls,
      confidence: 0.92,
      provider,
      model,
    };
  }
}

// Global agent provider singleton
export const ollamaAgent = new OllamaAgentProvider();
