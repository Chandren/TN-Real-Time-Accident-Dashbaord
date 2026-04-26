"""
TN Accident Intel — Seed Data + Demo Ingestion Engine
Seeds the DB with all 38 Tamil Nadu districts + realistic accident history
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from models import (
    Base, District, DistrictMetric, Accident, Alert,
    HourlyTrend, SystemStatus, engine, SessionLocal
)

# ── District master data ───────────────────────────────────────────────────────
DISTRICTS = [
    ("CHN",  "Chennai",          13.0827, 80.2707, "North"),
    ("COI",  "Coimbatore",       11.0018, 76.9628, "West"),
    ("MAD",  "Madurai",          9.9252,  78.1198, "South"),
    ("SAL",  "Salem",            11.6643, 78.1460, "Central"),
    ("TIR",  "Tiruchirappalli",  10.7905, 78.7047, "Delta"),
    ("VEL",  "Vellore",          12.9165, 79.1325, "North"),
    ("ERS",  "Erode",            11.3410, 77.7172, "West"),
    ("THI",  "Tirunelveli",      8.7139,  77.6839, "South"),
    ("TAN",  "Thanjavur",        10.7870, 79.1378, "Delta"),
    ("DIN",  "Dindigul",         10.3673, 77.9803, "South"),
    ("KAN",  "Kanchipuram",      12.8342, 79.7036, "North"),
    ("KRI",  "Krishnagiri",      12.5186, 78.2132, "North"),
    ("NAM",  "Namakkal",         11.2190, 78.1677, "Central"),
    ("CUD",  "Cuddalore",        11.7480, 79.7714, "East"),
    ("KAR",  "Karur",            10.9601, 78.0766, "Central"),
    ("TUV",  "Thoothukudi",      8.7642,  78.1348, "South"),
    ("VIR",  "Virudhunagar",     9.5851,  77.9624, "South"),
    ("RAM",  "Ramanathapuram",   9.3712,  78.8302, "South"),
    ("TIV",  "Tiruvarur",        10.7726, 79.6369, "Delta"),
    ("NGP",  "Nagapattinam",     10.7672, 79.8449, "Delta"),
    ("ARY",  "Ariyalur",         11.1395, 79.0786, "Delta"),
    ("PEP",  "Perambalur",       11.2342, 78.8808, "Delta"),
    ("PUD",  "Pudukkottai",      10.3797, 78.8215, "Delta"),
    ("THE",  "Theni",            10.0104, 77.4777, "South"),
    ("SIV",  "Sivaganga",        9.8427,  78.4827, "South"),
    ("NIL",  "Nilgiris",         11.4102, 76.6950, "West"),
    ("DHA",  "Dharmapuri",       12.1284, 78.1583, "North"),
    ("KAL",  "Kallakurichi",     11.7480, 79.0126, "East"),
    ("TIP",  "Tirupathur",       12.4966, 78.5637, "North"),
    ("CHE",  "Chengalpattu",     12.6919, 79.9702, "North"),
    ("TPR",  "Tiruppur",         11.1085, 77.3411, "West"),
    ("RAN",  "Ranipet",          12.9249, 79.3333, "North"),
    ("TEN",  "Tenkasi",          8.9597,  77.3152, "South"),
    ("MAY",  "Mayiladuthurai",   11.1028, 79.6516, "Delta"),
    ("KOV",  "Kancheepuram",     12.8342, 79.7036, "North"),
    ("TIR3", "Tiruvannamalai",   12.2253, 79.0747, "North"),
    ("TIK",  "Tirukkuvalai",     10.7726, 79.6369, "Delta"),
    ("MAM",  "Tirupattur",       12.4966, 78.5637, "North"),
]

# ── Base accident rates per district ───────────────────────────────────────────
BASE_ACCIDENTS = {
    "Chennai": 38, "Coimbatore": 29, "Madurai": 24, "Salem": 22,
    "Tiruchirappalli": 20, "Vellore": 18, "Erode": 17, "Tirunelveli": 16,
    "Chengalpattu": 16, "Tiruppur": 15, "Thanjavur": 15, "Dindigul": 14,
    "Tiruvannamalai": 14, "Kanchipuram": 14, "Dharmapuri": 13,
    "Krishnagiri": 13, "Namakkal": 13, "Cuddalore": 12, "Kancheepuram": 12,
    "Karur": 11, "Thoothukudi": 11, "Ranipet": 11, "Virudhunagar": 10,
    "Ramanathapuram": 10, "Kallakurichi": 9, "Tiruvarur": 9, "Ariyalur": 8,
    "Tirupathur": 8, "Tenkasi": 8, "Theni": 7, "Nagapattinam": 8,
    "Perambalur": 7, "Pudukkottai": 7, "Nilgiris": 6, "Sivaganga": 6,
    "Mayiladuthurai": 7, "Tirukkuvalai": 6, "Tirupattur": 7,
}

INCIDENT_TYPES = [
    "Multi-vehicle collision", "Two-wheeler collision", "MTC Bus collision",
    "Lorry overturned on highway", "Head-on collision", "Pedestrian struck",
    "Skid due to wet road", "Auto-rickshaw accident", "Chain collision",
    "School van rear-ended", "Tanker truck collision", "Cargo truck rollover",
    "Motorcycle skid", "Car-pedestrian collision", "Road rage incident",
]

ROAD_TYPES = ["NH", "SH", "City", "Rural", "Expressway"]

LOCATIONS = {
    "Chennai": ["Anna Salai", "GST Road", "OMR", "ECR", "NH-44 Tambaram", "Inner Ring Road", "Kathipara Junction"],
    "Coimbatore": ["Avinashi Road", "Mettupalayam Road", "Pollachi Road", "Gandhipuram", "NH-48"],
    "Madurai": ["Anna Nagar", "Bypass Road", "Mattuthavani", "NH-38", "SH-76"],
    "Salem": ["Fairlands", "Omalur Road", "NH-44", "Steel Plant Road", "NH-79"],
    "Tiruchirappalli": ["Srirangam", "NH-45B", "Karur Bypass", "Ariyamangalam", "NH-83"],
    "DEFAULT": ["NH-44", "NH-48", "NH-38", "SH-76", "Bypass Road", "Town Road"],
}

UNITS = ["EMS, HWY PATROL", "TRAFFIC", "TOW, TRAFFIC", "EMS", "HWY PATROL", "EMS, TRAFFIC, POLICE"]


def compute_risk(accidents: int, fatal: int) -> float:
    score = min(100.0, round(accidents * 2.1 + fatal * 11.5, 1))
    return score


def get_severity_from_risk(score: float) -> str:
    if score >= 70: return "critical"
    if score >= 40: return "high"
    if score >= 20: return "moderate"
    return "low"


def get_sev_code(is_fatal: bool, vehicles: int) -> tuple[str, str]:
    if is_fatal: return ("SEV-1", "FATAL")
    if vehicles >= 3: return ("SEV-2", "MAJOR")
    return ("SEV-3", "MINOR")


async def seed_districts(db: AsyncSession):
    """Insert district master data if not present"""
    result = await db.execute(select(District))
    existing = result.scalars().all()
    if existing:
        return {d.name: d for d in existing}

    district_map = {}
    for code, name, lat, lng, region in DISTRICTS:
        d = District(code=code, name=name, lat=lat, lng=lng, region=region)
        db.add(d)
    await db.commit()

    result = await db.execute(select(District))
    return {d.name: d for d in result.scalars().all()}


async def seed_metrics(db: AsyncSession, district_map: dict):
    """Initialize district metrics"""
    result = await db.execute(select(DistrictMetric))
    existing = {m.district_id for m in result.scalars().all()}

    for name, district in district_map.items():
        if district.id in existing:
            continue
        base = BASE_ACCIDENTS.get(name, 8)
        accidents = base + random.randint(0, 6)
        fatal = max(0, random.randint(0, max(1, base // 10)))
        risk = compute_risk(accidents, fatal)
        sev = get_severity_from_risk(risk)
        db.add(DistrictMetric(
            district_id=district.id,
            accidents_today=accidents,
            fatal_today=fatal,
            risk_score=risk,
            severity=sev,
            trend=random.choice(["up", "down", "flat"]),
            updated_at=datetime.utcnow(),
        ))
    await db.commit()


async def seed_accidents_history(db: AsyncSession, district_map: dict):
    """Generate 48h of accident history"""
    result = await db.execute(select(Accident))
    if result.scalars().first():
        return

    now = datetime.utcnow()
    for name, district in district_map.items():
        base = BASE_ACCIDENTS.get(name, 8)
        locs = LOCATIONS.get(name, LOCATIONS["DEFAULT"])
        # Generate accidents over last 24h (weighted by hour)
        for h in range(24):
            hour_weight = 1
            if 7 <= h <= 9 or 17 <= h <= 21: hour_weight = 3
            elif h <= 5 or h >= 22: hour_weight = 0.5
            count = max(0, int(base * hour_weight / 8) + random.randint(-1, 2))
            for _ in range(count):
                is_fatal = random.random() < 0.08
                vehicles = random.randint(1, 4)
                sev_code, sev_label = get_sev_code(is_fatal, vehicles)
                dt = now - timedelta(hours=24 - h, minutes=random.randint(0, 59))
                acc = Accident(
                    district_id=district.id,
                    severity_code=sev_code,
                    severity_label=sev_label,
                    incident_type=random.choice(INCIDENT_TYPES),
                    location=random.choice(locs),
                    road_type=random.choice(ROAD_TYPES),
                    is_fatal=is_fatal,
                    vehicles_involved=vehicles,
                    units_dispatched=random.choice(UNITS),
                    lat=district.lat + random.uniform(-0.08, 0.08),
                    lng=district.lng + random.uniform(-0.08, 0.08),
                    occurred_at=dt,
                )
                db.add(acc)
    await db.commit()


async def seed_alerts(db: AsyncSession, district_map: dict):
    result = await db.execute(select(Alert))
    if result.scalars().first():
        return

    now = datetime.utcnow()
    districts = list(district_map.values())
    random.shuffle(districts)
    for i, district in enumerate(districts[:12]):
        locs = LOCATIONS.get(district.name, LOCATIONS["DEFAULT"])
        is_fatal = i < 3
        sev_code, sev_label = ("SEV-1", "FATAL") if is_fatal else (("SEV-2", "MAJOR") if i < 6 else ("SEV-3", "MINOR"))
        loc = random.choice(locs)
        db.add(Alert(
            district_id=district.id,
            severity_code=sev_code,
            severity_label=sev_label,
            message=f"{random.choice(INCIDENT_TYPES)} at {loc}",
            location=loc,
            units_dispatched=random.choice(UNITS),
            is_resolved=False,
            created_at=now - timedelta(minutes=random.randint(1, 120)),
        ))
    await db.commit()


async def seed_hourly_trends(db: AsyncSession):
    result = await db.execute(select(HourlyTrend))
    if result.scalars().first():
        return

    today = datetime.utcnow().strftime("%Y-%m-%d")
    hourly_pattern = [2,1,1,1,2,3,7,11,9,6,5,5,7,5,4,4,5,9,14,12,8,6,4,3]
    for h, count in enumerate(hourly_pattern):
        db.add(HourlyTrend(
            hour_bucket=f"{str(h).zfill(2)}:00",
            accident_count=count + random.randint(-1, 2),
            fatal_count=max(0, count // 8 + random.randint(0, 1)),
            date=today,
        ))
    await db.commit()


async def seed_system_status(db: AsyncSession):
    services = [
        ("TN Police Accident Feed",    "OPERATIONAL", 99.9,  48.0),
        ("NCRB District Data Stream",  "OPERATIONAL", 99.7, 120.0),
        ("Highway Authority Network",  "OPERATIONAL", 99.8,  89.0),
        ("Emergency Services API",     "OPERATIONAL", 99.9,  55.0),
        ("NDRF Alert Integration",     "OPERATIONAL", 98.5, 210.0),
        ("Weather & Road Conditions",  "DEGRADED",    95.2, 450.0),
        ("Municipal CCTV Feed",        "OPERATIONAL", 99.1,  88.0),
        ("Ambulance Dispatch System",  "OPERATIONAL", 99.9,  34.0),
        ("Map Tile Server",            "OPERATIONAL", 100.0,  22.0),
        ("Database Replication",       "OPERATIONAL", 100.0,  12.0),
        ("WebSocket Gateway",          "OPERATIONAL", 99.8,  18.0),
    ]
    for name, status, uptime, latency in services:
        result = await db.execute(select(SystemStatus).where(SystemStatus.service_name == name))
        existing = result.scalar_one_or_none()
        if existing:
            existing.status = status
            existing.uptime_pct = uptime
            existing.latency_ms = latency
            existing.updated_at = datetime.utcnow()
        else:
            db.add(SystemStatus(service_name=name, status=status, uptime_pct=uptime, latency_ms=latency))
    await db.commit()


async def run_seed():
    """Full seed pipeline"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        print("🌱 Seeding districts...")
        district_map = await seed_districts(db)
        print(f"   ✓ {len(district_map)} districts")
        print("🌱 Seeding district metrics...")
        await seed_metrics(db, district_map)
        print("🌱 Seeding accident history...")
        await seed_accidents_history(db, district_map)
        print("🌱 Seeding alerts...")
        await seed_alerts(db, district_map)
        print("🌱 Seeding hourly trends...")
        await seed_hourly_trends(db)
        print("🌱 Seeding system status...")
        await seed_system_status(db)
        print("✅ Seed complete!")
    return district_map


if __name__ == "__main__":
    asyncio.run(run_seed())
