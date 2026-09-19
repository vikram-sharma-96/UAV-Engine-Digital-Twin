"""
main.py
-------
FastAPI backend service for UAV Engine Digital Twin Real-Time Fault Detection.
Provides REST API endpoints for telemetry health check and ML fault inference.
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel, Field

# Load environment variables from .env if present
load_dotenv()

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ml.predict import predictor

# ─── Ollama Configuration ───────────────────────────────────────────────────

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# ─── ElevenLabs Configuration ────────────────────────────────────────────────

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
ELEVENLABS_STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")
ELEVENLABS_TTS_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io"

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
@app.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
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


# ─── Local AI Agent (Ollama) Request & Response Models ───────────────────────

class AITelemetryInput(BaseModel):
    """Real-time engine sensor telemetry snapshot for Local AI Agent diagnosis."""
    engineTemp: Optional[float] = Field(None, description="Engine cylinder head temperature in °C")
    rpm: Optional[float] = Field(None, description="Engine crankshaft speed in RPM")
    oilPressure: Optional[float] = Field(None, description="Lubrication oil pressure in bar")
    vibration: Optional[float] = Field(None, description="3-axis RMS vibration velocity in mm/s")
    propSpeed: Optional[float] = Field(None, description="Propeller speed in RPM")
    cylinderHeadTemp: Optional[float] = Field(None, description="Cylinder head temperature in °C")
    fuelFlow: Optional[float] = Field(None, description="Fuel flow rate in L/h")

    # Snake-case aliases for interoperability
    temperature: Optional[float] = None
    oil_pressure: Optional[float] = None
    prop_speed: Optional[float] = None
    fuel_flow: Optional[float] = None

    def get_normalized_dict(self) -> Dict[str, Any]:
        cht = (
            self.cylinderHeadTemp
            if self.cylinderHeadTemp is not None
            else (self.engineTemp if self.engineTemp is not None else self.temperature)
        )
        rpm_val = (
            self.rpm
            if self.rpm is not None
            else (self.propSpeed if self.propSpeed is not None else self.prop_speed)
        )
        oil_p = (
            self.oilPressure
            if self.oilPressure is not None
            else self.oil_pressure
        )
        vib = self.vibration
        prop = (
            self.propSpeed
            if self.propSpeed is not None
            else (self.prop_speed if self.prop_speed is not None else rpm_val)
        )
        fuel = (
            self.fuelFlow
            if self.fuelFlow is not None
            else self.fuel_flow
        )

        return {
            "engineTemp": round(cht, 1) if cht is not None else 78.0,
            "rpm": round(rpm_val, 0) if rpm_val is not None else 5200.0,
            "oilPressure": round(oil_p, 2) if oil_p is not None else 4.3,
            "vibration": round(vib, 2) if vib is not None else 0.8,
            "propSpeed": round(prop, 0) if prop is not None else 5200.0,
            "cylinderHeadTemp": round(cht, 1) if cht is not None else 78.0,
            "fuelFlow": round(fuel, 2) if fuel is not None else 2.7,
        }


class AIAnalysisResponse(BaseModel):
    """Structured engine diagnostic response from Local Ollama AI Agent."""
    status: str = Field(..., description="NORMAL | WARNING | CRITICAL")
    fault_detected: bool = Field(..., description="Whether a fault or anomaly was detected")
    fault_type: str = Field(
        ...,
        description="NONE | OVERHEATING | LOW_OIL_PRESSURE | HIGH_VIBRATION | OVERSPEED | MULTIPLE",
    )
    severity: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    confidence: float = Field(..., description="AI diagnostic confidence percentage (0 to 100)")
    summary: str = Field(..., description="Short diagnostic summary")
    recommended_action: str = Field(..., description="Short recommended maintenance action")
    affected_parameters: List[str] = Field(
        default_factory=list,
        description="Parameters deviating from nominal bounds with actual values",
    )
    reasoning: str = Field(..., description="Short engineering explanation")
    model: str = Field(default="", description="Ollama model used for analysis")
    timestamp: str = Field(default="", description="ISO timestamp of analysis")
    telemetry: Optional[Dict[str, Any]] = Field(
        default=None, description="Actual telemetry values analyzed"
    )


class AIHealthResponse(BaseModel):
    """Health status and model availability of local Ollama service."""
    status: str = Field(..., description="ONLINE | OFFLINE | MODEL_UNAVAILABLE")
    ollama_connected: bool = Field(..., description="Whether local Ollama instance is reachable")
    model_installed: bool = Field(..., description="Whether configured OLLAMA_MODEL is available locally")
    model: str = Field(..., description="Active configured model name")
    available_models: List[str] = Field(
        default_factory=list, description="Locally pulled models in Ollama"
    )
    message: str = Field(..., description="Status summary message")


# ─── System Prompt ────────────────────────────────────────────────────────────

AI_SYSTEM_PROMPT = (
    "You are the local AI diagnostic agent for a UAV Aero Piston Engine Digital Twin.\n\n"
    "Your job is to analyze engine telemetry, identify abnormal conditions, determine possible fault categories, assess severity, and provide concise maintenance recommendations.\n\n"
    "You are assisting an engineering dashboard, not replacing a certified aviation diagnostic system.\n\n"
    "Analyze only the telemetry provided.\n\n"
    "Return ONLY valid JSON using this structure:\n\n"
    "{\n"
    '  "status": "NORMAL | WARNING | CRITICAL",\n'
    '  "fault_detected": true,\n'
    '  "fault_type": "NONE | OVERHEATING | LOW_OIL_PRESSURE | HIGH_VIBRATION | OVERSPEED | MULTIPLE",\n'
    '  "severity": "LOW | MEDIUM | HIGH | CRITICAL",\n'
    '  "confidence": 0,\n'
    '  "summary": "short diagnostic summary",\n'
    '  "recommended_action": "short recommended action",\n'
    '  "affected_parameters": [],\n'
    '  "reasoning": "short engineering explanation"\n'
    "}\n\n"
    "Do not invent sensor values.\n"
    "Do not claim certainty when the telemetry does not support it.\n"
    "Keep the response concise."
)


# ─── Local AI Agent Endpoints ────────────────────────────────────────────────

@app.get("/api/ai/health", response_model=AIHealthResponse, tags=["Local AI Agent"])
async def get_ai_health():
    """
    Lightweight health check against the local Ollama service.
    Verifies if Ollama is reachable and whether the configured model is installed.
    """
    configured_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            if resp.status_code != 200:
                return AIHealthResponse(
                    status="OFFLINE",
                    ollama_connected=False,
                    model_installed=False,
                    model=configured_model,
                    available_models=[],
                    message=f"Local AI unavailable — Ollama returned HTTP {resp.status_code}.",
                )

            data = resp.json()
            models_list = [m.get("name", "") for m in data.get("models", [])]

            # Check if model exists (exact match, prefix, or tag variations)
            def match_model(target: str, candidate: str) -> bool:
                if target == candidate:
                    return True
                target_base = target.split(":")[0]
                candidate_base = candidate.split(":")[0]
                return target_base == candidate_base or candidate.startswith(f"{target}:")

            model_installed = any(match_model(configured_model, m) for m in models_list)

            if not model_installed:
                return AIHealthResponse(
                    status="MODEL_UNAVAILABLE",
                    ollama_connected=True,
                    model_installed=False,
                    model=configured_model,
                    available_models=models_list,
                    message=f"Configured model '{configured_model}' is not installed in local Ollama. Run 'ollama pull {configured_model}'",
                )

            return AIHealthResponse(
                status="ONLINE",
                ollama_connected=True,
                model_installed=True,
                model=configured_model,
                available_models=models_list,
                message=f"Local Ollama AI Agent ready ({configured_model}).",
            )
    except Exception:
        return AIHealthResponse(
            status="OFFLINE",
            ollama_connected=False,
            model_installed=False,
            model=configured_model,
            available_models=[],
            message="Local AI unavailable — telemetry simulation continues.",
        )


@app.post("/api/ai/analyze", response_model=AIAnalysisResponse, tags=["Local AI Agent"])
async def analyze_engine_telemetry(telemetry: AITelemetryInput):
    """
    Analyze UAV engine sensor telemetry snapshot using local Ollama model.
    Returns structured JSON with fault status, severity, confidence, affected parameters,
    and maintenance recommendations.
    """
    configured_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    norm_telemetry = telemetry.get_normalized_dict()
    user_prompt = f"Engine Telemetry Snapshot: {json.dumps(norm_telemetry)}"

    payload = {
        "model": configured_model,
        "messages": [
            {"role": "system", "content": AI_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.0,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(f"{base_url}/api/chat", json=payload)

            if resp.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Model '{configured_model}' not found in local Ollama. Run 'ollama pull {configured_model}'",
                )
            elif resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Ollama returned HTTP {resp.status_code}: {resp.text}",
                )

            data = resp.json()
            content = data.get("message", {}).get("content", "")

            # Strip markdown fence if model wrapped JSON in ```json ... ```
            clean_content = content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            elif clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            clean_content = clean_content.strip()

            parsed = json.loads(clean_content)

            # Sanitize and validate fields
            ai_status = str(parsed.get("status", "NORMAL")).upper()
            if ai_status not in ["NORMAL", "WARNING", "CRITICAL"]:
                ai_status = "WARNING" if parsed.get("fault_detected") else "NORMAL"

            raw_conf = parsed.get("confidence", 95)
            try:
                conf_val = float(raw_conf)
                if 0.0 <= conf_val <= 1.0:
                    conf_val = round(conf_val * 100, 1)
                else:
                    conf_val = round(conf_val, 1)
            except (ValueError, TypeError):
                conf_val = 95.0

            fault_type = str(parsed.get("fault_type", "NONE")).upper()
            severity = str(parsed.get("severity", "LOW")).upper()
            if severity not in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
                severity = "LOW"

            affected = parsed.get("affected_parameters", [])
            if not isinstance(affected, list):
                affected = [str(affected)]

            return AIAnalysisResponse(
                status=ai_status,
                fault_detected=bool(parsed.get("fault_detected", ai_status != "NORMAL")),
                fault_type=fault_type,
                severity=severity,
                confidence=conf_val,
                summary=str(parsed.get("summary", "Telemetry within nominal flight bounds.")),
                recommended_action=str(
                    parsed.get("recommended_action", "Continue standard engine monitoring.")
                ),
                affected_parameters=affected,
                reasoning=str(parsed.get("reasoning", "Nominal transducer measurements.")),
                model=configured_model,
                timestamp=datetime.now(timezone.utc).isoformat(),
                telemetry=norm_telemetry,
            )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local Ollama daemon is unreachable at http://localhost:11434.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Local Ollama request timed out.",
        )
    except json.JSONDecodeError as jde:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama returned invalid JSON: {str(jde)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Diagnostic Agent error: {str(e)}",
        )


# ─── Conversational Chat Request & Response Models ───────────────────────────

class ChatMessage(BaseModel):
    """A single message in the conversation history."""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text content")


class ChatRequest(BaseModel):
    """Multi-turn chat request with live telemetry context."""
    message: str = Field(..., description="The user's current message")
    history: List[ChatMessage] = Field(
        default_factory=list,
        description="Prior conversation turns for multi-turn context",
    )
    telemetry: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Live engine telemetry snapshot injected into system prompt",
    )


class ChatResponse(BaseModel):
    """Single chat reply from the AI copilot."""
    reply: str = Field(..., description="AI assistant response text")
    model: str = Field(..., description="Ollama model used")
    timestamp: str = Field(..., description="ISO timestamp of response")


# ─── Chat System Prompt ───────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT_BASE = (
    "You are AeroTwin Copilot, the AI engine health assistant for a UAV Aero Piston Engine Digital Twin dashboard.\n\n"
    "Your role:\n"
    "- Answer engineering questions about UAV engine health, faults, and maintenance.\n"
    "- Explain sensor readings, fault codes, and health scores in plain language.\n"
    "- Give concise, technically accurate answers grounded in the live telemetry below.\n"
    "- When asked for recommendations, provide practical UAV maintenance advice.\n"
    "- Do NOT invent sensor values beyond what is provided.\n"
    "- Keep responses concise and clear (2-5 sentences for simple questions, more if detail is requested).\n"
    "- You may use engineering terminology but always explain it briefly.\n\n"
    "Current Live Engine Telemetry:\n"
    "{telemetry_block}\n\n"
    "Answer in plain text. Do not use JSON or code blocks unless the user explicitly requests it.\n"
)

CHAT_NO_TELEMETRY_BLOCK = (
    "No live telemetry available. Answer based on general UAV piston engine engineering knowledge."
)


def _build_chat_system_prompt(telemetry: Optional[Dict[str, Any]]) -> str:
    if telemetry:
        lines = []
        field_labels = {
            "engineTemp": ("Engine Temp (CHT)", "°C"),
            "rpm": ("Engine RPM", "RPM"),
            "oilPressure": ("Oil Pressure", "bar"),
            "vibration": ("Vibration (RMS)", "mm/s"),
            "propSpeed": ("Prop Speed", "RPM"),
            "fuelFlow": ("Fuel Flow", "L/h"),
            "cylinderHeadTemp": ("Cylinder Head Temp", "°C"),
            "healthScore": ("Health Score", "%"),
            "engineStatus": ("Engine Status", ""),
            "activeFault": ("Active Fault", ""),
            "faultRisk": ("Fault Risk Level", ""),
        }
        for key, (label, unit) in field_labels.items():
            val = telemetry.get(key)
            if val is not None:
                unit_str = f" {unit}" if unit else ""
                lines.append(f"  • {label}: {val}{unit_str}")
        telemetry_block = "\n".join(lines) if lines else CHAT_NO_TELEMETRY_BLOCK
    else:
        telemetry_block = CHAT_NO_TELEMETRY_BLOCK

    return CHAT_SYSTEM_PROMPT_BASE.format(telemetry_block=telemetry_block)


# ─── Conversational Chat Endpoint ────────────────────────────────────────────

@app.post("/api/ai/chat", response_model=ChatResponse, tags=["Local AI Chat"])
async def ai_chat(request: ChatRequest):
    """
    Multi-turn conversational chat endpoint for the AI Engine Health Copilot.

    Accepts user message, prior conversation history, and optional live telemetry.
    Routes the full conversation to local Ollama for grounded multi-turn responses.
    """
    configured_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    system_prompt = _build_chat_system_prompt(request.telemetry)

    # Build full messages array: system + history + current user message
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for turn in request.history:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": request.message})

    payload = {
        "model": configured_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 512,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{base_url}/api/chat", json=payload)

            if resp.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Model '{configured_model}' not found. Run 'ollama pull {configured_model}'",
                )
            elif resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Ollama returned HTTP {resp.status_code}: {resp.text[:200]}",
                )

            data = resp.json()
            reply_text = data.get("message", {}).get("content", "").strip()

            if not reply_text:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Ollama returned an empty response.",
                )

            return ChatResponse(
                reply=reply_text,
                model=configured_model,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local Ollama daemon is unreachable at http://localhost:11434. Please start Ollama.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Local Ollama request timed out. The model may be loading — please retry.",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat error: {str(e)}",
        )


def _get_elevenlabs_config():
    """Dynamically reads ElevenLabs config with fresh .env reload."""
    load_dotenv(override=True)
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    stt_model = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2").strip()
    tts_model = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5").strip()
    return api_key, voice_id, stt_model, tts_model


# ─── Voice Status Response Model ────────────────────────────────────────────

class VoiceStatusResponse(BaseModel):
    """Reports ElevenLabs voice service configuration status."""
    elevenlabs_configured: bool = Field(..., description="True if API key and voice ID are set")
    stt_model: str = Field(..., description="Configured STT model")
    tts_model: str = Field(..., description="Configured TTS model")
    voice_id_set: bool = Field(..., description="True if ELEVENLABS_VOICE_ID is configured")
    api_key_set: bool = Field(..., description="True if ELEVENLABS_API_KEY is configured")
    message: str = Field(..., description="Human-readable status")


class SpeakRequest(BaseModel):
    """Request body for TTS endpoint."""
    text: str = Field(..., description="Text to synthesize")


# ─── Voice Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/voice/status", response_model=VoiceStatusResponse, tags=["Voice"])
async def get_voice_status():
    """
    Returns ElevenLabs voice service configuration status.
    Hot-reloads .env so changes take effect immediately without server restart.
    Never exposes the API key.
    """
    api_key, voice_id, stt_model, tts_model = _get_elevenlabs_config()
    configured = bool(api_key and voice_id)
    return VoiceStatusResponse(
        elevenlabs_configured=configured,
        stt_model=stt_model,
        tts_model=tts_model,
        voice_id_set=bool(voice_id),
        api_key_set=bool(api_key),
        message=(
            f"ElevenLabs ready (STT: {stt_model}, TTS: {tts_model})"
            if configured
            else "ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID not configured in .env (Browser voice fallback active)"
        ),
    )


@app.post("/api/voice/transcribe", tags=["Voice"])
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Receives audio from the browser (multipart/form-data) and transcribes it
    using ElevenLabs Speech-to-Text (scribe_v2). The ElevenLabs API key is
    never exposed to the browser — it is read from environment only.
    """
    api_key, _, stt_model, _ = _get_elevenlabs_config()

    if not api_key:
        return {
            "success": False,
            "error": "VOICE_NOT_CONFIGURED",
            "message": "ELEVENLABS_API_KEY is not set in .env. Voice transcription unavailable.",
        }

    audio_bytes = await audio.read()
    if not audio_bytes:
        return {"success": False, "error": "EMPTY_AUDIO", "message": "No audio data received."}

    try:
        content_type = audio.content_type or "audio/webm"
        filename = audio.filename or "recording.webm"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{ELEVENLABS_BASE_URL}/v1/speech-to-text",
                headers={"xi-api-key": api_key},
                files={"file": (filename, audio_bytes, content_type)},
                data={"model_id": stt_model},
            )

            if resp.status_code == 401:
                return {"success": False, "error": "AUTH_FAILED", "message": "ElevenLabs API key is invalid."}
            elif resp.status_code == 422:
                return {"success": False, "error": "INVALID_AUDIO", "message": f"Audio format ({content_type}) rejected by ElevenLabs STT: {resp.text[:200]}"}
            elif resp.status_code != 200:
                return {
                    "success": False,
                    "error": "STT_ERROR",
                    "message": f"ElevenLabs STT error (HTTP {resp.status_code}): {resp.text[:200]}",
                }

            data = resp.json()
            transcript = ""
            if isinstance(data, dict):
                if data.get("text"):
                    transcript = str(data["text"]).strip()
                elif data.get("transcript"):
                    transcript = str(data["transcript"]).strip()
                elif isinstance(data.get("results"), list) and len(data["results"]) > 0:
                    first_res = data["results"][0]
                    if isinstance(first_res, dict):
                        transcript = str(first_res.get("transcript", "")).strip()

            if not transcript:
                return {"success": False, "error": "EMPTY_TRANSCRIPT", "message": "No speech detected in audio. Please speak clearly into microphone."}

            return {"success": True, "text": transcript}

    except httpx.ConnectError:
        return {"success": False, "error": "ELEVENLABS_OFFLINE", "message": "Cannot reach ElevenLabs API. Check internet connection."}
    except httpx.TimeoutException:
        return {"success": False, "error": "TIMEOUT", "message": "ElevenLabs STT request timed out."}
    except Exception as e:
        return {"success": False, "error": "UNKNOWN", "message": f"Transcription error: {str(e)}"}


@app.post("/api/voice/speak", tags=["Voice"])
async def speak_text(request: SpeakRequest):
    """
    Converts AI response text to speech using ElevenLabs TTS and streams
    MP3 audio back to the browser. The ElevenLabs API key is never exposed
    to the browser — it is read from environment only.
    """
    api_key, voice_id, _, tts_model = _get_elevenlabs_config()

    if not api_key or not voice_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID not configured in .env",
        )

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # Truncate very long responses to avoid excessive TTS costs
    if len(text) > 2000:
        text = text[:2000] + "..."

    payload = {
        "text": text,
        "model_id": tts_model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{ELEVENLABS_BASE_URL}/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json=payload,
            )

            if resp.status_code == 401:
                raise HTTPException(status_code=503, detail="ElevenLabs API key is invalid.")
            elif resp.status_code == 404:
                raise HTTPException(status_code=503, detail=f"ElevenLabs voice ID '{voice_id}' not found.")
            elif resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"ElevenLabs TTS returned HTTP {resp.status_code}: {resp.text[:200]}",
                )

            audio_bytes = resp.content

            async def audio_stream():
                yield audio_bytes

            return StreamingResponse(
                audio_stream(),
                media_type="audio/mpeg",
                headers={"Content-Length": str(len(audio_bytes))},
            )

    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot reach ElevenLabs API. Check internet connection.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="ElevenLabs TTS request timed out.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
