/**
 * TN ACCIDENT INTEL - Charts Module
 * Renders and updates all Chart.js charts
 */

window.TNCharts = (function () {

    const CHART_DEFAULTS = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeInOutQuart' },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(22,27,34,0.95)',
                borderColor: 'rgba(0,240,255,0.3)',
                borderWidth: 1,
                titleColor: '#00F0FF',
                bodyColor: '#dee2ec',
                padding: 10,
            }
        },
    };

    const gridLine = { color: 'rgba(255,255,255,0.05)', drawBorder: false };
    const tickStyle = { color: '#849495', font: { family: 'Inter', size: 11 } };

    let trendChart = null;
    let barChart = null;
    let scatterChart = null;

    // ── Trend Line Chart ──────────────────────────────────────────────
    function initTrendChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const { labels, data } = window.TNDATA.getTrendData();

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(0,240,255,0.25)');
        gradient.addColorStop(1, 'rgba(0,240,255,0)');

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: '#00F0FF',
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#00F0FF',
                    pointHoverRadius: 5,
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                scales: {
                    x: { grid: { ...gridLine }, ticks: { ...tickStyle, maxTicksLimit: 8 } },
                    y: { grid: gridLine, ticks: { ...tickStyle, callback: v => v + ' acc' }, beginAtZero: true }
                }
            }
        });
    }

    // ── District Bar Chart ────────────────────────────────────────────
    function initBarChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const districts = window.TNDATA.getDistricts().sort((a, b) => b.accidents - a.accidents).slice(0, 12);

        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: districts.map(d => d.name),
                datasets: [{
                    data: districts.map(d => d.accidents),
                    backgroundColor: districts.map(d => {
                        const c = { critical: 'rgba(255,77,77,0.7)', high: 'rgba(255,165,0,0.7)', moderate: 'rgba(0,240,255,0.5)', low: 'rgba(34,197,94,0.5)' };
                        return c[d.severity] || 'rgba(132,148,149,0.5)';
                    }),
                    borderColor: districts.map(d => {
                        const c = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };
                        return c[d.severity] || '#849495';
                    }),
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                scales: {
                    x: { grid: { display: false }, ticks: { ...tickStyle, maxRotation: 45, minRotation: 30 } },
                    y: { grid: gridLine, ticks: tickStyle, beginAtZero: true }
                }
            }
        });
    }

    // ── Scatter / Hotspot Chart ───────────────────────────────────────
    function initScatterChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const districts = window.TNDATA.getDistricts();

        const colorMap = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };

        scatterChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    data: districts.map(d => ({
                        x: d.accidents,
                        y: d.fatal,
                        r: Math.max(4, d.riskScore / 10),
                        label: d.name,
                        severity: d.severity,
                    })),
                    backgroundColor: districts.map(d => colorMap[d.severity] + '99'),
                    borderColor: districts.map(d => colorMap[d.severity]),
                    borderWidth: 1,
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                plugins: {
                    ...CHART_DEFAULTS.plugins,
                    tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                            label: ctx => {
                                const d = ctx.raw;
                                return ` ${d.label}: ${d.x} accidents, ${d.y} fatal`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: gridLine, ticks: tickStyle, title: { display: true, text: 'Accidents', color: '#849495', font: { size: 11 } } },
                    y: { grid: gridLine, ticks: tickStyle, title: { display: true, text: 'Fatalities', color: '#849495', font: { size: 11 } } }
                }
            }
        });
    }

    // ── Updates ───────────────────────────────────────────────────────
    function updateTrend() {
        if (!trendChart) return;
        const { data } = window.TNDATA.getTrendData();
        trendChart.data.datasets[0].data = data;
        trendChart.update('none');
    }

    function updateBar() {
        if (!barChart) return;
        const districts = window.TNDATA.getDistricts().sort((a, b) => b.accidents - a.accidents).slice(0, 12);
        const colorMap = { critical: 'rgba(255,77,77,0.7)', high: 'rgba(255,165,0,0.7)', moderate: 'rgba(0,240,255,0.5)', low: 'rgba(34,197,94,0.5)' };
        const borderMap = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };
        barChart.data.labels = districts.map(d => d.name);
        barChart.data.datasets[0].data = districts.map(d => d.accidents);
        barChart.data.datasets[0].backgroundColor = districts.map(d => colorMap[d.severity] || 'rgba(132,148,149,0.5)');
        barChart.data.datasets[0].borderColor = districts.map(d => borderMap[d.severity] || '#849495');
        barChart.update('none');
    }

    function updateScatter() {
        if (!scatterChart) return;
        const districts = window.TNDATA.getDistricts();
        const colorMap = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };
        scatterChart.data.datasets[0].data = districts.map(d => ({
            x: d.accidents, y: d.fatal, r: Math.max(4, d.riskScore / 10), label: d.name, severity: d.severity
        }));
        scatterChart.data.datasets[0].backgroundColor = districts.map(d => colorMap[d.severity] + '99');
        scatterChart.data.datasets[0].borderColor = districts.map(d => colorMap[d.severity]);
        scatterChart.update('none');
    }

    // ── API-powered update methods ────────────────────────────────────
    function updateTrendFromAPI(labels, data) {
        if (!trendChart) return;
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = data;
        trendChart.update('none');
    }

    function updateBarFromAPI(districts) {
        if (!barChart) return;
        const colorMap = { critical: 'rgba(255,77,77,0.7)', high: 'rgba(255,165,0,0.7)', moderate: 'rgba(0,240,255,0.5)', low: 'rgba(34,197,94,0.5)' };
        const borderMap = { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' };
        // districts from API have: name, accidents_today, severity
        barChart.data.labels = districts.map(d => d.name.length > 9 ? d.name.slice(0, 8) + '…' : d.name);
        barChart.data.datasets[0].data = districts.map(d => d.accidents_today);
        barChart.data.datasets[0].backgroundColor = districts.map(d => colorMap[d.severity] || 'rgba(132,148,149,0.5)');
        barChart.data.datasets[0].borderColor = districts.map(d => borderMap[d.severity] || '#849495');
        barChart.update('none');
    }

    return { initTrendChart, initBarChart, initScatterChart, updateTrend, updateBar, updateScatter, updateTrendFromAPI, updateBarFromAPI };
})();
