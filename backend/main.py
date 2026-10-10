from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from datetime import datetime, timezone, timedelta
import asyncio

from backend.config import CORS_ORIGINS
from backend.database import create_db_and_tables, engine
from backend.models import HoldEntry, WaitlistEntry, Booking, User, Equipment
from backend.engine import process_cascade, process_no_show_releases
from backend.websocket_manager import manager
from backend.notifications import notification_service

from backend.routes.equipment import router as equipment_router
from backend.routes.bookings import router as bookings_router
from backend.routes.waitlist import router as waitlist_router
from backend.routes.admin import router as admin_router
from backend.routes.analytics import router as analytics_router
from backend.routes.schedule import router as schedule_router

async def hold_expiry_loop():
    """
    Background worker loop checking for expired provisional holds every 15 seconds.
    Cascades release to next eligible candidate when hold expires unconfirmed.
    Dispatches hold expiration emails, hold awarded alerts, and 30-minute slot reminders.
    """
    while True:
        try:
            await asyncio.sleep(15)
            with Session(engine) as session:
                now = datetime.now(timezone.utc)
                expired_holds = session.exec(
                    select(HoldEntry).where(
                        HoldEntry.expired == False,
                        HoldEntry.confirmed == False,
                        HoldEntry.expires_at <= now
                    )
                ).all()

                for hold in expired_holds:
                    hold.expired = True
                    session.add(hold)

                    # Mark waitlist entry expired
                    if hold.waitlist_entry_id:
                        entry = session.get(WaitlistEntry, hold.waitlist_entry_id)
                        if entry:
                            entry.status = "expired"
                            session.add(entry)

                    session.commit()

                    # Send hold expired notification in background
                    hold_user = session.get(User, hold.user_id)
                    hold_unit = session.get(Equipment, hold.unit_id)
                    asyncio.create_task(asyncio.to_thread(
                        notification_service.send_hold_expired,
                        user_email=hold_user.email if hold_user else f"{hold.user_id}@campus.edu",
                        user_name=hold.user_name,
                        hold_id=hold.id,
                        unit_name=hold_unit.name if hold_unit else hold.unit_id,
                        unit_number=hold_unit.unit_number if hold_unit else ""
                    ))

                    # Trigger cascade for next candidate
                    next_cand, next_hold, msg = process_cascade(
                        session,
                        hold.unit_id,
                        hold.start_time,
                        hold.end_time,
                        now
                    )

                    await manager.broadcast("hold_expired", {"hold_id": hold.id, "unit_id": hold.unit_id})
                    if next_hold and next_cand:
                        await manager.broadcast("hold_assigned", next_hold.model_dump())
                        next_user = session.get(User, next_cand.user_id)
                        asyncio.create_task(asyncio.to_thread(
                            notification_service.send_hold_awarded,
                            user_email=next_user.email if next_user else f"{next_cand.user_id}@campus.edu",
                            user_name=next_cand.user_name,
                            hold_id=next_hold.id,
                            unit_name=hold_unit.name if hold_unit else next_hold.unit_id,
                            unit_number=hold_unit.unit_number if hold_unit else "",
                            start_time=next_hold.start_time,
                            end_time=next_hold.end_time,
                            expires_at=next_hold.expires_at
                        ))

                # Check for no-show check-in releases (+15m past start time)
                released = process_no_show_releases(session, now)
                for bk, promoted, hold in released:
                    await manager.broadcast("booking_cancelled", {"booking_id": bk.id, "unit_id": bk.unit_id, "reason": "no_show"})
                    if hold and promoted:
                        await manager.broadcast("hold_assigned", hold.model_dump())
                        promoted_user = session.get(User, promoted.user_id)
                        promoted_unit = session.get(Equipment, hold.unit_id)
                        asyncio.create_task(asyncio.to_thread(
                            notification_service.send_hold_awarded,
                            user_email=promoted_user.email if promoted_user else f"{promoted.user_id}@campus.edu",
                            user_name=promoted.user_name,
                            hold_id=hold.id,
                            unit_name=promoted_unit.name if promoted_unit else hold.unit_id,
                            unit_number=promoted_unit.unit_number if promoted_unit else "",
                            start_time=hold.start_time,
                            end_time=hold.end_time,
                            expires_at=hold.expires_at
                        ))

                # Check for 30-minute booking reminders
                reminder_window = now + timedelta(minutes=30)
                upcoming_stmt = select(Booking).where(
                    Booking.status == "active",
                    Booking.reminder_sent == False,
                    Booking.start_time >= now,
                    Booking.start_time <= reminder_window
                )
                upcoming_bookings = session.exec(upcoming_stmt).all()
                for ub in upcoming_bookings:
                    ub.reminder_sent = True
                    session.add(ub)
                    session.commit()

                    u_user = session.get(User, ub.user_id)
                    u_unit = session.get(Equipment, ub.unit_id)
                    asyncio.create_task(asyncio.to_thread(
                        notification_service.send_reminder_30m,
                        user_email=u_user.email if u_user else f"{ub.user_id}@campus.edu",
                        user_name=ub.user_name,
                        booking_id=ub.id,
                        unit_name=u_unit.name if u_unit else ub.unit_id,
                        unit_number=u_unit.unit_number if u_unit else "",
                        start_time=ub.start_time,
                        end_time=ub.end_time
                    ))

        except asyncio.CancelledError:
            break
        except Exception as e:
            # Continue running background loop
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    worker_task = asyncio.create_task(hold_expiry_loop())
    yield
    worker_task.cancel()

app = FastAPI(
    title="ZeroClash Smart Campus Hub API",
    version="2.4.0",
    description="Transactional Conflict Engine, Priority Waitlist Cascade & Concurrency Locking",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(equipment_router)
app.include_router(bookings_router)
app.include_router(waitlist_router)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(schedule_router)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive & receive client heartbeat messages
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)

@app.get("/health")
def health_check():
    return {"status": "online", "engine": "ZeroClash Concurrency Core v2.4", "timestamp": datetime.now(timezone.utc).isoformat()}
