# AeroTwin Security Architecture & Guidelines

## 1. Security Principles

The AeroTwin UAV Engine Digital Twin is designed with defense-in-depth principles appropriate for aerospace software systems:
1. **Zero Client Secret Exposure**: Secrets and API keys must never appear in client bundles, DOM trees, network inspectable payloads, or git repositories.
2. **Local-First Resilience**: All core digital twin physics and telemetry analysis functions are self-contained and execute locally without external cloud dependencies.
3. **Safe Tool Sandboxing**: AI agent tools are strictly partitioned into `READ_ONLY` telemetry queries and safe `SIMULATION_ACTION` branches.
4. **Prompt Injection & Hallucination Resistance**: Strict prompt constraints guarantee that AI reasoning cannot fabricate engine state or override avionics safety thresholds.

---

## 2. API Key Management & Proxy Isolation

### Rules
- `ELEVENLABS_API_KEY` is loaded solely into the Node.js server process (`scripts/server.ts`).
- The endpoint `GET /api/voice/status` returns only:
  ```json
  {
    "configured": true,
    "modelId": "eleven_turbo_v2_5",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "latencyOptimization": 3
  }
  ```
  **The key value is NEVER exposed in the JSON response.**
- Client-side code sends text to `/api/voice/speak` rather than communicating directly with ElevenLabs servers.

---

## 3. Sandboxed Counterfactual Isolation

AI Copilot simulation scenarios (e.g. *"What happens if engine load increases by 15%?"*) invoke `run_counterfactual_simulation`.
- This tool **clones** the state vector into an isolated memory sandbox.
- It executes hypothetical dynamics steps and measures trajectory deltas.
- **The live running engine simulation is never mutated.**
- This protects operational flight monitoring from being corrupted by diagnostic "what-if" explorations.

---

## 4. Input Sanitization & Safety Controls

1. **Text Length Clamping**: Text submitted to `/api/voice/speak` is clamped to 500 characters to prevent API denial-of-service or unexpected credit consumption.
2. **Special Character Stripping**: Markdown characters (`*`, `#`, `` ` ``, `_`, `[`, `]`) are stripped before TTS submission, preventing acoustic artifacts or synthetic syntax rendering.
3. **Rate Limiting**: The server rejects overlapping TTS calls triggered within rapid 1-second intervals.
