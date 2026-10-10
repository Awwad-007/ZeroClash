import json
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from backend.database import engine, create_db_and_tables
from backend.models import User, Building, Equipment, Booking, WaitlistEntry, MaintenanceRecord, AuditLog
from backend.engine import calculate_priority_score

def get_relative_date(day_offset: int, hour: int, minute: int = 0) -> datetime:
    d = datetime.now(timezone.utc) + timedelta(days=day_offset)
    return d.replace(hour=hour, minute=minute, second=0, microsecond=0)

def seed_database():
    create_db_and_tables()

    with Session(engine) as session:
        # Check if already seeded
        if session.exec(select(User)).first():
            print("Database already seeded. Skipping.")
            return

        print("Seeding ZeroClash database...")

        # 1. Seed Users
        users = [
            User(id="usr-student-alex", name="Alex M.", role="Student", email="alex.m@campus.edu", department="Computer Science & Media", no_show_count=1, reliability_score=85),
            User(id="usr-faculty-reed", name="Dr. Evelyn Reed", role="Faculty", email="e.reed@campus.edu", department="Applied Physics & Quantum Optics", no_show_count=0, reliability_score=100),
            User(id="usr-researcher-devin", name="Devin T.", role="Researcher", email="devin.t@campus.edu", department="AI & Robotics Institute", no_show_count=0, reliability_score=95),
            User(id="usr-researcher-priya", name="Priya S.", role="Researcher", email="priya.s@campus.edu", department="Computational Vision & Graphics", no_show_count=0, reliability_score=98),
            User(id="usr-student-sarah", name="Sarah K.", role="Student", email="sarah.k@campus.edu", department="Documentary Cinema", no_show_count=2, reliability_score=70),
            User(id="usr-faculty-thorne", name="Prof. Aris Thorne", role="Faculty", email="a.thorne@campus.edu", department="Architecture & Spatial Design", no_show_count=0, reliability_score=100),
            User(id="usr-student-marcus", name="Marcus Vance", role="Student", email="m.vance@campus.edu", department="Mechanical Prototyping", no_show_count=1, reliability_score=85),
            User(id="usr-student-chloe", name="Chloe Sanders", role="Student", email="c.sanders@campus.edu", department="Virtual Worlds & Gaming", no_show_count=0, reliability_score=95),
            User(id="usr-student-liam", name="Liam N.", role="Student", email="liam.n@campus.edu", department="Spatial Computing", no_show_count=1, reliability_score=85),
            User(id="usr-admin-sarah", name="Sarah Jenkins (Lab Admin)", role="Lab Admin", email="admin.jenkins@campus.edu", department="Central Research Infrastructure", no_show_count=0, reliability_score=100),
        ]
        session.add_all(users)

        # 2. Seed Buildings
        buildings = [
            Building(id="bldg-science", name="Science Wing", code="SW-01", category="science", color_theme="cyan", neon_color="#00e5ff", fill_color="#0284c7", position_json="[-7.5, 0, -1.5]", size_json="[7.2, 3.8, 7.2]", architectural_type="science-wing"),
            Building(id="bldg-empty-blue", name="North Annex", code="NA-02", category="annex", color_theme="dark-blue", neon_color="#0284c7", fill_color="#0f172a", position_json="[-3.5, 0, -7.5]", size_json="[6.0, 4.2, 5.5]", architectural_type="stepped-annex"),
            Building(id="bldg-media-1", name="Media Lab", code="Block A - Media Wing", category="media", color_theme="green", neon_color="#22c55e", fill_color="#15803d", position_json="[4.5, 0, -4.5]", size_json="[7.0, 3.8, 6.0]", architectural_type="media-hall"),
            Building(id="bldg-empty-orange", name="East Archive", code="EA-04", category="archive", color_theme="orange", neon_color="#ea580c", fill_color="#7c2d12", position_json="[10.5, 0, 0.5]", size_json="[5.8, 4.0, 5.2]", architectural_type="cube-archive"),
            Building(id="bldg-library", name="Main Library Locker", code="LIB-HUB", category="library", color_theme="orange", neon_color="#f97316", fill_color="#c2410c", position_json="[6.5, 0, 6.0]", size_json="[7.0, 4.4, 6.6]", architectural_type="classical-library"),
            Building(id="bldg-media-2", name="Media Lab", code="Block B - Studio 2", category="media", color_theme="green", neon_color="#22c55e", fill_color="#15803d", position_json="[0.5, 0, 8.0]", size_json="[6.4, 3.6, 5.4]", architectural_type="media-hall"),
            Building(id="bldg-media-3", name="Media Lab", code="Block B - Studio 1", category="media", color_theme="green", neon_color="#22c55e", fill_color="#15803d", position_json="[-6.0, 0, 4.5]", size_json="[6.2, 3.8, 5.2]", architectural_type="media-hall"),
        ]
        session.add_all(buildings)

        # 3. Seed Equipment
        equipment = [
            Equipment(id="eq-cam-01", name="DSLR Camera", unit_number="#01", type="camera", icon_url="/assets/icons/camera.png", building_id="bldg-science", building_name="Science Wing - Lab 102", status="available", status_text="AVAILABLE until 16:00 today", specs_json=json.dumps({"model": "Sony Alpha 7 IV Mirrorless", "resolution": "33MP Full-Frame 4K60p"}), aliases_json=json.dumps(["sony", "dslr", "camera"])),
            Equipment(id="eq-print-01", name="3D Printer", unit_number="#02", type="printer", icon_url="/assets/icons/printer.png", building_id="bldg-science", building_name="Science Wing - Fabrication Suite", status="available", status_text="AVAILABLE until 18:30 today", specs_json=json.dumps({"model": "Bambu Lab X1-Carbon Combo", "resolution": "50-micron high-speed print"}), aliases_json=json.dumps(["printer", "3d", "print"])),
            Equipment(id="eq-cam-04", name="DSLR Camera", unit_number="#04", type="camera", icon_url="/assets/icons/camera.png", building_id="bldg-media-1", building_name="Block A - Media Wing", status="available", status_text="AVAILABLE until 12:00 today", specs_json=json.dumps({"model": "Canon EOS R5C Cinema", "resolution": "45MP 8K Raw 60fps"}), aliases_json=json.dumps(["camera", "dslr", "canon"])),
            Equipment(id="eq-gpu-01", name="GPU Compute Node", unit_number="#08", type="gpu", icon_url="/assets/icons/gpu.png", building_id="bldg-media-1", building_name="Block A - Media Wing", status="booked", status_text="IN USE until 17:30 today (Devin T.)", specs_json=json.dumps({"model": "NVIDIA RTX 4090 24GB Server Node", "vram": "24GB GDDR6X"}), aliases_json=json.dumps(["gpu", "cuda", "nvidia"])),
            Equipment(id="eq-vr-01", name="VR Headset", unit_number="#03", type="vr", icon_url="/assets/icons/vr.png", building_id="bldg-media-1", building_name="Block A - Media Wing", status="available", status_text="AVAILABLE until 14:00 today", specs_json=json.dumps({"model": "Meta Quest Pro 256GB", "resolution": "1800x1920 per eye"}), aliases_json=json.dumps(["vr", "meta", "quest"])),
            Equipment(id="eq-cam-02", name="DSLR Camera", unit_number="#02", type="camera", icon_url="/assets/icons/camera.png", building_id="bldg-library", building_name="Main Library Locker - Bay 3", status="booked", status_text="IN USE until 15:00 today (Sarah K.)", specs_json=json.dumps({"model": "Sony FX3 Cinema Line", "resolution": "12.1MP Full-Frame 4K120p"}), aliases_json=json.dumps(["camera", "dslr", "sony"])),
            Equipment(id="eq-proj-01", name="Laser Projector", unit_number="#01", type="projector", icon_url="/assets/icons/projector.png", building_id="bldg-library", building_name="Main Library Locker - Bay 1", status="available", status_text="AVAILABLE until 17:00 today", specs_json=json.dumps({"model": "Epson Pro L1070U 4K Laser", "resolution": "1920x1200 WUXGA"}), aliases_json=json.dumps(["projector", "proj", "epson"])),
            Equipment(id="eq-vr-02", name="VR Headset", unit_number="#05", type="vr", icon_url="/assets/icons/vr.png", building_id="bldg-media-2", building_name="Block B - Studio 2", status="available", status_text="AVAILABLE until 14:00 today", specs_json=json.dumps({"model": "HTC Vive Focus 3 Industrial", "resolution": "5K (2448x2448 per eye)"}), aliases_json=json.dumps(["vr", "vive", "htc"])),
            Equipment(id="eq-micro-01", name="Digital Microscope", unit_number="#01", type="microscope", icon_url="/assets/icons/microscope.png", building_id="bldg-media-2", building_name="Block B - Studio 2", status="maintenance", status_text="MAINTENANCE - Lens Recalibration until tomorrow 10:00", specs_json=json.dumps({"model": "Keyence VHX-7000 Digital Microscope"}), aliases_json=json.dumps(["microscope", "keyence"])),
            Equipment(id="eq-vr-03", name="VR Headset", unit_number="#06", type="vr", icon_url="/assets/icons/vr.png", building_id="bldg-media-3", building_name="Block B - Studio 1", status="booked", status_text="IN USE until 16:15 today (Prof. Aris Thorne)", specs_json=json.dumps({"model": "Apple Vision Pro 512GB"}), aliases_json=json.dumps(["vr", "apple"])),
            Equipment(id="eq-micro-02", name="Digital Microscope", unit_number="#02", type="microscope", icon_url="/assets/icons/microscope.png", building_id="bldg-media-3", building_name="Block B - Studio 1", status="available", status_text="AVAILABLE until 18:00 today", specs_json=json.dumps({"model": "Leica DM6 B Automated Microscope"}), aliases_json=json.dumps(["microscope", "leica"])),
        ]
        session.add_all(equipment)

        # 4. Seed Bookings
        bookings = [
            Booking(id="bk-seed-01", unit_id="eq-gpu-01", user_id="usr-researcher-devin", user_name="Devin T.", user_role="Researcher", start_time=get_relative_date(0, 10, 0), end_time=get_relative_date(0, 17, 30), purpose="Deep Learning Diffusion Model Benchmark", status="active"),
            Booking(id="bk-seed-02", unit_id="eq-cam-02", user_id="usr-student-sarah", user_name="Sarah K.", user_role="Student", start_time=get_relative_date(0, 11, 0), end_time=get_relative_date(0, 15, 0), purpose="Design Documentary Interview B-Roll", status="active"),
            Booking(id="bk-seed-03", unit_id="eq-vr-03", user_id="usr-faculty-thorne", user_name="Prof. Aris Thorne", user_role="Faculty", start_time=get_relative_date(0, 13, 0), end_time=get_relative_date(0, 16, 15), purpose="Interactive Architecture Simulation", status="active"),
            Booking(id="bk-seed-04", unit_id="eq-cam-04", user_id="usr-student-alex", user_name="Alex M.", user_role="Student", start_time=get_relative_date(0, 12, 0), end_time=get_relative_date(0, 15, 0), purpose="Campus Night Photography & Motion Tracking", status="active"),
            Booking(id="bk-seed-05", unit_id="eq-cam-01", user_id="usr-faculty-reed", user_name="Dr. Evelyn Reed", user_role="Faculty", start_time=get_relative_date(0, 16, 0), end_time=get_relative_date(0, 19, 0), purpose="Interferometer Optical Alignment Recording", status="active"),
            Booking(id="bk-seed-06", unit_id="eq-vr-01", user_id="usr-student-chloe", user_name="Chloe Sanders", user_role="Student", start_time=get_relative_date(0, 14, 0), end_time=get_relative_date(0, 16, 30), purpose="Haptic Feedback Usability Study", status="active"),
            Booking(id="bk-seed-07", unit_id="eq-proj-01", user_id="usr-student-alex", user_name="Alex M.", user_role="Student", start_time=get_relative_date(0, 17, 0), end_time=get_relative_date(0, 20, 0), purpose="Robotics Club Keynote & Demo Prep", status="active"),
            Booking(id="bk-seed-08", unit_id="eq-micro-02", user_id="usr-researcher-priya", user_name="Priya S.", user_role="Researcher", start_time=get_relative_date(0, 18, 0), end_time=get_relative_date(0, 21, 0), purpose="Graphene Microstructure Spectrometry", status="active"),
            Booking(id="bk-seed-09", unit_id="eq-gpu-01", user_id="usr-researcher-priya", user_name="Priya S.", user_role="Researcher", start_time=get_relative_date(1, 9, 0), end_time=get_relative_date(1, 14, 0), purpose="Transformer Attention Map Analysis", status="active"),
            Booking(id="bk-seed-10", unit_id="eq-cam-04", user_id="usr-student-sarah", user_name="Sarah K.", user_role="Student", start_time=get_relative_date(1, 10, 30), end_time=get_relative_date(1, 13, 30), purpose="Senior Capstone Short Film Scene 4", status="active"),
            Booking(id="bk-seed-11", unit_id="eq-vr-02", user_id="usr-student-liam", user_name="Liam N.", user_role="Student", start_time=get_relative_date(1, 14, 0), end_time=get_relative_date(1, 17, 0), purpose="Multi-User Spatial Telepresence Test", status="active"),
            Booking(id="bk-seed-12", unit_id="eq-print-01", user_id="usr-student-marcus", user_name="Marcus Vance", user_role="Student", start_time=get_relative_date(1, 15, 0), end_time=get_relative_date(1, 19, 0), purpose="Quadcopter Chassis Prototyping", status="active"),
        ]
        session.add_all(bookings)

        # 5. Seed Waitlist
        waitlist = [
            WaitlistEntry(id="wl-seed-01", unit_id="eq-gpu-01", user_id="usr-faculty-reed", user_name="Dr. Evelyn Reed", user_role="Faculty", start_time=get_relative_date(0, 11, 0), end_time=get_relative_date(0, 15, 0), urgency="high", purpose="Urgent Grant Proposal Simulation Rerun", priority_score=calculate_priority_score("Faculty", "high", 0), status="waiting"),
            WaitlistEntry(id="wl-seed-02", unit_id="eq-gpu-01", user_id="usr-researcher-priya", user_name="Priya S.", user_role="Researcher", start_time=get_relative_date(0, 13, 0), end_time=get_relative_date(0, 17, 0), urgency="high", purpose="CVPR Camera Ready Visual Validation", priority_score=calculate_priority_score("Researcher", "high", 0), status="waiting"),
            WaitlistEntry(id="wl-seed-03", unit_id="eq-gpu-01", user_id="usr-student-alex", user_name="Alex M.", user_role="Student", start_time=get_relative_date(0, 12, 0), end_time=get_relative_date(0, 16, 0), urgency="medium", purpose="Course Project Model Convergence Test", priority_score=calculate_priority_score("Student", "medium", 1), status="waiting"),
            WaitlistEntry(id="wl-seed-04", unit_id="eq-cam-04", user_id="usr-researcher-devin", user_name="Devin T.", user_role="Researcher", start_time=get_relative_date(0, 13, 0), end_time=get_relative_date(0, 16, 0), urgency="medium", purpose="High-Speed Tracking Calibration", priority_score=calculate_priority_score("Researcher", "medium", 0), status="waiting"),
        ]
        session.add_all(waitlist)

        # 6. Seed Maintenance
        maintenance = [
            MaintenanceRecord(id="maint-seed-01", unit_id="eq-micro-01", is_active=True, reason="Lens Recalibration & Optical Sensor Cleaning", expected_return_time=get_relative_date(1, 10, 0), started_at=get_relative_date(0, 7, 0)),
            MaintenanceRecord(id="maint-seed-02", unit_id="eq-print-01", is_active=True, reason="Hotend Assembly Maintenance & Dual-Extruder Tuning", expected_return_time=get_relative_date(0, 18, 0), started_at=get_relative_date(0, 8, 30)),
        ]
        session.add_all(maintenance)

        session.commit()
        print("Database successfully seeded with realistic academic hub data.")

if __name__ == "__main__":
    seed_database()
