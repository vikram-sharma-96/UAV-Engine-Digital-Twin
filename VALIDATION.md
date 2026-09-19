# AeroTwin AI — Engineering Validation & Physical Plausibility

## 1. Physical Plausibility Guarantees

The simulation engine enforces rigorous physical plausibility constraints at every evaluation step:

| Constraint | Physical Rationale | Software Enforcement |
| :--- | :--- | :--- |
| $\text{RPM} \ge 0$ | Rotational speed cannot be negative. | Clamped at minimum to idle speed ($1400\text{ RPM}$) during running regime. |
| $T > 0\text{ K}$ | Temperature cannot drop below absolute zero. | Lower bounded by ambient ISA temperature ($T \ge T_{amb} \ge 180\text{ K}$). |
| $P_{gauge} \ge 0$ | Absolute pressure in manifold and oil channels must remain strictly positive. | $\text{MAP} \ge 0.2\text{ bar}$, $P_{oil} \ge 0.2\text{ bar}$. |
| $\dot{m}_f \ge 0$ | Fuel consumption cannot be negative. | Lower bounded to $0.0\text{ kg/s}$. |
| $\text{NaN} / \infty$ Protection | Numerical overflow from division by zero. | Guarded angular velocity ($\omega > 10\text{ rad/s}$) and bounded matrix operations. |

---

## 2. Automated Test Results

The automated regression test suite (`tests/`) executes 21 validation checks across 11 suites via Node 24 native test runner:

```powershell
node --test tests/*.test.ts
```

### Verified Test Suites:
1. **Atmosphere Model (ISA Equations)**:
   * Sea level barometric pressure ($101,325\text{ Pa}$) and temperature ($288.15\text{ K}$).
   * Correct monotonic decrease in pressure and density with altitude.
2. **Intake and Combustion Model**:
   * Strict dimensional consistency ($P = \tau \cdot \omega$).
   * Airflow, MAP, and fuel consumption respond monotonically to throttle changes.
   * Fails safely against negative/invalid control inputs.
3. **Engine Rotational Dynamics**:
   * Engine decelerates when load torque exceeds brake torque; accelerates when brake torque exceeds load.
4. **Dynamic Thermal Model**:
   * Thermal inertia confirmed: temperatures transition smoothly over tens of seconds rather than leaping instantaneously.
5. **Lubrication and Vibration**:
   * Viscosity-temperature curve verified: hot oil lowers dynamic pressure.
   * Correlated vibration responds to shaft unbalance and bearing defect harmonics.
6. **Sensor Transducers**:
   * True state vs noisy measured telemetry separation confirmed.
   * Transducer drift accumulation verified.
   * Transducer open-circuit dropout verified.
7. **Fault Engine**:
   * Progressive severity scaling across fault modes ($0.0 \to 1.0$).
   * Multi-fault composability verified.
8. **Digital Twin Residuals**:
   * Baseline telemetry produces near-zero residuals and high health score ($>90\%$).
   * Anomaly states produce proportional residual growth and health score degradation.
9. **Counterfactual Simulation**:
   * Isolated sandbox execution verified: live engine state remains **100% unmutated** after forward prediction.
10. **PRNG Reproducibility**:
    * Deterministic identical sequences verified across runs with identical seeds.
11. **Synthetic Dataset Generator**:
    * Ground-truth labeling completeness and valid CSV formatting verified.
