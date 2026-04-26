"""
TN Accident Intel — Main FastAPI Application
All REST API routes + SSE stream + CORS + startup lifecycle
"""
import asyncio
import json
import os
import time
from datetime import datetime, timedelta
from typing import AsyncGenerator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_

load_dotenv()

from models import (
    District, DistrictMetric, Accident, Alert,
    HourlyTrend, SystemStatus, init_db, get_db, engine
)
from schemas import (
    SummaryOut, DistrictMetricOut, AlertOut, AccidentCreate, AccidentOut,
    TrendPoint, HotspotOut, SystemStatusOut, SystemServiceStatus, MapMarkerOut
)
from sse import broadcaster
from ingestion import ingestion_loop
from seed import run_seed

# ── App Factory ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TN Accident Intel API",
    description="Real-Time Tamil Nadu Road Accident Intelligence Platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()
_ingestion_task = None


@app.on_event("startup")
async def startup():
    global _ingestion_task
    await init_db()
    await run_seed()
    interval = int(os.getenv("SEED_INTERVAL_SECONDS", "6"))
    _ingestion_task = asyncio.create_task(ingestion_loop(broadcaster, interval))
    print("✅ TN Accident Intel API started")


@app.on_event("shutdown")
async def shutdown():
    if _ingestion_task:
        _ingestion_task.cancel()


# ── Helpers ────────────────────────────────────────────────────────────────────
def compute_peak_hour() -> str:
    h = datetime.utcnow().hour
    if 7 <= h <= 9:   return "07:00 – 09:00"
    if 12 <= h <= 14: return "12:00 – 14:00"
    if 17 <= h <= 21: return "17:00 – 21:00"
    return "18:00 – 21:00"


async def get_district_by_name(name: str, db: AsyncSession) -> District:
    result = await db.execute(select(District).where(
        func.lower(District.name) == name.strip().lower()
    ))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail=f"District '{name}' not found")
    return d


# ── Root ───────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    uptime = round(time.time() - START_TIME, 1)
    return {"service": "TN Accident Intel API", "version": "2.0.0", "uptime_seconds": uptime}


# ══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/summary", response_model=SummaryOut)
async def get_summary(db: AsyncSession = Depends(get_db)):
    r1 = await db.execute(select(func.sum(DistrictMetric.accidents_today)))
    r2 = await db.execute(select(func.sum(DistrictMetric.fatal_today)))
    r3 = await db.execute(select(func.count()).where(DistrictMetric.severity == "critical"))
    r4 = await db.execute(
        select(func.count()).select_from(Alert).where(
            and_(Alert.severity_code == "SEV-1", Alert.is_resolved == False)
        )
    )
    r5 = await db.execute(select(func.avg(DistrictMetric.risk_score)))

    total     = r1.scalar() or 0
    fatal     = r2.scalar() or 0
    critical  = r3.scalar() or 0
    emerg     = r4.scalar() or 0
    avg_risk  = round(r5.scalar() or 0.0, 1)

    return SummaryOut(
        total_accidents=int(total),
        fatal_accidents=int(fatal),
        critical_zones=int(critical),
        peak_hour=compute_peak_hour(),
        emergency_alerts=int(emerg),
        statewide_risk=avg_risk,
        last_updated=datetime.utcnow().strftime("%H:%M:%S UTC"),
    )


# ══════════════════════════════════════════════════════════════════════════════
#  DISTRICTS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/districts", response_model=list[DistrictMetricOut])
async def list_districts(
    sort: str = Query("risk_score", enum=["risk_score", "accidents_today", "name"]),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(District, DistrictMetric)
        .join(DistrictMetric, District.id == DistrictMetric.district_id)
    )
    rows = result.all()
    out = []
    for district, metric in rows:
        out.append(DistrictMetricOut(
            district_id=district.id,
            code=district.code,
            name=district.name,
            lat=district.lat,
            lng=district.lng,
            region=district.region,
            accidents_today=metric.accidents_today,
            fatal_today=metric.fatal_today,
            risk_score=metric.risk_score,
            severity=metric.severity,
            trend=metric.trend,
            updated_at=metric.updated_at,
        ))
    if sort == "name":
        out.sort(key=lambda x: x.name)
    elif sort == "accidents_today":
        out.sort(key=lambda x: x.accidents_today, reverse=True)
    else:
        out.sort(key=lambda x: x.risk_score, reverse=True)
    return out


@app.get("/api/districts/search")
async def search_districts(
    q: str = Query("", min_length=0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(District, DistrictMetric)
        .join(DistrictMetric, District.id == DistrictMetric.district_id)
        .where(func.lower(District.name).contains(q.lower()))
        .limit(10)
    )
    rows = result.all()
    return [
        {
            "name": d.name, "code": d.code, "lat": d.lat, "lng": d.lng,
            "risk_score": m.risk_score, "severity": m.severity,
            "accidents_today": m.accidents_today,
        }
        for d, m in rows
    ]


@app.get("/api/district/{name}")
async def get_district_detail(name: str, db: AsyncSession = Depends(get_db)):
    district = await get_district_by_name(name, db)
    result = await db.execute(
        select(DistrictMetric).where(DistrictMetric.district_id == district.id)
    )
    metric = result.scalar_one_or_none()
    return {
        "id": district.id, "code": district.code, "name": district.name,
        "lat": district.lat, "lng": district.lng, "region": district.region,
        "accidents_today": metric.accidents_today if metric else 0,
        "fatal_today": metric.fatal_today if metric else 0,
        "risk_score": metric.risk_score if metric else 0.0,
        "severity": metric.severity if metric else "low",
        "trend": metric.trend if metric else "flat",
        "updated_at": metric.updated_at.isoformat() if metric and metric.updated_at else None,
    }


@app.get("/api/district/{name}/trend", response_model=list[TrendPoint])
async def get_district_trend(name: str, db: AsyncSession = Depends(get_db)):
    """Return 24h trend data for today"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    result = await db.execute(
        select(HourlyTrend)
        .where(HourlyTrend.date == today)
        .order_by(HourlyTrend.hour_bucket)
    )
    rows = result.scalars().all()
    return [TrendPoint(hour=r.hour_bucket, count=r.accident_count, fatal=r.fatal_count) for r in rows]


@app.get("/api/district/{name}/alerts", response_model=list[AlertOut])
async def get_district_alerts(name: str, limit: int = 20, db: AsyncSession = Depends(get_db)):
    district = await get_district_by_name(name, db)
    result = await db.execute(
        select(Alert)
        .where(Alert.district_id == district.id)
        .order_by(desc(Alert.created_at))
        .limit(limit)
    )
    alerts = result.scalars().all()
    return [
        AlertOut(
            id=a.id, district_name=name, district_id=district.id,
            severity_code=a.severity_code, severity_label=a.severity_label,
            message=a.message, location=a.location,
            units_dispatched=a.units_dispatched, is_resolved=a.is_resolved,
            created_at=a.created_at,
        )
        for a in alerts
    ]


@app.get("/api/district/{name}/hotspots")
async def get_district_hotspots(name: str, db: AsyncSession = Depends(get_db)):
    district = await get_district_by_name(name, db)
    since = datetime.utcnow() - timedelta(hours=24)
    result = await db.execute(
        select(Accident)
        .where(and_(Accident.district_id == district.id, Accident.occurred_at >= since))
        .order_by(desc(Accident.occurred_at))
        .limit(50)
    )
    accidents = result.scalars().all()
    # Group by location
    from collections import defaultdict
    hotspots = defaultdict(lambda: {"count": 0, "fatal": 0, "lat": None, "lng": None})
    for a in accidents:
        h = hotspots[a.location]
        h["count"] += 1
        if a.is_fatal: h["fatal"] += 1
        if a.lat: h["lat"] = a.lat
        if a.lng: h["lng"] = a.lng
    return [
        {"location": loc, **data}
        for loc, data in sorted(hotspots.items(), key=lambda x: -x[1]["count"])
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  ACCIDENTS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/accidents")
async def list_accidents(
    district: Optional[str] = None,
    severity: Optional[str] = None,
    from_dt: Optional[str] = None,
    to_dt: Optional[str] = None,
    road_type: Optional[str] = None,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
):
    q = select(Accident, District).join(District, Accident.district_id == District.id)
    filters = []
    if district:
        d = await get_district_by_name(district, db)
        filters.append(Accident.district_id == d.id)
    if severity:
        filters.append(Accident.severity_code == severity.upper())
    if from_dt:
        filters.append(Accident.occurred_at >= datetime.fromisoformat(from_dt))
    if to_dt:
        filters.append(Accident.occurred_at <= datetime.fromisoformat(to_dt))
    if road_type:
        filters.append(Accident.road_type == road_type)
    if filters:
        q = q.where(and_(*filters))
    q = q.order_by(desc(Accident.occurred_at)).limit(limit)
    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "id": a.id, "district": d.name, "district_id": a.district_id,
            "severity_code": a.severity_code, "severity_label": a.severity_label,
            "incident_type": a.incident_type, "location": a.location,
            "road_type": a.road_type, "is_fatal": a.is_fatal,
            "vehicles_involved": a.vehicles_involved,
            "units_dispatched": a.units_dispatched,
            "lat": a.lat, "lng": a.lng,
            "occurred_at": a.occurred_at.isoformat(),
        }
        for a, d in rows
    ]


@app.post("/api/accidents", status_code=201)
async def create_accident(payload: AccidentCreate, db: AsyncSession = Depends(get_db)):
    district = await get_district_by_name(payload.district_name, db)
    acc = Accident(
        district_id=district.id,
        severity_code=payload.severity_code,
        severity_label=payload.severity_label,
        incident_type=payload.incident_type,
        location=payload.location,
        road_type=payload.road_type,
        is_fatal=payload.is_fatal,
        vehicles_involved=payload.vehicles_involved,
        units_dispatched=payload.units_dispatched,
        lat=payload.lat,
        lng=payload.lng,
        occurred_at=datetime.utcnow(),
    )
    db.add(acc)
    # Update metric
    result = await db.execute(
        select(DistrictMetric).where(DistrictMetric.district_id == district.id)
    )
    metric = result.scalar_one_or_none()
    if metric:
        metric.accidents_today += 1
        if payload.is_fatal: metric.fatal_today += 1
        from seed import compute_risk, get_severity_from_risk
        metric.risk_score = compute_risk(metric.accidents_today, metric.fatal_today)
        metric.severity = get_severity_from_risk(metric.risk_score)
        metric.trend = "up"
    await db.commit()
    await broadcaster.broadcast({"type": "accident", "data": {"district": district.name, "severity_code": payload.severity_code}, "ts": datetime.utcnow().isoformat()})
    return {"status": "created", "district": district.name}


# ══════════════════════════════════════════════════════════════════════════════
#  ALERTS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/alerts", response_model=list[AlertOut])
async def list_alerts(
    district: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Alert, District).join(District, Alert.district_id == District.id)
    filters = [Alert.is_resolved == False]
    if district:
        d = await get_district_by_name(district, db)
        filters.append(Alert.district_id == d.id)
    if severity:
        filters.append(Alert.severity_code == severity.upper())
    q = q.where(and_(*filters)).order_by(desc(Alert.created_at)).limit(limit)
    result = await db.execute(q)
    rows = result.all()
    return [
        AlertOut(
            id=a.id, district_name=d.name, district_id=a.district_id,
            severity_code=a.severity_code, severity_label=a.severity_label,
            message=a.message, location=a.location,
            units_dispatched=a.units_dispatched, is_resolved=a.is_resolved,
            created_at=a.created_at,
        )
        for a, d in rows
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  HOTSPOTS / MAP
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/hotspots", response_model=list[HotspotOut])
async def get_hotspots(
    min_risk: float = Query(0.0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(District, DistrictMetric)
        .join(DistrictMetric, District.id == DistrictMetric.district_id)
        .where(DistrictMetric.risk_score >= min_risk)
        .order_by(desc(DistrictMetric.risk_score))
    )
    rows = result.all()
    return [
        HotspotOut(
            district_id=d.id, district_name=d.name, lat=d.lat, lng=d.lng,
            risk_score=m.risk_score, severity=m.severity,
            accidents_today=m.accidents_today, fatal_today=m.fatal_today,
        )
        for d, m in rows
    ]


@app.get("/api/map/markers", response_model=list[MapMarkerOut])
async def get_map_markers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(District, DistrictMetric)
        .join(DistrictMetric, District.id == DistrictMetric.district_id)
    )
    rows = result.all()
    return [
        MapMarkerOut(
            district_id=d.id, name=d.name, lat=d.lat, lng=d.lng,
            risk_score=m.risk_score, severity=m.severity,
            accidents_today=m.accidents_today, fatal_today=m.fatal_today,
        )
        for d, m in rows
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  REPORTS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/reports/summary")
async def report_summary(db: AsyncSession = Depends(get_db)):
    districts = await list_districts(sort="risk_score", db=db)
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "total_accidents": sum(d.accidents_today for d in districts),
        "total_fatal": sum(d.fatal_today for d in districts),
        "critical_districts": [d.name for d in districts if d.severity == "critical"],
        "high_districts": [d.name for d in districts if d.severity == "high"],
        "districts": [
            {
                "name": d.name, "accidents": d.accidents_today, "fatal": d.fatal_today,
                "risk_score": d.risk_score, "severity": d.severity, "trend": d.trend,
                "injury_rate": f"{round(d.fatal_today/d.accidents_today*100,1)}%" if d.accidents_today else "0%"
            }
            for d in districts
        ]
    }


@app.get("/api/reports/district/{name}")
async def report_district(name: str, db: AsyncSession = Depends(get_db)):
    district = await get_district_by_name(name, db)
    detail = await get_district_detail(name, db)
    alerts = await list_alerts(district=name, db=db)
    hotspots = await get_district_hotspots(name, db)
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "district": detail,
        "alerts": [a.model_dump() for a in alerts],
        "hotspots": hotspots,
    }


@app.get("/api/reports/export.csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    districts = await list_districts(sort="risk_score", db=db)
    lines = ["Rank,District,Accidents,Fatalities,Injury Rate,Risk Score,Severity"]
    for i, d in enumerate(districts, 1):
        injury = f"{round(d.fatal_today/d.accidents_today*100,1)}%" if d.accidents_today else "0%"
        lines.append(f"{i},{d.name},{d.accidents_today},{d.fatal_today},{injury},{d.risk_score},{d.severity}")
    content = "\n".join(lines)
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tn_accident_report.csv"},
    )


@app.get("/api/trend/hourly", response_model=list[TrendPoint])
async def get_hourly_trend(db: AsyncSession = Depends(get_db)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    result = await db.execute(
        select(HourlyTrend)
        .where(HourlyTrend.date == today)
        .order_by(HourlyTrend.hour_bucket)
    )
    rows = result.scalars().all()
    return [TrendPoint(hour=r.hour_bucket, count=r.accident_count, fatal=r.fatal_count) for r in rows]


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM STATUS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/system/status", response_model=SystemStatusOut)
async def get_system_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemStatus))
    services = result.scalars().all()
    uptime = round(time.time() - START_TIME, 1)
    db_ping_start = time.time()
    await db.execute(select(func.now()))
    db_latency = round((time.time() - db_ping_start) * 1000, 1)

    return SystemStatusOut(
        services=[
            SystemServiceStatus(
                service_name=s.service_name, status=s.status,
                uptime_pct=s.uptime_pct, latency_ms=s.latency_ms,
                details=s.details,
            )
            for s in services
        ],
        api_uptime=uptime,
        db_latency_ms=db_latency,
        sse_active_connections=broadcaster.connection_count,
        ingestion_status="ACTIVE" if _ingestion_task and not _ingestion_task.done() else "STOPPED",
        last_sync=datetime.utcnow().strftime("%H:%M:%S UTC"),
        server_time=datetime.utcnow().isoformat(),
    )


# ══════════════════════════════════════════════════════════════════════════════
#  SSE STREAM
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/stream")
async def sse_stream(request: Request):
    """Server-Sent Events endpoint — push live accident/alert/summary events"""
    queue = broadcaster.subscribe()

    async def event_generator() -> AsyncGenerator[str, None]:
        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'ts': datetime.utcnow().isoformat()})}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield msg
                except asyncio.TimeoutError:
                    # Keepalive ping
                    yield f"data: {json.dumps({'type': 'ping', 'ts': datetime.utcnow().isoformat()})}\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        reload=True,
    )
