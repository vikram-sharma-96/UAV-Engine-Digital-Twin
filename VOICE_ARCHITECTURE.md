# AeroTwin Voice Subsystem Architecture

## 1. System Overview

The **AeroTwin Voice Subsystem** handles bidirectional audio interaction:
1. **Voice Input (STT)**: Transcribes the engineer's spoken voice questions via the Web Speech Recognition API into grounded queries.
2. **Voice Output (TTS)**: Streams audio responses via ElevenLabs neural models (or native browser SpeechSynthesis fallback).
3. **Barge-in / Audio Interrupts**: Allows the engineer to immediately halt audio output either by issuing a new query or clicking the **STOP** button.
4. **Mute Control**: Persists silence preference while retaining full visual terminal outputs.

---

## 2. Audio Streaming Flow

```
                      [User Speaks / Clicks "TALK"]
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │   Web Speech API (Browser)   │
                   │   SpeechRecognition          │
                   └──────────────┬───────────────┘
                                  │ Transcribed Text
                                  ▼
                   ┌──────────────────────────────┐
                   │    handleQuery(transcript)   │
                   └──────────────┬───────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │    POST /api/agent/query     │
                   │  - Executes grounded tools   │
                   │  - Formats [SPOKEN] summary  │
                   └──────────────┬───────────────┘
                                  │ { spoken, visual }
                                  ▼
                   ┌──────────────────────────────┐
                   │    POST /api/voice/speak     │
                   └──────────────┬───────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
          API Key Configured?            API Key Missing?
                   ▼                             ▼
       ┌────────────────────────┐    ┌────────────────────────┐
       │ ElevenLabs Stream      │    │ Browser Fallback       │
       │ Transfer-Encoding:     │    │ window.speechSynthesis │
       │ chunked (audio/mpeg)   │    │ SpeechSynthesisUtterance
       └───────────┬────────────┘    └───────────┬────────────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │ HTML5 Audio / Speech Playback│
                   │ State: SPEAKING (TTS)        │
                   └──────────────┬───────────────┘
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       │                                                     │
   Playback Finishes                                  Barge-In / Stop
       ▼                                                     ▼
State: READY                                        State: READY (Halted)
```

---

## 3. Real-Time State Machine

The voice subsystem operates across 4 distinct visual and logical states:

| State | Badge Color | Animation | Behavior |
| :--- | :--- | :--- | :--- |
| **`READY`** | Emerald | Pulse slow | Waiting for user interaction; audio pipeline idle. |
| **`LISTENING`** | Amber | Ping | Microphone recording; Web Speech API active. |
| **`PROCESSING`** | Cyan | Pulse | Grounding telemetry, querying Ollama/ensemble, executing tools. |
| **`SPEAKING`** | Purple | Pulse | TTS audio playback active; Stop/Barge-in button exposed. |

Global state changes are dispatched as `voice-state-changed` DOM events and mirrored in the **Real-Time Telemetry Status Panel**.

---

## 4. Barge-In & Interruption Handling

In avionics and critical operations, voice systems must never talk over the user or refuse cancellation:
1. **User Barge-In**: Whenever a new query is submitted (by clicking a query chip, typing in the input box, or speaking into the mic), any running audio stream is immediately paused, its buffer cleared, and `window.speechSynthesis.cancel()` is called.
2. **Explicit Stop**: Clicking the red `[STOP]` button instantly terminates playback and resets the voice badge to `READY`.

---

## 5. Autoplay Policy Compliance

Modern web browsers (Chrome, Edge, Firefox, Safari) block unprompted audio autoplay. AeroTwin complies with browser security policies by:
- Never attempting unprompted background audio upon initial page load.
- Initiating audio context only in response to direct user interactions (clicking a query button, clicking TALK, or submitting a form).
