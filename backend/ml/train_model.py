"""
train_model.py
--------------
Trains a RandomForestClassifier on engine telemetry features to classify
fault conditions for the UAV Engine Digital Twin.

Artifacts saved:
- backend/ml/model/engine_fault_model.pkl (joblib serialized model)
- backend/ml/model/model_metadata.json (metadata, accuracy, feature order)
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Feature column contract
FEATURE_COLUMNS = [
    "rpm",
    "temperature",
    "oil_pressure",
    "vibration",
    "fuel_flow",
]

TARGET_COLUMN = "fault"


def load_or_generate_dataset(data_path: str) -> pd.DataFrame:
    """Load dataset or auto-generate if missing."""
    if not os.path.exists(data_path):
        print(f"Dataset not found at {data_path}. Generating dataset now...")
        from generate_dataset import main as gen_main
        gen_main()
    return pd.read_csv(data_path)


def train_engine_fault_model():
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, "data", "engine_telemetry_dataset.csv")
    model_dir = os.path.join(base_dir, "model")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "engine_fault_model.pkl")
    meta_path = os.path.join(model_dir, "model_metadata.json")

    print("=" * 65)
    print("UAV Engine Digital Twin - ML Model Training Pipeline")
    print("=" * 65)

    # 1. Load Dataset
    df = load_or_generate_dataset(data_path)
    print(f"Loaded dataset with {len(df)} records.")

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    classes = np.unique(y).tolist()
    print(f"Target classes ({len(classes)}): {classes}")

    # 2. Stratified Train/Test Split (80% Train, 20% Test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Training samples: {len(X_train)} | Test samples: {len(X_test)}")

    # 3. Train RandomForestClassifier
    print("\nTraining RandomForestClassifier...")
    rf_model = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    rf_model.fit(X_train, y_train)

    # 4. Evaluation
    y_pred = rf_model.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred))
    report = classification_report(y_test, y_pred, output_dict=True)
    cm = confusion_matrix(y_test, y_pred, labels=rf_model.classes_)

    print(f"\nModel Accuracy: {accuracy * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print("Confusion Matrix:")
    print(f"Classes: {list(rf_model.classes_)}")
    print(cm)

    # Feature Importance
    feature_importances = dict(
        zip(FEATURE_COLUMNS, [float(v) for v in rf_model.feature_importances_])
    )
    print("\nFeature Importances:")
    for feat, imp in sorted(feature_importances.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {feat:15s}: {imp * 100:.2f}%")

    # 5. Save Model & Preprocessing/Metadata
    model_payload = {
        "model": rf_model,
        "features": FEATURE_COLUMNS,
        "classes": list(rf_model.classes_),
        "version": "1.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    joblib.dump(model_payload, model_path)
    print(f"\nTrained model successfully saved to: {model_path}")

    # Metadata JSON
    metadata = {
        "model_type": "RandomForestClassifier",
        "n_estimators": 120,
        "features": FEATURE_COLUMNS,
        "classes": list(rf_model.classes_),
        "accuracy": accuracy,
        "feature_importances": feature_importances,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Model metadata saved to: {meta_path}")
    print("=" * 65)

    return accuracy


if __name__ == "__main__":
    train_engine_fault_model()
