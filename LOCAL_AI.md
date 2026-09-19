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

## 3. Sandboxed Tool Registry for Local LLM Reasoning

The AI Copilot executes through the unified Sandboxed Tool Registry (`src/engine/ai/toolRegistry.ts`), exposing 16 grounded engineering tools with JSON schemas and parameter validation:

| Tool Method | Access Level | Description |
| :--- | :--- | :--- |
| `get_current_engine_state` | `READ_ONLY` | Returns active snapshot of measured values, expected values, residuals, and health scores. |
| `get_recent_telemetry` | `READ_ONLY` | Returns rolling ring buffer array of recent transducer samples. |
| `get_telemetry_history` | `READ_ONLY` | Historical telemetry records across current mission phase. |
| `get_engine_health` | `READ_ONLY` | Overall engine health score ($0 - 100$) and subsystem breakdowns. |
| `get_active_faults` | `READ_ONLY` | Currently triggered faults, severity levels, and timestamps. |
| `get_fault_history` | `READ_ONLY` | Historical fault event logs. |
| `get_sensor_status` | `READ_ONLY` | Transducer health, drift detection, and noise floor. |
| `get_sensor_residuals` | `READ_ONLY` | Instantaneous deviation vector between measured and expected state. |
| `get_recent_events` | `READ_ONLY` | Chronological operational events and limit excursions. |
| `get_prediction` | `READ_ONLY` | ML-predicted remaining useful life and degradation trajectory. |
| `get_degradation_state` | `READ_ONLY` | Mechanical wear state (bearings, piston rings, oil viscosity). |
| `get_mission_state` | `READ_ONLY` | Active flight phase, altitude, and flight hours. |
| `run_counterfactual_simulation` | `SIMULATION_ACTION` | Clones engine state and simulates forward $N$ seconds to test "What-If" scenarios. |
| `run_simulation_scenario` | `SIMULATION_ACTION` | Switches active simulation mode (normal, overheating, bearing, etc.). |
| `generate_diagnostic_summary` | `READ_ONLY` | Pre-flight/post-flight diagnostic dispatch summary. |
| `get_system_status` | `READ_ONLY` | Bus interface, kalman filter, and daemon readiness status. |

---

## 4. Voice Subsystem Integration

The local AI reasoning daemon is paired with the **ElevenLabs Voice Streaming Subsystem**:
- **Dual-Stream Partitioning**: All agent responses are split into `[SPOKEN]` (spoken audio via ElevenLabs TTS or browser Web Speech) and `[VISUAL]` (avionics terminal display).
- **Offline Fallback**: If Ollama or ElevenLabs is offline, AeroTwin falls back to deterministic Bayesian rules and browser SpeechSynthesis.
- See [`AI_AGENT.md`](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/AI_AGENT.md), [`ELEVENLABS_INTEGRATION.md`](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/ELEVENLABS_INTEGRATION.md), and [`VOICE_ARCHITECTURE.md`](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/VOICE_ARCHITECTURE.md) for full architectural specifications.
