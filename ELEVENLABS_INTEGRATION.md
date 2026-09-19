# ElevenLabs Voice Integration Guide

## 1. Overview

AeroTwin integrates the **ElevenLabs Text-to-Speech API** to provide an ultra-realistic, low-latency synthetic voice for the AI Engine Copilot.

Voice output is streamed over chunked HTTP (`audio/mpeg`) directly from the server-side proxy to the client browser, minimizing time-to-first-audio while preserving absolute secret isolation.

---

## 2. Server-Side Proxy & Absolute Secret Isolation

To protect API credentials from browser inspection, web scrapers, and malicious tampering:
1. **The ElevenLabs API Key is NEVER sent to the client browser.**
2. The browser calls internal endpoint `POST /api/voice/speak` with `{ "text": "..." }`.
3. The server proxy (`scripts/server.ts`) reads `process.env.ELEVENLABS_API_KEY`, constructs the authorized upstream request to `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream`, and streams the raw MP3 audio chunk-by-chunk back to the client.
4. If no key is set or the network is offline, the endpoint responds with `{ status: "fallback", provider: "browser" }`, triggering the browser's native `SpeechSynthesis` engine.

---

## 3. Configuration & Environment Variables

Configure ElevenLabs settings in your `.env` file:

```env
# ElevenLabs API Key (Server-Side Only)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Selected Voice ID
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Selected Model
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5

# Latency Optimization (0 to 4)
ELEVENLABS_LATENCY_OPTIMIZATION=3

# Stability & Similarity Boost
ELEVENLABS_STABILITY=0.5
ELEVENLABS_SIMILARITY_BOOST=0.75
```

### Recommended Voices for Flight Avionics
| Voice ID | Name | Tone / Accent | Use Case |
| :--- | :--- | :--- | :--- |
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Calm, Professional, Clear | Primary Flight Avionics Copilot |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Confident, Crisp | Tactical UAV Operator |
| `ErXwobaYiN019PkySvjV` | Antoni | Steady, Analytical | Maintenance Dispatch & Telemetry |

---

## 4. Latency Optimization & Streaming

To achieve sub-second voice synthesis:
1. **Model Selection**: AeroTwin uses `eleven_turbo_v2_5`, offering the fastest synthesis times (< 250ms TTFA).
2. **Chunked Streaming**: Audio is streamed using the `/stream` endpoint with `optimize_streaming_latency=3`.
3. **Piped Streams**: The Node.js proxy pipes the upstream web `ReadableStream` directly into the HTTP response stream without buffering the entire audio file into memory.

---

## 5. Safety & Cost Protection Guards

The client implementation in [`src/engine/voice/elevenLabsClient.ts`](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/src/engine/voice/elevenLabsClient.ts) enforces strict limits to prevent API credit burn:
- **Text Length Clamping**: Spoken prompts are clamped to a maximum of 500 characters.
- **Spoken Text Extraction**: Only the `[SPOKEN]` summary is dispatched to ElevenLabs; full markdown reports and ASCII tables remain exclusively in the visual terminal.
- **Rate Limiting**: Duplicate TTS calls within a 1-second debounce window are rejected.

---

## 6. Offline Fallback Mechanics

When operating in field environments without Internet access:
1. When `ELEVENLABS_API_KEY` is not present, `GET /api/voice/status` returns `{ configured: false }`.
2. The UI switches the voice engine indicator to `WEB SPEECH FALLBACK`.
3. Audio is synthesized using the browser's native `SpeechSynthesis` API (`SpeechSynthesisUtterance`).
4. **Result:** Full voice experience without network connectivity or API costs.
