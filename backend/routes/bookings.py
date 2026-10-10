from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlmodel import Session, select
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import asyncio

from backend.database import get_session
from backend.models import Booking, MaintenanceRecord, AuditLog, User, Equipment
from backend.engine import get_unit_lock, find_alternative_slots, process_cascade
from backend.websocket_manager import manager
from backend.qr_service import generate_signed_token, verify_signed_token, generate_qr_data_url
from backend.notifications import notification_service
from backend.auth import get_current_user, normalize_role, ROLE_LAB_ADMIN

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
    background_tasks: BackgroundTasks,
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

        booking_id = f"bk-{uuid.uuid4().hex[:8]}"
        expiry_ts = int(req.end_time.timestamp())
        qr_token = generate_signed_token(booking_id, expiry_ts)

        new_booking = Booking(
            id=booking_id,
            unit_id=req.unit_id,
            user_id=req.user_id,
            user_name=req.user_name,
            user_role=req.user_role,
            start_time=req.start_time,
            end_time=req.end_time,
            purpose=req.purpose,
            status="active",
            qr_token=qr_token,
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

    # Send confirmation email in background
    user = session.get(User, req.user_id)
    unit = session.get(Equipment, req.unit_id)
    user_email = user.email if user else f"{req.user_id}@campus.edu"
    background_tasks.add_task(
        notification_service.send_booking_confirmed,
        user_email=user_email,
        user_name=req.user_name,
        booking_id=new_booking.id,
        unit_name=unit.name if unit else req.unit_id,
        unit_number=unit.unit_number if unit else "",
        start_time=new_booking.start_time,
        end_time=new_booking.end_time,
        purpose=new_booking.purpose,
        qr_token=new_booking.qr_token
    )

    return new_booking

@router.patch("/{booking_id}")
async def modify_booking(
    booking_id: str,
    req: BookingModifyRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "active":
        raise HTTPException(status_code=400, detail="Cannot modify non-active booking")

    # Only booking owner or lab_admin can modify
    effective_user_id = req.user_id or current_user.id
    if booking.user_id != effective_user_id and normalize_role(current_user.role) != ROLE_LAB_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: users can only modify their own bookings"
        )

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
            user_id=effective_user_id
        )
        session.add(audit)
        session.commit()
        session.refresh(booking)

    await manager.broadcast("booking_modified", booking.model_dump())
    return booking

@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only booking owner or lab_admin can cancel
    if booking.user_id != current_user.id and normalize_role(current_user.role) != ROLE_LAB_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: users can only cancel their own bookings"
        )

    unit = session.get(Equipment, booking.unit_id)
    cancelled_user = session.get(User, booking.user_id)

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

    # Send cancellation email to booking owner
    cancelled_email = cancelled_user.email if cancelled_user else f"{booking.user_id}@campus.edu"
    background_tasks.add_task(
        notification_service.send_booking_cancelled,
        user_email=cancelled_email,
        user_name=booking.user_name,
        booking_id=booking.id,
        unit_name=unit.name if unit else booking.unit_id,
        unit_number=unit.unit_number if unit else "",
        start_time=booking.start_time,
        end_time=booking.end_time,
        reason="Cancelled by user"
    )

    # If hold was awarded to waitlisted candidate, notify them with 10-minute deadline & link
    if hold and promoted_candidate:
        cand_user = session.get(User, promoted_candidate.user_id)
        cand_email = cand_user.email if cand_user else f"{promoted_candidate.user_id}@campus.edu"
        background_tasks.add_task(
            notification_service.send_hold_awarded,
            user_email=cand_email,
            user_name=promoted_candidate.user_name,
            hold_id=hold.id,
            unit_name=unit.name if unit else hold.unit_id,
            unit_number=unit.unit_number if unit else "",
            start_time=hold.start_time,
            end_time=hold.end_time,
            expires_at=hold.expires_at
        )

    return {
        "status": "cancelled",
        "booking_id": booking_id,
        "cascade_result": message,
        "promoted_user": promoted_candidate.user_name if promoted_candidate else None
    }

class CheckInRequest(BaseModel):
    token: Optional[str] = None
    user_id: Optional[str] = None

class CheckOutRequest(BaseModel):
    user_id: Optional[str] = None

@router.get("/{booking_id}/qr")
async def get_booking_qr(booking_id: str, session: Session = Depends(get_session)):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not booking.qr_token:
        expiry_ts = int(booking.end_time.timestamp())
        booking.qr_token = generate_signed_token(booking.id, expiry_ts)
        session.add(booking)
        session.commit()
        session.refresh(booking)

    qr_url = generate_qr_data_url(booking.qr_token)
    return {
        "booking_id": booking.id,
        "token": booking.qr_token,
        "qr_data_url": qr_url
    }

@router.post("/{booking_id}/check-in")
async def check_in_booking(
    booking_id: str,
    req: Optional[CheckInRequest] = None,
    session: Session = Depends(get_session)
):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if req and req.token:
        is_valid, token_b_id, err_msg = verify_signed_token(req.token)
        if not is_valid or token_b_id != booking_id:
            raise HTTPException(status_code=400, detail=f"Invalid QR check-in token: {err_msg or 'ID mismatch'}")

    now = datetime.now(timezone.utc)
    start = booking.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    min_window = start - timedelta(minutes=10)
    max_window = start + timedelta(minutes=15)

    if now < min_window:
        raise HTTPException(
            status_code=400,
            detail=f"Check-in opens 10 minutes prior to session start ({min_window.strftime('%H:%M:%S UTC')})"
        )
    if now > max_window:
        raise HTTPException(
            status_code=400,
            detail="Check-in window expired (+15 min past start). Slot released."
        )

    if booking.status not in ("active", "in_use"):
        raise HTTPException(status_code=400, detail=f"Cannot check in to {booking.status} booking")

    booking.checked_in_at = now
    booking.status = "in_use"
    session.add(booking)

    audit = AuditLog(
        id=f"log-{uuid.uuid4().hex[:8]}",
        action="CHECK_IN",
        target_id=booking.id,
        details=f"User {booking.user_name} checked in via QR pass for unit {booking.unit_id}.",
        timestamp=now,
        user_id=req.user_id if (req and req.user_id) else booking.user_id
    )
    session.add(audit)
    session.commit()
    session.refresh(booking)

    await manager.broadcast("booking_checked_in", booking.model_dump())
    return booking

@router.post("/{booking_id}/check-out")
async def check_out_booking(
    booking_id: str,
    req: Optional[CheckOutRequest] = None,
    session: Session = Depends(get_session)
):
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    now = datetime.now(timezone.utc)
    booking.checked_out_at = now
    booking.status = "completed"
    session.add(booking)

    # If checked out early, cascade remaining slot to waitlist if applicable
    if now < booking.end_time - timedelta(minutes=15):
        process_cascade(session, booking.unit_id, now, booking.end_time, now)

    audit = AuditLog(
        id=f"log-{uuid.uuid4().hex[:8]}",
        action="CHECK_OUT",
        target_id=booking.id,
        details=f"User {booking.user_name} checked out early/completed for unit {booking.unit_id}.",
        timestamp=now,
        user_id=req.user_id if (req and req.user_id) else booking.user_id
    )
    session.add(audit)
    session.commit()
    session.refresh(booking)

    await manager.broadcast("booking_checked_out", booking.model_dump())
    return booking

