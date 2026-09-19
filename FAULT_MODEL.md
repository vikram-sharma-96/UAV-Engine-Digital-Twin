# AeroTwin AI — Fault Injection & Degradation Model Documentation

## 1. Overview

The AeroTwin AI fault injection framework simulates controlled anomalies with **progressive severity** ($0.0$ to $1.0$) rather than instantaneous binary failure states. This allows machine learning models to learn early warning signatures and degradation trajectories prior to catastrophic breakdown.

---

## 2. Supported Fault Modes

### 1. `INJECTOR_DEGRADATION`
* **Physical Mechanism**: Carbon build-up or solenoid delay on fuel injector nozzle (default: Cylinder #2).
* **Telemetry Signature**: 
  * Localized CHT increase on target cylinder due to lean burn ($\text{AFR} > 16.0$)
  * Specific fuel consumption deviation ($\Delta \text{Fuel} > 0.5\text{ L/h}$)
  * Mild RPM cyclic roughness
* **Severity Response**:
  * $0.2$ (Mild): $+8^\circ\text{C}$ CHT rise on cylinder 2
  * $0.5$ (Moderate): $+20^\circ\text{C}$ CHT rise, AFR shifts $+10\%$ lean
  * $1.0$ (Critical): Severe cylinder overtemperature ($>135^\circ\text{C}$), engine advisory alert

### 2. `MISFIRE`
* **Physical Mechanism**: Intermittent spark plug fouling or ignition coil breakdown.
* **Telemetry Signature**: Periodic combustion torque collapse, sudden drop in EGT on affected bank, high impulsive vibration spikes ($>2.5\text{ mm/s}$).
* **Severity Response**: Proportional to probability of missed power strokes ($0.0$ to $35\%$ of cycles).

### 3. `OVERHEATING`
* **Physical Mechanism**: Airflow restriction across cylinder cooling fins or debris blockage in oil/coolant radiator core.
* **Telemetry Signature**: Steady, monotonic growth in both CHT and Oil Temperature across tens of seconds. EGT remains normal.
* **Severity Response**: Reduces convective cooling coefficient $h_{cool}$ by up to $75\%$.

### 4. `LUBRICATION_DEGRADATION`
* **Physical Mechanism**: Oil pump gear cavitation, pressure relief valve spring relaxation, or thermal viscosity shear.
* **Telemetry Signature**: Oil pressure drops below $3.0\text{ bar}$ (down to $1.5\text{ bar}$ at critical severity), oil temperature trends upward due to increased journal friction.
* **Severity Response**: Reduces pump effective volumetric delivery by $(1 - 0.75 \times \text{severity})$.

### 5. `VIBRATION_FAULT`
* **Physical Mechanism**: Crankshaft main journal bearing micro-spalling or mechanical unbalance.
* **Telemetry Signature**: Dramatic spike in high-frequency RMS vibration velocity ($1.2\text{ mm/s} \to 5.1\text{ mm/s}$), while temperature and pressure remain initially stable.
* **Severity Response**: Exponential vibration growth ($V_{bearing} \propto \text{severity}^{1.5}$).

### 6. `SENSOR_DRIFT`
* **Physical Mechanism**: Thermocouple junction oxidation or ADC reference voltage drift.
* **Telemetry Signature**: Measured temperature or pressure drifts continuously ($+0.6^\circ\text{C/s}$), while the underlying true engine state remains completely nominal.
* **FDIR Distinction**: Digital twin observer detects residual drift without corresponding changes in thermodynamic power output.

### 7. `SENSOR_DROPOUT`
* **Physical Mechanism**: Wiring harness disconnection, transducer short circuit, or open-circuit failure.
* **Telemetry Signature**: Transducer value immediately drops to $0.0$, accompanied by open-circuit flag.

### 8. `COMBUSTION_INSTABILITY`
* **Physical Mechanism**: Cyclic combustion variability ($\text{COV}_{imep} > 8\%$) caused by poor fuel atomization or intake turbulence.
* **Telemetry Signature**: Stochastic torque fluctuation, irregular exhaust gas temperature variations, and elevated mid-spectrum vibration.

### 9. `AIR_FUEL_IMBALANCE`
* **Physical Mechanism**: Intake manifold gasket leak introducing unmetered bypass air.
* **Telemetry Signature**: Global lean shift across all cylinders; elevated EGT and CHT accompanied by reduced brake torque.

### 10. `PROGRESSIVE_DEGRADATION`
* **Physical Mechanism**: Natural cumulative wear over hundreds of operational flight hours (piston ring wear, valve seat recession, bearing clearance widening).
* **Telemetry Signature**: Gradual long-term loss of peak torque ($1-5\%$), slight increase in specific fuel consumption, and higher baseline vibration.
