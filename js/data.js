/**
 * TN ACCIDENT INTEL - Data Engine
 * Simulates real-time accident data for all 38 Tamil Nadu districts
 */

window.TNDATA = (function () {

  const DISTRICTS = [
    { id: 'CHN', name: 'Chennai',       baseAccidents: 38, baseFatal: 5,  lat: 13.08, lng: 80.27 },
    { id: 'COI', name: 'Coimbatore',    baseAccidents: 29, baseFatal: 4,  lat: 11.00, lng: 76.96 },
    { id: 'MAD', name: 'Madurai',       baseAccidents: 24, baseFatal: 3,  lat: 9.92,  lng: 78.11 },
    { id: 'SAL', name: 'Salem',         baseAccidents: 22, baseFatal: 3,  lat: 11.67, lng: 78.15 },
    { id: 'TIR', name: 'Tiruchirappalli',baseAccidents:20, baseFatal: 2,  lat: 10.79, lng: 78.70 },
    { id: 'VEL', name: 'Vellore',       baseAccidents: 18, baseFatal: 2,  lat: 12.92, lng: 79.13 },
    { id: 'ERS', name: 'Erode',         baseAccidents: 17, baseFatal: 2,  lat: 11.34, lng: 77.73 },
    { id: 'THI', name: 'Tirunelveli',   baseAccidents: 16, baseFatal: 2,  lat: 8.73,  lng: 77.69 },
    { id: 'TAN', name: 'Thanjavur',     baseAccidents: 15, baseFatal: 1,  lat: 10.79, lng: 79.14 },
    { id: 'DIN', name: 'Dindigul',      baseAccidents: 14, baseFatal: 2,  lat: 10.36, lng: 77.97 },
    { id: 'KAN', name: 'Kanchipuram',   baseAccidents: 14, baseFatal: 1,  lat: 12.83, lng: 79.70 },
    { id: 'KRI', name: 'Krishnagiri',   baseAccidents: 13, baseFatal: 2,  lat: 12.52, lng: 78.21 },
    { id: 'NAM', name: 'Namakkal',      baseAccidents: 13, baseFatal: 1,  lat: 11.22, lng: 78.17 },
    { id: 'CUD', name: 'Cuddalore',     baseAccidents: 12, baseFatal: 1,  lat: 11.75, lng: 79.76 },
    { id: 'KAR', name: 'Karur',         baseAccidents: 11, baseFatal: 1,  lat: 10.96, lng: 78.08 },
    { id: 'TUV', name: 'Thoothukudi',   baseAccidents: 11, baseFatal: 1,  lat: 8.76,  lng: 78.13 },
    { id: 'VIR', name: 'Virudhunagar',  baseAccidents: 10, baseFatal: 1,  lat: 9.58,  lng: 77.96 },
    { id: 'RAM', name: 'Ramanathapuram',baseAccidents: 10, baseFatal: 1,  lat: 9.37,  lng: 78.83 },
    { id: 'TIV', name: 'Tiruvarur',     baseAccidents: 9,  baseFatal: 1,  lat: 10.77, lng: 79.64 },
    { id: 'NGP', name: 'Nagapattinam',  baseAccidents: 8,  baseFatal: 1,  lat: 10.76, lng: 79.84 },
    { id: 'ARY', name: 'Ariyalur',      baseAccidents: 8,  baseFatal: 1,  lat: 11.14, lng: 79.08 },
    { id: 'PEP', name: 'Perambalur',    baseAccidents: 7,  baseFatal: 0,  lat: 11.23, lng: 78.88 },
    { id: 'PUD', name: 'Pudukkottai',   baseAccidents: 7,  baseFatal: 1,  lat: 10.38, lng: 78.82 },
    { id: 'THE', name: 'Theni',         baseAccidents: 7,  baseFatal: 0,  lat: 10.01, lng: 77.48 },
    { id: 'SIV', name: 'Sivaganga',     baseAccidents: 6,  baseFatal: 1,  lat: 9.84,  lng: 78.48 },
    { id: 'TIK', name: 'Tirukkuvalai',  baseAccidents: 6,  baseFatal: 0,  lat: 10.76, lng: 79.53 },
    { id: 'NIL', name: 'Nilgiris',      baseAccidents: 6,  baseFatal: 1,  lat: 11.41, lng: 76.69 },
    { id: 'DHA', name: 'Dharmapuri',    baseAccidents: 13, baseFatal: 2,  lat: 12.12, lng: 78.16 },
    { id: 'KAL', name: 'Kallakurichi',  baseAccidents: 9,  baseFatal: 1,  lat: 11.74, lng: 79.01 },
    { id: 'TIP', name: 'Tirupathur',    baseAccidents: 8,  baseFatal: 1,  lat: 12.50, lng: 78.56 },
    { id: 'CHE', name: 'Chengalpattu',  baseAccidents: 16, baseFatal: 2,  lat: 12.69, lng: 79.97 },
    { id: 'TIR2',name: 'Tiruppur',      baseAccidents: 15, baseFatal: 2,  lat: 11.11, lng: 77.34 },
    { id: 'RAN', name: 'Ranipet',       baseAccidents: 11, baseFatal: 1,  lat: 12.92, lng: 79.33 },
    { id: 'TEN', name: 'Tenkasi',       baseAccidents: 8,  baseFatal: 1,  lat: 8.96,  lng: 77.32 },
    { id: 'MAY', name: 'Mayiladuthurai',baseAccidents: 7,  baseFatal: 0,  lat: 11.10, lng: 79.65 },
    { id: 'TIV2',name: 'Tirupattur',    baseAccidents: 7,  baseFatal: 1,  lat: 12.50, lng: 78.56 },
    { id: 'KOV', name: 'Kancheepuram', baseAccidents: 12, baseFatal: 1,  lat: 12.84, lng: 79.70 },
    { id: 'TIR3',name: 'Tiruvannamalai',baseAccidents: 14, baseFatal: 2, lat: 12.23, lng: 79.07 },
  ];

  const ALERT_TEMPLATES = [
    { severity: 'CRITICAL', icon: 'car_crash', locations: ['Anna Salai, Chennai', 'GST Road, Kancheepuram', 'NH48 Bypass, Coimbatore', 'Inner Ring Road, Chennai', 'SIDCO Industrial Area, Salem'] },
    { severity: 'CRITICAL', icon: 'car_crash', locations: ['Tambaram-Mudichur Rd', 'Mettupalayam Rd, Coimbatore', 'NH44, Krishnagiri', 'Trichy-Madurai NH', 'Vellore-Katpadi Rd'] },
    { severity: 'HIGH',     icon: 'warning',   locations: ['NH44, Salem District', 'Avinashi Rd, Tiruppur', 'Palayamkottai Rd, Tirunelveli', 'Karur Bypass', 'Madurai Ring Rd'] },
    { severity: 'HIGH',     icon: 'warning',   locations: ['Villupuram NH', 'Cuddalore Beach Rd', 'Thanjavur-Kumbakonam Rd', 'Erode-Tiruppur Rd', 'Namakkal-Salem NH'] },
    { severity: 'MODERATE', icon: 'minor_crash', locations: ['Besant Nagar, Chennai', 'RS Puram, Coimbatore', 'Anna Nagar, Madurai', 'Fairlands, Salem', 'Srirangam, Trichy'] },
    { severity: 'MODERATE', icon: 'minor_crash', locations: ['Ooty Main Road, Nilgiris', 'Pollachi Rd, Coimbatore', 'Sivakasi Rd, Virudhunagar', 'Rajapalayam NH', 'Sivaganga Bypass'] },
  ];

  const INCIDENT_TYPES = [
    'Multi-vehicle pileup', 'Two-wheeler collision', 'MTC Bus collision',
    'Lorry overturned on highway', 'Head-on collision', 'Pedestrian struck',
    'Skid due to wet road', 'Auto-rickshaw accident', 'Chain collision',
    'School van rear-ended', 'Tanker truck collision', 'Auto-ambulance accident'
  ];

  // Build initial district state
  let districts = DISTRICTS.map(d => ({
    ...d,
    accidents: d.baseAccidents + Math.floor(Math.random() * 8),
    fatal: d.baseFatal + (Math.random() > 0.5 ? 1 : 0),
    trend: Math.random() > 0.5 ? 'up' : 'down',
    riskScore: 0,
  }));

  // Compute risk scores
  function computeRisk(d) {
    return Math.min(100, Math.round((d.accidents * 2 + d.fatal * 10)));
  }

  districts.forEach(d => { d.riskScore = computeRisk(d); });

  function getSeverity(d) {
    if (d.riskScore >= 70) return 'critical';
    if (d.riskScore >= 40) return 'high';
    if (d.riskScore >= 20) return 'moderate';
    return 'low';
  }

  districts.forEach(d => { d.severity = getSeverity(d); });

  // Trend history for line chart (last 24 hours, hourly)
  const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  let trendData = HOURS.map((_, i) => {
    // Simulate more accidents in morning (7-9) and evening (17-21)
    const hour = i;
    let base = 4;
    if (hour >= 7 && hour <= 9) base = 14;
    else if (hour >= 17 && hour <= 21) base = 18;
    else if (hour >= 22 || hour <= 5) base = 3;
    return base + Math.floor(Math.random() * 5);
  });

  // Alerts feed
  let alerts = [];

  function generateAlert() {
    const tmpl = ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
    const loc = tmpl.locations[Math.floor(Math.random() * tmpl.locations.length)];
    const incidentType = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    // Get a nearby district
    const districtNames = districts.slice(0, 10).map(d => d.name);
    const district = districtNames[Math.floor(Math.random() * districtNames.length)];
    return { severity: tmpl.severity, icon: tmpl.icon, location: loc, incident: incidentType, time: timeStr, district, id: Date.now() + Math.random() };
  }

  // Seed initial alerts
  for (let i = 0; i < 6; i++) alerts.unshift(generateAlert());

  // Public API
  return {
    getDistricts() { return [...districts]; },
    getTop5() {
      return [...districts].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
    },
    getTrendData() { return { labels: HOURS, data: [...trendData] }; },
    getAlerts() { return [...alerts]; },
    getKPIs() {
      const total = districts.reduce((s, d) => s + d.accidents, 0);
      const fatal = districts.reduce((s, d) => s + d.fatal, 0);
      const critZones = districts.filter(d => d.severity === 'critical').length;
      const now = new Date();
      const hour = now.getHours();
      let peakHour = '18:00 – 21:00';
      if (hour >= 7 && hour <= 9) peakHour = '07:00 – 09:00';
      else if (hour >= 12 && hour <= 14) peakHour = '12:00 – 14:00';
      const emergencyAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
      return { total, fatal, critZones, peakHour, emergencyAlerts };
    },
    getSeverityColor(severity) {
      return { critical: '#FF4D4D', high: '#FFA500', moderate: '#00F0FF', low: '#22c55e' }[severity] || '#849495';
    },
    // Simulate live updates
    tick() {
      districts.forEach(d => {
        const delta = Math.random() < 0.3 ? (Math.random() < 0.6 ? 1 : -1) : 0;
        d.accidents = Math.max(0, d.accidents + delta);
        if (Math.random() < 0.05) d.fatal = Math.max(0, d.fatal + 1);
        d.riskScore = computeRisk(d);
        d.severity = getSeverity(d);
        d.trend = delta > 0 ? 'up' : delta < 0 ? 'down' : d.trend;
      });
      // Update trend: push current total into last slot
      const total = districts.reduce((s, d) => s + d.accidents, 0);
      trendData.push(total > 20 ? Math.floor(total / 5) : 6 + Math.floor(Math.random() * 4));
      trendData.shift();
      // Maybe add alert
      if (Math.random() < 0.4) {
        alerts.unshift(generateAlert());
        if (alerts.length > 20) alerts.pop();
      }
    }
  };
})();

// Main tick interval - every 5 seconds
setInterval(() => {
  window.TNDATA.tick();
  document.dispatchEvent(new CustomEvent('tn:update'));
}, 5000);
