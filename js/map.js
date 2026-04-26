/**
 * TN ACCIDENT INTEL - SVG Map Module
 * Renders a simplified Tamil Nadu district map with color-coding
 */

window.TNMap = (function () {

    // Simplified district positions as x,y percentages of viewBox (0-100)
    // Mapped to approximate geographic locations within TN bounding box
    const DISTRICT_POSITIONS = {
        'Chennai': { cx: 82, cy: 12, r: 5 },
        'Kanchipuram': { cx: 78, cy: 18, r: 4 },
        'Chengalpattu': { cx: 80, cy: 22, r: 4 },
        'Vellore': { cx: 65, cy: 14, r: 4 },
        'Ranipet': { cx: 60, cy: 16, r: 3 },
        'Tirupattur': { cx: 63, cy: 20, r: 3 },
        'Tiruvannamalai': { cx: 70, cy: 25, r: 4 },
        'Villupuram': { cx: 74, cy: 30, r: 4 },
        'Kallakurichi': { cx: 68, cy: 32, r: 3 },
        'Cuddalore': { cx: 80, cy: 33, r: 4 },
        'Krishnagiri': { cx: 55, cy: 20, r: 4 },
        'Dharmapuri': { cx: 52, cy: 24, r: 4 },
        'Salem': { cx: 55, cy: 30, r: 5 },
        'Namakkal': { cx: 55, cy: 36, r: 4 },
        'Erode': { cx: 47, cy: 32, r: 4 },
        'Tiruppur': { cx: 43, cy: 38, r: 4 },
        'Coimbatore': { cx: 35, cy: 38, r: 6 },
        'Nilgiris': { cx: 35, cy: 30, r: 3 },
        'Ariyalur': { cx: 68, cy: 40, r: 3 },
        'Perambalur': { cx: 64, cy: 42, r: 3 },
        'Karur': { cx: 55, cy: 44, r: 3 },
        'Tiruchirappalli': { cx: 65, cy: 48, r: 5 },
        'Thanjavur': { cx: 72, cy: 50, r: 4 },
        'Nagapattinam': { cx: 80, cy: 53, r: 3 },
        'Tiruvarur': { cx: 75, cy: 52, r: 3 },
        'Mayiladuthurai': { cx: 77, cy: 48, r: 3 },
        'Pudukkottai': { cx: 65, cy: 55, r: 3 },
        'Dindigul': { cx: 53, cy: 52, r: 4 },
        'Theni': { cx: 46, cy: 55, r: 3 },
        'Madurai': { cx: 57, cy: 60, r: 5 },
        'Sivaganga': { cx: 66, cy: 63, r: 3 },
        'Ramanathapuram': { cx: 72, cy: 68, r: 4 },
        'Virudhunagar': { cx: 57, cy: 67, r: 3 },
        'Tenkasi': { cx: 47, cy: 72, r: 3 },
        'Tirunelveli': { cx: 53, cy: 75, r: 4 },
        'Thoothukudi': { cx: 62, cy: 78, r: 4 },
        'Kancheepuram': { cx: 79, cy: 18, r: 3 },
        'Tirukkuvalai': { cx: 73, cy: 53, r: 2 },
    };

    const COLOR_MAP = {
        critical: '#FF4D4D',
        high: '#FFA500',
        moderate: '#00F0FF',
        low: '#22c55e',
    };

    function render(svgId) {
        const svg = document.getElementById(svgId);
        if (!svg) return;

        svg.innerHTML = '';
        svg.setAttribute('viewBox', '0 0 100 90');

        // Background grid
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        grid.setAttribute('id', 'grid');
        grid.setAttribute('width', '10');
        grid.setAttribute('height', '10');
        grid.setAttribute('patternUnits', 'userSpaceOnUse');
        const gridLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        gridLine1.setAttribute('d', 'M 10 0 L 0 0 0 10');
        gridLine1.setAttribute('fill', 'none');
        gridLine1.setAttribute('stroke', 'rgba(0,240,255,0.05)');
        gridLine1.setAttribute('stroke-width', '0.3');
        grid.appendChild(gridLine1);
        defs.appendChild(grid);
        svg.appendChild(defs);

        // Grid background
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', '100'); bgRect.setAttribute('height', '90');
        bgRect.setAttribute('fill', 'url(#grid)');
        svg.appendChild(bgRect);

        // TN Outline (simplified polygon)
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        outline.setAttribute('points',
            '48,5 65,5 88,8 92,14 88,22 82,30 85,40 82,50 80,60 75,70 65,82 55,88 45,85 38,78 32,68 28,56 25,44 28,34 32,24 38,16 44,8'
        );
        outline.setAttribute('fill', 'rgba(0,240,255,0.03)');
        outline.setAttribute('stroke', 'rgba(0,240,255,0.2)');
        outline.setAttribute('stroke-width', '0.5');
        svg.appendChild(outline);

        // Title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', '2'); title.setAttribute('y', '5');
        title.setAttribute('fill', 'rgba(0,240,255,0.3)');
        title.setAttribute('font-size', '3');
        title.setAttribute('font-family', 'Inter');
        title.textContent = 'TAMIL NADU';
        svg.appendChild(title);

        const districts = window.TNDATA.getDistricts();
        const districtMap = {};
        districts.forEach(d => { districtMap[d.name] = d; });

        Object.entries(DISTRICT_POSITIONS).forEach(([name, pos]) => {
            const d = districtMap[name];
            const severity = d ? d.severity : 'low';
            const color = COLOR_MAP[severity] || '#849495';
            const riskScore = d ? d.riskScore : 0;

            // Glow ring (only for critical)
            if (severity === 'critical') {
                const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                ring.setAttribute('cx', pos.cx); ring.setAttribute('cy', pos.cy);
                ring.setAttribute('r', pos.r + 3);
                ring.setAttribute('fill', 'none');
                ring.setAttribute('stroke', color);
                ring.setAttribute('stroke-width', '0.3');
                ring.setAttribute('opacity', '0.3');
                ring.innerHTML = `<animate attributeName="r" values="${pos.r + 2};${pos.r + 5};${pos.r + 2}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/>`;
                svg.appendChild(ring);
            }

            // Main district circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pos.cx); circle.setAttribute('cy', pos.cy);
            circle.setAttribute('r', pos.r);
            circle.setAttribute('fill', color + '40');
            circle.setAttribute('stroke', color);
            circle.setAttribute('stroke-width', '0.5');
            circle.setAttribute('data-name', name);
            circle.setAttribute('data-severity', severity);
            circle.setAttribute('data-risk', riskScore);
            circle.style.cursor = 'pointer';
            svg.appendChild(circle);

            // District label (only for larger/important ones)
            if (pos.r >= 4) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', pos.cx); label.setAttribute('y', pos.cy + 0.5 + pos.r);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('fill', color);
                label.setAttribute('font-size', '2.2');
                label.setAttribute('font-family', 'Inter');
                label.setAttribute('font-weight', '600');
                label.textContent = name.length > 9 ? name.slice(0, 8) + '…' : name;
                svg.appendChild(label);
            }

            // Tooltip
            circle.addEventListener('mouseenter', (e) => showTooltip(e, name, d, color));
            circle.addEventListener('mouseleave', hideTooltip);
            circle.addEventListener('mousemove', moveTooltip);
        });
    }

    function showTooltip(e, name, d, color) {
        let tip = document.getElementById('map-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'map-tooltip';
            tip.className = 'map-tooltip';
            document.body.appendChild(tip);
        }
        tip.innerHTML = `
      <div style="color:${color};font-weight:700;font-size:13px;margin-bottom:4px;">${name}</div>
      <div style="color:#dee2ec;font-size:12px;">🚨 Accidents: <b>${d ? d.accidents : 'N/A'}</b></div>
      <div style="color:#dee2ec;font-size:12px;">💀 Fatal: <b>${d ? d.fatal : 'N/A'}</b></div>
      <div style="color:#849495;font-size:11px;margin-top:4px;">Risk Score: ${d ? d.riskScore : 'N/A'}</div>
    `;
        tip.style.display = 'block';
        moveTooltip(e);
    }

    function moveTooltip(e) {
        const tip = document.getElementById('map-tooltip');
        if (!tip) return;
        tip.style.left = (e.clientX + 15) + 'px';
        tip.style.top = (e.clientY - 10) + 'px';
    }

    function hideTooltip() {
        const tip = document.getElementById('map-tooltip');
        if (tip) tip.style.display = 'none';
    }

    function update(svgId) {
        render(svgId);
    }

    /**
     * updateFromAPI — renders map using /api/map/markers data
     * markers: [{ name, risk_score, severity, accidents_today, fatal_today, lat, lng }]
     */
    function updateFromAPI(svgId, markers) {
        const svg = document.getElementById(svgId);
        if (!svg || !markers) return;
        // Patch tooltips on existing circles using data-name
        markers.forEach(m => {
            const circle = svg.querySelector(`[data-name="${m.name}"]`);
            if (circle) {
                const color = COLOR_MAP[m.severity] || '#849495';
                circle.setAttribute('fill', color + '40');
                circle.setAttribute('stroke', color);
                circle.dataset.severity = m.severity;
                circle.dataset.risk = m.risk_score;
                // Refresh hover listener
                circle.onmouseenter = (e) => showTooltip(e, m.name, { accidents: m.accidents_today, fatal: m.fatal_today, riskScore: m.risk_score }, color);
                circle.onmouseleave = hideTooltip;
                circle.onmousemove = moveTooltip;
            }
        });
        // If SVG is empty (first render), do a full render with mapped data
        if (!svg.querySelector('circle')) {
            // Build a DistrictMap compatible object
            window._apiMarkers = markers;
            renderFromAPI(svgId, markers);
        }
    }

    function renderFromAPI(svgId, markers) {
        // Use existing render() but override TNDATA with API markers
        const fakeDistrictMap = {};
        markers.forEach(m => {
            fakeDistrictMap[m.name] = {
                name: m.name, accidents: m.accidents_today, fatal: m.fatal_today,
                riskScore: m.risk_score, severity: m.severity
            };
        });
        // Temporarily patch window.TNDATA for render compatibility
        const origGetDistricts = window.TNDATA ? window.TNDATA.getDistricts : null;
        if (!window.TNDATA) window.TNDATA = {};
        window.TNDATA.getDistricts = () => markers.map(m => ({
            name: m.name, accidents: m.accidents_today, fatal: m.fatal_today,
            riskScore: m.risk_score, severity: m.severity
        }));
        render(svgId);
        if (origGetDistricts) window.TNDATA.getDistricts = origGetDistricts;
    }

    return { render, update, updateFromAPI };
})();
