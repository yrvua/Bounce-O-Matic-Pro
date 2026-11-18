
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

from app.cup_analysis import analyze_cup_patterns
from app.recommendations import analyze_player_recommendations
from app.player_grouping import analyze_player_grouping


app = FastAPI(
    title="Bounce-O-Matic Pro ML Service",
    description="AI analytics service for the Ping-Pong Toss Challenge",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyticsRequest(BaseModel):
    games: list[dict[str, Any]]


@app.get("/")
def home():
    return {
        "success": True,
        "message": "Bounce-O-Matic Pro ML Service is running!",
    }


@app.get("/health")
def health_check():
    return {
        "success": True,
        "service": "Bounce-O-Matic Pro ML Service",
        "status": "online",
    }


@app.post("/api/analytics/cups")
def cup_analysis(request: AnalyticsRequest):
    try:
        return analyze_cup_patterns(request.games)
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/analytics/recommendations")
def player_recommendations(request: AnalyticsRequest):
    try:
        return analyze_player_recommendations(request.games)
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/analytics/rankings")
def player_rankings(request: AnalyticsRequest):
    try:
        return analyze_player_grouping(request.games)
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error))
