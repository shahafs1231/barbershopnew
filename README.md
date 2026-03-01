# Barbershop Booking System

A full-stack barbershop appointment booking system with a customer-facing booking flow, a self-service management page, and a full admin dashboard. Supports English and Hebrew (RTL).

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Features](#features)
5. [Getting Started](#getting-started)
6. [Running the Project](#running-the-project)
7. [Environment Variables](#environment-variables)
8. [Database](#database)
9. [API Reference](#api-reference)
10. [Frontend Pages](#frontend-pages)
11. [Components](#components)
12. [Bilingual Support](#bilingual-support)
13. [Business Rules](#business-rules)
14. [Known Issues & Limitations](#known-issues--limitations)

---

## Overview

This system allows customers to:
- Browse available services and barbers
- Pick a date and available time slot
- Book an appointment with optional notes and payment method
- View, reschedule, or cancel their appointment

Admins can:
- View a daily calendar of all appointments
- Mark appointments as completed or cancel them
- Add, edit, and delete barbers (with photo upload)
- Add, edit, and delete services and pricing
- Upload a hero background image for the home page

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy, SQLite |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Validation | Pydantic v2 |
| File uploads | `aiofiles`, FastAPI `UploadFile` |
| Icons | `lucide-react` |
| Language | English + Hebrew (RTL) |

---

## Project Structure

```
barbershop/
├── start.sh                  # One-command startup script
│
├── backend/
│   ├── main.py               # All FastAPI routes and business logic
│   ├── models.py             # SQLAlchemy ORM models
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── database.py           # Database engine and session setup
│   ├── seed.py               # Populates DB with initial barbers & services
│   ├── requirements.txt      # Python dependencies
│   ├── barbershop.db         # SQLite database (auto-created)
│   └── static/
│       └── barbers/          # Uploaded barber photos (auto-created)
│
└── frontend/
    ├── app/
    │   ├── layout.tsx        # Root layout + LanguageProvider
    │   ├── globals.css       # Global styles + Tailwind + .input class
    │   ├── page.tsx          # Home / landing page
    │   ├── book/
    │   │   └── page.tsx      # 6-step booking flow
    │   ├── manage/
    │   │   └── page.tsx      # Customer appointment management
    │   └── admin/
    │       └── page.tsx      # Admin dashboard
    ├── components/
    │   ├── ServiceCard.tsx   # Service selection card
    │   ├── BarberCard.tsx    # Barber selection card
    │   ├── MiniCalendar.tsx  # Date picker calendar
    │   ├── StepIndicator.tsx # Multi-step progress bar
    │   └── LanguageToggle.tsx# EN ↔ HE toggle button
    ├── lib/
    │   ├── api.ts            # All API calls + TypeScript interfaces
    │   ├── LanguageContext.tsx # React context for language state
    │   └── translations.ts   # All UI strings in English and Hebrew
    ├── public/
    │   └── hero-bg.png       # Hero background image (replaceable via admin)
    ├── .env.local            # Frontend environment variables
    └── package.json
```

---

## Features

### Customer Booking Flow (`/book`)
A 6-step wizard:
1. **Services** — Select one or more services (multi-select). Shows combined price and duration.
2. **Barber** — Choose a barber. Shows photo or color avatar.
3. **Date** — Pick from a calendar. Only open days are clickable.
4. **Time** — Shows available slots in real-time based on barber + date + service duration. Booked slots are crossed out.
5. **Details** — Name, phone (required), email (optional), notes, and payment method.
6. **Confirm** — Review all details and submit. Shows a confirmation card with appointment number.

After booking, the customer can:
- Go back to the home page
- Jump directly to the manage page with their appointment pre-loaded

### Customer Management (`/manage`)
- Search by appointment ID + phone number
- View full appointment details
- Reschedule to a new date/time (if 8+ hours before the appointment)
- Cancel the appointment (if 8+ hours before the appointment)
- Clear messaging if the cancellation window has passed

### Admin Dashboard (`/admin`)
Five tabs accessible from a sidebar:

| Tab | Description |
|---|---|
| Dashboard | Today's appointments, upcoming count, total revenue from completed appointments |
| Appointments | Full calendar view — click any date to see that day's schedule. Each appointment shows customer, services, barber, phone, price, status, and payment. Admins can mark complete or cancel. |
| Barbers | View all barbers. Add/edit barber with name, specialty, phone, avatar color, and photo upload. Soft-delete (marks inactive). |
| Services | Table of all services with category, duration, and price. Add/edit/delete. |
| Home Page | Upload a new hero background image that appears on the landing page. |

---

## Getting Started

### Prerequisites

- Python 3.11+ with `pip`
- Node.js 18+ with `npm`

### 1. Clone / navigate to the project

```bash
cd /path/to/barbershop
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Seed the database (first time only)

```bash
cd backend
python seed.py
```

This creates `barbershop.db` and inserts:
- 6 services: Haircut, Beard Trim, Haircut + Beard, Hair Coloring, Hair Treatment, Kids Haircut
- 3 barbers: Avi Cohen, Yossi Levi, Moshe Katz

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running the Project

### Option A — One command (recommended)

From the project root:

```bash
bash start.sh
```

This will:
- Install Python deps if missing
- Seed the DB if it doesn't exist
- Start the backend on `http://localhost:5000`
- Start the frontend on `http://localhost:9000`

### Option B — Manual (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --reload --port 5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev -- --port 9000
```

### URLs

| Service | URL |
|---|---|
| Customer site | http://localhost:9000 |
| Book appointment | http://localhost:9000/book |
| Manage appointment | http://localhost:9000/manage |
| Admin panel | http://localhost:9000/admin |
| API (FastAPI) | http://localhost:5000 |
| API docs (Swagger) | http://localhost:5000/docs |

---

## Environment Variables

**`frontend/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

This is the base URL the frontend uses for all API calls. Change it if you run the backend on a different port or host.

---

## Database

The project uses **SQLite** stored in `backend/barbershop.db`. It is created automatically when the backend starts.

### Tables

**`services`**
| Column | Type | Description |
|---|---|---|
| id | Integer PK | Auto-increment |
| name | String | Service name (English) |
| description | Text | Short description |
| price | Float | Price in ₪ |
| duration_minutes | Integer | Service duration |
| category | String | `haircut`, `beard`, `combo`, `accessories` |
| is_active | Boolean | False = soft-deleted |

**`barbers`**
| Column | Type | Description |
|---|---|---|
| id | Integer PK | Auto-increment |
| name | String | Barber's full name |
| specialty | String | Skills description |
| phone | String | Contact number |
| avatar_color | String | Hex color for avatar fallback |
| photo_url | String | Path to uploaded photo |
| is_active | Boolean | False = soft-deleted |

**`appointments`**
| Column | Type | Description |
|---|---|---|
| id | Integer PK | Auto-increment |
| customer_name | String | |
| customer_phone | String | Used for identity verification |
| customer_email | String | Optional |
| barber_id | FK → barbers | |
| appointment_date | String | Format: `YYYY-MM-DD` |
| appointment_time | String | Format: `HH:MM` |
| end_time | String | Calculated from services |
| total_price | Float | Sum of selected services |
| payment_method | String | `prepay` or `on_site` |
| payment_status | String | `pending`, `paid`, `refunded` |
| status | String | `confirmed`, `cancelled`, `completed` |
| notes | Text | Optional customer notes |
| created_at | DateTime | |

**`appointment_services`** (many-to-many join table)
| Column | Type |
|---|---|
| appointment_id | FK → appointments |
| service_id | FK → services |

### Re-seed the database

> **Warning:** This deletes all existing services and barbers.

```bash
cd backend
python seed.py
```

---

## API Reference

Base URL: `http://localhost:5000`

Interactive docs: `http://localhost:5000/docs`

### Services

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/services` | List all active services |
| `POST` | `/services` | Create a new service |
| `PUT` | `/services/{id}` | Update a service |
| `DELETE` | `/services/{id}` | Soft-delete a service |

### Barbers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/barbers` | List all active barbers |
| `POST` | `/barbers` | Create a new barber |
| `PUT` | `/barbers/{id}` | Update a barber |
| `DELETE` | `/barbers/{id}` | Soft-delete a barber |
| `POST` | `/barbers/{id}/photo` | Upload barber photo (multipart) |

### Availability

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/availability/{barber_id}/{date}` | Get available time slots |

Query params:
- `service_ids` — comma-separated IDs to calculate total duration
- `exclude_appointment_id` — exclude a specific appointment (used for rescheduling)

### Appointments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/appointments` | List appointments (filterable by `date`, `barber_id`, `status`) |
| `POST` | `/appointments` | Create a new appointment |
| `GET` | `/appointments/{id}` | Get one appointment (`?phone=` for customer verification) |
| `PATCH` | `/appointments/{id}/status` | Admin: update status |
| `DELETE` | `/appointments/{id}` | Cancel an appointment (`?admin=true` or `?phone=`) |
| `PATCH` | `/appointments/{id}/reschedule` | Reschedule (requires phone + 8h cutoff) |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/settings/hero-image` | Upload hero background image |
| `GET` | `/settings/hero-image-exists` | Check if a hero image has been uploaded |

### Info

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/info` | Returns shop name, hours, open/closed days, slot interval |

---

## Frontend Pages

### `/` — Home Page (`app/page.tsx`)
- Hero section with background image (uploaded via admin) + dark overlay
- "Book Now" and "Manage Appointment" call-to-action buttons
- Features grid (4 cards explaining the booking process)
- Bottom CTA section
- Language toggle in the header

### `/book` — Booking Page (`app/book/page.tsx`)
- Manages state for all 6 steps with `useState`
- Fetches services and barbers on mount
- Fetches time slots when the user reaches Step 3 (Time)
- On successful submission, shows a confirmation card
- "Book Another" button resets the entire form

### `/manage` — Manage Appointment (`app/manage/page.tsx`)
- Wrapped in `<Suspense>` to support `useSearchParams`
- Auto-searches if `?id=` and `?phone=` are in the URL (linked from confirmation page)
- Reschedule modal uses `MiniCalendar` and fetches available slots dynamically

### `/admin` — Admin Dashboard (`app/admin/page.tsx`)
- Tab-based layout with a fixed sidebar
- Dashboard stats are computed client-side from the full appointment list
- Calendar grid is rendered manually (no external library)
- Barber and service modals use controlled form state

---

## Components

### `ServiceCard.tsx`
Displays a single service as a selectable card. Shows category badge, name, description, price, and duration. Highlights in dark when selected and shows a checkmark.

### `BarberCard.tsx`
Displays a barber as a selectable card. Shows a circular photo if uploaded, otherwise a color avatar with initials. Highlights when selected.

### `MiniCalendar.tsx`
A self-contained month calendar. Disabled days: Monday, Saturday, and any past dates. Shows a ring on today. Props: `selected`, `onSelect`, `cal` (translation object).

### `StepIndicator.tsx`
Horizontal step progress bar. Completed steps show a green checkmark. Current step is dark. Takes `steps[]` and `current` index as props.

### `LanguageToggle.tsx`
A button that switches between English (LTR) and Hebrew (RTL). Persists to `localStorage` and updates the `<html>` `dir` and `lang` attributes.

---

## Bilingual Support

All UI text lives in `frontend/lib/translations.ts`. Two language objects (`en` and `he`) share the exact same structure.

The active language is stored in `LanguageContext.tsx` and persisted to `localStorage`. Switching languages is instant with no page reload.

RTL layout is handled automatically by Tailwind's `dir`-aware utilities (e.g., `end-3`, `start-3`). The `<html dir="rtl">` attribute is set dynamically by the context.

Service names and descriptions in the DB are stored in English. The translation files map the English strings to their Hebrew equivalents for display.

---

## Business Rules

| Rule | Value |
|---|---|
| Open days | Sunday, Tuesday, Wednesday, Thursday, Friday |
| Closed days | Monday, Saturday |
| Working hours | 10:00 — 20:00 |
| Last bookable slot | 20:00 (30-min service ends 20:30) |
| Slot interval | 30 minutes |
| Cancellation cutoff | 8 hours before the appointment |
| Rescheduling cutoff | 8 hours before the appointment |
| Admin cancel | No time restriction |

**Slot blocking logic:** When a multi-service appointment is booked (e.g., 60 minutes), it blocks all 30-minute slots it covers. Other customers cannot start a booking that overlaps any of those blocks.

**Soft delete:** Deleting a barber or service marks it `is_active = False`. It disappears from the customer view but existing appointments that reference it are preserved.

**Payment:** Two options — "Pay at Shop" (cash/card on arrival, status stays `pending`) or "Pay Online" (status set to `paid` on booking). A real payment gateway is not integrated.

---

## Known Issues & Limitations

| Issue | Details |
|---|---|
| No admin authentication | The `/admin` page is open to anyone. There is no login system. |
| No real payments | "Pay Online" marks the booking as paid without an actual transaction. |
| No notifications | No email or SMS is sent to customers after booking or cancellation. |
| Hardcoded open days in frontend | `MiniCalendar` and the admin calendar have open days hardcoded. If changed in the backend, the frontend must be updated manually. |
| `ServiceCard` RTL bug | The selection checkmark uses `right-3` instead of `end-3`, placing it on the wrong side in Hebrew mode. |
| Service edit in Hebrew mode | Editing a service while in Hebrew mode saves the translated name to the database, breaking translation lookups. Always edit services in English mode. |
| Hero image path | The backend uses a relative path `../frontend/public/hero-bg.png`. If the backend is started from a directory other than `backend/`, the upload will fail. Always run uvicorn from inside the `backend/` folder. |
