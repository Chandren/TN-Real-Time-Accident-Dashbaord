"""
TN Accident Intel — Database Models & Setup
SQLAlchemy async models for SQLite → PostgreSQL ready
"""
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./tn_accident.db")

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()


# ── District master table ──────────────────────────────────────────────────────
class District(Base):
    __tablename__ = "districts"
    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String(8), unique=True, nullable=False)
    name        = Column(String(80), nullable=False, index=True)
    lat         = Column(Float, nullable=False)
    lng         = Column(Float, nullable=False)
    region      = Column(String(40))   # North / South / Central / West / Delta / East


# ── Live district metrics (updated in real-time) ──────────────────────────────
class DistrictMetric(Base):
    __tablename__ = "district_metrics"
    id              = Column(Integer, primary_key=True)
    district_id     = Column(Integer, ForeignKey("districts.id"), unique=True, nullable=False)
    accidents_today = Column(Integer, default=0)
    fatal_today     = Column(Integer, default=0)
    risk_score      = Column(Float, default=0.0)
    severity        = Column(String(12), default="low")   # critical/high/moderate/low
    trend           = Column(String(4), default="flat")    # up/down/flat
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Individual accident events ─────────────────────────────────────────────────
class Accident(Base):
    __tablename__ = "accidents"
    id              = Column(Integer, primary_key=True)
    district_id     = Column(Integer, ForeignKey("districts.id"), nullable=False)
    severity_code   = Column(String(6), default="SEV-3")  # SEV-1/SEV-2/SEV-3
    severity_label  = Column(String(20), default="MINOR")  # FATAL/MAJOR/MINOR
    incident_type   = Column(String(120))
    location        = Column(String(200))
    road_type       = Column(String(40))   # NH/SH/City/Rural
    is_fatal        = Column(Boolean, default=False)
    vehicles_involved = Column(Integer, default=1)
    units_dispatched  = Column(String(100))
    lat             = Column(Float, nullable=True)
    lng             = Column(Float, nullable=True)
    occurred_at     = Column(DateTime, default=datetime.utcnow, index=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


# ── Alert feed ─────────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"
    id              = Column(Integer, primary_key=True)
    district_id     = Column(Integer, ForeignKey("districts.id"), nullable=False)
    accident_id     = Column(Integer, ForeignKey("accidents.id"), nullable=True)
    severity_code   = Column(String(6), default="SEV-3")
    severity_label  = Column(String(20), default="MINOR")
    message         = Column(Text)
    location        = Column(String(200))
    units_dispatched = Column(String(100))
    is_resolved     = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow, index=True)


# ── Hourly trend snapshot ──────────────────────────────────────────────────────
class HourlyTrend(Base):
    __tablename__ = "hourly_trends"
    id              = Column(Integer, primary_key=True)
    hour_bucket     = Column(String(5))   # "HH:00"
    accident_count  = Column(Integer, default=0)
    fatal_count     = Column(Integer, default=0)
    date            = Column(String(10))  # "YYYY-MM-DD"


# ── System status snapshots ────────────────────────────────────────────────────
class SystemStatus(Base):
    __tablename__ = "system_status"
    id            = Column(Integer, primary_key=True)
    service_name  = Column(String(60), unique=True)
    status        = Column(String(20), default="OPERATIONAL")
    uptime_pct    = Column(Float, default=100.0)
    latency_ms    = Column(Float, default=0.0)
    details       = Column(Text)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with SessionLocal() as session:
        yield session
