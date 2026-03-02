"""
WhatsApp AI Booking Agent
Claude claude-sonnet-4-6 with tool use — books, views, reschedules, and cancels
barbershop appointments via Meta WhatsApp Cloud API.

Entry points:
  process_message(phone, text) → reply str
  send_whatsapp_reply(to, text) → sends message via Meta Graph API
Both are called by /webhook/whatsapp in main.py
"""

import os
import json
import httpx
from datetime import datetime, timedelta

from anthropic import AsyncAnthropic

from database import SessionLocal
import models

# ── Meta Graph API sender ─────────────────────────────────────────────────────

async def send_whatsapp_reply(to: str, text: str) -> None:
    """Send a WhatsApp message via Meta Cloud API."""
    token          = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

    if not token or not phone_number_id:
        print("[WhatsApp] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — reply not sent.")
        return

    url = f"https://graph.facebook.com/v20.0/{phone_number_id}/messages"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to":   to,
                "type": "text",
                "text": {"body": text},
            },
        )
    if resp.status_code != 200:
        print(f"[WhatsApp] Send failed {resp.status_code}: {resp.text}")

# ── Constants (must stay in sync with main.py) ────────────────────────────────
OPEN_HOUR           = 10
CLOSE_HOUR          = 20
SLOT_INTERVAL       = 30          # minutes
CANCEL_CUTOFF_HOURS = 8
WORKING_DAYS        = {1, 2, 3, 4, 6}   # Python weekday: Mon=0 … Sun=6

# ── Anthropic client ──────────────────────────────────────────────────────────
_client = AsyncAnthropic()

# ── Session store: phone → message list ───────────────────────────────────────
_sessions: dict[str, list] = {}
SESSION_MAX = 30   # trim to last N messages to keep tokens low

# ─────────────────────────────────────────────────────────────────────────────
# Slot helpers (mirrors main.py logic)
# ─────────────────────────────────────────────────────────────────────────────

def _all_slots() -> list[str]:
    slots, t = [], datetime.strptime(f"{OPEN_HOUR:02d}:00", "%H:%M")
    end = datetime.strptime(f"{CLOSE_HOUR:02d}:00", "%H:%M")
    while t <= end:
        slots.append(t.strftime("%H:%M"))
        t += timedelta(minutes=SLOT_INTERVAL)
    return slots


def _add_min(time_str: str, minutes: int) -> str:
    return (datetime.strptime(time_str, "%H:%M") + timedelta(minutes=minutes)).strftime("%H:%M")


def _blocks(start: str, duration: int) -> list[str]:
    result, t = [], datetime.strptime(start, "%H:%M")
    end = t + timedelta(minutes=duration)
    while t < end:
        result.append(t.strftime("%H:%M"))
        t += timedelta(minutes=SLOT_INTERVAL)
    return result


def _round_dur(minutes: int) -> int:
    return max(SLOT_INTERVAL, ((minutes + SLOT_INTERVAL - 1) // SLOT_INTERVAL) * SLOT_INTERVAL)


def _is_open_day(d) -> bool:
    return d.weekday() in WORKING_DAYS


def _clean_phone(p: str) -> str:
    return p.replace("-", "").replace(" ", "")


# ─────────────────────────────────────────────────────────────────────────────
# Tool implementations — direct DB access, no HTTP round-trip
# ─────────────────────────────────────────────────────────────────────────────

def _list_services(_: dict) -> str:
    db = SessionLocal()
    try:
        rows = db.query(models.Service).filter(models.Service.is_active == True).all()
        return json.dumps([
            {"id": s.id, "name": s.name, "price": s.price,
             "duration_minutes": s.duration_minutes, "category": s.category}
            for s in rows
        ])
    finally:
        db.close()


def _list_barbers(_: dict) -> str:
    db = SessionLocal()
    try:
        rows = db.query(models.Barber).filter(models.Barber.is_active == True).all()
        return json.dumps([{"id": b.id, "name": b.name, "specialty": b.specialty} for b in rows])
    finally:
        db.close()


def _check_availability(inp: dict) -> str:
    barber_id   = inp["barber_id"]
    date_str    = inp["date"]
    service_ids = inp.get("service_ids") or []

    db = SessionLocal()
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").date()
        if not _is_open_day(target):
            return json.dumps({"error": "Barbershop is closed on that day.", "available_slots": []})

        total = SLOT_INTERVAL
        if service_ids:
            svcs = db.query(models.Service).filter(models.Service.id.in_(service_ids)).all()
            if svcs:
                total = _round_dur(sum(s.duration_minutes for s in svcs))

        existing = db.query(models.Appointment).filter(
            models.Appointment.barber_id == barber_id,
            models.Appointment.appointment_date == date_str,
            models.Appointment.status != "cancelled",
        ).all()

        blocked: set[str] = set()
        for appt in existing:
            dur = _round_dur(sum(s.duration_minutes for s in appt.services) if appt.services else SLOT_INTERVAL)
            for b in _blocks(appt.appointment_time, dur):
                blocked.add(b)

        now, today, close_str = datetime.now(), datetime.now().date(), f"{CLOSE_HOUR:02d}:30"
        available = []
        for slot in _all_slots():
            if _add_min(slot, total) > close_str:
                continue
            if target == today:
                if datetime.combine(today, datetime.strptime(slot, "%H:%M").time()) <= now:
                    continue
            if not any(b in blocked for b in _blocks(slot, total)):
                available.append(slot)

        return json.dumps({"date": date_str, "available_slots": available})
    finally:
        db.close()


def _book_appointment(inp: dict) -> str:
    db = SessionLocal()
    try:
        date_str = inp["appointment_date"]
        time_str = inp["appointment_time"]
        target   = datetime.strptime(date_str, "%Y-%m-%d").date()

        if not _is_open_day(target):
            return json.dumps({"error": "Barbershop is closed on that day."})

        barber = db.query(models.Barber).filter(
            models.Barber.id == inp["barber_id"], models.Barber.is_active == True
        ).first()
        if not barber:
            return json.dumps({"error": "Barber not found."})

        svcs = db.query(models.Service).filter(models.Service.id.in_(inp["service_ids"])).all()
        if len(svcs) != len(inp["service_ids"]):
            return json.dumps({"error": "One or more services not found."})

        total    = _round_dur(sum(s.duration_minutes for s in svcs))
        end_time = _add_min(time_str, total)
        price    = sum(s.price for s in svcs)

        if end_time > f"{CLOSE_HOUR:02d}:30":
            return json.dumps({"error": "Appointment would exceed closing time (20:30)."})

        existing = db.query(models.Appointment).filter(
            models.Appointment.barber_id == inp["barber_id"],
            models.Appointment.appointment_date == date_str,
            models.Appointment.status != "cancelled",
        ).all()

        blocked: set[str] = set()
        for a in existing:
            dur = _round_dur(sum(s.duration_minutes for s in a.services) if a.services else SLOT_INTERVAL)
            for b in _blocks(a.appointment_time, dur):
                blocked.add(b)

        if any(b in blocked for b in _blocks(time_str, total)):
            return json.dumps({"error": "Time slot already booked."})

        appt = models.Appointment(
            customer_name    = inp["customer_name"],
            customer_phone   = inp["customer_phone"],
            customer_email   = inp.get("customer_email"),
            barber_id        = inp["barber_id"],
            appointment_date = date_str,
            appointment_time = time_str,
            end_time         = end_time,
            total_price      = price,
            payment_method   = inp.get("payment_method", "on_site"),
            payment_status   = "paid" if inp.get("payment_method") == "prepay" else "pending",
            status           = "confirmed",
            notes            = inp.get("notes"),
        )
        appt.services = svcs
        db.add(appt)
        db.commit()
        db.refresh(appt)

        return json.dumps({
            "success":        True,
            "appointment_id": appt.id,
            "barber":         barber.name,
            "services":       [s.name for s in svcs],
            "date":           date_str,
            "time":           f"{time_str}–{end_time}",
            "total":          f"₪{price:.0f}",
            "payment":        inp.get("payment_method", "on_site"),
        })
    finally:
        db.close()


def _get_appointment(inp: dict) -> str:
    db = SessionLocal()
    try:
        appt = db.query(models.Appointment).filter(models.Appointment.id == inp["appointment_id"]).first()
        if not appt:
            return json.dumps({"error": "Appointment not found."})
        if _clean_phone(appt.customer_phone) != _clean_phone(inp["phone"]):
            return json.dumps({"error": "Phone number does not match."})
        return json.dumps({
            "id":             appt.id,
            "status":         appt.status,
            "barber":         appt.barber.name,
            "services":       [s.name for s in appt.services],
            "date":           appt.appointment_date,
            "time":           f"{appt.appointment_time}–{appt.end_time}",
            "total":          f"₪{appt.total_price:.0f}",
            "payment_status": appt.payment_status,
        })
    finally:
        db.close()


def _cancel_appointment(inp: dict) -> str:
    db = SessionLocal()
    try:
        appt = db.query(models.Appointment).filter(models.Appointment.id == inp["appointment_id"]).first()
        if not appt:
            return json.dumps({"error": "Appointment not found."})
        if appt.status == "cancelled":
            return json.dumps({"error": "Already cancelled."})
        if _clean_phone(appt.customer_phone) != _clean_phone(inp["phone"]):
            return json.dumps({"error": "Phone number does not match."})

        appt_dt    = datetime.strptime(f"{appt.appointment_date} {appt.appointment_time}", "%Y-%m-%d %H:%M")
        hours_left = (appt_dt - datetime.now()).total_seconds() / 3600
        if hours_left < CANCEL_CUTOFF_HOURS:
            return json.dumps({"error": f"Cannot cancel — only {hours_left:.1f}h remaining (need 8h+)."})

        appt.status = "cancelled"
        db.commit()
        return json.dumps({"success": True})
    finally:
        db.close()


def _reschedule_appointment(inp: dict) -> str:
    db = SessionLocal()
    try:
        appt = db.query(models.Appointment).filter(models.Appointment.id == inp["appointment_id"]).first()
        if not appt:
            return json.dumps({"error": "Appointment not found."})
        if appt.status != "confirmed":
            return json.dumps({"error": "Only confirmed appointments can be rescheduled."})
        if _clean_phone(appt.customer_phone) != _clean_phone(inp["phone"]):
            return json.dumps({"error": "Phone number does not match."})

        appt_dt    = datetime.strptime(f"{appt.appointment_date} {appt.appointment_time}", "%Y-%m-%d %H:%M")
        hours_left = (appt_dt - datetime.now()).total_seconds() / 3600
        if hours_left < CANCEL_CUTOFF_HOURS:
            return json.dumps({"error": "Cannot reschedule — too close to appointment time."})

        new_date = datetime.strptime(inp["new_date"], "%Y-%m-%d").date()
        if not _is_open_day(new_date):
            return json.dumps({"error": "Barbershop is closed on that day."})

        total   = _round_dur(sum(s.duration_minutes for s in appt.services) if appt.services else SLOT_INTERVAL)
        new_end = _add_min(inp["new_time"], total)
        if new_end > f"{CLOSE_HOUR:02d}:30":
            return json.dumps({"error": "New time exceeds closing time."})

        existing = db.query(models.Appointment).filter(
            models.Appointment.barber_id == appt.barber_id,
            models.Appointment.appointment_date == inp["new_date"],
            models.Appointment.status != "cancelled",
            models.Appointment.id != appt.id,
        ).all()

        blocked: set[str] = set()
        for a in existing:
            dur = _round_dur(sum(s.duration_minutes for s in a.services) if a.services else SLOT_INTERVAL)
            for b in _blocks(a.appointment_time, dur):
                blocked.add(b)

        if any(b in blocked for b in _blocks(inp["new_time"], total)):
            return json.dumps({"error": "New time slot is already booked."})

        appt.appointment_date = inp["new_date"]
        appt.appointment_time = inp["new_time"]
        appt.end_time         = new_end
        db.commit()
        return json.dumps({
            "success":        True,
            "appointment_id": appt.id,
            "new_date":       inp["new_date"],
            "new_time":       f"{inp['new_time']}–{new_end}",
        })
    finally:
        db.close()


# ── Tool registry ─────────────────────────────────────────────────────────────
_TOOL_FNS = {
    "list_services":          _list_services,
    "list_barbers":           _list_barbers,
    "check_availability":     _check_availability,
    "book_appointment":       _book_appointment,
    "get_appointment":        _get_appointment,
    "cancel_appointment":     _cancel_appointment,
    "reschedule_appointment": _reschedule_appointment,
}

TOOLS = [
    {
        "name": "list_services",
        "description": "Return all available services with ID, name, price, duration, and category.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "list_barbers",
        "description": "Return all active barbers with ID, name, and specialty.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "check_availability",
        "description": "Return available time slots for a barber on a given date. Always pass service_ids so duration is calculated correctly.",
        "input_schema": {
            "type": "object",
            "properties": {
                "barber_id":   {"type": "integer", "description": "Barber ID"},
                "date":        {"type": "string",  "description": "YYYY-MM-DD"},
                "service_ids": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "Service IDs to account for total appointment duration",
                },
            },
            "required": ["barber_id", "date"],
        },
    },
    {
        "name": "book_appointment",
        "description": "Create a confirmed appointment. Always confirm all details with the customer before calling this.",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_name":    {"type": "string"},
                "customer_phone":   {"type": "string", "description": "Customer's phone number"},
                "customer_email":   {"type": "string"},
                "barber_id":        {"type": "integer"},
                "service_ids":      {"type": "array", "items": {"type": "integer"}},
                "appointment_date": {"type": "string", "description": "YYYY-MM-DD"},
                "appointment_time": {"type": "string", "description": "HH:MM"},
                "payment_method":   {"type": "string", "enum": ["on_site", "prepay"],
                                     "description": "on_site = pay at shop, prepay = pay online"},
                "notes":            {"type": "string"},
            },
            "required": ["customer_name", "customer_phone", "barber_id",
                         "service_ids", "appointment_date", "appointment_time", "payment_method"],
        },
    },
    {
        "name": "get_appointment",
        "description": "Look up an appointment by ID. Requires the customer's phone number for verification.",
        "input_schema": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"},
                "phone":          {"type": "string"},
            },
            "required": ["appointment_id", "phone"],
        },
    },
    {
        "name": "cancel_appointment",
        "description": "Cancel a confirmed appointment. Only allowed 8+ hours before the appointment time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"},
                "phone":          {"type": "string"},
            },
            "required": ["appointment_id", "phone"],
        },
    },
    {
        "name": "reschedule_appointment",
        "description": "Move an appointment to a new date and time. Only allowed 8+ hours before the current appointment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"},
                "phone":          {"type": "string"},
                "new_date":       {"type": "string", "description": "YYYY-MM-DD"},
                "new_time":       {"type": "string", "description": "HH:MM"},
            },
            "required": ["appointment_id", "phone", "new_date", "new_time"],
        },
    },
]

SYSTEM_PROMPT = """You are the WhatsApp booking assistant for a professional barbershop.
You help customers book appointments, check their bookings, reschedule, or cancel.

Business info:
• Open: Sunday, Tuesday, Wednesday, Thursday, Friday
• Closed: Monday and Saturday
• Hours: 10:00–20:00 (appointments must finish by 20:30)
• Currency: ₪ (Israeli Shekel)

Booking flow:
1. Ask what service(s) they want — use list_services to show options
2. Ask which barber — use list_barbers to show options
3. Ask for the date, then call check_availability (always include service_ids for accurate duration)
4. Offer the available time slots
5. Collect the customer's full name
6. Ask about payment: "pay at shop" or "pay online in advance"
7. Show a clear summary and ask for confirmation
8. Only call book_appointment AFTER the customer confirms — use their WhatsApp number as customer_phone

Rules:
- Detect the customer's language from their first message and always reply in the same language (Hebrew or English)
- Keep messages short and clear — this is WhatsApp
- Never invent or guess services, barbers, or time slots — always call the tools
- The customer's WhatsApp phone number is already known — use it for bookings and verification
- Today's date and the customer's number are appended to each system prompt"""


async def process_message(phone: str, text: str) -> str:
    """
    Handle one incoming WhatsApp message and return the text reply.

    phone — Meta 'from' field, e.g. '972501234567' (digits only, no prefix)
    text  — message body
    """
    clean_phone = phone.strip()

    session = _sessions.setdefault(phone, [])
    session.append({"role": "user", "content": text})

    # Keep session size bounded
    if len(session) > SESSION_MAX:
        _sessions[phone] = session[-SESSION_MAX:]
        session = _sessions[phone]

    # Inject today's date + phone so Claude has accurate context
    today_ctx = (
        f"\n\n[Today: {datetime.now().strftime('%A, %Y-%m-%d %H:%M')} | "
        f"Customer WhatsApp: {clean_phone}]"
    )

    # Agentic loop — runs until Claude returns a text reply
    while True:
        response = await _client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT + today_ctx,
            tools=TOOLS,
            messages=session,
        )

        session.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            return "\n".join(b.text for b in response.content if hasattr(b, "text"))

        if response.stop_reason == "tool_use":
            results = []
            for block in response.content:
                if block.type == "tool_use":
                    fn = _TOOL_FNS.get(block.name)
                    output = fn(block.input) if fn else json.dumps({"error": "Unknown tool"})
                    results.append({
                        "type":        "tool_result",
                        "tool_use_id": block.id,
                        "content":     output,
                    })
            session.append({"role": "user", "content": results})
            continue

        break  # unexpected stop_reason

    return "Something went wrong. Please try again."


if __name__ == "__main__":
    import asyncio

    phone = input("Your phone number (e.g. 972501234567): ").strip()
    print("Type your message. Ctrl+C to quit.\n")
    while True:
        try:
            msg = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nBye!")
            break
        if not msg:
            continue
        reply = asyncio.run(process_message(phone, msg))
        print(f"Bot: {reply}\n")
