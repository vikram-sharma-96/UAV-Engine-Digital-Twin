"""
main.py
-------
FastAPI backend service for UAV Engine Digital Twin Real-Time Fault Detection.
Provides REST API endpoints for telemetry health check and ML fault inference.
"""

import os
import sys
from typing import Dict
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ml.predict import predictor

# ─── FastAPI Application ─────────────────────────────────────────────────────

app = FastAPI(
    title="UAV Engine Digital Twin - ML Fault Detection API",
    description="Real-Time Machine Learning Fault Prediction & Telemetry Classification API for UAV Aero Piston Engines.",
    version="1.0.0",
)

# ─── CORS Configuration ──────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4321",
        "http://127.0.0.1:4321",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request & Response Models ───────────────────────────────────────────────

class TelemetryInput(BaseModel):
    """Real-time engine sensor values received from UAV telemetry bus or simulator."""
    rpm: float = Field(..., description="Engine crankshaft speed in RPM (e.g. 5200)")
    temperature: float = Field(..., description="Cylinder head temperature CHT in °C (e.g. 78.0)")
    oil_pressure: float = Field(..., description="Crankcase lubrication oil pressure in bar (e.g. 4.3)")
    vibration: float = Field(..., description="3-axis RMS vibration velocity in mm/s (e.g. 1.2)")
    fuel_flow: float = Field(..., description="Fuel consumption flow rate in L/h (e.g. 2.7)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "rpm": 5200.0,
                "temperature": 78.0,
                "oil_pressure": 4.3,
                "vibration": 1.2,
                "fuel_flow": 2.7,
            }
        }
    }


class PredictionResponse(BaseModel):
    """Machine learning fault prediction and class probability distribution."""
    fault: str = Field(..., description="Predicted engine operating fault category")
    confidence: float = Field(..., description="Model class probability confidence score (0.0 to 1.0)")
    probabilities: Dict[str, float] = Field(..., description="Probability estimates for each fault class")


class HealthResponse(BaseModel):
    """Backend service and ML model health status."""
    status: str = Field(..., description="Service status ('ok')")
    model_loaded: bool = Field(..., description="Whether the ML model is initialized in memory")
    classes: list = Field(default_factory=list, description="Supported fault target classes")


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def get_health():
    """Health check endpoint to verify backend status and model readiness."""
    return {
        "status": "ok",
        "model_loaded": predictor.is_loaded(),
        "classes": predictor.classes if predictor.is_loaded() else [],
    }


@app.post(
    "/api/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Fault Inference"],
)
def predict_engine_fault(telemetry: TelemetryInput):
    """
    Predict engine fault condition from real-time sensor telemetry.

    Features:
    - rpm: Crankshaft speed (RPM)
    - temperature: Cylinder Head Temperature (°C)
    - oil_pressure: Lubrication Oil Pressure (bar)
    - vibration: 3-Axis RMS Vibration (mm/s)
    - fuel_flow: Fuel Consumption Flow Rate (L/h)
    """
    if not predictor.is_loaded():
        # Attempt just-in-time reload
        if not predictor.load_model():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ML Model is not loaded. Please train the model using 'python backend/ml/train_model.py' first.",
            )

    try:
        result = predictor.predict(
            rpm=telemetry.rpm,
            temperature=telemetry.temperature,
            oil_pressure=telemetry.oil_pressure,
            vibration=telemetry.vibration,
            fuel_flow=telemetry.fuel_flow,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
