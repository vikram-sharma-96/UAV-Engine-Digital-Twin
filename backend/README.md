# UAV Engine Digital Twin — Machine Learning Backend

Machine Learning fault detection backend service for the **AI Digital Twin for UAV Aero Piston Engines**.

Powered by **FastAPI** and **scikit-learn** (`RandomForestClassifier`), this service processes real-time UAV engine sensor telemetry and delivers multi-class fault classification with class probability distributions.

---

## 📁 Backend Architecture

```
backend/
├── main.py                  # FastAPI REST API application
├── requirements.txt         # Python dependencies
├── README.md                # Backend setup & API documentation
└── ml/
    ├── generate_dataset.py  # Realistic physics-based telemetry dataset generator
    ├── train_model.py       # Random Forest model training & evaluation pipeline
    ├── predict.py           # Model inference & probability distribution module
    ├── data/
    │   └── engine_telemetry_dataset.csv
    └── model/
        ├── engine_fault_model.pkl   # Serialized model artifact
        └── model_metadata.json      # Model metadata & evaluation metrics
```

---

## ⚙️ Setup & Installation

### 1. Create Virtual Environment

```bash
# Windows
python -m venv .venv

# Or using py launcher
py -m venv .venv
```

### 2. Activate Virtual Environment

```bash
# Windows (PowerShell / Command Prompt)
.venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

---

## 🧠 Dataset Generation & Model Training

### 1. Generate Synthetic Telemetry Dataset

Creates 10,000 realistic engine telemetry samples across 5 fault categories with physical cross-sensor correlations and controlled Gaussian noise:

```bash
python backend/ml/generate_dataset.py
```

### 2. Train Random Forest Classifier

Trains a stratified `RandomForestClassifier`, evaluates classification performance, prints accuracy and confusion matrix, and saves `engine_fault_model.pkl`:

```bash
python backend/ml/train_model.py
```

---

## 🚀 Start FastAPI Backend Server

```bash
# From workspace root:
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be live at:
- **Base URL**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

---

## 📡 API Endpoints

### 1. Health Check

**`GET /api/health`**

Response:
```json
{
  "status": "ok",
  "model_loaded": true,
  "classes": [
    "Bearing Degradation",
    "Low Oil Pressure",
    "Normal",
    "Overheating",
    "Performance Degradation"
  ]
}
```

---

### 2. Fault Prediction Inference

**`POST /api/predict`**

Request:
```json
{
  "rpm": 5200.0,
  "temperature": 78.0,
  "oil_pressure": 4.3,
  "vibration": 1.2,
  "fuel_flow": 2.7
}
```

Response:
```json
{
  "fault": "Normal",
  "confidence": 0.96,
  "probabilities": {
    "Normal": 0.96,
    "Overheating": 0.01,
    "Bearing Degradation": 0.01,
    "Low Oil Pressure": 0.01,
    "Performance Degradation": 0.01
  }
}
```

---

## 🧪 Testing the API via cURL / PowerShell

```powershell
# Test Normal Baseline
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -ContentType "application/json" -Body '{"rpm":5200,"temperature":78.0,"oil_pressure":4.3,"vibration":1.2,"fuel_flow":2.7}'

# Test Overheating Fault
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -ContentType "application/json" -Body '{"rpm":5280,"temperature":105.0,"oil_pressure":3.5,"vibration":1.8,"fuel_flow":3.4}'

# Test Bearing Degradation Fault
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -ContentType "application/json" -Body '{"rpm":4750,"temperature":89.0,"oil_pressure":3.2,"vibration":5.1,"fuel_flow":3.1}'

# Test Low Oil Pressure Fault
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -ContentType "application/json" -Body '{"rpm":4850,"temperature":92.0,"oil_pressure":2.3,"vibration":2.4,"fuel_flow":2.9}'

# Test Performance Degradation
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -ContentType "application/json" -Body '{"rpm":4620,"temperature":84.0,"oil_pressure":3.9,"vibration":2.1,"fuel_flow":3.65}'
```
