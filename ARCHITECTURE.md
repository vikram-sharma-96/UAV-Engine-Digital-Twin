# AeroTwin AI — System Architecture Documentation

## 1. High-Level Architectural Topology

AeroTwin AI is designed as a **local-first, modular digital twin system** for unmanned aerial vehicle (UAV) aero piston engines. It operates with zero mandatory cloud dependencies, capable of running either within an embedded desktop shell (Tauri / Electron) or directly in a local browser.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AEROTWIN LOCAL RUNTIME                                │
│                                                                                 │
│  ┌─────────────────────────┐          ┌──────────────────────────────────────┐  │
│  │   Operational Control   │          │         Environment Engine           │  │
│  │ Mission Profile Runner  │          │   ISA Atmosphere: P(h), T(h), rho    │  │
│  └───────────┬─────────────┘          └──────────────────┬───────────────────┘  │
│              │ Throttle, Load, Alt                       │ Density, Ambient P/T │
│              ▼                                           ▼                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     ENGINE PHYSICAL SIMULATOR                             │  │
│  │  - Manifold Absolute Pressure (MAP) & Volumetric Efficiency Aspiration   │  │
│  │  - Mean-Value Combustion, Indicated Torque & Brake Power                 │  │
│  │  - Rotational Crankshaft Dynamics & Propeller Absorption                 │  │
│  │  - Dynamic Thermal Balance (CHT, EGT, Oil Temp Inertia)                  │  │
│  │  - Hydrodynamic Lubrication & Pressure Relief Limiter                    │  │
│  │  - Correlated Harmonic & Impulsive Vibration Synthesis                   │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │ True Physical State (Unbiased)         │
│                                        ▼                                        │
│  ┌─────────────────────────┐          ┌──────────────────────────────────────┐  │
│  │   Fault Injection Fwk   │─────────▶│      Sensor Transducer Pipeline      │  │
│  │ 10 Fault Modes (0.0-1.0)│          │ Noise, Bias, Drift, Quantization,    │  │
│  └─────────────────────────┘          │ Dropout Open-Circuit Circuitry       │  │
│                                       └──────────────────┬───────────────────┘  │
│                                                          │ Measured Telemetry   │
│                                                          ▼                      │
│                                       ┌──────────────────────────────────────┐  │
│                                       │     DIGITAL TWIN RESIDUAL ENGINE     │  │
│                                       │  - Parallel Nominal State Observer   │  │
│                                       │  - Residual Vector: Delta = Meas - Exp│ │
│                                       │  - Transparent Health Score (0-100)  │  │
│                                       │  - Subsystem Degradation Breakdown   │  │
│                                       └──────────────────┬───────────────────┘  │
│                                                          │                      │
│             ┌────────────────────────────────────────────┼───────────────────┐  │
│             ▼                                            ▼                   ▼  │
│  ┌──────────────────────┐                     ┌────────────────────┐ ┌───────┴┐ │
│  │ Central State Store  │                     │ ML Model Interface │ │What-If │ │
│  │ & DOM Event Pipeline │                     │ (Mock / Real Model)│ │Counter-│ │
│  │ (engine-state-update)│                     └────────────────────┘ │factual │ │
│  └──────────┬───────────┘                                            └────────┘ │
└─────────────┼───────────────────────────────────────────────────────────────────┘
              │ Event-Driven State Streaming
              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION DASHBOARD                              │
│                                                                                 │
│  - Isometric SVG Engine Twin Viewer (Rotating Crank, Dynamic Flame Glow)        │
│  - Real-Time Flight Metric Cards (Health, RPM, CHT, OilP, Vibration, Fuel)       │
│  - High-Density SVG Telemetry Trend Charts (10-Minute Historical Buffer)         │
│  - FDIR Anomaly Classifier & Telemetry Evidence Matrix                          │
│  - Predictive Prognostics & RUL Estimator                                       │
│  - Maintenance Console, TBO Countdown & Airworthiness Logbook                   │
│  - Grounded AI Health Copilot Assistant                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Subsystem Boundaries

To satisfy Rule 5 of the master engineering specification, all subsystems are strictly decoupled:

| Subsystem | Primary Class / Interface | Responsibility | Dependencies |
| :--- | :--- | :--- | :--- |
| **Atmosphere** | `AtmosphereModel` | Computes altitude-dependent pressure, temperature, and air density. | None |
| **Physics Core** | `IntakeCombustionModel`, `EngineDynamicsModel`, `ThermalModel`, `LubricationModel`, `VibrationModel` | Calculates combustion heat release, indicated torque, rotational speed, heat transfer, and mechanical wear. | `AtmosphereModel`, `EngineConfig` |
| **Fault Engine** | `FaultEngine` | Maintains progressive severity state across 10 failure modes and generates physical modifiers. | None |
| **Sensor Model** | `SensorTransducerModel` | Applies transducer bias, drift, noise, and dropout to ground-truth states. | `PRNG` |
| **Digital Twin** | `DigitalTwinEngine` | Evaluates parallel nominal observer, computes residual vector, and calculates transparent health score. | None |
| **Mission Profile** | `MissionProfileRunner` | Sequentially steps through flight phases (Takeoff, Climb, Cruise, Loiter, etc.). | None |
| **Counterfactual** | `CounterfactualEngine` | Clones state into a sandbox and predicts "What-If" deviations without mutating live telemetry. | Physics models |
| **ML Interface** | `MLModelProvider`, `MockAIProvider` | Clean contract for anomaly detection, fault classification, and RUL estimation. | Domain types |
| **Dataset Generator** | `DatasetGenerator` | Deterministically exports labeled CSV/JSON time-series runs for offline model training. | All subsystems |

---

## 3. Real-Time Streaming & Central State Flow

1. Every $1.0\text{ s}$ (or at accelerated rates $10\times, 50\times, 100\times$ in training mode), `simulator.tick()` advances:
   * Atmospheric state at current altitude
   * Dynamic torque and rotational dynamics
   * Thermal integration ($C_{th} \frac{dT}{dt} = \dot{Q}_{in} - \dot{Q}_{loss}$)
   * Transducer measurement synthesis
   * Digital twin residual vector analysis
2. The synthesized state is broadcast to the presentation layer via:
   ```ts
   document.dispatchEvent(new CustomEvent('engine-state-update', { detail: state }));
   ```
3. UI components (`DigitalTwinViewer`, `MetricCards`, `TelemetryCharts`, etc.) listen to this event and update DOM elements without re-rendering unnecessary component trees.

---

## 4. Desktop & Local-First Execution

* **Memory Budget**: Target footprint is $<250\text{ MB}$ RAM, ensuring smooth operation on 4 GB Intel i3 development machines.
* **Storage**: In-memory ring buffer (default 30–600 historical samples). High-frequency telemetry is not permanently dumped to disk unless a dataset recording session is active.
* **Offline Guarantee**: The full engine physics simulator, digital twin observer, FDIR evidence rules, and mock ML inference require **zero internet connectivity**.
