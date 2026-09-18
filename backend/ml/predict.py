"""
predict.py
----------
Inference module for UAV Engine Fault Detection. Loads the trained
RandomForestClassifier and computes class predictions and probability distributions.
"""

import os
import joblib
import pandas as pd
from typing import Dict, Any, Optional

FEATURE_COLUMNS = [
    "rpm",
    "temperature",
    "oil_pressure",
    "vibration",
    "fuel_flow",
]


class EngineFaultPredictor:
    """Predictor service wrapping the trained RandomForest fault classifier."""

    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            base_dir = os.path.dirname(__file__)
            model_path = os.path.join(base_dir, "model", "engine_fault_model.pkl")

        self.model_path = model_path
        self.model = None
        self.classes = []
        self.features = FEATURE_COLUMNS
        self.load_model()

    def load_model(self) -> bool:
        """Load joblib model from disk."""
        if not os.path.exists(self.model_path):
            return False

        try:
            payload = joblib.load(self.model_path)
            if isinstance(payload, dict) and "model" in payload:
                self.model = payload["model"]
                self.classes = payload.get("classes", list(self.model.classes_))
                self.features = payload.get("features", FEATURE_COLUMNS)
            else:
                self.model = payload
                self.classes = list(self.model.classes_)
            return True
        except Exception as e:
            print(f"Error loading model from {self.model_path}: {e}")
            return False

    def is_loaded(self) -> bool:
        """Check if model is loaded and ready for inference."""
        return self.model is not None

    def predict(
        self,
        rpm: float,
        temperature: float,
        oil_pressure: float,
        vibration: float,
        fuel_flow: float,
    ) -> Dict[str, Any]:
        """
        Run inference on sensor telemetry readings.

        Returns:
            dict containing:
            - fault: predicted class label (str)
            - confidence: class probability of predicted class (float rounded to 4 decimals)
            - probabilities: dictionary mapping all fault classes to their probability (dict[str, float])
        """
        if not self.is_loaded():
            if not self.load_model():
                raise RuntimeError(
                    f"Model not loaded. Please ensure '{self.model_path}' exists by running train_model.py."
                )

        # Construct single-row DataFrame with validated column order
        input_data = pd.DataFrame([{
            "rpm": float(rpm),
            "temperature": float(temperature),
            "oil_pressure": float(oil_pressure),
            "vibration": float(vibration),
            "fuel_flow": float(fuel_flow),
        }])[self.features]

        # Class prediction & probability distribution
        predicted_class = str(self.model.predict(input_data)[0])
        proba_array = self.model.predict_proba(input_data)[0]

        # Map classes to probability floats
        probabilities: Dict[str, float] = {}
        for cls_name, prob in zip(self.model.classes_, proba_array):
            probabilities[str(cls_name)] = round(float(prob), 4)

        # Confidence is the probability of the predicted class
        confidence = probabilities.get(predicted_class, round(float(max(proba_array)), 4))

        return {
            "fault": predicted_class,
            "confidence": confidence,
            "probabilities": probabilities,
        }


# Global singleton predictor instance
predictor = EngineFaultPredictor()


def predict_fault(
    rpm: float,
    temperature: float,
    oil_pressure: float,
    vibration: float,
    fuel_flow: float,
) -> Dict[str, Any]:
    """Convenience helper function for module-level prediction."""
    return predictor.predict(
        rpm=rpm,
        temperature=temperature,
        oil_pressure=oil_pressure,
        vibration=vibration,
        fuel_flow=fuel_flow,
    )
