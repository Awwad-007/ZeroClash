from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlmodel import Session, select
from datetime import datetime, timezone
from typing import Optional
import uuid
import asyncio

from backend.database import get_session
from backend.models import Booking, MaintenanceRecord, AuditLog
from backend.engine import get_unit_lock, find_alternative_slots, process_cascade
from backend.websocket_manager import manager

router = APIRouter(prefix="/bookings", tags=["Bookings"])

class BookingCreateRequest(BaseModel):
    unit_id: str
    user_id: str
    user_name: str
    user_role: str
    start_time: datetime
    end_time: datetime
    purpose: str

class BookingModifyRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    user_id: Optional[str] = "system"

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_booking(
    req: BookingCreateRequest,
    session: Session = Depends(get_session)
):
    if req.start_time >= req.end_time:
        raise HTTPException(status_code=400, detail="start_time must be strictly before end_time")

    lock = get_unit_lock(req.unit_id)
    async with lock:
        # Simulate micro processing latency to ensure serializability test coverage
        await asyncio.sleep(0.01)

        # 1. Overlap query against active bookings on this equipment
        clash_stmt = select(Booking).where(
            Booking.unit_id == req.unit_id,
            Booking.status == "active",
            Booking.start_time < req.end_time,
            Booking.end_time > req.start_time
        )
        conflicting = session.exec(clash_stmt).all()

        # 2. Check active maintenance
        maint_stmt = select(MaintenanceRecord).where(
            MaintenanceRecord.unit_id == req.unit_id,
            MaintenanceRecord.is_active == True,
            MaintenanceRecord.started_at < req.end_time,
            MaintenanceRecord.expected_return_time > req.start_time
        )
        maint = session.exec(maint_stmt).first()

        if conflicting or maint:
            duration_min = int((req.end_time - req.start_time).total_seconds() / 60)
            alternatives = find_alternative_slots(session, req.unit_id, req.start_time, req.end_time, duration_min)

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=jsonable_encoder({
                    "error": "Clash detected with existing reservation or maintenance",
                    "conflicting_bookings": [b.model_dump() for b in conflicting],
                    "conflicting_maintenance": maint.model_dump() if maint else None,
                    "suggested_alternative_slots": alternatives,
                })
            )

        new_booking = Booking(
            id=f"bk-{uuid.uuid4().hex[:8]}",
            unit_id=req.unit_id,
            user_id=req.user_id,
            user_name=req.user_name,
            user_role=req.user_role,
            start_time=req.start_time,
            end_time=req.end_time,
            purpose=req.purpose,
            status="active",
            created_at=datetime.now(timezone.utc)
        )
        session.add(new_booking)

        audit = AuditLog(
            id=f"log-{uuid.uuid4().hex[:8]}",
            action="CREATE_BOOKING",
            target_id=new_booking.id,
            details=f"Booked by {req.user_name} ({req.user_role}) for {req.purpose}",
            timestamp=datetime.now(timezone.utc),
            user_id=req.user_id
        )
        session.add(audit)
        session.commit()
        session.refresh(new_booking)

    # Broadcast event
    await manager.broadcast("booking_created", new_booking.model_dump())

    return new_booking

@router.patch("/{booking_id}")
async def modify_booking(
    booking_id: str,
    req: BookingModifyRequest,
    session: Session = Depends(get_session)
):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "active":
        raise HTTPException(status_code=400, detail="Cannot modify non-active booking")

    lock = get_unit_lock(booking.unit_id)
    async with lock:
        # Atomic overlap check excluding self
        clash_stmt = select(Booking).where(
            Booking.unit_id == booking.unit_id,
            Booking.id != booking_id,
            Booking.status == "active",
            Booking.start_time < req.end_time,
            Booking.end_time > req.start_time
        )
        conflicts = session.exec(clash_stmt).all()

        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Reschedule conflict: slot occupied by {', '.join(c.user_name for c in conflicts)}"
            )

        booking.start_time = req.start_time
        booking.end_time = req.end_time

        audit = AuditLog(
            id=f"log-{uuid.uuid4().hex[:8]}",
            action="MODIFY_BOOKING",
            target_id=booking.id,
            details=f"Rescheduled to {req.start_time} - {req.end_time}",
            timestamp=datetime.now(timezone.utc),
            user_id=req.user_id or "system"
        )
        session.add(audit)
        session.commit()
        session.refresh(booking)

    await manager.broadcast("booking_modified", booking.model_dump())
    return booking

@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: str,
    session: Session = Depends(get_session)
):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    lock = get_unit_lock(booking.unit_id)
    async with lock:
        booking.status = "cancelled"
        session.add(booking)

        audit = AuditLog(
            id=f"log-{uuid.uuid4().hex[:8]}",
            action="CANCEL_BOOKING",
            target_id=booking.id,
            details=f"Cancelled booking {booking.id}",
            timestamp=datetime.now(timezone.utc),
            user_id=booking.user_id
        )
        session.add(audit)
        session.commit()

        # Trigger waitlist cascade
        promoted_candidate, hold, message = process_cascade(
            session,
            booking.unit_id,
            booking.start_time,
            booking.end_time,
            datetime.now(timezone.utc)
        )

    await manager.broadcast("booking_cancelled", {"booking_id": booking_id, "unit_id": booking.unit_id})
    if hold:
        await manager.broadcast("hold_assigned", hold.model_dump())

    return {
        "status": "cancelled",
        "booking_id": booking_id,
        "cascade_result": message,
        "promoted_user": promoted_candidate.user_name if promoted_candidate else None
    }
