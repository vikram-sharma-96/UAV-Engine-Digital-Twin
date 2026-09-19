# AeroTwin AI — Local AI Agent Interface & Safety Guidelines

## 1. Overview

AeroTwin AI includes an abstract reasoning interface for local Large Language Models (e.g. running via Ollama / Llama 3 / Mistral) to act as an **AI Engine Health Copilot**.

Cloud APIs (OpenAI, Gemini) are strictly optional; core engine operations and simulation function completely offline.

---

## 2. AI Safety Rule (Rule 26)

> **CRITICAL RULE**: The AI agent is **NOT** the authoritative numerical engine.

1. **Authoritative Sources**:
   * Digital Twin State Observer
   * Physics Simulation Engine
   * Mathematical Residual Vectors
   * Trained Supervised ML Models
2. **LLM Operational Boundary**:
   * The LLM **must never invent sensor values**, fabricate Remaining Useful Life numbers, or override flight safety bounds.
   * All numbers quoted by the AI must originate from deterministic simulation tools.
   * Responses must use qualified engineering language:
     * *"Model indicates..."*
     * *"Simulation estimates..."*
     * *"Predicted fault probability..."*
     * *"Prototype observer suggests..."*

---

## 3. Tool Hooks for Local LLM Reasoning

The `LocalAIAgentTools` interface (`src/engine/ai/mlInterface.ts`) exposes deterministic query functions:

| Tool Method | Description |
| :--- | :--- |
| `getCurrentEngineState()` | Returns active snapshot of measured values, expected values, residuals, and health scores. |
| `getRecentTelemetry(count)` | Returns rolling ring buffer array of recent transducer samples. |
| `getResiduals()` | Returns instantaneous deviation vector between measured and expected state. |
| `getHealthIndex()` | Returns overall engine health score ($0 - 100$) and subsystem scores. |
| `runCounterfactual(intervention)` | Clones engine state and simulates forward $N$ seconds to test "What-If" scenarios. |
| `generateEngineeringReport()` | Produces standard pre-flight/post-flight text summary of anomalies and alerts. |
