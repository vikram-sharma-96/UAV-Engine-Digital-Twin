# AeroTwin AI — Synthetic Dataset Generation Guide

## 1. Purpose

The Dataset Generator (`src/engine/dataset/datasetGenerator.ts`) allows developers and ML engineers to generate reproducible, high-density training datasets for:
1. Supervised fault classification (Random Forests, XGBoost, CatBoost)
2. Time-series anomaly detection (LSTM Autoencoders, Isolation Forests)
3. Remaining Useful Life (RUL) regression

---

## 2. Generating Datasets via Script

You can generate synthetic runs programmatically or via Node:

```ts
import { DatasetGenerator } from './src/engine/dataset/datasetGenerator.ts';

const result = DatasetGenerator.generateScenario({
  scenarioId: 'MISSION-RUN-001',
  name: 'Complete UAV Mission with Progressive Overheating',
  description: '60s nominal cruise followed by radiator blockage',
  duration_s: 120, // 2 minutes (120 samples @ 1 Hz)
  seed: 42, // Guarantees 100% reproducible noise & trajectory
  engineProfile: 'UAV-PT900-X1',
  degradationIndex: 0.15,
  faultsToInject: [
    {
      fault: {
        id: 'OVERHEATING',
        name: 'Radiator Obstruction',
        description: 'Partial airflow loss',
        severity: 0.75,
        targetSubsystem: 'COOLING',
      },
      start_s: 60,
      duration_s: 60,
    }
  ]
});

// Export to standard CSV format
const csvString = DatasetGenerator.toCSV(result.samples);
```

---

## 3. Ground Truth Labels in Dataset

Every row generated in the dataset contains both raw transducer signals and supervised training ground truth:

```csv
timestamp_s,flight_phase,altitude_m,measured_rpm,measured_cht_C,measured_oil_pressure_bar,res_cht,res_oil_pressure,primary_fault_label,fault_severity,degradation_index
0,CRUISE,2400,5198,78.1,4.28,-0.1,-0.02,NONE,0.0,0.15
1,CRUISE,2400,5204,78.2,4.31,0.0,0.01,NONE,0.0,0.15
...
61,CRUISE,2400,5215,82.4,4.22,4.2,-0.08,OVERHEATING,0.75,0.15
75,CRUISE,2400,5228,98.6,3.84,20.4,-0.46,OVERHEATING,0.75,0.15
```
