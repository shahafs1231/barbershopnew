from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# Association table: appointment <-> service (many-to-many)
appointment_services = Table(
    "appointment_services",
    Base.metadata,
    Column("appointment_id", Integer, ForeignKey("appointments.id")),
    Column("service_id", Integer, ForeignKey("services.id")),
)


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # duration in minutes
    category = Column(String(50), nullable=False)  # haircut, beard, accessories, combo
    is_active = Column(Boolean, default=True)

    appointments = relationship("Appointment", secondary=appointment_services, back_populates="services")


class Barber(Base):
    __tablename__ = "barbers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    specialty = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    avatar_color = Column(String(7), default="#4F46E5")  # for UI avatar
    photo_url = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True)

    appointments = relationship("Appointment", back_populates="barber")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(30), nullable=False)
    customer_email = Column(String(150), nullable=True)

    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False)
    barber = relationship("Barber", back_populates="appointments")

    services = relationship("Service", secondary=appointment_services, back_populates="appointments")

    appointment_date = Column(String(10), nullable=False)   # YYYY-MM-DD
    appointment_time = Column(String(5), nullable=False)    # HH:MM
    end_time = Column(String(5), nullable=False)            # HH:MM

    total_price = Column(Float, nullable=False)
    payment_method = Column(String(20), nullable=False)     # "prepay" or "on_site"
    payment_status = Column(String(20), default="pending")  # pending, paid, refunded

    status = Column(String(20), default="confirmed")        # confirmed, cancelled, completed
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
