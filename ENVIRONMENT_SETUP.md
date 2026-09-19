# AeroTwin Environment Setup & Developer Guide

## 1. Prerequisites

- **Node.js**: `v22.12.0` or higher (tested on Node `v24.20.0`).
- **Python**: `3.10+` (optional, for ML backend service).
- **Ollama**: (optional, for local LLM reasoning).
- **Modern Browser**: Chrome, Edge, Safari, or Firefox with Web Audio support.

---

## 2. Port Allocation Map

| Port | Service | Description |
| :--- | :--- | :--- |
| `4321` | Astro + REST / SSE Server | Main application dashboard, telemetry stream, and ElevenLabs voice proxy. |
| `8000` | FastAPI Backend | Python ML inference service (`backend/main.py`). |
| `11434` | Ollama Daemon | Local LLM inference server (`http://localhost:11434`). |

---

## 3. Quick Start (1-Minute Setup)

### Step 1: Clone and Install
```bash
git clone https://github.com/vikram-sharma-96/UAV-Engine-Digital-Twin.git
cd UAV-Engine-Digital-Twin
npm install
```

### Step 2: Configure Environment (Optional)
```bash
cp .env.example .env
```
Edit `.env` if you wish to configure your ElevenLabs API key:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```
*(If omitted, AeroTwin defaults to Web SpeechSynthesis without error).*

### Step 3: Start the Server
```bash
npm run server
```
Navigate your browser to: `http://localhost:4321`.

---

## 4. Setting Up Local Ollama (Optional)

To enable local LLM tool reasoning:
1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Pull the recommended model:
   ```bash
   ollama run llama3
   ```
3. Ensure the daemon is running on port 11434.
4. AeroTwin will automatically detect the server and route queries through `OllamaAgentProvider`.

---

## 5. Running the Test Suite

Execute all automated unit and integration tests:
```bash
npm run test
```
All 42 test suites across physics, aerodynamics, observer residuals, counterfactual isolation, ElevenLabs voice guards, and tool execution will execute synchronously.
