# AeroTwin AI — Engine Mathematical & Physical Model Documentation

> **Engineering Status**: Physics-Informed 0D/1D Mean-Value Engine Model (MVEM) & Real-Time Digital Twin State Observer.  
> **Fidelity Classification**: Representative prototype engineering simulation for health monitoring, fault injection, and synthetic ML dataset generation. *Not FAA/EASA certified OEM flight dynamics software.*

---

## 1. Dimensional Standard & Unit Discipline

All internal physics calculations strictly adhere to the International System of Units (SI):

| Dimension | SI Unit | Display / Aerospace Unit | Conversion |
| :--- | :--- | :--- | :--- |
| **Pressure** | Pascal ($\text{Pa}$) | $\text{bar}$ | $1\text{ bar} = 10^5\text{ Pa}$ |
| **Temperature** | Kelvin ($\text{K}$) | Celsius ($^\circ\text{C}$) | $T(^\circ\text{C}) = T(\text{K}) - 273.15$ |
| **Mass Flow Rate** | $\text{kg/s}$ | Liters per hour ($\text{L/h}$) | $\dot{V} = (\dot{m}_f / \rho_f) \times 3600$ |
| **Torque** | Newton-meter ($\text{N}\cdot\text{m}$) | $\text{N}\cdot\text{m}$ | $1:1$ |
| **Power** | Watt ($\text{W}$) | Kilowatt ($\text{kW}$), Horsepower ($\text{hp}$) | $1\text{ kW} = 1000\text{ W}$, $1\text{ hp} \approx 745.7\text{ W}$ |
| **Angular Velocity** | $\text{rad/s}$ | Revolutions per minute ($\text{RPM}$) | $\omega = \frac{2\pi \cdot \text{RPM}}{60}$ |
| **Vibration** | $\text{m/s}$ | $\text{mm/s}$ (RMS velocity) | $1\text{ mm/s} = 10^{-3}\text{ m/s}$ |

---

## 2. Atmospheric & Environmental Model (ISA)

### Equation 2.1: Temperature Lapse Rate
$$T(h) = T_0 - L \cdot h$$
* **Variables**:
  * $T(h)$: Ambient air temperature at altitude $h$ ($\text{K}$)
  * $T_0$: Sea-level standard temperature ($288.15\text{ K}$)
  * $L$: Tropospheric lapse rate ($0.0065\text{ K/m}$)
  * $h$: Geometric altitude above mean sea level ($\text{m}$)
* **Assumptions**: Dry air within the standard troposphere ($h \le 11,000\text{ m}$).
* **Approximation**: Neglects local micro-meteorological inversions.
* **Validity Range**: $-500\text{ m} \le h \le 11,000\text{ m}$.
* **Implementation**: `src/engine/environment/atmosphere.ts`
* **Test Case**: `tests/physics.test.ts` ("Atmosphere Model (ISA Equations)")

### Equation 2.2: Barometric Pressure
$$P(h) = P_0 \left(1 - \frac{L \cdot h}{T_0}\right)^{\frac{g_0 \cdot M}{R \cdot L}}$$
* **Variables**:
  * $P(h)$: Ambient static atmospheric pressure ($\text{Pa}$)
  * $P_0$: Standard sea-level pressure ($101,325\text{ Pa}$)
  * $g_0$: Gravitational acceleration ($9.80665\text{ m/s}^2$)
  * $M$: Molar mass of Earth's air ($0.0289644\text{ kg/mol}$)
  * $R$: Universal gas constant ($8.31446\text{ J/(mol}\cdot\text{K)}$)
  * Power exponent: $\frac{g_0 \cdot M}{R \cdot L} \approx 5.25588$
* **Implementation**: `src/engine/environment/atmosphere.ts`
* **Test Case**: `tests/physics.test.ts`

### Equation 2.3: Air Density (Ideal Gas Law)
$$\rho(h) = \frac{P(h)}{R_{specific} \cdot T(h)}$$
* **Variables**:
  * $\rho(h)$: Atmospheric air density ($\text{kg/m}^3$)
  * $R_{specific}$: Specific gas constant for dry air ($287.058\text{ J/(kg}\cdot\text{K)}$)
* **Implementation**: `src/engine/environment/atmosphere.ts`
* **Test Case**: `tests/physics.test.ts`

---

## 3. Intake Manifold & Combustion Model

### Equation 3.1: Manifold Absolute Pressure (MAP)
$$\text{MAP} = P_{amb} \left(r_{min} + (r_{max} - r_{min}) \cdot \theta^{0.85}\right)$$
* **Variables**:
  * $\text{MAP}$: Manifold Absolute Pressure ($\text{Pa}$)
  * $P_{amb}$: Ambient atmospheric pressure ($\text{Pa}$)
  * $\theta$: Throttle valve angle fraction $[0.0, 1.0]$
  * $r_{min}$: Idle throttle pressure ratio ($0.35$)
  * $r_{max}$: Wide-Open-Throttle pressure ratio ($0.98$) accounting for intake duct & filter delta $P$
* **Approximation**: Steady-state throttle plate discharge curve.
* **Implementation**: `src/engine/physics/intakeCombustion.ts`
* **Test Case**: `tests/physics.test.ts` ("increases MAP and airflow as throttle increases")

### Equation 3.2: Air Mass Flow Rate ($\dot{m}_a$)
$$\dot{m}_a = \left(\frac{\text{RPM}}{120}\right) \cdot V_d \cdot \rho_{manifold} \cdot \eta_v$$
* **Variables**:
  * $\dot{m}_a$: Intake mass air flow ($\text{kg/s}$)
  * $\text{RPM} / 120$: Number of intake induction cycles per second for a 4-stroke engine ($2\text{ revolutions per cycle} \times 60\text{ s/min}$)
  * $V_d$: Engine total displacement ($0.001211\text{ m}^3 = 1211\text{ cc}$)
  * $\rho_{manifold}$: Air density in intake plenum ($\text{kg/m}^3$)
  * $\eta_v$: Volumetric efficiency ($\sim 0.85 - 0.96$)
* **Implementation**: `src/engine/physics/intakeCombustion.ts`
* **Test Case**: `tests/physics.test.ts`

### Equation 3.3: Fuel Mass Flow & Chemical Heat Release
$$\dot{m}_f = \frac{\dot{m}_a}{\text{AFR}_{actual}}, \quad \dot{Q}_{comb} = \dot{m}_f \cdot \text{LHV} \cdot \eta_{comb}$$
* **Variables**:
  * $\dot{m}_f$: Fuel mass flow rate ($\text{kg/s}$)
  * $\text{AFR}_{actual}$: Effective air-fuel mass ratio (stoichiometric nominal $= 14.7$)
  * $\text{LHV}$: Fuel lower heating value ($43.5 \times 10^6\text{ J/kg}$ for Avgas 100LL)
  * $\eta_{comb}$: Combustion efficiency ($0.98$ nominal)
  * $\dot{Q}_{comb}$: Total chemical energy release rate ($\text{W}$)
* **Implementation**: `src/engine/physics/intakeCombustion.ts`
* **Test Case**: `tests/physics.test.ts`

---

## 4. Mechanical Power, Torque & Rotational Dynamics

### Equation 4.1: Indicated & Brake Torque
$$\tau_{ind} = \frac{\dot{Q}_{comb} \cdot \eta_{th}}{\omega}, \quad \tau_{brake} = \max(0, \tau_{ind} - \tau_{fric})$$
* **Variables**:
  * $\tau_{ind}$: Indicated combustion torque ($\text{N}\cdot\text{m}$)
  * $\omega$: Crankshaft angular velocity ($\text{rad/s}$), $\omega = \frac{2\pi \cdot \text{RPM}}{60}$
  * $\eta_{th}$: Thermal conversion efficiency ($\sim 0.36$)
  * $\tau_{fric}$: Friction & pumping losses ($\text{N}\cdot\text{m}$) modeled by Chen-Flynn formulation
* **Dimensional Proof**:
  $$[\text{W}] / [\text{rad/s}] = [\text{J/s}] / [\text{1/s}] = \text{J} = \text{N}\cdot\text{m}$$
* **Implementation**: `src/engine/physics/intakeCombustion.ts`
* **Test Case**: `tests/physics.test.ts` ("maintains dimensional consistency between power, torque, and angular velocity")

### Equation 4.2: Rotational Equation of Motion (Newton-Euler)
$$I_{total} \frac{d\omega}{dt} = \tau_{brake} - \tau_{prop}$$
$$\tau_{prop} = k_{prop} \cdot \rho_{air} \cdot \omega^2$$
* **Variables**:
  * $I_{total}$: Drivetrain polar moment of inertia ($0.085\text{ kg}\cdot\text{m}^2$)
  * $\tau_{prop}$: Opposing aerodynamic propeller load torque ($\text{N}\cdot\text{m}$)
  * $k_{prop}$: Propeller absorption coefficient ($m^5$)
* **Implementation**: `src/engine/physics/dynamics.ts`
* **Test Case**: `tests/physics.test.ts` ("Engine Rotational Dynamics")

---

## 5. Dynamic Thermal Model (Thermal Inertia)

### Equation 5.1: Cylinder Head Heat Balance
$$C_{th,cyl} \frac{dT_{CHT}}{dt} = \dot{Q}_{in,cyl} - h_{cool} \cdot A_{eff} \cdot (T_{CHT} - T_{amb})$$
* **Variables**:
  * $C_{th,cyl}$: Cylinder assembly lumped thermal capacitance ($1400\text{ J/K}$)
  * $\dot{Q}_{in,cyl}$: Thermal conduction from combustion flame ($\sim 14\%$ of $\dot{Q}_{comb}$)
  * $h_{cool}$: Convective heat transfer coefficient, scaling with airspeed and prop wash
  * $T_{amb}$: Ambient outside air temperature ($\text{K}$)
* **Physical Effect**: Prevents instant temperature leaps; yields realistic $25-45\text{s}$ thermal response times.
* **Implementation**: `src/engine/physics/thermal.ts`
* **Test Case**: `tests/physics.test.ts` ("Dynamic Thermal Model exhibits thermal inertia")

---

## 6. Lubrication & Oil Pressure Model

### Equation 6.1: Dynamic Oil Pressure
$$P_{oil} = \min\left(P_{relief}, \; P_{base}(\text{RPM}) \cdot \left(\frac{\mu(T_{oil})}{\mu_0}\right)^{0.4} \cdot \eta_{pump}\right)$$
* **Variables**:
  * $P_{oil}$: Dynamic oil pressure ($\text{Pa}$)
  * $P_{relief}$: Safety pressure relief valve limiter ($520,000\text{ Pa} = 5.2\text{ bar}$)
  * $\mu(T_{oil}) / \mu_0$: Dynamic viscosity ratio computed via Walther-ASTM temperature curve
  * $\eta_{pump}$: Oil pump volumetric health factor ($1.0$ nominal, $<0.5$ in degradation)
* **Implementation**: `src/engine/physics/lubrication.ts`
* **Test Case**: `tests/physics.test.ts` ("decreases oil pressure when oil temperature increases")

---

## 7. Physics-Correlated Vibration Synthesis

### Equation 7.1: RMS Vibration Signal
$$V_{RMS} = \sqrt{V_{1X}^2 + V_{2X}^2 + V_{bearing}^2 + V_{misfire}^2} + \mathcal{N}(0, \sigma)$$
* **Variables**:
  * $V_{1X}$: Crankshaft fundamental rotational unbalance $\propto (\text{RPM} / \text{RPM}_0)^{1.4}$
  * $V_{2X}$: 2nd harmonic combustion firing frequency for 4-cylinder 4-stroke engine
  * $V_{bearing}$: High-frequency ball-pass defect harmonic generated by bearing spalling
  * $V_{misfire}$: Low-frequency rocking torque asymmetry impulse
* **Implementation**: `src/engine/physics/vibration.ts`
* **Test Case**: `tests/physics.test.ts` ("correlates vibration with RPM and bearing defect states")

---

## 8. Sensor Transducer Pipeline

$$y_{measured} = \text{Quantize}\left(\text{Clamp}\left(y_{true} + \beta + \mathcal{N}(0, \sigma) + \int \delta_{drift} \, dt, \; y_{min}, \; y_{max}\right)\right)$$
* **Transducer Properties**:
  * $\beta$: Static calibration offset / bias
  * $\sigma$: Additive Gaussian white noise standard deviation
  * $\delta_{drift}$: Cumulative transducer drift per second
  * Dropout flag: $y_{measured} = 0.0$ when transducer connection is severed
* **Implementation**: `src/engine/sensors/sensorTransducer.ts`
* **Test Case**: `tests/sensors_and_faults.test.ts` ("separates true state from noisy measured state")

---

## 9. Digital Twin Residual Vector

$$\mathbf{R} = \mathbf{y}_{measured} - \mathbf{y}_{expected}$$
$$r_i = \frac{|y_{measured, i} - y_{expected, i}|}{3\sigma_i}$$
* **Residual Channels**:
  1. $\Delta \text{RPM} = \text{RPM}_{meas} - \text{RPM}_{exp}$
  2. $\Delta \text{CHT} = \text{CHT}_{meas} - \text{CHT}_{exp}$
  3. $\Delta \text{EGT} = \text{EGT}_{meas} - \text{EGT}_{exp}$
  4. $\Delta P_{oil} = P_{oil, meas} - P_{oil, exp}$
  5. $\Delta T_{oil} = T_{oil, meas} - T_{oil, exp}$
  6. $\Delta \text{Vib} = \text{Vib}_{meas} - \text{Vib}_{exp}$
  7. $\Delta \dot{V}_{fuel} = \dot{V}_{meas} - \dot{V}_{exp}$
* **Health Score Formulation**:
  $$\text{Health Index} = 100 \cdot \left(1 - \sum w_i \cdot \min(1.0, \text{Penalty}_i)\right)$$
* **Implementation**: `src/engine/twin/digitalTwinEngine.ts`
* **Test Case**: `tests/digital_twin_and_counterfactual.test.ts`
