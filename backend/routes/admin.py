from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlmodel import Session, select
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import json

from backend.database import get_session
from backend.models import MaintenanceRecord, Booking, Equipment, AuditLog, User
from backend.websocket_manager import manager
from backend.notifications import notification_service
from backend.auth import require_lab_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

class MaintenanceRequest(BaseModel):
    unit_id: str
    is_active: bool
    reason: Optional[str] = "Routine Diagnostic Inspection"
    expected_return_time: Optional[datetime] = None
    user_id: Optional[str] = "admin"

@router.post("/maintenance")
async def toggle_maintenance(
    req: MaintenanceRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    admin_user: User = Depends(require_lab_admin)
):
    unit = session.get(Equipment, req.unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Equipment unit not found")

    maint_stmt = select(MaintenanceRecord).where(MaintenanceRecord.unit_id == req.unit_id)
    record = session.exec(maint_stmt).first()

    cancelled_bookings: List[str] = []

    if req.is_active:
        return_time = req.expected_return_time or datetime.now(timezone.utc)
        now = datetime.now(timezone.utc)

        # Auto-cancel clashing future bookings
        clash_stmt = select(Booking).where(
            Booking.unit_id == req.unit_id,
            Booking.status == "active",
            Booking.start_time < return_time,
            Booking.end_time > now
        )
        conflicts = session.exec(clash_stmt).all()

        for cb in conflicts:
            cb.status = "cancelled"
            session.add(cb)
            cancelled_bookings.append(cb.id)

            audit = AuditLog(
                id=f"log-{uuid.uuid4().hex[:8]}",
                action="CANCEL_BOOKING",
                target_id=cb.id,
                details=f"Auto-cancelled due to emergency hardware maintenance: {req.reason}",
                timestamp=now,
                user_id=req.user_id or "admin"
            )
            session.add(audit)

            # Send maintenance cancellation email in background
            user = session.get(User, cb.user_id)
            user_email = user.email if user else f"{cb.user_id}@campus.edu"
            background_tasks.add_task(
                notification_service.send_maintenance_cancellation,
                user_email=user_email,
                user_name=cb.user_name,
                booking_id=cb.id,
                unit_name=unit.name,
                unit_number=unit.unit_number,
                start_time=cb.start_time,
                end_time=cb.end_time,
                maint_reason=req.reason or "Routine Diagnostic Inspection"
            )

        if record:
            record.is_active = True
            record.reason = req.reason or "Routine Maintenance"
            record.expected_return_time = return_time
            record.started_at = now
            existing_cancelled = json.loads(record.cancelled_booking_ids_json or "[]")
            record.cancelled_booking_ids_json = json.dumps(list(set(existing_cancelled + cancelled_bookings)))
            session.add(record)
        else:
            record = MaintenanceRecord(
                id=f"maint-{uuid.uuid4().hex[:8]}",
                unit_id=req.unit_id,
                is_active=True,
                reason=req.reason or "Routine Maintenance",
                expected_return_time=return_time,
                started_at=now,
                cancelled_booking_ids_json=json.dumps(cancelled_bookings)
            )
            session.add(record)

        unit.status = "maintenance"
        unit.status_text = f"MAINTENANCE - {req.reason}"
        session.add(unit)

        audit_maint = AuditLog(
            id=f"log-{uuid.uuid4().hex[:8]}",
            action="SET_MAINTENANCE",
            target_id=req.unit_id,
            details=f"Placed unit {req.unit_id} into maintenance until {return_time.isoformat()}. {len(cancelled_bookings)} bookings cancelled.",
            timestamp=now,
            user_id=req.user_id or "admin"
        )
        session.add(audit_maint)

    else:
        if record:
            record.is_active = False
            session.add(record)

        unit.status = "available"
        unit.status_text = "AVAILABLE for reservation"
        session.add(unit)

        audit_maint = AuditLog(
            id=f"log-{uuid.uuid4().hex[:8]}",
            action="CLEAR_MAINTENANCE",
            target_id=req.unit_id,
            details=f"Cleared maintenance on unit {req.unit_id}. Returned to service.",
            timestamp=datetime.now(timezone.utc),
            user_id=req.user_id or "admin"
        )
        session.add(audit_maint)

    session.commit()
    session.refresh(unit)

    await manager.broadcast("maintenance_changed", {
        "unit_id": req.unit_id,
        "is_active": req.is_active,
        "cancelled_count": len(cancelled_bookings)
    })

    return {
        "unit_id": req.unit_id,
        "status": unit.status,
        "cancelled_bookings_count": len(cancelled_bookings),
        "cancelled_booking_ids": cancelled_bookings
    }

@router.get("/audit-logs")
def get_audit_logs(
    session: Session = Depends(get_session),
    admin_user: User = Depends(require_lab_admin)
):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100)
    return session.exec(stmt).all()
