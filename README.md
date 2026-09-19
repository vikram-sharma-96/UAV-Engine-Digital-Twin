# 🚁 UAV Engine Digital Twin

### AI-Enabled Real-Time Digital Twin System for Health Monitoring & Fault Prediction

> A smart digital twin platform for monitoring UAV aero piston engines, analyzing engine health parameters, detecting abnormal behavior, and predicting potential faults in real time.

---

## 📌 Overview

**UAV Engine Digital Twin** is an intelligent engine-health monitoring platform designed for **UAV (Unmanned Aerial Vehicle) aero piston engines**.

The system creates a **digital representation of the physical engine** and continuously analyzes engine parameters such as:

* 🌡️ Engine Temperature
* ⚙️ RPM
* 🛢️ Oil Pressure
* 💨 Fuel Flow
* 🔋 Battery Voltage
* 📈 Vibration
* ⛽ Fuel Level
* 🔥 Engine Load

The collected data is processed to understand the current condition of the engine, identify abnormal patterns, and provide early warnings for possible faults.

---

## 🎯 Problem Statement

UAV engines operate under continuously changing conditions. Unexpected engine failures can result in:

* Loss of UAV control
* Mission failure
* Expensive maintenance
* Reduced operational efficiency
* Safety risks

Traditional monitoring systems mainly provide raw sensor readings and may not provide sufficient **early fault detection or predictive insights**.

This project aims to provide a centralized system that can monitor engine health and transform raw telemetry into meaningful information.

---

## 💡 Proposed Solution

The proposed system combines:

**Real-Time Engine Data → Digital Twin → Data Analysis → Health Monitoring → Fault Detection → Prediction**

The digital twin continuously represents the current state of the physical engine.

When abnormal behavior is detected, the system can generate alerts and display the affected parameters through an interactive dashboard.

---

## 🏗️ System Architecture

```text
        UAV Aero Piston Engine
                 │
                 ▼
        ┌─────────────────┐
        │  Sensor Data    │
        │ RPM / Temp /    │
        │ Pressure / etc. │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Data Processing │
        │ & Validation    │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Digital Twin   │
        │ Engine State    │
        └────────┬────────┘
                 │
          ┌──────┴───────┐
          ▼              ▼
   Health Monitoring   ML Analysis
          │              │
          ▼              ▼
   Current Engine     Fault Detection
       Health         & Prediction
          │              │
          └──────┬───────┘
                 ▼
        ┌─────────────────┐
        │    Dashboard    │
        │ Alerts / Graphs │
        │ Engine Status   │
        └─────────────────┘
```

---

## ✨ Key Features

### 📊 Real-Time Engine Monitoring

Monitor important engine parameters through an interactive dashboard.

### 🧠 Digital Twin

Maintain a virtual representation of the physical UAV engine and its current operating condition.

### 🚨 Fault Detection

Identify abnormal engine behavior using predefined thresholds and intelligent analysis.

### 🔮 Predictive Maintenance

Analyze historical and real-time data to identify patterns that may indicate an upcoming engine fault.

### 📈 Data Visualization

Visualize engine parameters using:

* Real-time graphs
* Health indicators
* Performance charts
* Parameter trends
* Warning indicators

### 🟢 Engine Health Status

The dashboard can represent engine condition using states such as:

```text
NORMAL
WARNING
CRITICAL
```

### 📋 Fault History

Maintain a record of detected abnormalities and engine-health events for further analysis.

---

## 🖥️ Dashboard

The dashboard provides a centralized view of the UAV engine.

Example monitored parameters:

| Parameter       | Example Value | Status  |
| --------------- | ------------: | ------- |
| RPM             |          4200 | Normal  |
| Temperature     |          82°C | Normal  |
| Oil Pressure    |       3.8 bar | Normal  |
| Fuel Flow       |       1.2 L/h | Normal  |
| Vibration       |      4.2 mm/s | Warning |
| Battery Voltage |        23.8 V | Normal  |

> Values shown above are sample values for demonstration purposes.

---

## 🧠 AI/ML Pipeline

The future intelligent prediction pipeline is planned as:

```text
Engine Telemetry
       ↓
Data Cleaning
       ↓
Feature Extraction
       ↓
Feature Engineering
       ↓
ML Model
       ↓
Fault Classification
       ↓
Health Score
       ↓
Prediction & Alert
```

Possible ML approaches include:

* Classification
* Anomaly Detection
* Time-Series Analysis
* Predictive Maintenance Models
* Remaining Useful Life (RUL) estimation

---

## 🛠️ Technology Stack

### Digital Twin & Simulation Engine

* **Engine Model**: 0D/1D Mean-Value Engine Model (MVEM) with dynamic thermal inertia and fluid mechanics
* **Digital Twin**: Parallel observer state estimation with real-time residual vector computation
* **Fault Injection**: 10 failure modes with progressive severity ($0.0 \to 1.0$)
* **Atmosphere**: International Standard Atmosphere (ISA) barometric and air density model

### Frontend Dashboard

* **Framework**: Astro 5.x (`^7.3.2`) with `@tailwindcss/vite` (v4.3.3)
* **Visualization**: Interactive isometric SVG 4-cylinder boxer engine schematic with real-time animated crankshaft
* **Streaming**: Central state store broadcasting `engine-state-update` events
* **Styling**: Modern dark aerospace HUD aesthetic with glassmorphism

### AI / Machine Learning Ready

* **Dataset Generator**: Seedable PRNG with labeled CSV / JSON export
* **ML Model Interface**: Decoupled prediction contract (`predict(window) -> MLPrediction`)
* **Mock Provider**: Calibrated Bayesian residual inference and grounded LLM Copilot tools

---

## 📂 Project Structure

```text
UAV-ENGINE-DIGITAL-TWIN/
├── src/
│   ├── engine/                    # Modular Physics & Digital Twin Core
│   │   ├── config/                # Default engine profile and sensor specs
│   │   ├── environment/           # ISA atmosphere equations (P, T, rho)
│   │   ├── physics/               # Intake, dynamics, thermal, lubrication, vibration
│   │   ├── sensors/               # Transducer pipeline (noise, bias, drift, dropout)
│   │   ├── faults/                # Progressive fault injection engine (10 modes)
│   │   ├── twin/                  # Digital twin observer and residual engine
│   │   ├── counterfactual/        # What-if state cloner and forward simulator
│   │   ├── mission/               # UAV flight regime sequencer
│   │   ├── dataset/               # Synthetic dataset generator for ML training
│   │   └── ai/                    # ML contract and deterministic mock AI provider
│   ├── components/                # Astro dashboard components (SVG twin, metric cards)
│   ├── data/                      # Central simulator singleton (engineSimulator.ts)
│   ├── layouts/                   # Avionics dashboard shell (DashboardLayout.astro)
│   └── pages/                     # 8 Avionics pages (/overview, /digital-twin, etc.)
├── tests/                         # Automated unit & physical validation suite
├── ENGINE_MODEL.md                # Full mathematical documentation of equations
├── ARCHITECTURE.md                # System topology and modular design
├── TELEMETRY_SCHEMA.md            # Transducer data dictionary
├── FAULT_MODEL.md                 # Fault signatures and severity behavior
├── DATASET_GENERATION.md          # Synthetic data generation instructions
├── ML_INTEGRATION.md              # ML model provider integration guide
├── VALIDATION.md                  # Physical plausibility benchmarks
├── LOCAL_AI.md                    # Local LLM Copilot tools and safety rules
└── DEVELOPER_SETUP.md             # Developer setup and quickstart guide
```

---

## 🚀 Quickstart

```powershell
# 1. Run automated engineering tests
node --test tests/*.test.ts

# 2. Start local development server
npm run dev

# 3. Compile production bundle
npm run build
```

---

## 🤖 LOCAL AI SETUP

The UAV Engine Digital Twin includes a **Local AI Diagnostic Agent** powered by [Ollama](https://ollama.com). The AI Agent runs 100% locally on your machine, ingests real-time engine telemetry every 5–10 seconds, detects anomalies, assesses severity, and provides structured maintenance recommendations directly inside the avionics dashboard.

### 1. Install Ollama
Download and install Ollama for Windows, macOS, or Linux from:
👉 **[https://ollama.com/download](https://ollama.com/download)**

### 2. Start Ollama
Ensure the Ollama local daemon is running:
```powershell
ollama serve
```
By default, Ollama serves on `http://localhost:11434`.

### 3. Pull the Configured Model
Pull the default model (`llama3.2`):
```powershell
ollama pull llama3.2
```
*(Note: If you have limited VRAM or prefer another model, e.g. `qwen2.5:3b` or `mistral`, you can pull that instead).*

### 4. Set OLLAMA_MODEL (Optional)
Copy the sample environment file if you wish to customize the model or Ollama host:
```powershell
cp .env.example .env
```
Contents of `.env`:
```env
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
```
> **Security Note**: No API keys are needed or exposed because Ollama executes entirely locally. Do not commit secrets.

### 5. Start the Backend
In a terminal, activate your virtual environment and start the FastAPI service:
```powershell
# Activate Python virtual environment
.\.venv\Scripts\Activate.ps1

# Start FastAPI on port 8000
npm run backend
# Or directly:
# uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```
Verify the backend and AI agent health:
- Swagger Docs: `http://127.0.0.1:8000/docs`
- AI Health Check: `http://127.0.0.1:8000/api/ai/health`

### 6. Start the Frontend
In another terminal, launch the Astro development server:
```powershell
npm run dev
```
Open **`http://localhost:4321`** in your browser.

---

* **Local AI Only**: The Ollama integration is explicitly designed as a local-first engineering copilot. The production Vercel frontend does not assume `localhost:11434` or `localhost:8000` exists on the remote hosting infrastructure.
* **Graceful Degradation**: If the dashboard is opened without the local backend or Ollama running:
  - The **AI AGENT** status cleanly displays **`Offline`**.
  - A non-intrusive status notice informs the user: *"Local AI unavailable — telemetry simulation continues."*
  - The underlying Mean-Value physics simulation, transducer telemetry, isometric 3D twin, and deterministic charts continue functioning with zero degradation or browser errors.
* **Model Availability Check**: If Ollama is running but the configured model is missing, the AI Agent displays **`Model unavailable`** and prints a helpful guide in the browser developer console indicating which model to pull.

---

## 🎙️ Voice Copilot Setup (ElevenLabs)

The AI ENGINE HEALTH COPILOT supports full **voice + text** interaction:

- 🎤 **Speech-to-Text** (STT): ElevenLabs `scribe_v2` — transcribes your spoken question
- 🤖 **Reasoning**: Local Ollama — generates the AI response grounded in live telemetry
- 🔊 **Text-to-Speech** (TTS): ElevenLabs `eleven_flash_v2_5` — reads the AI response aloud

### Architecture

```
User speaks → Browser mic
                 ↓
     Backend /api/voice/transcribe
                 ↓
    ElevenLabs STT (scribe_v2)
                 ↓
           Transcript text
                 ↓
       Backend /api/ai/chat
                 ↓
        Ollama llama3.2 + live telemetry
                 ↓
           AI response text
                 ↓
     Backend /api/voice/speak
                 ↓
  ElevenLabs TTS (eleven_flash_v2_5)
                 ↓
         Browser plays audio
```

### Step-by-Step Setup

**1. Create an ElevenLabs account**
- Go to [https://elevenlabs.io](https://elevenlabs.io) and create a free account.

**2. Get your API key**
- Navigate to **Profile → API Keys** or [https://elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)
- Create a new key with **restricted permissions** (Speech-to-Text + Text-to-Speech only)

**3. Choose a voice**
- Browse the Voice Library at [https://elevenlabs.io/app/voice-library](https://elevenlabs.io/app/voice-library)
- Copy the **Voice ID** of your preferred voice

**4. Configure your `.env` file**
```env
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
ELEVENLABS_STT_MODEL=scribe_v2
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
```

**5. Start the backend**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**6. Verify voice is ready**
- Open `http://localhost:4321`
- The Copilot panel should show a green **VOICE READY** badge
- The 🎤 mic button will be active

### How to Use Voice Mode

1. Click the 🎤 **mic button** → button turns red and pulses → **LISTENING...**
2. Speak your question clearly
3. Click the mic button again to stop recording → **TRANSCRIBING...**
4. Your transcript appears as a chat bubble
5. AI analyzes with live telemetry → **ANALYZING...**
6. AI response appears, audio plays automatically → **AI SPEAKING...**
7. Each AI response has a **SPEAK** / **STOP** button for replay

### Shared Context

Text and voice conversations share the **same conversation history**. You can type a question and follow up by voice — the AI maintains full context.

### Security

> [!CAUTION]
> **Never** put `ELEVENLABS_API_KEY` in frontend JavaScript, HTML, localStorage, or any public-facing location.
> The browser **only** calls `http://localhost:8000/api/voice/transcribe` and `http://localhost:8000/api/voice/speak`.
> The actual ElevenLabs API calls are made **exclusively from the backend**, keeping your API key completely private.

The `.env` file is listed in `.gitignore` and will never be committed to your repository.

### Graceful Degradation

| Condition | Result |
|-----------|--------|
| ElevenLabs not configured | Mic disabled, **VOICE OFFLINE** badge, text chat works normally |
| ElevenLabs STT fails | Error shown in chat, text chat unaffected |
| ElevenLabs TTS fails | AI text reply shown normally, no audio |
| Ollama offline | Error bubble in chat, both text and voice show AI offline |
| Mic permission denied | Error notice in chat window |

### Component Roles

| Component | Role |
|-----------|------|
| **ElevenLabs STT** | Converts your spoken audio to text |
| **ElevenLabs TTS** | Converts AI text response to speech |
| **Ollama (local)** | Conversational reasoning and explanation layer |
| **FDIR** | Deterministic fault detection rules (separate from Ollama) |
| **Digital Twin** | Physics engine simulation and telemetry source |

> **Engineering note**: Ollama is the *explanation* layer — it interprets detected conditions and provides recommendations in natural language. Fault detection is the responsibility of the deterministic FDIR rules engine and the trained ML models. Ollama is not certified for fault detection.

