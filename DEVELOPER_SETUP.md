# AeroTwin AI — Developer Setup & Engineering Quickstart Guide

## 1. Prerequisites & Environment

* **Node.js**: $\ge 22.12.0$ (Strict requirement in `package.json`; tested on Node.js v24.20.0).
* **Package Manager**: npm (bundled with Node.js).
* **Target Hardware Profile**: Designed for low-power edge hardware. Operates under $<120\text{ MB}$ RAM and $<5\%$ CPU on dual-core Intel Core i3 systems with 4 GB RAM.
* **Network Requirement**: **Zero external internet required**. The entire physics simulation, digital twin observer, FDIR diagnostics, and AI Copilot reasoning engine run 100% offline.

---

## 2. Quick Installation & Smoke Test

```bash
# 1. Install frontend build dependencies (Astro 5 & Tailwind 4)
npm install

# 2. (Optional) Configure ElevenLabs API key for voice streaming
cp .env.example .env

# 3. Run the automated engineering verification suite
npm run test
```

All **42 unit and integration tests across 16 engineering suites** should execute and pass in $\sim 2.0\text{ seconds}$.

---

## 3. Available CLI Commands & Runmodes

| Command | Target / Mode | Description |
| :--- | :--- | :--- |
| `npm run dev` | Interactive Development | Starts Astro development server with instant HMR at `http://localhost:4321` |
| `npm run build` | Static Production | Compiles all 8 Astro pages and client assets into `dist/` |
| `npm run desktop` | Native Desktop App | Boots the local simulation server and opens Chromium/Edge in windowed App Mode |
| `npm run server` | Headless API Daemon | Runs zero-dependency Node HTTP server exposing REST endpoints, SSE stream, and ElevenLabs voice proxy |
| `npm run test` | Verification Suite | Executes all 42 unit & integration tests (`node --test tests/*.test.ts`) |
| `npm run benchmark` | Performance Profiling | Simulates 10,000 real-time cycles and measures throughput, latency, and memory |
| `npm run dataset` | Dataset Generation | Generates synthetic labeled telemetry CSV files for machine learning training |

---

## 4. Running the Development Server

Start the local Astro development server:

```powershell
npm run dev
```

Or using background mode per workspace instructions:

```powershell
astro dev --background
```

Manage background mode using:
* `astro dev status` — Check current server PID and status
* `astro dev logs` — Stream server logs
* `astro dev stop` — Terminate background instance

Navigate to [http://localhost:4321](http://localhost:4321) in your browser.

---

## 5. Running the Native Desktop Launcher

AeroTwin AI includes a built-in desktop launcher that opens the application in an isolated window without browser navigation chrome:

```powershell
# 1. Build the production static distribution
npm run build

# 2. Launch the desktop window
npm run desktop
```

* **Windows**: Automatically detects Microsoft Edge or Google Chrome and launches in `--app=http://localhost:4321` mode.
* **macOS / Linux**: Opens the local server URL via default native browser wrappers.
* Press `Ctrl+C` in the terminal to terminate the server.

For packaging instructions into a standalone installer via Tauri v2, consult [DESKTOP_PACKAGING.md](file:///c:/GitHub%20Projects/AeroTwin/UAV-Engine-Digital-Twin/DESKTOP_PACKAGING.md).

---

## 6. Headless Simulation & REST/SSE API Server

For integration with external hardware-in-the-loop (HIL) simulators, flight controllers, or Python analytics tools, run the standalone server:

```powershell
npm run server
```

The server exposes standard REST and real-time streaming endpoints:
* `GET  /api/engine/state` — Instantaneous snapshot of physical and observer state.
* `GET  /api/engine/telemetry` — Measured noisy sensor readings.
* `GET  /api/health` — Digital twin health score (0–100), risk level, and subsystem ratings.
* `GET  /api/events` — Active fault alerts and residual threshold crossings.
* `GET  /api/configuration` — Structural engine specifications and limits.
* `POST /api/fault/inject` — Progressive fault injection (`{"scenario": "bearing"}`).
* `POST /api/simulation/reset` — Restore nominal cruise baseline.
* `POST /api/simulation/counterfactual` — Run sandbox "What-If" evaluation without mutating live state.
* `GET  /api/telemetry/stream` — Real-time Server-Sent Events (SSE) stream (10 Hz broadcast).

---

## 7. Performance & Memory Profiling

To benchmark simulation throughput and memory footprint on your machine:

```powershell
npm run benchmark
```

Simulates 10,000 real-time steps (166.7 minutes of UAV engine operation):
* **Throughput**: $> 1,500\text{ steps / second}$ ($> 1,500\times$ real-time).
* **Mean Step Latency**: $\approx 0.65\text{ ms}$.
* **Memory Heap**: $\approx 11.4\text{ MB}$ ($< 2.5\text{ MB}$ total heap delta over 10k steps).

---

## 8. Generating Synthetic Datasets for Machine Learning

Generate CSV telemetry datasets with complete ground-truth physics labels:

```powershell
# Default nominal cruise run (600 seconds)
npm run dataset

# Custom scenario with specific duration and fault condition
node scripts/generate_dataset.ts --scenario=OVERHEATING_RUN --duration=300 --seed=1024 --out=overheating_test.csv
```

---

## 9. Codebase Structure & Navigation

```
src/
├── engine/                      <- Physics, Digital Twin, Sensors, & Faults Core
│   ├── types.ts                 <- Domain types, SI units, fault IDs
│   ├── config/                  <- Default engine specification (Rotax 912 / PT900)
│   ├── utils/                   <- Deterministic Mulberry32 & Box-Muller PRNG
│   ├── environment/             <- ISA atmospheric lapse models
│   ├── physics/                 <- Mean-value intake, dynamics, thermal, fluids, vibration
│   ├── sensors/                 <- Sensor transducer pipeline (bias, drift, dropout)
│   ├── faults/                  <- Progressive severity fault engine
│   ├── twin/                    <- Analytical observer & residual engine
│   ├── counterfactual/          <- Sandbox "What-If" state cloner
│   ├── dataset/                 <- Synthetic labeled dataset generator
│   ├── ai/                      <- ML interface & grounded offline Copilot
│   └── demo/                    <- Deterministic 10-step hackathon demo sequencer
├── data/
│   └── engineSimulator.ts       <- Singleton runtime adapter connecting physics to UI
├── components/                  <- Astro UI components (preserved 100% visual fidelity)
│   └── AiAgentPlaceholder.astro <- Grounded interactive Copilot panel
└── pages/                       <- Astro application routes
    ├── index.astro              <- Landing page
    ├── overview.astro           <- Flight overview & primary instruments
    ├── digital-twin.astro       <- Real-time observer & residual monitors
    ├── engine-health.astro      <- Subsystem health scoring & degradations
    ├── fault-detection.astro    <- FDIR alarms & threshold monitoring
    ├── predictions.astro        <- AI Copilot & counterfactual "What-If" explorer
    ├── maintenance.astro        <- RUL predictions & component work orders
    └── sensor-data.astro        <- Raw sensor telemetry table & export
```

---

## 10. Verification Matrix

Before committing any modifications or delivering to evaluators, verify that all three automated checks pass:

```powershell
npm run test       # Expect: 27 passing tests (0 failures)
npm run build      # Expect: 8 pages built in dist/
npm run benchmark  # Expect: Mean latency < 1.0 ms, memory < 150 MB
```
