from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field

def utc_now():
    return datetime.now(timezone.utc)

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    role: str = Field(index=True) # Student, Faculty, Researcher, Lab Admin
    email: str = Field(unique=True, index=True)
    department: str
    no_show_count: int = Field(default=0)
    reliability_score: int = Field(default=100)

class Building(SQLModel, table=True):
    __tablename__ = "buildings"
    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    code: str
    category: str
    color_theme: str
    neon_color: str
    fill_color: str
    position_json: str # "[x, y, z]"
    size_json: str # "[w, h, d]"
    architectural_type: str

class Equipment(SQLModel, table=True):
    __tablename__ = "equipment"
    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    unit_number: str
    type: str = Field(index=True)
    icon_url: str
    building_id: str = Field(index=True)
    building_name: str
    status: str = Field(default="available", index=True) # available, booked, maintenance
    status_text: str = Field(default="AVAILABLE for reservation")
    specs_json: str = Field(default="{}")
    aliases_json: str = Field(default="[]")

class Booking(SQLModel, table=True):
    __tablename__ = "bookings"
    id: str = Field(primary_key=True)
    unit_id: str = Field(index=True)
    user_id: str = Field(index=True)
    user_name: str
    user_role: str
    start_time: datetime = Field(index=True)
    end_time: datetime = Field(index=True)
    purpose: str
    status: str = Field(default="active", index=True) # active, cancelled, completed
    created_at: datetime = Field(default_factory=utc_now)

class WaitlistEntry(SQLModel, table=True):
    __tablename__ = "waitlist"
    id: str = Field(primary_key=True)
    unit_id: str = Field(index=True)
    user_id: str = Field(index=True)
    user_name: str
    user_role: str
    start_time: datetime = Field(index=True)
    end_time: datetime = Field(index=True)
    urgency: str # low, medium, high
    purpose: str
    priority_score: int = Field(index=True)
    status: str = Field(default="waiting", index=True) # waiting, on_hold, promoted, expired, cancelled
    requested_at: datetime = Field(default_factory=utc_now)
    hold_expires_at: Optional[datetime] = None
    hold_id: Optional[str] = None

class HoldEntry(SQLModel, table=True):
    __tablename__ = "holds"
    id: str = Field(primary_key=True)
    waitlist_entry_id: str = Field(index=True)
    unit_id: str = Field(index=True)
    user_id: str = Field(index=True)
    user_name: str
    user_role: str
    start_time: datetime
    end_time: datetime
    held_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)
    confirmed: bool = Field(default=False)
    expired: bool = Field(default=False)

class MaintenanceRecord(SQLModel, table=True):
    __tablename__ = "maintenance"
    id: str = Field(primary_key=True)
    unit_id: str = Field(index=True)
    is_active: bool = Field(default=True, index=True)
    reason: str
    expected_return_time: datetime = Field(index=True)
    started_at: datetime = Field(default_factory=utc_now)
    cancelled_booking_ids_json: str = Field(default="[]")

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    id: str = Field(primary_key=True)
    action: str = Field(index=True)
    target_id: str = Field(index=True)
    details: str
    timestamp: datetime = Field(default_factory=utc_now)
    user_id: str = Field(index=True)
