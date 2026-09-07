import app.ssl_patch  # noqa: F401 — must be first; patches SSL before HuggingFace imports
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent import run_agent, build_system_prompt

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build the RAG index on first startup if storage doesn't exist yet.
    Runs in a thread so the synchronous HF model download doesn't block the event loop."""
    try:
        from app.rag import ensure_index_built
        await asyncio.to_thread(ensure_index_built)
    except Exception as e:
        logger.warning(
            "RAG index build failed at startup (will retry on first request): %s", e
        )
    yield  # server runs here


app = FastAPI(
    title="TerraLearn Environmental Agent API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CropContext(BaseModel):
    crop: str
    plantingDate: str
    yieldEstimate: float
    viabilityScore: float
    profit: float

class EnvSnapshot(BaseModel):
    temperature: Optional[float] = None
    precipitation: Optional[float] = None
    humidity: Optional[float] = None
    soilPH: Optional[float] = None
    soilNitrogen: Optional[float] = None
    soilPhosphorus: Optional[float] = None
    usAqi: Optional[float] = None
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None
    ozone: Optional[float] = None

class BuyerDemandCtx(BaseModel):
    buyerName: str
    category: str
    rate: Optional[float] = None
    unit: Optional[str] = None
    distanceKm: Optional[float] = None

class ChatTurn(BaseModel):
    role: str            # 'user' | 'assistant'
    content: str

class AskRequest(BaseModel):
    question: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    cropContext: Optional[CropContext] = None
    locationName: Optional[str] = None
    env: Optional[EnvSnapshot] = None
    suggestedCrops: Optional[List[str]] = None
    mandiTrendPct: Optional[float] = None
    buyerDemand: Optional[List[BuyerDemandCtx]] = None
    # Conversation memory + light identity (the backend stays stateless — the
    # client sends recent turns and the farmer's profile bits each call).
    history: Optional[List[ChatTurn]] = None
    farmerLanguage: Optional[str] = None
    farmerName: Optional[str] = None
    village: Optional[str] = None
    enterprises: Optional[List[str]] = None

class AskResponse(BaseModel):
    answer: str

class RiskBriefRequest(BaseModel):
    lat: float
    lng: float
    crop: str
    plantingDate: str
    yieldEstimate: float
    viabilityScore: float
    profit: float

class RiskBriefResponse(BaseModel):
    brief: str

@app.get("/")
def read_root():
    return {"status": "online", "service": "TerraLearn FastAPI Backend"}

@app.get("/health")
def health_check():
    """Lightweight liveness probe — no LLM, RAG, or network calls.
    Used by the keep-Render-awake GitHub Action to stop the free-tier
    service from sleeping."""
    return {"status": "ok"}

@app.post("/api/ask", response_model=AskResponse)
async def ask_question(req: AskRequest):
    try:
        formatted_input = f"User Question: {req.question}"
        if req.lat is not None and req.lng is not None:
            formatted_input += (
                f"\nTarget Location Coordinates: Latitude {req.lat}, Longitude {req.lng}"
            )
        if req.cropContext:
            formatted_input += (
                f"\nPre-computed Frontend Crop Result:\n"
                f"- Crop Type: {req.cropContext.crop}\n"
                f"- Planting Date: {req.cropContext.plantingDate}\n"
                f"- Yield Estimate: {req.cropContext.yieldEstimate} tons/ha\n"
                f"- Viability Score: {req.cropContext.viabilityScore}/100\n"
                f"- Calculated Profit: ${req.cropContext.profit:,.2f}"
            )

        if req.locationName:
            formatted_input += f"\nLocation: {req.locationName}"

        if req.env:
            e = req.env
            snap = []
            if e.temperature is not None:
                snap.append(f"temp {e.temperature}C")
            if e.humidity is not None:
                snap.append(f"humidity {e.humidity}%")
            if e.precipitation is not None:
                snap.append(f"precip {e.precipitation}mm")
            if e.soilPH is not None:
                snap.append(f"soil pH {e.soilPH}")
            if e.soilNitrogen is not None:
                snap.append(f"soil N {e.soilNitrogen}ppm")
            if e.soilPhosphorus is not None:
                snap.append(f"soil P {e.soilPhosphorus}ppm")
            if e.usAqi is not None:
                snap.append(f"US AQI {e.usAqi}")
            if e.pm2_5 is not None:
                snap.append(f"PM2.5 {e.pm2_5}")
            if e.pm10 is not None:
                snap.append(f"PM10 {e.pm10}")
            if e.ozone is not None:
                snap.append(f"ozone {e.ozone}")
            if snap:
                formatted_input += "\nCurrent pin snapshot: " + ", ".join(snap)

        if req.suggestedCrops:
            formatted_input += (
                "\nTop suggested crops for this pin: " + ", ".join(req.suggestedCrops)
            )

        if req.mandiTrendPct is not None:
            formatted_input += (
                f"\nRecent mandi price trend for the selected crop: "
                f"{req.mandiTrendPct:+.0f}% vs the trailing average"
            )

        if req.buyerDemand:
            lines = []
            for b in req.buyerDemand:
                line = f"- {b.buyerName} wants {b.category}"
                if b.rate:
                    line += f" @ {b.rate}/{b.unit or 'unit'}"
                if b.distanceKm is not None:
                    line += f" ({b.distanceKm} km away)"
                lines.append(line)
            formatted_input += "\nNearby buyer demand:\n" + "\n".join(lines)

        system_prompt = build_system_prompt(
            req.farmerLanguage, req.farmerName, req.village, req.enterprises
        )
        history = [
            {"role": t.role, "content": t.content} for t in (req.history or [])
        ][-10:]

        answer_text = await asyncio.to_thread(
            run_agent, formatted_input, history, system_prompt
        )
        if not answer_text:
            answer_text = "No response generated by the environmental agent."

        return AskResponse(answer=answer_text)
    except Exception as e:
        err_str = str(e)
        if "api_key" in err_str.lower() or "401" in err_str or "dummy-key" in err_str or "authentication" in err_str.lower():
            return AskResponse(
                answer="OpenAI API key is missing or invalid. Please configure OPENAI_API_KEY in backend/.env to query the AI agent."
            )
        return AskResponse(answer=f"Error running environmental assistant: {err_str}")


@app.post("/api/risk-brief", response_model=RiskBriefResponse)
async def get_risk_brief(req: RiskBriefRequest):
    """Generate a concise 2-3 sentence environmental risk brief for a crop/location.
    Reuses the existing run_agent — no separate Groq/OpenRouter config created."""
    try:
        internal_prompt = (
            f"You are generating a concise environmental risk brief for a farmer's decision.\n"
            f"Location: Latitude {req.lat}, Longitude {req.lng}\n"
            f"Crop: {req.crop}\n"
            f"Planting Date: {req.plantingDate}\n"
            f"Pre-computed Viability Score: {req.viabilityScore}/100\n"
            f"Estimated Yield: {req.yieldEstimate:.2f} tons/ha\n\n"
            f"Task: Use your available tools (real-time AQI data and environmental knowledge base) "
            f"to write exactly 2-3 sentences summarising the key environmental risks or favourable "
            f"conditions for growing {req.crop} at this location right now. "
            f"Be specific: mention pollutant levels, temperature suitability, or weather risks if relevant. "
            f"Keep it farmer-friendly and actionable. Do not use bullet points."
        )
        brief_text = await asyncio.to_thread(run_agent, internal_prompt)
        # Strip provider footnotes and error prefixes from the brief
        if not brief_text or brief_text.startswith("Error") or "rate-limited" in brief_text or "unavailable" in brief_text.lower():
            brief_text = "Environmental insights temporarily unavailable."
        return RiskBriefResponse(brief=brief_text)
    except Exception as e:
        logger.warning("risk-brief error: %s", e)
        return RiskBriefResponse(brief="Environmental insights temporarily unavailable.")
