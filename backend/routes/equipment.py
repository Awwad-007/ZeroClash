from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from backend.database import get_session
from backend.models import Equipment, Booking, MaintenanceRecord
from backend.engine import find_alternative_slots

router = APIRouter(prefix="", tags=["Equipment"])

@router.get("/equipment")
def list_equipment(session: Session = Depends(get_session)):
    units = session.exec(select(Equipment)).all()
    return units

@router.get("/availability")
def check_equipment_availability(
    unit_id: str = Query(...),
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    session: Session = Depends(get_session)
):
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="start_time must be strictly before end_time")

    duration_min = int((end_time - start_time).total_seconds() / 60)

    # Check maintenance
    maint_stmt = select(MaintenanceRecord).where(
        MaintenanceRecord.unit_id == unit_id,
        MaintenanceRecord.is_active == True,
        MaintenanceRecord.started_at < end_time,
        MaintenanceRecord.expected_return_time > start_time
    )
    maint = session.exec(maint_stmt).first()

    # Check active bookings
    clash_stmt = select(Booking).where(
        Booking.unit_id == unit_id,
        Booking.status == "active",
        Booking.start_time < end_time,
        Booking.end_time > start_time
    )
    conflicting = session.exec(clash_stmt).all()

    if maint or conflicting:
        alternatives = find_alternative_slots(session, unit_id, start_time, end_time, duration_min)
        return {
            "ok": False,
            "conflicting_bookings": [b.dict() for b in conflicting],
            "conflicting_maintenance": maint.dict() if maint else None,
            "suggested_alternative_slots": alternatives,
            "reason": f"Unit under maintenance until {maint.expected_return_time.isoformat()}" if maint else f"Slot occupied by {', '.join(b.user_name for b in conflicting)}"
        }

    return {
        "ok": True,
        "conflicting_bookings": [],
        "suggested_alternative_slots": []
    }
