/**
 * TN Accident Intel — API Client
 * Replaces js/data.js simulated data with real FastAPI backend calls
 * Also handles SSE subscription for live updates
 */

window.TNAPI = (function () {

    const BASE = 'http://localhost:8000';

    // ── SSE Connection ───────────────────────────────────────────────
    let _sse = null;
    let _sseRetries = 0;
    const MAX_SSE_RETRIES = 5;

    function connectSSE() {
        if (_sse) { _sse.close(); }
        _sse = new EventSource(`${BASE}/api/stream`);

        _sse.onopen = () => {
            _sseRetries = 0;
            console.info('[SSE] Connected to TN Accident Intel stream');
            document.dispatchEvent(new CustomEvent('tn:connected'));
        };

        _sse.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                // Dispatch typed events
                document.dispatchEvent(new CustomEvent('tn:stream', { detail: payload }));
                if (payload.type === 'accident' || payload.type === 'alert' || payload.type === 'summary_refresh') {
                    document.dispatchEvent(new CustomEvent('tn:update'));
                }
                if (payload.type === 'alert' && payload.data) {
                    document.dispatchEvent(new CustomEvent('tn:alert', { detail: payload.data }));
                }
            } catch (e) {
                console.warn('[SSE] Parse error', e);
            }
        };

        _sse.onerror = () => {
            _sse.close();
            _sse = null;
            if (_sseRetries < MAX_SSE_RETRIES) {
                _sseRetries++;
                console.warn(`[SSE] Disconnected. Retry ${_sseRetries}/${MAX_SSE_RETRIES} in 5s...`);
                setTimeout(connectSSE, 5000);
            } else {
                console.error('[SSE] Max retries reached. Falling back to polling.');
                startPollingFallback();
            }
        };
    }

    function startPollingFallback() {
        setInterval(() => {
            document.dispatchEvent(new CustomEvent('tn:update'));
        }, 8000);
    }

    // ── Core Fetch Helper ────────────────────────────────────────────
    async function apiFetch(path, opts = {}) {
        try {
            const res = await fetch(`${BASE}${path}`, opts);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return await res.json();
        } catch (err) {
            console.error(`[API] ${path} failed:`, err);
            return null;
        }
    }

    // ── Public API Methods (mirror old TNDATA interface) ─────────────
    return {
        init() {
            connectSSE();
        },

        // Summary KPIs
        async getSummary() {
            return await apiFetch('/api/summary');
        },

        // All districts with live metrics
        async getDistricts(sort = 'risk_score') {
            return await apiFetch(`/api/districts?sort=${sort}`) || [];
        },

        // District search autocomplete
        async searchDistricts(q) {
            return await apiFetch(`/api/districts/search?q=${encodeURIComponent(q)}`) || [];
        },

        // Single district detail
        async getDistrict(name) {
            return await apiFetch(`/api/district/${encodeURIComponent(name)}`);
        },

        // Trend data
        async getHourlyTrend() {
            return await apiFetch('/api/trend/hourly') || [];
        },

        async getDistrictTrend(name) {
            return await apiFetch(`/api/district/${encodeURIComponent(name)}/trend`) || [];
        },

        // Alerts
        async getAlerts(district = null, severity = null) {
            let url = '/api/alerts?limit=30';
            if (district) url += `&district=${encodeURIComponent(district)}`;
            if (severity) url += `&severity=${encodeURIComponent(severity)}`;
            return await apiFetch(url) || [];
        },

        // Hotspot map markers
        async getMapMarkers() {
            return await apiFetch('/api/map/markers') || [];
        },

        // Hotspots with min risk filter
        async getHotspots(minRisk = 0) {
            return await apiFetch(`/api/hotspots?min_risk=${minRisk}`) || [];
        },

        // Top 5 by risk score
        async getTop5() {
            const districts = await this.getDistricts('risk_score');
            return districts.slice(0, 5);
        },

        // Accidents with filters
        async getAccidents({ district, severity, from_dt, to_dt, road_type, limit = 50 } = {}) {
            const params = new URLSearchParams({ limit });
            if (district) params.set('district', district);
            if (severity) params.set('severity', severity);
            if (from_dt) params.set('from_dt', from_dt);
            if (to_dt) params.set('to_dt', to_dt);
            if (road_type) params.set('road_type', road_type);
            return await apiFetch(`/api/accidents?${params}`) || [];
        },

        // System status
        async getSystemStatus() {
            return await apiFetch('/api/system/status');
        },

        // Reports
        async getReportSummary() {
            return await apiFetch('/api/reports/summary');
        },

        // Utility: map severity to color
        severityColor(severity) {
            return { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' }[severity] || '#849495';
        },

        // Utility: severity label to sev code
        sevCodeToLabel(code) {
            return { 'SEV-1': 'FATAL', 'SEV-2': 'MAJOR', 'SEV-3': 'MINOR' }[code] || code;
        },

        get sseConnected() {
            return _sse && _sse.readyState === EventSource.OPEN;
        },
    };
})();
