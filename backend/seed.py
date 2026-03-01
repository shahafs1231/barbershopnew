"""
Run once to populate initial barbers and services.
Usage: python seed.py
"""
from database import engine, SessionLocal, Base
import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── Clear existing data ───────────────────────────────────────────────────────
db.query(models.Service).delete()
db.query(models.Barber).delete()
db.commit()

# ── Services ──────────────────────────────────────────────────────────────────
services = [
    models.Service(
        name="Haircut",
        description="Classic haircut – any style",
        price=60,
        duration_minutes=30,
        category="haircut",
    ),
    models.Service(
        name="Beard Trim",
        description="Shape and trim your beard",
        price=40,
        duration_minutes=20,
        category="beard",
    ),
    models.Service(
        name="Haircut + Beard",
        description="Full grooming combo deal",
        price=90,
        duration_minutes=45,
        category="combo",
    ),
    models.Service(
        name="Hair Coloring",
        description="Full color or highlights",
        price=150,
        duration_minutes=60,
        category="accessories",
    ),
    models.Service(
        name="Hair Treatment",
        description="Deep conditioning & keratin treatment",
        price=120,
        duration_minutes=45,
        category="accessories",
    ),
    models.Service(
        name="Kids Haircut",
        description="Haircut for kids under 12",
        price=40,
        duration_minutes=20,
        category="haircut",
    ),
]

db.add_all(services)
db.commit()

# ── Barbers ───────────────────────────────────────────────────────────────────
barbers = [
    models.Barber(
        name="Avi Cohen",
        specialty="Fades, Undercuts, Beard styling",
        phone="050-1234567",
        avatar_color="#4F46E5",
    ),
    models.Barber(
        name="Yossi Levi",
        specialty="Classic cuts, Kids cuts, Hair coloring",
        phone="052-7654321",
        avatar_color="#0891B2",
    ),
    models.Barber(
        name="Moshe Katz",
        specialty="Modern styles, Textured cuts, Treatments",
        phone="054-9876543",
        avatar_color="#059669",
    ),
]

db.add_all(barbers)
db.commit()
db.close()

print("✅ Database seeded successfully!")
print(f"   {len(services)} services added")
print(f"   {len(barbers)} barbers added")
