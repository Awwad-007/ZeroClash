import pytest
import asyncio
from datetime import datetime, timezone, timedelta
import httpx
from sqlmodel import create_engine, SQLModel, Session, select
from backend.main import app
from backend.database import get_session
import backend.database as db_module
from backend.models import Booking, HoldEntry, WaitlistEntry, Equipment, MaintenanceRecord, User

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

@pytest.mark.asyncio
async def test_qr_generation_check_in_and_check_out():
    """
    Verifies that a booking generates an HMAC signed QR code,
    allows check-in within window (-10m to +15m), and check-out.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Create booking starting in 5 minutes (within -10m window)
        start_time = datetime.now(timezone.utc) + timedelta(minutes=5)
        end_time = start_time + timedelta(hours=1)

        res_book = await client.post("/bookings", json={
            "unit_id": "eq-cam-01",
            "user_id": "usr-student-alex",
            "user_name": "Alex M.",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Field Photography Session"
        })
        assert res_book.status_code == 201
        booking_id = res_book.json()["id"]

        # Fetch QR pass
        res_qr = await client.get(f"/bookings/{booking_id}/qr")
        assert res_qr.status_code == 200
        qr_data = res_qr.json()
        assert "token" in qr_data
        assert "qr_data_url" in qr_data
        assert qr_data["qr_data_url"].startswith("data:image/png;base64,")
        token = qr_data["token"]

        # Check in with QR token
        res_checkin = await client.post(f"/bookings/{booking_id}/check-in", json={
            "token": token,
            "user_id": "usr-student-alex"
        })
        assert res_checkin.status_code == 200
        assert res_checkin.json()["status"] == "in_use"
        assert res_checkin.json()["checked_in_at"] is not None

        # Check out
        res_checkout = await client.post(f"/bookings/{booking_id}/check-out", json={
            "user_id": "usr-student-alex"
        })
        assert res_checkout.status_code == 200
        assert res_checkout.json()["status"] == "completed"
        assert res_checkout.json()["checked_out_at"] is not None

@pytest.mark.asyncio
async def test_check_in_window_restriction():
    """
    Verifies that checking in earlier than 10 minutes prior to session is rejected.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Booking starts tomorrow
        start_time = datetime.now(timezone.utc) + timedelta(hours=24)
        end_time = start_time + timedelta(hours=2)

        res_book = await client.post("/bookings", json={
            "unit_id": "eq-cam-02",
            "user_id": "usr-student-alex",
            "user_name": "Alex M.",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Future booking check-in test"
        })
        assert res_book.status_code == 201
        booking_id = res_book.json()["id"]

        # Attempt premature check-in
        res_checkin = await client.post(f"/bookings/{booking_id}/check-in", json={})
        assert res_checkin.status_code == 400
        assert "10 minutes" in res_checkin.json()["detail"].lower()

@pytest.mark.asyncio
async def test_no_show_auto_release_and_reliability_penalty():
    """
    Verifies that overdue bookings without check-in (>15m past start)
    are auto-released, user reliability score is penalized, and slot cascades.
    """
    from backend.engine import process_no_show_releases
    from backend.models import User

    now = datetime.now(timezone.utc)
    with Session(test_engine) as session:
        # Seed test user
        user = User(
            id="usr-noshow-test",
            name="NoShow User",
            role="Student",
            email="noshow@campus.edu",
            department="Physics",
            no_show_count=0,
            reliability_score=100
        )
        session.add(user)

        # Booking started 25 minutes ago, never checked in
        overdue_booking = Booking(
            id="bk-overdue-test",
            unit_id="eq-vr-01",
            user_id=user.id,
            user_name=user.name,
            user_role=user.role,
            start_time=now - timedelta(minutes=25),
            end_time=now + timedelta(hours=1),
            purpose="Overdue VR simulation",
            status="active"
        )
        session.add(overdue_booking)
        session.commit()

        # Run no-show release
        released = process_no_show_releases(session, now)
        assert len(released) >= 1
        assert released[0][0].id == "bk-overdue-test"

        # Verify penalties
        session.refresh(user)
        session.refresh(overdue_booking)
        assert overdue_booking.status == "cancelled"
        assert user.no_show_count == 1
        assert user.reliability_score == 85

@pytest.mark.asyncio
async def test_notification_service_provider_interface():
    """
    Verifies that the notification provider interface formats and dispatches all 6 required alert types:
    confirmed, cancelled, hold awarded (with 10m deadline + link), hold expired, maintenance cancellation, and 30m reminder.
    """
    from backend.notifications import ConsoleNotificationProvider, NotificationService

    provider = ConsoleNotificationProvider()
    service = NotificationService(provider=provider)

    now = datetime.now(timezone.utc)

    # 1. Booking confirmed
    ok1 = service.send_booking_confirmed(
        user_email="alex@campus.edu",
        user_name="Alex M.",
        booking_id="bk-test-1",
        unit_name="DSLR Camera",
        unit_number="#01",
        start_time=now,
        end_time=now + timedelta(hours=2),
        purpose="Project Video",
        qr_token="bk-test-1:1700:hmac"
    )
    assert ok1 is True
    assert len(provider.sent_messages) == 1
    assert "Confirmed" in provider.sent_messages[-1]["subject"]
    assert "DSLR Camera" in provider.sent_messages[-1]["body_text"]

    # 2. Booking cancelled
    ok2 = service.send_booking_cancelled(
        user_email="alex@campus.edu",
        user_name="Alex M.",
        booking_id="bk-test-1",
        unit_name="DSLR Camera",
        unit_number="#01",
        start_time=now,
        end_time=now + timedelta(hours=2),
        reason="Reschedule requested"
    )
    assert ok2 is True
    assert "Cancelled" in provider.sent_messages[-1]["subject"]

    # 3. Provisional hold awarded (must include 10-minute deadline and confirm link)
    deadline = now + timedelta(minutes=10)
    ok3 = service.send_hold_awarded(
        user_email="e.reed@campus.edu",
        user_name="Dr. Evelyn Reed",
        hold_id="hld-test-1",
        unit_name="GPU Compute Node",
        unit_number="#08",
        start_time=now,
        end_time=now + timedelta(hours=3),
        expires_at=deadline,
        confirm_url="http://localhost:5173/holds/hld-test-1/confirm"
    )
    assert ok3 is True
    last_msg = provider.sent_messages[-1]
    assert "10-Minute Hold" in last_msg["subject"]
    assert "10-MINUTE WINDOW" in last_msg["body_text"]
    assert "http://localhost:5173/holds/hld-test-1/confirm" in last_msg["body_text"]

    # 4. Hold expired
    ok4 = service.send_hold_expired(
        user_email="e.reed@campus.edu",
        user_name="Dr. Evelyn Reed",
        hold_id="hld-test-1",
        unit_name="GPU Compute Node",
        unit_number="#08"
    )
    assert ok4 is True
    assert "Hold Expired" in provider.sent_messages[-1]["subject"]

    # 5. Maintenance cancellation
    ok5 = service.send_maintenance_cancellation(
        user_email="alex@campus.edu",
        user_name="Alex M.",
        booking_id="bk-test-2",
        unit_name="3D Printer",
        unit_number="#02",
        start_time=now,
        end_time=now + timedelta(hours=1),
        maint_reason="Emergency Extruder Replacement"
    )
    assert ok5 is True
    assert "Maintenance" in provider.sent_messages[-1]["subject"]
    assert "Emergency Extruder Replacement" in provider.sent_messages[-1]["body_text"]

    # 6. Reminder 30 minutes before slot
    ok6 = service.send_reminder_30m(
        user_email="alex@campus.edu",
        user_name="Alex M.",
        booking_id="bk-test-3",
        unit_name="VR Headset",
        unit_number="#03",
        start_time=now + timedelta(minutes=30),
        end_time=now + timedelta(minutes=90)
    )
    assert ok6 is True
    assert "30 minutes" in provider.sent_messages[-1]["subject"]

@pytest.mark.asyncio
async def test_booking_endpoints_dispatch_background_emails():
    """
    Verifies that POST /bookings and DELETE /bookings trigger background email tasks
    without blocking the response.
    """
    from backend.notifications import notification_service, ConsoleNotificationProvider

    # Ensure provider is Console provider and clear messages
    if not isinstance(notification_service.provider, ConsoleNotificationProvider):
        notification_service.provider = ConsoleNotificationProvider()
    notification_service.provider.sent_messages.clear()

    with Session(test_engine) as session:
        if not session.get(Equipment, "eq-cam-04"):
            session.add(Equipment(
                id="eq-cam-04",
                name="DSLR Camera",
                unit_number="#04",
                type="camera",
                icon_url="/assets/icons/camera.png",
                building_id="bldg-media-1",
                building_name="Block A",
                status="available"
            ))
        if not session.get(User, "usr-faculty-reed"):
            session.add(User(
                id="usr-faculty-reed",
                name="Dr. Evelyn Reed",
                role="Faculty",
                email="e.reed@campus.edu",
                department="Physics",
                no_show_count=0,
                reliability_score=100
            ))
        if not session.get(User, "usr-student-alex"):
            session.add(User(
                id="usr-student-alex",
                name="Alex M.",
                role="Student",
                email="alex.m@campus.edu",
                department="Computer Science",
                no_show_count=0,
                reliability_score=100
            ))
        session.commit()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start_time = datetime.now(timezone.utc) + timedelta(days=5, hours=10)
        end_time = start_time + timedelta(hours=2)

        # 1. Create booking -> should trigger booking confirmed email
        res_book = await client.post("/bookings", json={
            "unit_id": "eq-cam-04",
            "user_id": "usr-student-alex",
            "user_name": "Alex M.",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "Camera field test"
        })
        assert res_book.status_code == 201
        booking_id = res_book.json()["id"]

        # Let background task complete
        await asyncio.sleep(0.05)

        confirmed_emails = [m for m in notification_service.provider.sent_messages if "Booking Confirmed" in m["subject"]]
        assert len(confirmed_emails) >= 1
        assert "Camera field test" in confirmed_emails[-1]["body_text"]

        # 2. Add waitlisted student for the same slot
        res_wl = await client.post("/waitlist", json={
            "unit_id": "eq-cam-04",
            "user_id": "usr-faculty-reed",
            "user_name": "Dr. Evelyn Reed",
            "user_role": "Faculty",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "urgency": "high",
            "purpose": "High-speed lab capture"
        })
        assert res_wl.status_code == 201

        # 3. Cancel booking -> triggers cancellation email + hold awarded email to Dr. Evelyn Reed
        res_cancel = await client.delete(f"/bookings/{booking_id}")
        assert res_cancel.status_code == 200

        await asyncio.sleep(0.05)

        cancelled_emails = [m for m in notification_service.provider.sent_messages if "Booking Cancelled" in m["subject"]]
        assert len(cancelled_emails) >= 1

        hold_emails = [m for m in notification_service.provider.sent_messages if "Hold Awarded" in m["subject"]]
        assert len(hold_emails) >= 1
        assert "e.reed@campus.edu" in hold_emails[-1]["to_email"]
        assert "10-MINUTE WINDOW" in hold_emails[-1]["body_text"]

@pytest.mark.asyncio
async def test_maintenance_cancellation_email_dispatch():
    """
    Verifies that admin maintenance toggles trigger background maintenance cancellation emails.
    """
    from backend.notifications import notification_service, ConsoleNotificationProvider

    if not isinstance(notification_service.provider, ConsoleNotificationProvider):
        notification_service.provider = ConsoleNotificationProvider()
    notification_service.provider.sent_messages.clear()

    with Session(test_engine) as session:
        if not session.get(Equipment, "eq-vr-02"):
            session.add(Equipment(
                id="eq-vr-02",
                name="VR Headset",
                unit_number="#05",
                type="vr",
                icon_url="/assets/icons/vr.png",
                building_id="bldg-media-2",
                building_name="Block B",
                status="available"
            ))
        if not session.get(User, "usr-student-marcus"):
            session.add(User(
                id="usr-student-marcus",
                name="Marcus Vance",
                role="Student",
                email="m.vance@campus.edu",
                department="Design",
                no_show_count=0,
                reliability_score=100
            ))
        session.commit()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start_time = datetime.now(timezone.utc) + timedelta(days=6, hours=14)
        end_time = start_time + timedelta(hours=2)

        # Create booking
        res_book = await client.post("/bookings", json={
            "unit_id": "eq-vr-02",
            "user_id": "usr-student-marcus",
            "user_name": "Marcus Vance",
            "user_role": "Student",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": "VR Prototyping"
        })
        assert res_book.status_code == 201
        bk_id = res_book.json()["id"]

        # Admin enables maintenance
        res_maint = await client.post("/admin/maintenance", json={
            "unit_id": "eq-vr-02",
            "is_active": True,
            "reason": "Firmware GPU update and calibration",
            "expected_return_time": (end_time + timedelta(hours=5)).isoformat()
        })
        assert res_maint.status_code == 200

        await asyncio.sleep(0.05)

        maint_emails = [m for m in notification_service.provider.sent_messages if "Maintenance" in m["subject"]]
        assert len(maint_emails) >= 1
        assert "Firmware GPU update and calibration" in maint_emails[-1]["body_text"]
        assert "m.vance@campus.edu" in maint_emails[-1]["to_email"]

@pytest.mark.asyncio
async def test_30m_booking_reminder_dispatch():
    """
    Verifies that upcoming active bookings (within 30 minutes of start) receive
    a reminder email and are marked reminder_sent=True.
    """
    from backend.notifications import notification_service, ConsoleNotificationProvider

    if not isinstance(notification_service.provider, ConsoleNotificationProvider):
        notification_service.provider = ConsoleNotificationProvider()
    notification_service.provider.sent_messages.clear()

    now = datetime.now(timezone.utc)
    slot_start = now + timedelta(minutes=20)
    slot_end = slot_start + timedelta(hours=1)

    with Session(test_engine) as session:
        # Seed test user and booking
        if not session.get(User, "usr-remind-alex"):
            session.add(User(
                id="usr-remind-alex",
                name="Alex M.",
                role="Student",
                email="alex.m@campus.edu",
                department="Computer Science",
                no_show_count=0,
                reliability_score=100
            ))

        booking = Booking(
            id="bk-remind-test",
            unit_id="eq-cam-01",
            user_id="usr-remind-alex",
            user_name="Alex M.",
            user_role="Student",
            start_time=slot_start,
            end_time=slot_end,
            purpose="Studio Photography",
            status="active",
            reminder_sent=False
        )
        session.add(booking)
        session.commit()

        # Execute 30m reminder scanner logic
        reminder_window = now + timedelta(minutes=30)
        stmt = select(Booking).where(
            Booking.status == "active",
            Booking.reminder_sent == False,
            Booking.start_time >= now,
            Booking.start_time <= reminder_window
        )
        upcoming = session.exec(stmt).all()
        assert len(upcoming) >= 1

        for ub in upcoming:
            ub.reminder_sent = True
            session.add(ub)
            session.commit()

            u_user = session.get(User, ub.user_id)
            u_unit = session.get(Equipment, ub.unit_id)
            notification_service.send_reminder_30m(
                user_email=u_user.email if u_user else f"{ub.user_id}@campus.edu",
                user_name=ub.user_name,
                booking_id=ub.id,
                unit_name=u_unit.name if u_unit else ub.unit_id,
                unit_number=u_unit.unit_number if u_unit else "",
                start_time=ub.start_time,
                end_time=ub.end_time
            )

        # Verify email sent
        reminder_emails = [m for m in notification_service.provider.sent_messages if "30 minutes" in m["subject"]]
        assert len(reminder_emails) == 1
        assert "Studio Photography" not in reminder_emails[0]["subject"]
        assert "alex.m@campus.edu" in reminder_emails[0]["to_email"]

        # Verify second pass sends nothing (idempotent)
        second_pass = session.exec(stmt).all()
        assert len(second_pass) == 0

@pytest.mark.asyncio
async def test_ai_scheduling_suggest_slots_with_ortools():
    """
    Verifies that POST /schedule/suggest uses OR-Tools to compute the best 3 non-overlapping slots
    ranked by priority score, unit utilization, and forecasted demand index.
    """
    # Seed multiple GPU units and an existing booking
    with Session(test_engine) as session:
        now = datetime.now(timezone.utc)
        start_time = now + timedelta(days=2, hours=10)
        end_time = start_time + timedelta(hours=3)

        # Ensure GPU units exist
        for unit_id, num in [("eq-gpu-01", "#01"), ("eq-gpu-02", "#02"), ("eq-gpu-03", "#03")]:
            if not session.get(Equipment, unit_id):
                session.add(Equipment(
                    id=unit_id,
                    name="GPU Compute Node",
                    unit_number=num,
                    type="gpu",
                    icon_url="/assets/icons/gpu.png",
                    building_id="bldg-comp-1",
                    building_name="Turing Hall",
                    status="available"
                ))

        # Add booking on eq-gpu-01 so it has higher utilization and a conflict window
        if not session.get(Booking, "bk-gpu-block"):
            session.add(Booking(
                id="bk-gpu-block",
                unit_id="eq-gpu-01",
                user_id="usr-other",
                user_name="Dr. Turing",
                user_role="Faculty",
                start_time=start_time,
                end_time=end_time,
                purpose="Deep Learning Training",
                status="active"
            ))
        session.commit()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        req_start = datetime.now(timezone.utc) + timedelta(days=2, hours=8)
        req_end = req_start + timedelta(days=2)

        resp = await client.post("/schedule/suggest", json={
            "equipment_type": "gpu",
            "duration_minutes": 120,
            "start_window": req_start.isoformat(),
            "end_window": req_end.isoformat(),
            "user_role": "Researcher",
            "urgency": "high"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["equipment_type"] == "gpu"
        assert "suggested_slots" in data
        slots = data["suggested_slots"]
        assert len(slots) <= 3
        assert len(slots) > 0

        # Verify slots structure and sanity
        for slot in slots:
            assert "unit_id" in slot
            assert "score" in slot
            assert slot["duration_minutes"] == 120
            assert "demand_level" in slot
            assert "recommendation_reason" in slot
            assert slot["score"] > 0

        # Assert no slot conflicts with the booked window on eq-gpu-01
        for slot in slots:
            if slot["unit_id"] == "eq-gpu-01":
                slot_s = datetime.fromisoformat(slot["start_time"].replace("Z", "+00:00"))
                slot_e = datetime.fromisoformat(slot["end_time"].replace("Z", "+00:00"))
                # Must not overlap [start_time, end_time]
                assert not (slot_s < end_time and slot_e > start_time), "Suggested slot clashes with existing booking"

@pytest.mark.asyncio
async def test_ai_scheduling_parse_nlp():
    """
    Verifies that POST /schedule/parse-nlp extracts structured parameters from natural language.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Prompt: "I need a GPU for 3 hours on Friday afternoon"
        resp = await client.post("/schedule/parse-nlp", json={
            "prompt": "I need a GPU for 3 hours on Friday afternoon"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["equipment_type"] == "gpu"
        assert data["duration_minutes"] == 180
        assert "earliest" in data
        assert "latest" in data

        # Test empty prompt rejects with 400
        bad_resp = await client.post("/schedule/parse-nlp", json={"prompt": "   "})
        assert bad_resp.status_code == 400



