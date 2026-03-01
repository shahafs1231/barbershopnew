from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


# ── Services ──────────────────────────────────────────────────────────────────

class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    duration_minutes: int
    category: str


class ServiceCreate(ServiceBase):
    pass


class ServiceOut(ServiceBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


# ── Barbers ───────────────────────────────────────────────────────────────────

class BarberBase(BaseModel):
    name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None
    avatar_color: Optional[str] = "#4F46E5"


class BarberCreate(BarberBase):
    pass


class BarberOut(BarberBase):
    id: int
    is_active: bool
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


# ── Appointments ──────────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    barber_id: int
    service_ids: List[int]
    appointment_date: str   # YYYY-MM-DD
    appointment_time: str   # HH:MM
    payment_method: str     # "prepay" or "on_site"
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    customer_name: str
    customer_phone: str
    customer_email: Optional[str]
    barber: BarberOut
    services: List[ServiceOut]
    appointment_date: str
    appointment_time: str
    end_time: str
    total_price: float
    payment_method: str
    payment_status: str
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AppointmentStatusUpdate(BaseModel):
    status: str  # confirmed, cancelled, completed


class RescheduleRequest(BaseModel):
    phone: str
    new_date: str   # YYYY-MM-DD
    new_time: str   # HH:MM


# ── Availability ──────────────────────────────────────────────────────────────

class TimeSlot(BaseModel):
    time: str       # HH:MM
    available: bool


class AvailabilityOut(BaseModel):
    date: str
    barber_id: int
    slots: List[TimeSlot]
