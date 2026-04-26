/**
 * TN Accident Intel — App Controller v2.0
 * Wired to FastAPI backend via TNAPI client + SSE stream
 * Replaces old simulated TNDATA-based app.js
 */

window.TNApp = (function () {

    // ── Clock ──────────────────────────────────────────────────────────
    function startClock() {
        function tick() {
            const now = new Date();
            const el = document.getElementById('live-clock');
            if (el) el.textContent = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  ${now.toLocaleTimeString('en-IN', { hour12: false })}`;
        }
        tick();
        setInterval(tick, 1000);
    }

    // ── KPI Cards ─────────────────────────────────────────────────────
    async function updateKPIs() {
        const kpi = await window.TNAPI.getSummary();
        if (!kpi) return;
        animateNumber('kpi-total', kpi.total_accidents);
        animateNumber('kpi-fatal', kpi.fatal_accidents);
        animateNumber('kpi-zones', kpi.critical_zones);
        setTextEl('kpi-peak', kpi.peak_hour);
        animateNumber('kpi-alerts', kpi.emergency_alerts);
    }

    function animateNumber(id, value) {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null) return;
        el.classList.remove('number-update');
        void el.offsetWidth;
        el.classList.add('number-update');
        el.textContent = Number(value).toLocaleString();
    }

    function setTextEl(id, value) {
        const el = document.getElementById(id);
        if (el && value && el.textContent !== value) el.textContent = value;
    }

    // ── Top 5 Leaderboard ─────────────────────────────────────────────
    async function updateTop5() {
        const container = document.getElementById('top5-list');
        if (!container) return;
        const top5 = await window.TNAPI.getTop5();
        if (!top5 || !top5.length) return;
        const maxRisk = top5[0]?.risk_score || 100;
        const colors = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };
        const rankClass = ['r1', 'r2', 'r3', 'r4', 'r5'];
        container.innerHTML = top5.map((d, i) => `
      <div class="top5-item">
        <div class="top5-rank ${rankClass[i]}">${i + 1}</div>
        <div class="top5-info">
          <div class="top5-name" style="color:${colors[d.severity] || '#dee2ec'}">${d.name}</div>
          <div class="top5-data">${d.accidents_today} accidents · ${d.fatal_today} fatal · Risk: ${d.risk_score}</div>
        </div>
        <div>
          <div class="top5-bar-bg">
            <div class="top5-bar-fill" style="width:${Math.round((d.risk_score / maxRisk) * 100)}%;background:${colors[d.severity]};"></div>
          </div>
        </div>
      </div>
    `).join('');
    }

    // ── District Risk Ranking ──────────────────────────────────────────
    async function updateDistrictRanking() {
        const container = document.getElementById('district-ranking');
        if (!container) return;
        const districts = await window.TNAPI.getDistricts('risk_score');
        if (!districts) return;
        const top15 = districts.slice(0, 15);
        const colors = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };
        container.innerHTML = top15.map((d, i) => `
      <div class="flex items-center gap-2" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="width:20px;text-align:right;font-size:11px;color:var(--text-muted);">${i + 1}</span>
        <span class="severity-dot" style="background:${colors[d.severity]};flex-shrink:0;"></span>
        <span style="flex:1;font-size:13px;">${d.name}</span>
        <span style="font-size:12px;color:${colors[d.severity]};font-weight:600;">${d.accidents_today}</span>
      </div>
    `).join('');
    }

    // ── Alerts Feed (from API) ─────────────────────────────────────────
    async function refreshAlerts() {
        const container = document.getElementById('alerts-list');
        if (!container) return;
        const alerts = await window.TNAPI.getAlerts();
        if (!alerts || !alerts.length) return;
        const sevClass = { 'SEV-1': 'critical', 'SEV-2': 'high', 'SEV-3': 'moderate' };
        const sevIcon = { 'SEV-1': 'car_crash', 'SEV-2': 'warning', 'SEV-3': 'minor_crash' };
        container.innerHTML = alerts.map(a => {
            const cls = sevClass[a.severity_code] || 'moderate';
            const icon = sevIcon[a.severity_code] || 'info';
            const time = new Date(a.created_at + 'Z').toLocaleTimeString('en-IN', { hour12: false });
            return `
        <div class="alert-item ${cls}">
          <span class="material-symbols-outlined">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div class="flex items-center justify-between gap-2" style="margin-bottom:3px;">
              <span class="alert-badge ${cls}">${a.severity_code} (${a.severity_label})</span>
              <span class="alert-time">${time}</span>
            </div>
            <div class="alert-incident">${a.message}</div>
            <div style="margin-top:3px;">
              <span class="alert-district">
                <span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">location_on</span>
                ${a.location}
              </span>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${a.district_name} District · ${a.units_dispatched || ''}</div>
          </div>
        </div>`;
        }).join('');
    }

    // ── Live alert streaming (prepends new alerts from SSE) ───────────
    function setupLiveAlerts() {
        document.addEventListener('tn:alert', async (e) => {
            const container = document.getElementById('alerts-list');
            if (!container) return;
            await refreshAlerts(); // Re-fetch and re-render
        });
    }

    // ── Charts (API-powered) ───────────────────────────────────────────
    async function refreshCharts() {
        if (!window.TNCharts) return;
        const trend = await window.TNAPI.getHourlyTrend();
        if (trend && trend.length) {
            const labels = trend.map(t => t.hour);
            const data = trend.map(t => t.count);
            window.TNCharts.updateTrendFromAPI(labels, data);
        }
        const districts = await window.TNAPI.getDistricts('risk_score');
        if (districts && districts.length) {
            window.TNCharts.updateBarFromAPI(districts.slice(0, 12));
        }
    }

    // ── Map (API-powered) ──────────────────────────────────────────────
    async function refreshMap() {
        if (!window.TNMap) return;
        const markers = await window.TNAPI.getMapMarkers();
        if (markers && markers.length) {
            window.TNMap.updateFromAPI('tn-map', markers);
        }
    }

    // ── Notification Bell ──────────────────────────────────────────────
    function setupNotifications() {
        const btn = document.getElementById('notif-btn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const summary = await window.TNAPI.getSummary();
            if (summary) {
                alert(`🚨 ${summary.emergency_alerts} active critical alerts in Tamil Nadu.\nTotal accidents today: ${summary.total_accidents}\nCheck the Live Alerts panel for details.`);
            }
        });
    }

    // ── Connection indicator ───────────────────────────────────────────
    function updateConnectionBadge(connected) {
        const dots = document.querySelectorAll('.live-dot');
        dots.forEach(d => {
            d.style.background = connected ? 'var(--secondary)' : '#849495';
        });
    }

    // ── Main Update (called on SSE tn:update events) ───────────────────
    let _updateThrottle = false;
    async function onUpdate() {
        if (_updateThrottle) return;
        _updateThrottle = true;
        setTimeout(() => { _updateThrottle = false; }, 3000);
        await Promise.all([
            updateKPIs(),
            updateTop5(),
            updateDistrictRanking(),
        ]);
        await refreshAlerts();
        await refreshCharts();
        await refreshMap();
    }

    // ── Init ──────────────────────────────────────────────────────────
    async function init() {
        startClock();
        window.TNAPI.init();

        document.addEventListener('tn:connected', () => updateConnectionBadge(true));
        document.addEventListener('tn:update', onUpdate);

        // Initial data load
        await Promise.all([
            updateKPIs(),
            updateTop5(),
            updateDistrictRanking(),
            refreshAlerts(),
        ]);

        // Charts and map init after first data load
        await refreshCharts();
        await refreshMap();

        setupNotifications();
        setupLiveAlerts();
    }

    return { init, refreshAlerts, refreshCharts, refreshMap, updateKPIs };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.TNApp.init();
});
