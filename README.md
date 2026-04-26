# 🚦 TN Real-Time Accident Intelligence Dashboard

> A production-style, real-time road accident monitoring command center for Tamil Nadu — built with FastAPI, SQLite, Server-Sent Events, and a pure HTML/CSS/JS frontend.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-green)
![Status](https://img.shields.io/badge/Status-Live-brightgreen)

---

## 📸 Overview

| Feature | Description |
|---------|------------|
| 🗺️ Live District Map | SVG Tamil Nadu map, color-coded by risk severity (Critical/High/Moderate/Low) |
| 📡 Real-Time Updates | Server-Sent Events (SSE) push new accidents, alerts, and KPI changes every ~6 seconds |
| 📊 Live Charts | 24h accident trend line + district bar chart (Chart.js) |
| 🚨 Alert Feed | SEV-1 (Fatal) / SEV-2 (Major) / SEV-3 (Minor) live alert stream |
| 🏆 Risk Ranking | Top-5 danger zones leaderboard with risk score bars |
| 📋 Reports | Full district report table with CSV export |
| 🖥️ System Status | 11-service health monitoring panel (TN Police, NCRB, Highway Authority, etc.) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│         Browser (Frontend)       │
│  HTML + CSS + Chart.js + SVG     │
│  js/api.js  ←  SSE  →  REST     │
└──────────────┬──────────────────┘
               │ HTTP / SSE
┌──────────────▼──────────────────┐
│        FastAPI Backend           │
│  main.py  →  17 REST endpoints  │
│  ingestion.py  →  6s live ticks │
│  sse.py  →  push to all clients │
└──────────────┬──────────────────┘
               │ SQLAlchemy async
┌──────────────▼──────────────────┐
│     SQLite Database              │
│  districts · accidents · alerts  │
│  district_metrics · hourly_trends│
│  system_status                   │
└─────────────────────────────────┘
```

---

## 📁 Project Structure

```
TN-Real-Time-Accident-Dashboard/
│
├── index.html                 # Main real-time dashboard
├── district-analysis.html     # All 38 districts — sortable/filterable table
├── hotspot-maps.html          # Full-screen district risk map
├── reports.html               # Report generation + CSV export
├── system-status.html         # Backend service health monitoring
│
├── css/
│   └── style.css              # Dark theme design system (glass panels, animations)
│
├── js/
│   ├── api.js                 # API client: REST fetches + SSE stream + auto-reconnect
│   ├── app.js                 # App controller: KPIs, leaderboard, alerts, routing
│   ├── charts.js              # Chart.js: trend line, district bar, scatter charts
│   └── map.js                 # SVG Tamil Nadu map with live severity coloring
│
└── backend/
    ├── main.py                # FastAPI app — all 17+ REST routes + SSE endpoint
    ├── models.py              # SQLAlchemy async DB models (6 tables)
    ├── schemas.py             # Pydantic response schemas
    ├── seed.py                # DB seeder: 38 districts + 48h accident history
    ├── ingestion.py           # Demo live accident engine (fires every 6 seconds)
    ├── sse.py                 # SSE broadcaster (async queue per client)
    ├── .env.example           # Config template
    └── requirements.txt       # Python dependencies
```

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/Chandren/TN-Real-Time-Accident-Dashbaord.git
cd TN-Real-Time-Accident-Dashbaord
```

### 2. Set up the backend
```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
```

### 3. Start the backend
```bash
# From inside backend/
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will:
- ✅ Auto-create the SQLite database
- ✅ Seed all **38 Tamil Nadu districts**
- ✅ Generate **48h of realistic accident history**
- ✅ Start the **live demo ingestion engine** (new accident every 6s)

### 4. Open the frontend
```bash
# In a new terminal or via Finder:
open index.html
```

Or double-click `index.html` — no additional server needed.

---

## 🌐 API Reference

**Base URL**: `http://localhost:8000`  
**Interactive Docs**: http://localhost:8000/docs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/summary` | Statewide KPIs (accidents, fatal, critical zones, risk score) |
| `GET` | `/api/districts` | All 38 districts with live metrics (`?sort=risk_score\|accidents_today\|name`) |
| `GET` | `/api/districts/search?q=` | District autocomplete search |
| `GET` | `/api/district/{name}` | Single district detail |
| `GET` | `/api/district/{name}/trend` | 24h hourly accident trend |
| `GET` | `/api/district/{name}/alerts` | District-specific alerts |
| `GET` | `/api/district/{name}/hotspots` | Location-grouped hotspots |
| `GET` | `/api/accidents` | Accident list (`?district=&severity=&road_type=&from_dt=&to_dt=`) |
| `POST` | `/api/accidents` | Ingest a new accident event |
| `GET` | `/api/alerts` | Live alert feed (`?district=&severity=`) |
| `GET` | `/api/hotspots` | District hotspots for map (`?min_risk=`) |
| `GET` | `/api/map/markers` | Map circle data (lat, lng, severity, risk_score) |
| `GET` | `/api/trend/hourly` | Statewide 24h hourly trend |
| `GET` | `/api/reports/summary` | Full district report JSON |
| `GET` | `/api/reports/district/{name}` | Per-district detailed report |
| `GET` | `/api/reports/export.csv` | Download full report as CSV |
| `GET` | `/api/system/status` | 11-service health: uptime, latency, SSE connections |
| `GET` | `/api/stream` | **SSE live event stream** |

### SSE Event Types (`/api/stream`)
```json
{ "type": "connected" }                          // on first connect
{ "type": "accident",       "data": { ... } }    // new accident (every ~6s)
{ "type": "alert",          "data": { ... } }    // SEV-1 or SEV-2 alert created
{ "type": "summary_refresh" }                    // trigger KPI re-fetch
{ "type": "ping" }                               // keepalive (every ~30s idle)
```

---

## 🔄 Live Data Flow

```
ingestion.py (every 6s)
    │
    ├── Creates accident in SQLite
    ├── Updates district_metrics (risk_score, severity, trend)
    ├── Creates SEV-1/SEV-2 alert if applicable
    └── Broadcasts SSE event
              │
          /api/stream
              │
          js/api.js (EventSource)
              │
          tn:update DOM event
              │
          js/app.js → fetches
              ├── /api/summary     → KPI cards
              ├── /api/districts   → leaderboard + ranking
              ├── /api/alerts      → alerts panel
              ├── /api/trend/hourly → trend chart
              └── /api/map/markers  → SVG map colors
```

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Background | `#0a0d13` (dark navy) |
| Primary | `#00F0FF` (cyan) |
| Secondary | `#FF4D4D` (red) |
| Tertiary | `#FFA500` (orange) |
| Success | `#22c55e` (green) |
| Font (headings) | Space Grotesk |
| Font (body) | Inter |

**Severity Color Mapping:**

| Code | Label | Color |
|------|-------|-------|
| SEV-1 | FATAL | 🔴 `#FF4D4D` |
| SEV-2 | MAJOR | 🟠 `#FFA500` |
| SEV-3 | MINOR | 🔵 `#00F0FF` |
| — | Low Risk | 🟢 `#22c55e` |

---

## 🗄️ Database Schema

```sql
districts          -- 38 TN districts (code, name, lat, lng, region)
district_metrics   -- Live KPIs per district (accidents_today, fatal, risk_score, severity)
accidents          -- All accident events (SEV code, location, road_type, is_fatal, lat/lng)
alerts             -- Active alert feed (unresolved SEV-1/SEV-2/SEV-3)
hourly_trends      -- 24h statewide accident counts by HH:00
system_status      -- 11 external service health entries
```

---

## ⚙️ Configuration (`.env`)

```env
DATABASE_URL=sqlite+aiosqlite:///./tn_accident.db
CORS_ORIGINS=*
API_HOST=0.0.0.0
API_PORT=8000
DEMO_MODE=true
SEED_INTERVAL_SECONDS=6
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI 0.110 |
| ASGI server | Uvicorn |
| ORM | SQLAlchemy 2.0 (async) |
| Database | SQLite (via aiosqlite) |
| Live updates | Server-Sent Events (SSE) |
| Frontend | Pure HTML5 + CSS3 + ES2020 JS |
| Charts | Chart.js 4.4 |
| Map | Custom SVG (Tamil Nadu district layout) |
| Fonts | Google Fonts (Space Grotesk, Inter) |
| Icons | Material Symbols Outlined |

---

## 🔮 Future Roadmap

- [ ] Connect to real TN Police / NCRB accident data API
- [ ] Leaflet + OpenStreetMap integration for real geo map
- [ ] District GeoJSON boundaries overlay
- [ ] User authentication (admin vs. viewer)
- [ ] Push notifications (Web Push API)
- [ ] PostgreSQL migration for production
- [ ] Docker Compose setup
- [ ] Dark/Light mode toggle

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Chandren** — [@Chandren](https://github.com/Chandren)

> Built as a demonstration of real-time government intelligence dashboards using modern web and backend technologies.
