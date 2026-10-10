import pytest
import asyncio
from datetime import datetime, timezone, timedelta
import httpx
from sqlmodel import create_engine, SQLModel, Session, select
from backend.main import app
from backend.database import get_session
import backend.database as db_module
from backend.models import Booking, HoldEntry, WaitlistEntry, Equipment, MaintenanceRecord

TEST_DB_URL = "sqlite:///test_zeroclash.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})

@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    db_module.engine = test_engine
    yield
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_race_condition_simultaneous_booking():
    """
    Verifies that simultaneous double-booking requests for the exact same slot
    are serialized by the locking engine: exactly one succeeds (201) and one is rejected (409).
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start_time = datetime.now(timezone.utc) + timedelta(days=5, hours=10)
        end_time = start_time + timedelta(hours=2)

        payload_alpha = {
            "unit_id": "eq-gpu-01",
            "user_id": "usr-faculty-reed",
            "user_name": "Dr. Evelyn Reed",
            "user_role": "Faculty",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Race Simulation Alpha (Faculty)"
        }

        payload_beta = {
            "unit_id": "eq-gpu-01",
            "user_id": "usr-student-alex",
            "user_name": "Alex M.",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Race Simulation Beta (Student)"
        }

        # Fire both POST requests simultaneously
        resp_alpha, resp_beta = await asyncio.gather(
            client.post("/bookings", json=payload_alpha),
            client.post("/bookings", json=payload_beta)
        )

        status_codes = [resp_alpha.status_code, resp_beta.status_code]
        assert 201 in status_codes, f"Expected at least one 201: {status_codes}"
        assert 409 in status_codes, f"Expected at least one 409 conflict: {status_codes}"

        # Winner checks
        winner = resp_alpha if resp_alpha.status_code == 201 else resp_beta
        loser = resp_beta if resp_alpha.status_code == 201 else resp_alpha

        assert "id" in winner.json()
        assert "Clash detected" in loser.json()["detail"]["error"]

@pytest.mark.asyncio
async def test_back_to_back_slots_not_a_clash():
    """
    Verifies that back-to-back slots (where end_time == start_time) do not clash.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        slot1_start = datetime.now(timezone.utc) + timedelta(days=6, hours=10)
        slot1_end = slot1_start + timedelta(hours=2)
        slot2_start = slot1_end # Back-to-back
        slot2_end = slot2_start + timedelta(hours=2)

        res1 = await client.post("/bookings", json={
            "unit_id": "eq-cam-01",
            "user_id": "usr-1",
            "user_name": "User 1",
            "user_role": "Student",
            "start_time": slot1_start.isoformat(),
            "end_time": slot1_end.isoformat(),
            "purpose": "First Window"
        })
        assert res1.status_code == 201

        res2 = await client.post("/bookings", json={
            "unit_id": "eq-cam-01",
            "user_id": "usr-2",
            "user_name": "User 2",
            "user_role": "Faculty",
            "start_time": slot2_start.isoformat(),
            "end_time": slot2_end.isoformat(),
            "purpose": "Back-to-Back Window"
        })
        assert res2.status_code == 201, f"Expected 201 for back-to-back slot: {res2.text}"

@pytest.mark.asyncio
async def test_cancel_then_waitlist_cascade_and_confirm():
    """
    Verifies that cancelling an active booking frees the slot and triggers a waitlist cascade
    with a provisional 10-minute hold that can be confirmed.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start_time = datetime.now(timezone.utc) + timedelta(days=4, hours=14)
        end_time = start_time + timedelta(hours=3)

        # 1. Student creates initial booking
        res_book = await client.post("/bookings", json={
            "unit_id": "eq-vr-01",
            "user_id": "usr-student-alex",
            "user_name": "Alex M.",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Original Project"
        })
        assert res_book.status_code == 201
        booking_id = res_book.json()["id"]

        # 2. Faculty joins waitlist for this overlapping window
        res_wl = await client.post("/waitlist", json={
            "unit_id": "eq-vr-01",
            "user_id": "usr-faculty-reed",
            "user_name": "Dr. Evelyn Reed",
            "user_role": "Faculty",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "urgency": "high",
            "purpose": "Urgent Quantum VR Simulation"
        })
        assert res_wl.status_code == 201

        # 3. Student cancels original booking
        res_cancel = await client.delete(f"/bookings/{booking_id}")
        assert res_cancel.status_code == 200
        cancel_data = res_cancel.json()
        assert cancel_data["promoted_user"] == "Dr. Evelyn Reed"

        # 4. Verify hold was created in DB
        with Session(test_engine) as session:
            hold = session.exec(select(HoldEntry).where(HoldEntry.unit_id == "eq-vr-01", HoldEntry.confirmed == False)).first()
            assert hold is not None
            assert hold.user_name == "Dr. Evelyn Reed"
            hold_id = hold.id

        # 5. Confirm provisional hold
        res_confirm = await client.post(f"/holds/{hold_id}/confirm")
        assert res_confirm.status_code == 200
        assert res_confirm.json()["status"] == "active"

@pytest.mark.asyncio
async def test_maintenance_auto_cancels_future_bookings():
    """
    Verifies that placing equipment in maintenance auto-cancels future bookings
    and locks out any new booking attempts.
    """
    # Create unit in equipment table for foreign lookup
    with Session(test_engine) as session:
        session.add(Equipment(
            id="eq-print-01",
            name="3D Printer",
            unit_number="#02",
            type="printer",
            icon_url="/assets/icons/printer.png",
            building_id="bldg-science",
            building_name="Science Wing",
            status="available"
        ))
        session.commit()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start_time = datetime.now(timezone.utc) + timedelta(days=3, hours=11)
        end_time = start_time + timedelta(hours=3)

        # 1. Book unit
        res_book = await client.post("/bookings", json={
            "unit_id": "eq-print-01",
            "user_id": "usr-student-marcus",
            "user_name": "Marcus Vance",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Chassis 3D Print"
        })
        assert res_book.status_code == 201
        booking_id = res_book.json()["id"]

        # 2. Admin sets maintenance covering that window
        maint_return = datetime.now(timezone.utc) + timedelta(days=3, hours=20)
        res_maint = await client.post("/admin/maintenance", json={
            "unit_id": "eq-print-01",
            "is_active": True,
            "reason": "Emergency Laser Recalibration",
            "expected_return_time": maint_return.isoformat()
        })
        assert res_maint.status_code == 200
        assert res_maint.json()["cancelled_bookings_count"] >= 1
        assert booking_id in res_maint.json()["cancelled_booking_ids"]

        # 3. Verify new booking during maintenance is rejected with 409
        res_blocked = await client.post("/bookings", json={
            "unit_id": "eq-print-01",
            "user_id": "usr-researcher-priya",
            "user_name": "Priya S.",
            "user_role": "Researcher",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Attempt during maintenance"
        })
        assert res_blocked.status_code == 409
        assert "maintenance" in res_blocked.json()["detail"]["error"].lower()
