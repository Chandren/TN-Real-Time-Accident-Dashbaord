/**
 * TN ACCIDENT INTEL - Alerts Module
 * Renders and auto-updates the live alerts feed
 */

window.TNAlerts = (function () {

    const SEVERITY_CLASS = { CRITICAL: 'critical', HIGH: 'high', MODERATE: 'moderate' };

    function renderAlert(alert) {
        const cls = SEVERITY_CLASS[alert.severity] || 'moderate';
        return `
      <div class="alert-item ${cls}" data-id="${alert.id}">
        <span class="material-symbols-outlined">${alert.icon}</span>
        <div style="flex:1;min-width:0;">
          <div class="flex items-center justify-between gap-2" style="margin-bottom:3px;">
            <span class="alert-badge ${cls}">${alert.severity}</span>
            <span class="alert-time">${alert.time}</span>
          </div>
          <div class="alert-incident">${alert.incident}</div>
          <div class="flex items-center gap-2" style="margin-top:3px;">
            <span class="alert-district">
              <span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">location_on</span>
              ${alert.location}
            </span>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;letter-spacing:0.05em;">${alert.district} District</div>
        </div>
      </div>`;
    }

    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const alerts = window.TNDATA.getAlerts();
        container.innerHTML = alerts.map(renderAlert).join('');
    }

    function update(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const alerts = window.TNDATA.getAlerts();
        const existing = new Set([...container.querySelectorAll('[data-id]')].map(el => el.dataset.id));
        const newAlerts = alerts.filter(a => !existing.has(String(a.id)));

        if (newAlerts.length > 0) {
            // Prepend new alerts with animation
            newAlerts.reverse().forEach(alert => {
                const cls = SEVERITY_CLASS[alert.severity] || 'moderate';
                const div = document.createElement('div');
                div.innerHTML = renderAlert(alert);
                const item = div.firstElementChild;
                container.insertBefore(item, container.firstChild);
            });
            // Trim excess
            while (container.children.length > 20) {
                container.removeChild(container.lastChild);
            }
        }
    }

    return { render, update };
})();
