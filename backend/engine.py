from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlmodel import Session, select
from sqlalchemy import text
from backend.models import Booking, MaintenanceRecord, WaitlistEntry, HoldEntry, AuditLog
import uuid
import asyncio

# Lock dictionary per unit_id to guarantee in-process async request serializability
_unit_locks: Dict[str, asyncio.Lock] = {}

def get_unit_lock(unit_id: str) -> asyncio.Lock:
    if unit_id not in _unit_locks:
        _unit_locks[unit_id] = asyncio.Lock()
    return _unit_locks[unit_id]

ROLE_WEIGHTS = {
    "Lab Admin": 100,
    "Faculty": 90,
    "Researcher": 75,
    "Student": 50,
}

URGENCY_WEIGHTS = {
    "high": 100,
    "medium": 60,
    "low": 25,
}

def calculate_priority_score(role: str, urgency: str, no_show_count: int = 0) -> int:
    role_score = ROLE_WEIGHTS.get(role, 50)
    urgency_score = URGENCY_WEIGHTS.get(urgency.lower(), 50)
    reliability_score = max(0, 100 - no_show_count * 15)

    return round(role_score * 0.4 + urgency_score * 0.4 + reliability_score * 0.2)

def has_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    """
    Standard interval overlap formula:
    start1 < end2 and end1 > start2.
    Back-to-back (end1 == start2 or start1 == end2) is NOT a clash.
    """
    return start1 < end2 and end1 > start2

def find_alternative_slots(
    session: Session,
    unit_id: str,
    requested_start: datetime,
    requested_end: datetime,
    duration_minutes: int
) -> List[Dict[str, str]]:
    """
    Finds the next 3 available non-clashing slots of the same duration.
    """
    alternatives = []
    cursor = requested_start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    
    max_search_hours = 72
    hours_searched = 0

    while len(alternatives) < 3 and hours_searched < max_search_hours:
        candidate_start = cursor
        candidate_end = candidate_start + timedelta(minutes=duration_minutes)

        # Campus open hours: 08:00 - 22:00
        if 8 <= candidate_start.hour < 22 and (candidate_end.hour < 22 or (candidate_end.hour == 22 and candidate_end.minute == 0)):
            # Check overlap against bookings
            clash_stmt = select(Booking).where(
                Booking.unit_id == unit_id,
                Booking.status == "active",
                Booking.start_time < candidate_end,
                Booking.end_time > candidate_start
            )
            has_booking_clash = session.exec(clash_stmt).first() is not None

            # Check overlap against maintenance
            maint_stmt = select(MaintenanceRecord).where(
                MaintenanceRecord.unit_id == unit_id,
                MaintenanceRecord.is_active == True,
                MaintenanceRecord.started_at < candidate_end,
                MaintenanceRecord.expected_return_time > candidate_start
            )
            has_maint_clash = session.exec(maint_stmt).first() is not None

            if not has_booking_clash and not has_maint_clash:
                alternatives.append({
                    "start": candidate_start.isoformat(),
                    "end": candidate_end.isoformat(),
                })
                cursor = candidate_end
                continue

        cursor += timedelta(minutes=30)
        hours_searched += 0.5

    return alternatives

def process_cascade(
    session: Session,
    unit_id: str,
    released_start: datetime,
    released_end: datetime,
    current_time: Optional[datetime] = None
) -> Tuple[Optional[WaitlistEntry], Optional[HoldEntry], str]:
    """
    Processes waitlist cascade when a slot opens up.
    Assigns top priority waitlist candidate a 10-minute hold.
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)

    # Find candidates waiting on this unit whose window overlaps the released slot
    candidates_stmt = select(WaitlistEntry).where(
        WaitlistEntry.unit_id == unit_id,
        WaitlistEntry.status == "waiting",
        WaitlistEntry.start_time < released_end,
        WaitlistEntry.end_time > released_start
    )
    candidates = session.exec(candidates_stmt).all()

    if not candidates:
        return None, None, "No candidates in waitlist for this slot."

    # Sort by priority score DESC, then requested_at ASC
    sorted_candidates = sorted(candidates, key=lambda c: (-c.priority_score, c.requested_at))
    top = sorted_candidates[0]

    hold_id = f"hld-{uuid.uuid4().hex[:8]}"
    expires_at = current_time + timedelta(minutes=10)

    top.status = "on_hold"
    top.hold_id = hold_id
    top.hold_expires_at = expires_at
    session.add(top)

    new_hold = HoldEntry(
        id=hold_id,
        waitlist_entry_id=top.id,
        unit_id=top.unit_id,
        user_id=top.user_id,
        user_name=top.user_name,
        user_role=top.user_role,
        start_time=top.start_time,
        end_time=top.end_time,
        held_at=current_time,
        expires_at=expires_at,
        confirmed=False,
        expired=False
    )
    session.add(new_hold)

    # Log audit
    audit = AuditLog(
        id=f"log-{uuid.uuid4().hex[:8]}",
        action="WAITLIST_HOLD",
        target_id=new_hold.id,
        details=f"Slot provisionally held for {top.user_name} ({top.user_role}, Score: {top.priority_score}). 10-minute expiry.",
        timestamp=current_time,
        user_id=top.user_id
    )
    session.add(audit)
    session.commit()

    return top, new_hold, f"Slot reassigned to {top.user_name} (10-minute provisional hold active)"
