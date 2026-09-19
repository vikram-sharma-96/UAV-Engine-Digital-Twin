# AeroTwin AI Agent & Tool Subsystem Architecture

## 1. Executive Summary

The **AeroTwin AI Agent** is an aerospace engineering copilot designed to provide natural language diagnostic reasoning and counterfactual ("what-if") evaluation over live UAV engine telemetry.

Unlike generic chatbots, the AeroTwin AI copilot strictly adheres to **Rule 26: Zero Numerical Hallucination**:
1. It **never** invents engine RPM, temperatures, pressures, or health scores.
2. All quantitative statements are grounded in real-time observer state vectors and residual calculations.
3. Every response is partitioned into a concise **`[SPOKEN]`** summary (optimized for speech output) and a detailed **`[VISUAL]`** engineering readout (grounded observation, diagnostic hypothesis, and recommended maintenance action).

---

## 2. Multi-Tier Hybrid Architecture

```
                  ┌─────────────────────────────────────────┐
                  │          AeroTwin UI Dashboard          │
                  │   [Mic / Query]        [Voice State]    │
                  └──────────────────┬──────────────────────┘
                                     │ User Query / Audio Input
                                     ▼
                  ┌─────────────────────────────────────────┐
                  │       scripts/server.ts (Proxy)         │
                  │    POST /api/agent/query                │
                  └─────────┬──────────────────────┬────────┘
                            │                      │
                  Ollama Available?         Ollama Offline?
                            ▼                      ▼
           ┌──────────────────────────────┐  ┌──────────────────────────────┐
           │   OllamaAgentProvider (LLM)   │  │   MockAIProvider (Ensemble)  │
           │  Llama 3 / Mistral via tools │  │  Deterministic Rule Engine   │
           └──────────────┬───────────────┘  └──────────────┬───────────────┘
                          │                                 │
                          └───────────────┬─────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │      AeroTwin Tool Registry           │
                      │     (16 Grounded Engineering Tools)   │
                      └───────────────────┬───────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼                                             ▼
     ┌────────────────────────────┐               ┌────────────────────────────┐
     │  Digital Twin Observer     │               │  Counterfactual Engine     │
     │  - Live State Vector       │               │  - Isolated Clone Run      │
     │  - Analytical Residuals    │               │  - Zero Live State Mutation│
     │  - Subsystem Health Scores │               │  - Delta Trajectory        │
     └────────────────────────────┘               └────────────────────────────┘
```

### Fallback Guarantee (100% Offline Operational)
- If the local Ollama daemon (`http://localhost:11434`) is offline or unreachable, the system automatically falls back to `MockAIProvider`.
- The rule-based Bayesian ensemble evaluates sensor residuals, cross-checks active fault signatures, and runs isolated counterfactual branches without skipping a beat.

---

## 3. Sandboxed Engineering Tool Registry (16 Tools)

All tools are registered in [`src/engine/ai/toolRegistry.ts`](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/src/engine/ai/toolRegistry.ts) with JSON Schema parameter definitions and access level classifications:

| Tool Name | Access Level | Description | Parameters |
| :--- | :--- | :--- | :--- |
| `get_current_engine_state` | `READ_ONLY` | Retrieves live telemetry (RPM, CHT, EGT, oil pressure, vibration, fuel flow). | None |
| `get_recent_telemetry` | `READ_ONLY` | Time-series telemetry window (last N seconds). | `window_seconds` (number) |
| `get_telemetry_history` | `READ_ONLY` | Historical telemetry records since start of mission. | `limit` (number) |
| `get_engine_health` | `READ_ONLY` | Overall health index (0–100%) and subsystem health breakdown. | None |
| `get_active_faults` | `READ_ONLY` | Currently triggered faults, severity levels, and timestamps. | None |
| `get_fault_history` | `READ_ONLY` | Logged historical fault events and clearances. | `limit` (number) |
| `get_sensor_status` | `READ_ONLY` | Transducer health, drift detection, and signal noise floor. | `sensor_name` (optional string) |
| `get_sensor_residuals` | `READ_ONLY` | Analytical differences between measured values and physics predictions. | None |
| `get_recent_events` | `READ_ONLY` | Chronological log of significant operating events and warnings. | `limit` (number) |
| `get_prediction` | `READ_ONLY` | ML-based remaining useful life (RUL) and 30-minute degradation trend. | None |
| `get_degradation_state` | `READ_ONLY` | Multi-component wear tracking (bearings, rings, oil viscosity). | None |
| `get_mission_state` | `READ_ONLY` | Current flight phase (takeoff, cruise, loiter, descent) and flight hours. | None |
| `run_counterfactual_simulation` | `SIMULATION_ACTION` | Evaluates hypothetical scenarios in a sandboxed cloned engine state. | `load_change_pct`, `duration_seconds`, etc. |
| `run_simulation_scenario` | `SIMULATION_ACTION` | Switches active simulation scenario mode. | `scenario` ('normal' \| 'overheating' \| etc.) |
| `generate_diagnostic_summary` | `READ_ONLY` | Structured engineering diagnostic dispatch report. | None |
| `get_system_status` | `READ_ONLY` | Status of CAN-bus, kalman filters, and simulation state. | None |

### Isolation Guarantee
The tool `run_counterfactual_simulation` evaluates hypothetical branches inside an isolated cloned digital twin state. **It never modifies live engine RPM, throttle, or temperature.**

---

## 4. Dual-Stream Response Format

Every response generated by the copilot contains two distinct representations:

1. **`[SPOKEN]` (Voice Output)**:
   - Length: 1–3 short sentences.
   - Purpose: Designed for natural, clear spoken delivery via ElevenLabs TTS or Web Speech.
   - Style: Direct, avoids markdown tables or symbols. Immediately communicates severity and root cause.

2. **`[VISUAL]` (Terminal Output)**:
   - Purpose: Displayed in the high-density avionics terminal UI.
   - Structure:
     - `[GROUNDED OBSERVATION]`: Live numerical telemetry with units.
     - `[DIAGNOSTIC HYPOTHESIS]`: Underlying physical cause identified from residuals.
     - `[RECOMMENDED ACTION]`: Specific inspection or remediation interval.

---

## 5. System Prompt & Hallucination Defense

The system prompt is enforced in [`src/engine/ai/systemPrompt.ts`](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/src/engine/ai/systemPrompt.ts):
- Models are instructed: **"DO NOT GUESS OR FABRICATE TELEMETRY NUMBERS."**
- Any numerical figure must be retrieved through one of the 16 sandbox tools.
- Counterfactual questions (e.g. *"What happens if load increases 15%?"*) **must** invoke `run_counterfactual_simulation` rather than estimating.
