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
