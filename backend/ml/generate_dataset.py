"""
generate_dataset.py
-------------------
Generates a realistic synthetic telemetry dataset for UAV Aero Piston Engine
fault detection and classification.

Features:
- rpm (Engine crankshaft speed, RPM)
- temperature (Cylinder head temperature CHT, °C)
- oil_pressure (Crankcase lubrication pressure, bar)
- vibration (3-axis RMS piezoelectric vibration, mm/s)
- fuel_flow (Turbine fuel consumption, L/h)

Target:
- fault (Normal, Overheating, Bearing Degradation, Low Oil Pressure, Performance Degradation)
"""

import os
import numpy as np
import pandas as pd

# Set random seed for reproducibility
np.random.seed(42)

CLASSES = [
    "Normal",
    "Overheating",
    "Bearing Degradation",
    "Low Oil Pressure",
    "Performance Degradation",
]

SAMPLES_PER_CLASS = 2000


def generate_normal_samples(n: int) -> pd.DataFrame:
    """Nominal cruise flight regime baseline telemetry."""
    rpm = np.random.normal(loc=5200, scale=45, size=n)
    temperature = np.random.normal(loc=78.0, scale=2.0, size=n)
    oil_pressure = np.random.normal(loc=4.30, scale=0.10, size=n)
    vibration = np.random.normal(loc=1.20, scale=0.12, size=n)
    fuel_flow = np.random.normal(loc=2.70, scale=0.08, size=n)

    # Physical bounds clamping
    rpm = np.clip(rpm, 5050, 5350)
    temperature = np.clip(temperature, 72.0, 83.0)
    oil_pressure = np.clip(oil_pressure, 4.0, 4.6)
    vibration = np.clip(vibration, 0.8, 1.5)
    fuel_flow = np.clip(fuel_flow, 2.45, 2.95)

    return pd.DataFrame({
        "rpm": np.round(rpm, 1),
        "temperature": np.round(temperature, 1),
        "oil_pressure": np.round(oil_pressure, 2),
        "vibration": np.round(vibration, 2),
        "fuel_flow": np.round(fuel_flow, 2),
        "fault": "Normal",
    })


def generate_overheating_samples(n: int) -> pd.DataFrame:
    """Overheating scenario: CHT rises significantly, oil thins slightly."""
    # Temperature is the dominant feature (> 95°C)
    temperature = np.random.normal(loc=105.0, scale=4.5, size=n)
    # Slight thermal expansion rpm changes
    rpm = np.random.normal(loc=5270, scale=55, size=n)
    # Oil viscosity drops at high temperature -> lower pressure
    oil_pressure = 4.30 - (temperature - 78.0) * 0.026 + np.random.normal(0, 0.08, size=n)
    # Elevated thermal vibration
    vibration = 1.20 + (temperature - 78.0) * 0.022 + np.random.normal(0, 0.12, size=n)
    # Fuel flow increases due to ECU thermal enrichment
    fuel_flow = 2.70 + (temperature - 78.0) * 0.025 + np.random.normal(0, 0.10, size=n)

    rpm = np.clip(rpm, 5100, 5450)
    temperature = np.clip(temperature, 95.5, 122.0)
    oil_pressure = np.clip(oil_pressure, 3.1, 3.85)
    vibration = np.clip(vibration, 1.4, 2.3)
    fuel_flow = np.clip(fuel_flow, 3.0, 3.8)

    return pd.DataFrame({
        "rpm": np.round(rpm, 1),
        "temperature": np.round(temperature, 1),
        "oil_pressure": np.round(oil_pressure, 2),
        "vibration": np.round(vibration, 2),
        "fuel_flow": np.round(fuel_flow, 2),
        "fault": "Overheating",
    })


def generate_bearing_samples(n: int) -> pd.DataFrame:
    """Bearing Degradation: Harmonic vibration jumps strongly (> 3.5 mm/s), mechanical drag."""
    # Vibration is the dominant feature
    vibration = np.random.normal(loc=5.10, scale=0.65, size=n)
    # Mechanical friction causes RPM drop and instability
    rpm = np.random.normal(loc=4750, scale=85, size=n) - (vibration - 1.2) * 25
    # Friction heat in crankcase
    temperature = np.random.normal(loc=88.5, scale=2.8, size=n)
    # Bearing gap clearance leakage
    oil_pressure = np.random.normal(loc=3.25, scale=0.18, size=n)
    fuel_flow = np.random.normal(loc=3.10, scale=0.14, size=n)

    rpm = np.clip(rpm, 4450, 4980)
    temperature = np.clip(temperature, 82.0, 95.0)
    oil_pressure = np.clip(oil_pressure, 2.7, 3.65)
    vibration = np.clip(vibration, 3.7, 7.2)
    fuel_flow = np.clip(fuel_flow, 2.7, 3.5)

    return pd.DataFrame({
        "rpm": np.round(rpm, 1),
        "temperature": np.round(temperature, 1),
        "oil_pressure": np.round(oil_pressure, 2),
        "vibration": np.round(vibration, 2),
        "fuel_flow": np.round(fuel_flow, 2),
        "fault": "Bearing Degradation",
    })


def generate_low_oil_pressure_samples(n: int) -> pd.DataFrame:
    """Low Oil Pressure: Pressure severely reduced (< 2.6 bar), moderate temp/vib rise."""
    # Oil pressure is the dominant feature
    oil_pressure = np.random.normal(loc=2.35, scale=0.20, size=n)
    # Reduced lubrication causes temperature rise
    temperature = 78.0 + (4.3 - oil_pressure) * 7.2 + np.random.normal(0, 2.0, size=n)
    # Increased metal friction vibration
    vibration = 1.20 + (4.3 - oil_pressure) * 0.65 + np.random.normal(0, 0.15, size=n)
    rpm = np.random.normal(loc=4850, scale=70, size=n)
    fuel_flow = np.random.normal(loc=2.90, scale=0.12, size=n)

    rpm = np.clip(rpm, 4600, 5100)
    temperature = np.clip(temperature, 85.0, 102.0)
    oil_pressure = np.clip(oil_pressure, 1.4, 2.65)
    vibration = np.clip(vibration, 1.8, 3.2)
    fuel_flow = np.clip(fuel_flow, 2.5, 3.3)

    return pd.DataFrame({
        "rpm": np.round(rpm, 1),
        "temperature": np.round(temperature, 1),
        "oil_pressure": np.round(oil_pressure, 2),
        "vibration": np.round(vibration, 2),
        "fuel_flow": np.round(fuel_flow, 2),
        "fault": "Low Oil Pressure",
    })


def generate_degradation_samples(n: int) -> pd.DataFrame:
    """Performance Degradation: Power loss (low RPM), high fuel consumption (poor burn)."""
    # RPM drop is prominent
    rpm = np.random.normal(loc=4650, scale=80, size=n)
    # Inefficient combustion leads to high fuel consumption
    fuel_flow = np.random.normal(loc=3.65, scale=0.20, size=n)
    temperature = np.random.normal(loc=84.0, scale=2.5, size=n)
    oil_pressure = np.random.normal(loc=3.90, scale=0.15, size=n)
    vibration = np.random.normal(loc=2.10, scale=0.18, size=n)

    rpm = np.clip(rpm, 4350, 4850)
    temperature = np.clip(temperature, 78.0, 90.0)
    oil_pressure = np.clip(oil_pressure, 3.4, 4.25)
    vibration = np.clip(vibration, 1.6, 2.6)
    fuel_flow = np.clip(fuel_flow, 3.2, 4.2)

    return pd.DataFrame({
        "rpm": np.round(rpm, 1),
        "temperature": np.round(temperature, 1),
        "oil_pressure": np.round(oil_pressure, 2),
        "vibration": np.round(vibration, 2),
        "fuel_flow": np.round(fuel_flow, 2),
        "fault": "Performance Degradation",
    })


def main():
    print("=" * 60)
    print("UAV Engine Digital Twin - Synthetic Dataset Generator")
    print("=" * 60)

    dfs = [
        generate_normal_samples(SAMPLES_PER_CLASS),
        generate_overheating_samples(SAMPLES_PER_CLASS),
        generate_bearing_samples(SAMPLES_PER_CLASS),
        generate_low_oil_pressure_samples(SAMPLES_PER_CLASS),
        generate_degradation_samples(SAMPLES_PER_CLASS),
    ]

    dataset = pd.concat(dfs, ignore_index=True)
    # Shuffle rows
    dataset = dataset.sample(frac=1.0, random_state=42).reset_index(drop=True)

    # Ensure output directory exists
    output_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "engine_telemetry_dataset.csv")

    dataset.to_csv(output_path, index=False)

    print(f"Generated {len(dataset)} telemetry samples across {len(CLASSES)} classes.")
    print(f"Dataset saved to: {output_path}")
    print("\nClass distribution:")
    print(dataset["fault"].value_counts())
    print("\nSample preview:")
    print(dataset.head(8))
    print("=" * 60)


if __name__ == "__main__":
    main()
