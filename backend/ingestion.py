"""
TN Accident Intel — Demo Data Ingestion Engine
Simulates live accident creation in the DB every N seconds
Replaces the old frontend-side TNDATA.tick()
"""
import asyncio
import random
from datetime import datetime
from sqlalchemy import select, update, func
from models import District, DistrictMetric, Accident, Alert, HourlyTrend, SessionLocal
from seed import (
    INCIDENT_TYPES, ROAD_TYPES, LOCATIONS, UNITS,
    get_sev_code, compute_risk, get_severity_from_risk
)


async def create_demo_accident(db) -> dict:
    """Create a single random accident in a random district"""
    result = await db.execute(select(District).order_by(func.random()).limit(1))
    district = result.scalar_one_or_none()
    if not district:
        return {}

    locs = LOCATIONS.get(district.name, LOCATIONS["DEFAULT"])
    is_fatal = random.random() < 0.08
    vehicles = random.randint(1, 4)
    sev_code, sev_label = get_sev_code(is_fatal, vehicles)

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
        occurred_at=datetime.utcnow(),
    )
    db.add(acc)

    # Update district metrics
    result2 = await db.execute(
        select(DistrictMetric).where(DistrictMetric.district_id == district.id)
    )
    metric = result2.scalar_one_or_none()
    if metric:
        metric.accidents_today += 1
        if is_fatal:
            metric.fatal_today += 1
        metric.risk_score = compute_risk(metric.accidents_today, metric.fatal_today)
        metric.severity = get_severity_from_risk(metric.risk_score)
        metric.trend = "up"
        metric.updated_at = datetime.utcnow()

    # Maybe create an alert for SEV-1 and SEV-2
    alert = None
    if sev_code in ("SEV-1", "SEV-2"):
        al = Alert(
            district_id=district.id,
            severity_code=sev_code,
            severity_label=sev_label,
            message=f"{acc.incident_type} at {acc.location}",
            location=acc.location,
            units_dispatched=acc.units_dispatched,
            is_resolved=False,
            created_at=datetime.utcnow(),
        )
        db.add(al)
        alert = {
            "district": district.name,
            "severity_code": sev_code,
            "severity_label": sev_label,
            "message": f"{acc.incident_type} at {acc.location}",
            "location": acc.location,
            "units_dispatched": acc.units_dispatched,
            "time": datetime.utcnow().strftime("%H:%M:%S"),
        }

    await db.commit()

    return {
        "district": district.name,
        "district_id": district.id,
        "severity_code": sev_code,
        "severity_label": sev_label,
        "incident_type": acc.incident_type,
        "location": acc.location,
        "is_fatal": is_fatal,
        "alert": alert,
        "metric": {
            "accidents_today": metric.accidents_today if metric else None,
            "fatal_today": metric.fatal_today if metric else None,
            "risk_score": metric.risk_score if metric else None,
            "severity": metric.severity if metric else None,
        }
    }


async def update_random_metric(db):
    """Randomly drift a district metric down slightly (natural resolution)"""
    result = await db.execute(
        select(DistrictMetric).order_by(func.random()).limit(1)
    )
    metric = result.scalar_one_or_none()
    if metric and metric.accidents_today > 2:
        metric.accidents_today -= 1
        metric.risk_score = compute_risk(metric.accidents_today, metric.fatal_today)
        metric.severity = get_severity_from_risk(metric.risk_score)
        metric.trend = "down"
        metric.updated_at = datetime.utcnow()
        await db.commit()


async def update_hourly_trend(db):
    """Increment the current hour bucket"""
    now = datetime.utcnow()
    hour_bucket = f"{str(now.hour).zfill(2)}:00"
    today = now.strftime("%Y-%m-%d")
    result = await db.execute(
        select(HourlyTrend).where(
            HourlyTrend.hour_bucket == hour_bucket,
            HourlyTrend.date == today
        )
    )
    trend = result.scalar_one_or_none()
    if trend:
        trend.accident_count += 1
        await db.commit()
    else:
        db.add(HourlyTrend(hour_bucket=hour_bucket, accident_count=1, fatal_count=0, date=today))
        await db.commit()


async def ingestion_loop(broadcaster, interval: int = 6):
    """Main ingestion loop — runs forever, creates accidents and broadcasts SSE events"""
    import os
    demo_mode = os.getenv("DEMO_MODE", "true").lower() == "true"
    print(f"🚀 Demo ingestion started (interval={interval}s, demo_mode={demo_mode})")
    while True:
        await asyncio.sleep(interval)
        try:
            async with SessionLocal() as db:
                # 80% chance to create a new accident
                if random.random() < 0.80:
                    result = await create_demo_accident(db)
                    if result:
                        # Broadcast SSE event
                        await broadcaster.broadcast({
                            "type": "accident",
                            "data": result,
                            "ts": datetime.utcnow().isoformat(),
                        })
                        # Also broadcast alert if one was created
                        if result.get("alert"):
                            await broadcaster.broadcast({
                                "type": "alert",
                                "data": result["alert"],
                                "ts": datetime.utcnow().isoformat(),
                            })
                # 40% chance to drift a metric down
                if random.random() < 0.40:
                    await update_random_metric(db)

                await update_hourly_trend(db)

            # Broadcast summary update every tick
            await broadcaster.broadcast({
                "type": "summary_refresh",
                "ts": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            print(f"⚠ Ingestion error: {e}")
