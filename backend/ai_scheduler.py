import os
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from ortools.sat.python import cp_model
from sqlmodel import Session, select
from backend.models import Equipment, Booking, MaintenanceRecord, User
from backend.engine import calculate_priority_score

logger = logging.getLogger("zeroclash.ai_scheduler")

VALID_EQUIPMENT_TYPES = ["gpu", "camera", "vr", "printer", "microscope", "projector", "labkit", "device"]

class ParsedIntent(BaseModel):
    equipment_type: str
    duration_minutes: int
    earliest: datetime
    latest: datetime

class SlotSuggestion(BaseModel):
    unit_id: str
    unit_name: str
    unit_number: str
    building_id: str
    building_name: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    score: float
    utilization_rate: float
    demand_level: str
    recommendation_reason: str


SCHEDULE_PARSER_TOOL = {
    "name": "parse_scheduling_request",
    "description": "Extract structured equipment scheduling constraints from natural language queries.",
    "input_schema": {
        "type": "object",
        "properties": {
            "equipment_type": {
                "type": "string",
                "enum": VALID_EQUIPMENT_TYPES,
                "description": "Standardized campus equipment category."
            },
            "duration_minutes": {
                "type": "integer",
                "description": "Duration requested in minutes (e.g. 180 for 3 hours, 60 for 1 hour)."
            },
            "earliest": {
                "type": "string",
                "description": "ISO 8601 earliest start datetime."
            },
            "latest": {
                "type": "string",
                "description": "ISO 8601 latest acceptable completion datetime."
            }
        },
        "required": ["equipment_type", "duration_minutes", "earliest", "latest"]
    }
}


def parse_natural_language_intent(prompt: str, reference_time: Optional[datetime] = None) -> ParsedIntent:
    """
    Parses a natural-language booking query using Claude API (if ANTHROPIC_API_KEY is available)
    with a strict tool schema, falling back to heuristic parsing if key is missing or on error.
    Strictly validates the output format before returning.
    """
    now = reference_time or datetime.now(timezone.utc)
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if api_key and api_key.strip():
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key.strip())
            
            system_prompt = (
                f"You are the ZeroClash AI Scheduling Assistant for a smart campus equipment hub. "
                f"Current UTC reference time is {now.isoformat()}. "
                f"Extract the requested equipment type, duration in minutes, and earliest and latest datetime bounds. "
                f"Always call the parse_scheduling_request tool with valid ISO 8601 datetime strings."
            )

            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                system=system_prompt,
                tools=[SCHEDULE_PARSER_TOOL],
                tool_choice={"type": "tool", "name": "parse_scheduling_request"},
                messages=[{"role": "user", "content": prompt}]
            )

            for content_block in response.content:
                if content_block.type == "tool_use" and content_block.name == "parse_scheduling_request":
                    args = content_block.input
                    eq_type = str(args.get("equipment_type", "")).lower()
                    duration = int(args.get("duration_minutes", 60))
                    earliest_dt = datetime.fromisoformat(args["earliest"].replace("Z", "+00:00"))
                    latest_dt = datetime.fromisoformat(args["latest"].replace("Z", "+00:00"))

                    # Strict validation
                    if eq_type in VALID_EQUIPMENT_TYPES and 15 <= duration <= 480 and earliest_dt < latest_dt:
                        return ParsedIntent(
                            equipment_type=eq_type,
                            duration_minutes=duration,
                            earliest=earliest_dt,
                            latest=latest_dt
                        )
        except Exception as e:
            logger.warning(f"[AI Scheduler] Claude API call failed or unavailable ({e}); using rule-based parsing.")

    # Rule-based fallback parser
    return fallback_parse_intent(prompt, now)


def fallback_parse_intent(prompt: str, now: datetime) -> ParsedIntent:
    """Robust heuristic parser for natural language equipment queries."""
    text = prompt.lower()

    # 1. Detect equipment type
    detected_type = "gpu"
    if any(k in text for k in ["gpu", "cuda", "4090", "compute", "node", "ai training", "machine learning", "deep learning"]):
        detected_type = "gpu"
    elif any(k in text for k in ["camera", "dslr", "lens", "shoot", "photo", "canon", "sony", "video"]):
        detected_type = "camera"
    elif any(k in text for k in ["vr", "headset", "quest", "vive", "virtual reality", "meta", "spatial"]):
        detected_type = "vr"
    elif any(k in text for k in ["printer", "3d", "bambu", "filament", "print", "chassis"]):
        detected_type = "printer"
    elif any(k in text for k in ["microscope", "lens", "optical", "specimen", "keyence"]):
        detected_type = "microscope"
    elif any(k in text for k in ["projector", "epson", "display"]):
        detected_type = "projector"

    # 2. Detect duration (default 120 minutes)
    duration_minutes = 120
    hours_match = re.search(r"(\d+)\s*(?:hours?|hrs?|h)\b", text)
    mins_match = re.search(r"(\d+)\s*(?:minutes?|mins?|m)\b", text)

    if hours_match:
        duration_minutes = min(480, max(15, int(hours_match.group(1)) * 60))
    elif mins_match:
        duration_minutes = min(480, max(15, int(mins_match.group(1))))

    # 3. Detect target day and time-of-day
    target_day = now
    days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, dow in enumerate(days_of_week):
        if dow in text:
            current_dow = now.weekday()
            days_ahead = (i - current_dow) % 7
            if days_ahead == 0 and "next" in text:
                days_ahead = 7
            elif days_ahead == 0 and now.hour >= 18:
                days_ahead = 7
            target_day = now + timedelta(days=days_ahead)
            break

    if "tomorrow" in text:
        target_day = now + timedelta(days=1)
    elif "today" in text:
        target_day = now

    # Time-of-day range
    start_hour = 14
    end_hour = 18

    if "morning" in text:
        start_hour, end_hour = 9, 13
    elif "afternoon" in text:
        start_hour, end_hour = 13, 17
    elif "evening" in text or "night" in text:
        start_hour, end_hour = 17, 21

    earliest = target_day.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    latest = target_day.replace(hour=end_hour, minute=0, second=0, microsecond=0)

    # If earliest is before now, shift forward
    if earliest < now:
        earliest = now + timedelta(hours=1)
        latest = earliest + timedelta(hours=4)

    return ParsedIntent(
        equipment_type=detected_type,
        duration_minutes=duration_minutes,
        earliest=earliest,
        latest=latest
    )


def suggest_optimal_slots(
    session: Session,
    equipment_type: str,
    duration_minutes: int,
    start_window: datetime,
    end_window: datetime,
    user_role: str = "Student",
    urgency: str = "medium",
    user_reliability: int = 100
) -> List[SlotSuggestion]:
    """
    Ranks the best 3 non-conflicting slots across all units of the requested type.
    Combines priority scoring, unit load-balancing (utilization rate), forecasted demand,
    and OR-Tools CP-SAT for multi-candidate optimization.
    """
    # 1. Fetch matching equipment units
    units = session.exec(select(Equipment)).all()
    matching_units = [u for u in units if u.type.lower() == equipment_type.lower()]
    if not matching_units:
        # Fallback to broad match
        matching_units = [u for u in units if equipment_type.lower() in u.name.lower()]

    if not matching_units:
        return []

    # Calculate baseline priority score (Role 40% + Urgency 40% + Reliability 20%)
    base_priority = calculate_priority_score(user_role, urgency, (100 - user_reliability) // 15)

    candidate_slots = []
    unit_utilization_map = {}

    total_window_mins = max(60, int((end_window - start_window).total_seconds() / 60))

    # 2. Evaluate existing load on each unit
    for unit in matching_units:
        # Query active bookings within search window
        bk_stmt = select(Booking).where(
            Booking.unit_id == unit.id,
            Booking.status.in_(["active", "in_use"]),
            Booking.start_time < end_window,
            Booking.end_time > start_window
        )
        existing_bookings = session.exec(bk_stmt).all()

        maint_stmt = select(MaintenanceRecord).where(
            MaintenanceRecord.unit_id == unit.id,
            MaintenanceRecord.is_active == True,
            MaintenanceRecord.started_at < end_window,
            MaintenanceRecord.expected_return_time > start_window
        )
        existing_maint = session.exec(maint_stmt).all()

        # Compute booked minutes
        booked_mins = sum(
            int((min(b.end_time, end_window) - max(b.start_time, start_window)).total_seconds() / 60)
            for b in existing_bookings
        )
        maint_mins = sum(
            int((min(m.expected_return_time, end_window) - max(m.started_at, start_window)).total_seconds() / 60)
            for m in existing_maint
        )

        utilization = min(1.0, (booked_mins + maint_mins) / total_window_mins)
        unit_utilization_map[unit.id] = utilization

        # 3. Generate 30-min candidate start points within campus operating hours (08:00 to 22:00)
        curr = start_window
        # Round up to 30 mins
        rem = curr.minute % 30
        if rem != 0:
            curr += timedelta(minutes=(30 - rem))
        curr = curr.replace(second=0, microsecond=0)

        slot_delta = timedelta(minutes=duration_minutes)

        while curr + slot_delta <= end_window:
            cand_start = curr
            cand_end = curr + slot_delta
            curr += timedelta(minutes=30)

            # Campus operational hours check: 08:00 - 22:00
            if cand_start.hour < 8 or cand_end.hour > 22 or (cand_end.hour == 22 and cand_end.minute > 0):
                continue

            # Check overlap against bookings
            has_booking_overlap = any(
                b.start_time < cand_end and b.end_time > cand_start for b in existing_bookings
            )
            if has_booking_overlap:
                continue

            # Check overlap against maintenance
            has_maint_overlap = any(
                m.started_at < cand_end and m.expected_return_time > cand_start for m in existing_maint
            )
            if has_maint_overlap:
                continue

            # 4. Score slot:
            # - Priority component (0-40)
            priority_comp = (base_priority / 100.0) * 40.0

            # - Load balancing bonus: incentivize less loaded units (0-30)
            load_balance_bonus = (1.0 - utilization) * 30.0

            # - Forecasted demand / peak smoothing (0-30):
            # Peak hours 14:00-18:00 have high demand (demand index 0.9). Off-peak 08:00-12:00 have lower demand (0.3).
            # We favor scheduling during lower demand or balancing slots across the day.
            hour = cand_start.hour
            if 14 <= hour <= 17:
                demand_level = "High Peak"
                demand_score = 15.0  # slightly lower score during high contention to encourage off-peak
            elif 10 <= hour <= 13:
                demand_level = "Moderate"
                demand_score = 25.0
            else:
                demand_level = "Low Congestion"
                demand_score = 30.0

            total_score = round(priority_comp + load_balance_bonus + demand_score, 1)

            reason_str = (
                f"Balanced load on {unit.name} ({round((1 - utilization) * 100)}% available capacity). "
                f"{demand_level} window selected."
            )

            candidate_slots.append({
                "unit": unit,
                "start": cand_start,
                "end": cand_end,
                "score": total_score,
                "utilization": round(utilization, 2),
                "demand_level": demand_level,
                "reason": reason_str
            })

    if not candidate_slots:
        return []

    # 5. OR-Tools CP-SAT Batch Optimization
    # Select up to 3 non-overlapping, high-scoring slots across distinct start times or units
    try:
        model = cp_model.CpModel()
        bool_vars = []

        for i, c in enumerate(candidate_slots):
            bool_vars.append(model.new_bool_var(f"slot_{i}"))

        # Constraint: choose at most 3 slots
        model.add(sum(bool_vars) <= 3)

        # Constraint: no overlapping slots on the same unit
        for i in range(len(candidate_slots)):
            for j in range(i + 1, len(candidate_slots)):
                c1 = candidate_slots[i]
                c2 = candidate_slots[j]
                if c1["unit"].id == c2["unit"].id:
                    if c1["start"] < c2["end"] and c1["end"] > c2["start"]:
                        model.add(bool_vars[i] + bool_vars[j] <= 1)

        # Objective: Maximize sum of scores
        objective_terms = [
            int(c["score"] * 10) * bool_vars[i]
            for i, c in enumerate(candidate_slots)
        ]
        model.maximize(sum(objective_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 1.0
        status = solver.solve(model)

        selected = []
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for i, var in enumerate(bool_vars):
                if solver.value(var) == 1:
                    selected.append(candidate_slots[i])

        if selected:
            candidate_slots = sorted(selected, key=lambda s: s["score"], reverse=True)
        else:
            candidate_slots = sorted(candidate_slots, key=lambda s: s["score"], reverse=True)[:3]
    except Exception as e:
        logger.warning(f"[AI Scheduler] CP-SAT solver exception ({e}), falling back to priority sort.")
        candidate_slots = sorted(candidate_slots, key=lambda s: s["score"], reverse=True)[:3]

    # Return top 3 slots formatted
    results: List[SlotSuggestion] = []
    for c in candidate_slots[:3]:
        unit = c["unit"]
        results.append(SlotSuggestion(
            unit_id=unit.id,
            unit_name=unit.name,
            unit_number=unit.unit_number,
            building_id=unit.building_id,
            building_name=unit.building_name,
            start_time=c["start"],
            end_time=c["end"],
            duration_minutes=duration_minutes,
            score=c["score"],
            utilization_rate=c["utilization"],
            demand_level=c["demand_level"],
            recommendation_reason=c["reason"]
        ))

    return results
