from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from backend.database import get_session
from backend.models import User
from backend.ai_scheduler import (
    suggest_optimal_slots,
    parse_natural_language_intent,
    SlotSuggestion,
    ParsedIntent
)

router = APIRouter(prefix="/schedule", tags=["AI Scheduling"])

class ScheduleSuggestRequest(BaseModel):
    equipment_type: str
    duration_minutes: int = 120
    start_window: Optional[datetime] = None
    end_window: Optional[datetime] = None
    days_window: Optional[int] = 3
    user_role: Optional[str] = "Student"
    urgency: Optional[str] = "medium"
    user_id: Optional[str] = None

class ScheduleNLPRequest(BaseModel):
    prompt: str

@router.post("/suggest")
async def get_schedule_suggestions(
    req: ScheduleSuggestRequest,
    session: Session = Depends(get_session)
):
    now = datetime.now(timezone.utc)
    start_win = req.start_window or now
    end_win = req.end_window or (start_win + timedelta(days=req.days_window or 3))

    if start_win >= end_win:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_window must be earlier than end_window"
        )

    # Lookup user reliability if user_id provided
    reliability = 100
    if req.user_id:
        user = session.get(User, req.user_id)
        if user:
            reliability = user.reliability_score

    suggestions = suggest_optimal_slots(
        session=session,
        equipment_type=req.equipment_type,
        duration_minutes=req.duration_minutes,
        start_window=start_win,
        end_window=end_win,
        user_role=req.user_role or "Student",
        urgency=req.urgency or "medium",
        user_reliability=reliability
    )

    return {
        "equipment_type": req.equipment_type,
        "duration_minutes": req.duration_minutes,
        "window_start": start_win.isoformat(),
        "window_end": end_win.isoformat(),
        "suggested_slots": [s.model_dump() for s in suggestions]
    }

@router.post("/parse-nlp")
async def parse_natural_language_schedule(req: ScheduleNLPRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt text cannot be empty"
        )

    parsed: ParsedIntent = parse_natural_language_intent(req.prompt.strip())
    return {
        "equipment_type": parsed.equipment_type,
        "duration_minutes": parsed.duration_minutes,
        "earliest": parsed.earliest.isoformat(),
        "latest": parsed.latest.isoformat()
    }
