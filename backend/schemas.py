"""
TN Accident Intel — Pydantic Response Schemas
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class DistrictBase(BaseModel):
    code: str
    name: str
    lat: float
    lng: float
    region: Optional[str] = None


class DistrictMetricOut(BaseModel):
    district_id: int
    code: str
    name: str
    lat: float
    lng: float
    region: Optional[str] = None
    accidents_today: int
    fatal_today: int
    risk_score: float
    severity: str
    trend: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: int
    district_name: str
    district_id: int
    severity_code: str
    severity_label: str
    message: str
    location: str
    units_dispatched: Optional[str]
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AccidentCreate(BaseModel):
    district_name: str
    severity_code: str = "SEV-3"
    severity_label: str = "MINOR"
    incident_type: str
    location: str
    road_type: str = "City"
    is_fatal: bool = False
    vehicles_involved: int = 1
    units_dispatched: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class AccidentOut(BaseModel):
    id: int
    district_id: int
    district_name: Optional[str] = None
    severity_code: str
    severity_label: str
    incident_type: str
    location: str
    road_type: str
    is_fatal: bool
    vehicles_involved: int
    units_dispatched: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    occurred_at: datetime

    class Config:
        from_attributes = True


class SummaryOut(BaseModel):
    total_accidents: int
    fatal_accidents: int
    critical_zones: int
    peak_hour: str
    emergency_alerts: int
    statewide_risk: float
    last_updated: str


class TrendPoint(BaseModel):
    hour: str
    count: int
    fatal: int


class HotspotOut(BaseModel):
    district_id: int
    district_name: str
    lat: float
    lng: float
    risk_score: float
    severity: str
    accidents_today: int
    fatal_today: int


class SystemServiceStatus(BaseModel):
    service_name: str
    status: str
    uptime_pct: float
    latency_ms: float
    details: Optional[str]


class SystemStatusOut(BaseModel):
    services: List[SystemServiceStatus]
    api_uptime: float
    db_latency_ms: float
    sse_active_connections: int
    ingestion_status: str
    last_sync: str
    server_time: str


class MapMarkerOut(BaseModel):
    district_id: int
    name: str
    lat: float
    lng: float
    risk_score: float
    severity: str
    accidents_today: int
    fatal_today: int
