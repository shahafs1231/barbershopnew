import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid, aiofiles

import models
import schemas
from database import engine, get_db, Base
from dotenv import load_dotenv

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if not os.environ.get("VERCEL"):
    _env_file = os.path.join(_BACKEND_DIR, ".env")
    if os.path.isfile(_env_file):
        load_dotenv(_env_file, override=True)

Base.metadata.create_all(bind=engine)

# ── Static directory for barber photos ───────────────────────────────────────
# Vercel's filesystem is read-only except for /tmp
STATIC_DIR = "/tmp/static" if os.environ.get("VERCEL") else os.path.join(_BACKEND_DIR, "static")
os.makedirs(f"{STATIC_DIR}/barbers", exist_ok=True)

app = FastAPI(title="Barbershop API", version="1.0.0")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_allowed_origins = [
    "http://localhost:3000", "http://localhost:3001",
    "http://localhost:3002", "http://localhost:3003",
    "http://localhost:9000",
]
_vercel_url = os.getenv("VERCEL_URL")
if _vercel_url:
    _allowed_origins.append(f"https://{_vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ─────────────────────────────────────────────────────────────────

OPEN_HOUR = 10
CLOSE_HOUR = 20
SLOT_INTERVAL = 30
CANCEL_CUTOFF_HOURS = 8   # customer can cancel/reschedule only if ≥ 8 h before

# weekday(): Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
WORKING_DAYS = {1, 2, 3, 4, 6}


def _generate_slots() -> List[str]:
    slots = []
    t = datetime.strptime(f"{OPEN_HOUR:02d}:00", "%H:%M")
    end = datetime.strptime(f"{CLOSE_HOUR:02d}:00", "%H:%M")
    while t <= end:
        slots.append(t.strftime("%H:%M"))
        t += timedelta(minutes=SLOT_INTERVAL)
    return slots


def _add_minutes(time_str: str, minutes: int) -> str:
    t = datetime.strptime(time_str, "%H:%M") + timedelta(minutes=minutes)
    return t.strftime("%H:%M")


def _time_range_blocks(start: str, duration: int) -> List[str]:
    blocks = []
    t = datetime.strptime(start, "%H:%M")
    end = t + timedelta(minutes=duration)
    while t < end:
        blocks.append(t.strftime("%H:%M"))
        t += timedelta(minutes=SLOT_INTERVAL)
    return blocks


def _is_working_day(d: date) -> bool:
    return d.weekday() in WORKING_DAYS


def _appt_datetime(appt: models.Appointment) -> datetime:
    """Return the appointment's start as a datetime object."""
    return datetime.strptime(f"{appt.appointment_date} {appt.appointment_time}", "%Y-%m-%d %H:%M")


def _hours_until(appt: models.Appointment) -> float:
    delta = _appt_datetime(appt) - datetime.now()
    return delta.total_seconds() / 3600


# ── Services ──────────────────────────────────────────────────────────────────

@app.get("/services", response_model=List[schemas.ServiceOut])
def get_services(db: Session = Depends(get_db)):
    return db.query(models.Service).filter(models.Service.is_active == True).all()


@app.post("/services", response_model=schemas.ServiceOut)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    obj = models.Service(**service.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/services/{service_id}", response_model=schemas.ServiceOut)
def update_service(service_id: int, data: schemas.ServiceCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not obj:
        raise HTTPException(404, "Service not found")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not obj:
        raise HTTPException(404, "Service not found")
    obj.is_active = False
    db.commit()
    return {"ok": True}


# ── Barbers ───────────────────────────────────────────────────────────────────

@app.get("/barbers", response_model=List[schemas.BarberOut])
def get_barbers(db: Session = Depends(get_db)):
    return db.query(models.Barber).filter(models.Barber.is_active == True).all()


@app.post("/barbers", response_model=schemas.BarberOut)
def create_barber(barber: schemas.BarberCreate, db: Session = Depends(get_db)):
    obj = models.Barber(**barber.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/barbers/{barber_id}", response_model=schemas.BarberOut)
def update_barber(barber_id: int, data: schemas.BarberCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not obj:
        raise HTTPException(404, "Barber not found")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/barbers/{barber_id}")
def delete_barber(barber_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not obj:
        raise HTTPException(404, "Barber not found")
    obj.is_active = False
    db.commit()
    return {"ok": True}


@app.post("/barbers/{barber_id}/photo", response_model=schemas.BarberOut)
async def upload_barber_photo(barber_id: int, photo: UploadFile = File(...), db: Session = Depends(get_db)):
    obj = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not obj:
        raise HTTPException(404, "Barber not found")

    ext = photo.filename.rsplit(".", 1)[-1].lower() if photo.filename and "." in photo.filename else "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp"}:
        raise HTTPException(400, "Only jpg, png, webp images are allowed")

    filename = f"barber_{barber_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(STATIC_DIR, "barbers", filename)

    async with aiofiles.open(filepath, "wb") as f:
        content = await photo.read()
        await f.write(content)

    # Remove old photo file if present
    if obj.photo_url:
        old_path = obj.photo_url.lstrip("/").replace("static/", f"{STATIC_DIR}/", 1)
        if os.path.exists(old_path):
            os.remove(old_path)

    obj.photo_url = f"/static/barbers/{filename}"
    db.commit()
    db.refresh(obj)
    return obj


# ── Availability ──────────────────────────────────────────────────────────────

@app.get("/availability/{barber_id}/{date_str}", response_model=schemas.AvailabilityOut)
def get_availability(
    barber_id: int,
    date_str: str,
    service_ids: Optional[str] = Query(None),
    exclude_appointment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    if not _is_working_day(target_date):
        return schemas.AvailabilityOut(date=date_str, barber_id=barber_id, slots=[])

    total_duration = SLOT_INTERVAL
    if service_ids:
        ids = [int(i) for i in service_ids.split(",") if i.strip().isdigit()]
        svcs = db.query(models.Service).filter(models.Service.id.in_(ids)).all()
        if svcs:
            total_duration = sum(s.duration_minutes for s in svcs)
            total_duration = max(SLOT_INTERVAL, ((total_duration + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)

    all_slots = _generate_slots()

    existing = db.query(models.Appointment).filter(
        models.Appointment.barber_id == barber_id,
        models.Appointment.appointment_date == date_str,
        models.Appointment.status != "cancelled",
    ).all()

    blocked: set[str] = set()
    for appt in existing:
        if exclude_appointment_id and appt.id == exclude_appointment_id:
            continue
        svc_duration = sum(s.duration_minutes for s in appt.services) if appt.services else SLOT_INTERVAL
        svc_duration = max(SLOT_INTERVAL, ((svc_duration + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)
        for block in _time_range_blocks(appt.appointment_time, svc_duration):
            blocked.add(block)

    now = datetime.now()
    today = now.date()

    result_slots = []
    for slot in all_slots:
        end = _add_minutes(slot, total_duration)
        close_str = f"{CLOSE_HOUR:02d}:30"
        if end > close_str:
            continue
        if target_date == today:
            slot_dt = datetime.combine(today, datetime.strptime(slot, "%H:%M").time())
            if slot_dt <= now:
                continue
        needed_blocks = _time_range_blocks(slot, total_duration)
        available = not any(b in blocked for b in needed_blocks)
        result_slots.append(schemas.TimeSlot(time=slot, available=available))

    return schemas.AvailabilityOut(date=date_str, barber_id=barber_id, slots=result_slots)


# ── Appointments ──────────────────────────────────────────────────────────────

@app.get("/appointments", response_model=List[schemas.AppointmentOut])
def list_appointments(
    date: Optional[str] = Query(None),
    barber_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Appointment)
    if date:
        q = q.filter(models.Appointment.appointment_date == date)
    if barber_id:
        q = q.filter(models.Appointment.barber_id == barber_id)
    if status:
        q = q.filter(models.Appointment.status == status)
    return q.order_by(models.Appointment.appointment_date, models.Appointment.appointment_time).all()


@app.post("/appointments", response_model=schemas.AppointmentOut, status_code=201)
def create_appointment(data: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    try:
        target_date = datetime.strptime(data.appointment_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    if not _is_working_day(target_date):
        raise HTTPException(400, "The barbershop is closed on that day")

    barber = db.query(models.Barber).filter(
        models.Barber.id == data.barber_id, models.Barber.is_active == True
    ).first()
    if not barber:
        raise HTTPException(404, "Barber not found")

    services = db.query(models.Service).filter(models.Service.id.in_(data.service_ids)).all()
    if len(services) != len(data.service_ids):
        raise HTTPException(400, "One or more services not found")

    total_duration = sum(s.duration_minutes for s in services)
    total_duration = max(SLOT_INTERVAL, ((total_duration + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)
    total_price = sum(s.price for s in services)
    end_time = _add_minutes(data.appointment_time, total_duration)

    if end_time > f"{CLOSE_HOUR:02d}:30":
        raise HTTPException(400, "Appointment would exceed closing time (20:30)")

    existing = db.query(models.Appointment).filter(
        models.Appointment.barber_id == data.barber_id,
        models.Appointment.appointment_date == data.appointment_date,
        models.Appointment.status != "cancelled",
    ).all()

    blocked: set[str] = set()
    for appt in existing:
        dur = sum(s.duration_minutes for s in appt.services) if appt.services else SLOT_INTERVAL
        dur = max(SLOT_INTERVAL, ((dur + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)
        for block in _time_range_blocks(appt.appointment_time, dur):
            blocked.add(block)

    needed = _time_range_blocks(data.appointment_time, total_duration)
    if any(b in blocked for b in needed):
        raise HTTPException(409, "This time slot is already booked")

    appointment = models.Appointment(
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        barber_id=data.barber_id,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        end_time=end_time,
        total_price=total_price,
        payment_method=data.payment_method,
        payment_status="paid" if data.payment_method == "prepay" else "pending",
        status="confirmed",
        notes=data.notes,
    )
    appointment.services = services
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@app.get("/appointments/{appointment_id}", response_model=schemas.AppointmentOut)
def get_appointment(appointment_id: int, phone: Optional[str] = Query(None), db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    # If phone provided, verify it matches (customer self-service)
    if phone and appt.customer_phone.replace("-", "").replace(" ", "") != phone.replace("-", "").replace(" ", ""):
        raise HTTPException(403, "Phone number does not match this appointment")
    return appt


@app.patch("/appointments/{appointment_id}/status", response_model=schemas.AppointmentOut)
def update_appointment_status(appointment_id: int, data: schemas.AppointmentStatusUpdate, db: Session = Depends(get_db)):
    """Admin-only status update — no time restriction."""
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    appt.status = data.status
    db.commit()
    db.refresh(appt)
    return appt


@app.delete("/appointments/{appointment_id}")
def cancel_appointment(
    appointment_id: int,
    phone: Optional[str] = Query(None),
    admin: bool = Query(False),
    db: Session = Depends(get_db),
):
    """
    Cancel an appointment.
    - admin=true: no time restriction (admin portal)
    - otherwise: requires phone match + appointment must be ≥8 hours away
    """
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")

    if appt.status == "cancelled":
        raise HTTPException(400, "Appointment is already cancelled")

    if not admin:
        if not phone:
            raise HTTPException(400, "Phone number required to cancel")
        if appt.customer_phone.replace("-", "").replace(" ", "") != phone.replace("-", "").replace(" ", ""):
            raise HTTPException(403, "Phone number does not match this appointment")
        hours_left = _hours_until(appt)
        if hours_left < CANCEL_CUTOFF_HOURS:
            raise HTTPException(400, f"Cancellation is only allowed {CANCEL_CUTOFF_HOURS}+ hours before the appointment. Only {hours_left:.1f}h remaining.")

    appt.status = "cancelled"
    db.commit()
    return {"ok": True, "message": "Appointment cancelled"}


@app.patch("/appointments/{appointment_id}/reschedule", response_model=schemas.AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    data: schemas.RescheduleRequest,
    db: Session = Depends(get_db),
):
    """
    Reschedule an appointment to a new date/time.
    Requires phone match + appointment must be ≥8 hours away.
    """
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")

    if appt.status != "confirmed":
        raise HTTPException(400, "Only confirmed appointments can be rescheduled")

    # Verify phone
    if appt.customer_phone.replace("-", "").replace(" ", "") != data.phone.replace("-", "").replace(" ", ""):
        raise HTTPException(403, "Phone number does not match this appointment")

    # Enforce 8-hour cutoff
    hours_left = _hours_until(appt)
    if hours_left < CANCEL_CUTOFF_HOURS:
        raise HTTPException(400, f"Rescheduling is only allowed {CANCEL_CUTOFF_HOURS}+ hours before the appointment.")

    # Validate new date
    try:
        new_date = datetime.strptime(data.new_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format")
    if not _is_working_day(new_date):
        raise HTTPException(400, "The barbershop is closed on that day")

    # Check new slot availability (exclude the current appointment)
    total_duration = sum(s.duration_minutes for s in appt.services) if appt.services else SLOT_INTERVAL
    total_duration = max(SLOT_INTERVAL, ((total_duration + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)

    new_end = _add_minutes(data.new_time, total_duration)
    if new_end > f"{CLOSE_HOUR:02d}:30":
        raise HTTPException(400, "New time would exceed closing time (20:30)")

    existing = db.query(models.Appointment).filter(
        models.Appointment.barber_id == appt.barber_id,
        models.Appointment.appointment_date == data.new_date,
        models.Appointment.status != "cancelled",
        models.Appointment.id != appointment_id,
    ).all()

    blocked: set[str] = set()
    for a in existing:
        dur = sum(s.duration_minutes for s in a.services) if a.services else SLOT_INTERVAL
        dur = max(SLOT_INTERVAL, ((dur + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)
        for block in _time_range_blocks(a.appointment_time, dur):
            blocked.add(block)

    needed = _time_range_blocks(data.new_time, total_duration)
    if any(b in blocked for b in needed):
        raise HTTPException(409, "The new time slot is already booked")

    appt.appointment_date = data.new_date
    appt.appointment_time = data.new_time
    appt.end_time = new_end
    db.commit()
    db.refresh(appt)
    return appt


# ── Home Page / Appearance ────────────────────────────────────────────────────

HERO_IMAGE_PATH = (
    "/tmp/hero-bg.png"
    if os.environ.get("VERCEL")
    else os.path.join(_BACKEND_DIR, "..", "frontend", "public", "hero-bg.png")
)

@app.post("/settings/hero-image")
async def upload_hero_image(image: UploadFile = File(...)):
    ext = image.filename.rsplit(".", 1)[-1].lower() if image.filename and "." in image.filename else "png"
    if ext not in {"jpg", "jpeg", "png", "webp"}:
        raise HTTPException(400, "Only jpg, png, webp images are allowed")
    content = await image.read()
    async with aiofiles.open(HERO_IMAGE_PATH, "wb") as f:
        await f.write(content)
    return {"ok": True}


@app.get("/settings/hero-image-exists")
def hero_image_exists():
    return {"exists": os.path.exists(HERO_IMAGE_PATH)}


# ── Business Info ─────────────────────────────────────────────────────────────

@app.get("/info")
def get_info():
    return {
        "name": "BarberShop",
        "working_hours": {"open": "10:00", "close": "20:30"},
        "working_days": ["Sunday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "closed_days": ["Monday", "Saturday"],
        "slot_interval_minutes": SLOT_INTERVAL,
        "cancel_cutoff_hours": CANCEL_CUTOFF_HOURS,
    }


# ── WhatsApp Webhook (Meta Cloud API) ─────────────────────────────────────────

@app.get("/webhook/whatsapp")
async def whatsapp_verify(
    hub_mode:         str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge:    str = Query(None, alias="hub.challenge"),
):
    """
    Meta calls this once when you register the webhook URL.
    It checks that hub.verify_token matches WHATSAPP_VERIFY_TOKEN in your .env.
    """
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "barbershop_verify")
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(403, "Webhook verification failed — check WHATSAPP_VERIFY_TOKEN")


@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    Meta posts all WhatsApp events here (incoming messages, delivery receipts, etc.).
    We only act on text messages; everything else is acknowledged and ignored.
    """
    from whatsapp_bot import process_message, send_whatsapp_reply

    payload = await request.json()
    print("[WH] payload received:", str(payload)[:200])

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            msgs = value.get("messages", [])
            print(f"[WH] found {len(msgs)} messages")
            for msg in msgs:
                if msg.get("type") == "text":
                    phone = msg["from"]
                    text  = msg["text"]["body"]
                    print(f"[WH] processing: {phone} → {text}")
                    try:
                        reply = await process_message(phone, text)
                        print(f"[WH] reply: {reply[:80]}")
                        await send_whatsapp_reply(phone, reply)
                        print("[WH] sent ok")
                    except Exception as e:
                        print(f"[WH] ERROR: {e}")

    return {"status": "ok"}


# ── AI Hair Try-On ────────────────────────────────────────────────────────────

@app.post("/ai/hairstyle-preview")
async def hairstyle_preview(
    photo: UploadFile = File(...),
    style: str = Form(...),
):
    import base64, httpx

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(500, "GEMINI_API_KEY not configured")

    content = await photo.read()
    mime_type = photo.content_type or "image/jpeg"
    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Only JPEG, PNG or WebP images are supported")

    prompt = (
        f"Edit this person's hairstyle to: {style}. "
        "Keep their face, skin tone, background, and clothing exactly the same. "
        "Only modify the hair — style, length, and shape."
    )

    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(content).decode()}},
            ]
        }],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models"
        f"/gemini-2.0-flash-exp-image-generation:generateContent?key={api_key}"
    )

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=body)

    if resp.status_code != 200:
        raise HTTPException(502, f"Gemini API error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        if "inlineData" in part:
            return {"image": part["inlineData"]["data"], "mime_type": part["inlineData"]["mimeType"]}

    raise HTTPException(500, "Gemini did not return an image — try a different photo or style")
