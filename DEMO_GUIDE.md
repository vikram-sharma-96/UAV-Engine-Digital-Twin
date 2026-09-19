# AeroTwin AI Copilot - Demonstration & Presentation Guide

This guide outlines a step-by-step walkthrough for demonstrating the **AeroTwin UAV Engine Digital Twin with Voice Copilot** during hackathons, technical reviews, and engineering presentations.

---

## 1. Pre-Demo Checklist

1. **Verify Dev / Proxy Server**:
   ```bash
   npm run server
   ```
   Confirm console output:
   ```
   [AeroTwin Server] Listening on http://localhost:4321
   [AeroTwin Server] REST endpoints, SSE stream, Voice TTS proxy initialized.
   ```
2. **Audio Setup**:
   - Ensure your computer speakers / headphones are active and volume is set to ~50%.
   - Open browser at `http://localhost:4321`.
3. **Subsystem Verification**:
   - Click the gear icon (**Settings**) in the top navigation bar.
   - Verify that **Ollama API Host** and **Voice Provider** badges are illuminated.

---

## 2. 3-Minute Demo Walkthrough Script

### Step 1: Nominal Flight Telemetry
- Point to the live avionics dashboard: 5,400 RPM cruise, 142°C Cylinder Head Temperature (CHT), nominal oil pressure and vibration.
- Explain the **Digital Twin Observer**: analytical physics models calculate expected values, compare them with measured CAN-bus telemetry, and derive analytical residual vectors.

### Step 2: Voice Copilot Nominal Query
- Click the chip: **`"Why is engine health decreasing?"`** or click **`TALK`** and speak into the mic:
  > *"What is the current health index of the engine?"*
- **Observe**:
  - The voice state badge transitions to `⚙ Reasoning...` and then `🔊 Speaking (TTS)`.
  - The voice explains that current health is nominal (> 90%), RPM is cruise-stable, and all sensor residuals are within tolerance.
  - The avionics terminal prints the structured diagnostic breakdown: `[GROUNDED OBSERVATION]`, `[DIAGNOSTIC HYPOTHESIS]`, and `[RECOMMENDED ACTION]`.

### Step 3: Injecting an In-Flight Anomaly
- In the simulation controls, inject an anomaly:
  - Select **Bearing Anomaly** or **Overheating**.
  - Notice the vibration gauge spike to > 7.5 mm/s and health score drop to < 70%.
- Ask the Copilot:
  - Click chip: **`"What caused the vibration increase?"`**
- **Observe**:
  - The voice copilot immediately alerts:
    > *"Warning: Active fault detected: Bearing Degradation. Engine health is evaluated at 68 percent..."*
  - The terminal explains the root cause: Harmonic peaks in high-frequency FFT bins indicate outer-race bearing spall.
  - The recommended action specifies inspection within 5 flight hours.

### Step 4: Barge-in Demonstration
- While the copilot is speaking, click the red **`STOP`** button.
- **Observe**: The voice instantly cuts off, and the state badge returns to `AI Copilot Ready`.

### Step 5: Sandboxed Counterfactual "What-If" Simulation
- Ask:
  - Click chip: **`"Simulate 15% load increase"`**
- **Observe**:
  - The copilot invokes `run_counterfactual_simulation` inside an isolated sandbox clone.
  - The voice reports:
    > *"Counterfactual simulation complete. A 15 percent load increase produces a cylinder head temperature delta of +18.4 degrees Celsius..."*
  - Point out that **live engine RPM remained unaffected** during this hypothetical exploration.

---

## 3. Offline Demonstration Mode

If internet connectivity is restricted or unavailable during the demo:
- AeroTwin automatically falls back to browser `SpeechSynthesis` and local deterministic rule ensemble.
- No cloud calls are made.
- Telemetry, digital twin physics, fault classification, and voice feedback remain 100% operational.
