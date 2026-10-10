from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from datetime import datetime, timezone
import asyncio

from backend.config import CORS_ORIGINS
from backend.database import create_db_and_tables, engine
from backend.models import HoldEntry, WaitlistEntry
from backend.engine import process_cascade
from backend.websocket_manager import manager

from backend.routes.equipment import router as equipment_router
from backend.routes.bookings import router as bookings_router
from backend.routes.waitlist import router as waitlist_router
from backend.routes.admin import router as admin_router
from backend.routes.analytics import router as analytics_router

async def hold_expiry_loop():
    """
    Background worker loop checking for expired provisional holds every 15 seconds.
    Cascades release to next eligible candidate when hold expires unconfirmed.
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

                    # Trigger cascade for next candidate
                    next_cand, next_hold, msg = process_cascade(
                        session,
                        hold.unit_id,
                        hold.start_time,
                        hold.end_time,
                        now
                    )

                    await manager.broadcast("hold_expired", {"hold_id": hold.id, "unit_id": hold.unit_id})
                    if next_hold:
                        await manager.broadcast("hold_assigned", next_hold.model_dump())

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
