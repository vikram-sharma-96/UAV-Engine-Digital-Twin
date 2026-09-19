# AeroTwin AI — Telemetry Schema & Transducer Data Dictionary

This document defines the complete telemetry data contract broadcast by the engine simulator and ingested by the digital twin, UI, and external ML models.

---

## 1. Measured Telemetry Channels

Transducer readings measured from the simulated UAV avionics sensor bus (1.0 Mbps CAN-Bus / MIL-STD-1553B compliant):

| Field | Data Type | Physical Unit | Display Range | Nominal Cruise | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `timestamp_ms` | `integer` | milliseconds | Monotonic $\ge 0$ | — | System time since engine power-on. |
| `rpm` | `integer` | $\text{RPM}$ | $0 - 6500$ | $4800 - 5500$ | Crankshaft rotational speed measured by reluctor sensor. |
| `manifoldPressure_bar` | `float` | $\text{bar}$ | $0.2 - 2.5$ | $0.90 - 1.05$ | Manifold Absolute Pressure (MAP) downstream of throttle. |
| `fuelFlow_L_h` | `float` | $\text{L/h}$ | $0.0 - 30.0$ | $2.4 - 3.2$ | Volumetric fuel consumption from turbine flowmeter. |
| `cht_C` | `float` | $^\circ\text{C}$ | $-40 - 200$ | $70 - 85$ | Mean Cylinder Head Temperature (thermocouple). Limit $<95^\circ\text{C}$. |
| `egt_C` | `integer` | $^\circ\text{C}$ | $0 - 1000$ | $600 - 680$ | Exhaust Gas Temperature measured in exhaust manifold. |
| `oilPressure_bar` | `float` | $\text{bar}$ | $0.0 - 7.0$ | $3.8 - 5.0$ | Oil pump circuit pressure. Minimum safe limit $2.0\text{ bar}$. |
| `oilTemperature_C` | `float` | $^\circ\text{C}$ | $-20 - 150$ | $75 - 88$ | Oil sump temperature (Pt100 RTD). |
| `vibration_mm_s` | `float` | $\text{mm/s}$ | $0.0 - 20.0$ | $0.8 - 1.6$ | Tri-axial accelerometer RMS vibration velocity. |
| `alternatorVoltage_V` | `float` | $\text{V}$ | $10.0 - 16.0$ | $13.8 - 14.4$ | Avionics 14V regulated bus voltage. |
| `throttle_pct` | `integer` | $\%$ | $0 - 100$ | $70 - 85$ | Throttle position feedback transducer. |
| `engineLoad_pct` | `integer` | $\%$ | $0 - 100$ | $75 - 85$ | Effective brake torque output relative to nominal rating. |
| `altitude_m` | `integer` | $\text{m}$ | $-500 - 10000$ | $2400$ | Barometric pressure altitude above mean sea level. |
| `ambientTemp_C` | `float` | $^\circ\text{C}$ | $-50 - 50$ | $-0.6$ | Outside Ambient Air Temperature (OAT). |
| `airDensity_kg_per_m3`| `float` | $\text{kg/m}^3$| $0.2 - 1.5$ | $0.95$ | Calculated ambient air density ($\rho = P / RT$). |
| `torque_Nm` | `float` | $\text{N}\cdot\text{m}$| $0.0 - 140.0$ | $110 - 120$ | Estimated mechanical crankshaft brake torque. |
| `power_kW` | `float` | $\text{kW}$ | $0.0 - 80.0$ | $60.0 - 65.0$ | Mechanical brake power ($P = \tau \cdot \omega$). |

---

## 2. Digital Twin Residual Channels

Residuals reflect the delta between measured telemetry and expected physics observer states ($\Delta = \text{Measured} - \text{Expected}$):

| Residual Field | Unit | Normal Threshold | Critical Anomaly Threshold |
| :--- | :--- | :--- | :--- |
| `rpmResidual` | $\text{RPM}$ | $|\Delta| < 150$ | $|\Delta| > 500$ |
| `chtResidual` | $^\circ\text{C}$ | $|\Delta| < 8.0$ | $\Delta > +20.0$ |
| `egtResidual` | $^\circ\text{C}$ | $|\Delta| < 35$ | $|\Delta| > 80$ |
| `oilPressureResidual`| $\text{bar}$ | $|\Delta| < 0.4$ | $\Delta < -1.5$ |
| `oilTempResidual` | $^\circ\text{C}$ | $|\Delta| < 6.0$ | $\Delta > +18.0$ |
| `vibrationResidual` | $\text{mm/s}$ | $\Delta < +0.5$ | $\Delta > +2.0$ |
| `fuelFlowResidual` | $\text{L/h}$ | $|\Delta| < 0.35$ | $|\Delta| > 1.0$ |
| `normalizedResidualScore`| unitless | $< 0.25$ | $> 0.70$ |
