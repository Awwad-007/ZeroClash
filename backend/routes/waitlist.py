from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlmodel import Session, select
from datetime import datetime, timezone
import uuid

from backend.database import get_session, is_postgres_session
from backend.models import WaitlistEntry, HoldEntry, Booking, AuditLog, User, Equipment
from backend.engine import calculate_priority_score, get_unit_lock
from backend.websocket_manager import manager
from backend.qr_service import generate_signed_token
from backend.notifications import notification_service

router = APIRouter(prefix="", tags=["Waitlist"])

class WaitlistCreateRequest(BaseModel):
    unit_id: str
    user_id: str
    user_name: str
    user_role: str
    start_time: datetime
    end_time: datetime
    urgency: str
    purpose: str

@router.post("/waitlist", status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    req: WaitlistCreateRequest,
    session: Session = Depends(get_session)
):
    score = calculate_priority_score(req.user_role, req.urgency)

    entry = WaitlistEntry(
        id=f"wl-{uuid.uuid4().hex[:8]}",
        unit_id=req.unit_id,
        user_id=req.user_id,
        user_name=req.user_name,
        user_role=req.user_role,
        start_time=req.start_time,
        end_time=req.end_time,
        urgency=req.urgency,
        purpose=req.purpose,
        priority_score=score,
        status="waiting",
        requested_at=datetime.now(timezone.utc)
    )
    session.add(entry)

    audit = AuditLog(
        id=f"log-{uuid.uuid4().hex[:8]}",
        action="WAITLIST_HOLD",
        target_id=entry.id,
        details=f"{req.user_name} queued on waitlist (Score: {score}).",
        timestamp=datetime.now(timezone.utc),
        user_id=req.user_id
    )
    session.add(audit)
    session.commit()
    session.refresh(entry)

    return entry

@router.post("/holds/{hold_id}/confirm")
async def confirm_provisional_hold(
    hold_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    hold = session.get(HoldEntry, hold_id)
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    if hold.expired or hold.confirmed:
        raise HTTPException(status_code=400, detail="Hold is expired or already confirmed")

    lock = get_unit_lock(hold.unit_id)
    async with lock:
        if is_postgres_session(session):
            session.exec(select(Equipment).where(Equipment.id == hold.unit_id).with_for_update()).first()

        # Mark hold confirmed
        hold.confirmed = True
        session.add(hold)

    # Promote waitlist entry
    if hold.waitlist_entry_id:
        waitlist_entry = session.get(WaitlistEntry, hold.waitlist_entry_id)
        if waitlist_entry:
            waitlist_entry.status = "promoted"
            session.add(waitlist_entry)

    booking_id = f"bk-{uuid.uuid4().hex[:8]}"
    expiry_ts = int(hold.end_time.timestamp())
    qr_token = generate_signed_token(booking_id, expiry_ts)

    # Create active confirmed booking
    new_booking = Booking(
        id=booking_id,
        unit_id=hold.unit_id,
        user_id=hold.user_id,
        user_name=hold.user_name,
        user_role=hold.user_role,
        start_time=hold.start_time,
        end_time=hold.end_time,
        purpose="Promoted from Priority Waitlist Hold",
        status="active",
        qr_token=qr_token,
        created_at=datetime.now(timezone.utc)
    )
    session.add(new_booking)

    audit = AuditLog(
        id=f"log-{uuid.uuid4().hex[:8]}",
        action="HOLD_CONFIRMED",
        target_id=hold.id,
        details=f"Hold confirmed by {hold.user_name}. Created booking {new_booking.id}",
        timestamp=datetime.now(timezone.utc),
        user_id=hold.user_id
    )
    session.add(audit)
    session.commit()
    session.refresh(new_booking)

    await manager.broadcast("hold_confirmed", hold.model_dump())
    await manager.broadcast("booking_created", new_booking.model_dump())

    # Send confirmation email in background
    user = session.get(User, hold.user_id)
    unit = session.get(Equipment, hold.unit_id)
    user_email = user.email if user else f"{hold.user_id}@campus.edu"
    background_tasks.add_task(
        notification_service.send_booking_confirmed,
        user_email=user_email,
        user_name=hold.user_name,
        booking_id=new_booking.id,
        unit_name=unit.name if unit else hold.unit_id,
        unit_number=unit.unit_number if unit else "",
        start_time=new_booking.start_time,
        end_time=new_booking.end_time,
        purpose=new_booking.purpose,
        qr_token=new_booking.qr_token
    )

    return new_booking
