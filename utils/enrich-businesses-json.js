const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/businesses.json');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/""/g, '"')
    .trim();
}

function normalizeAreaName(rawArea) {
  const cleaned = normalizeText(rawArea)
    .replace(/קיבץ/g, 'קיבוץ')
    .replace(/רישוין/g, 'רישוי');

  if (!cleaned || cleaned === 'אזור לא מוגדר') {
    return 'שטח כללי מועצה אזורית';
  }

  return cleaned;
}

function areaCenter(area) {
  const text = normalizeAreaName(area);

  const areaCenters = [
    { test: /בית גוברין/, lat: 31.622, lng: 34.894 },
    { test: /ורדון/, lat: 31.681, lng: 34.822 },
    { test: /רבדים/, lat: 31.742, lng: 34.805 },
    { test: /גלאון/, lat: 31.665, lng: 34.748 },
    { test: /כפר מנחם/, lat: 31.732, lng: 34.842 },
    { test: /נגבה/, lat: 31.742, lng: 34.741 },
    { test: /שדה יואב/, lat: 31.694, lng: 34.776 },
    { test: /סגולה/, lat: 31.695, lng: 34.786 },
    { test: /נחלה/, lat: 31.684, lng: 34.789 },
    { test: /בית ניר/, lat: 31.675, lng: 34.847 },
    { test: /כפר הרי/, lat: 31.739, lng: 34.859 },
    { test: /קדמה|מנחת קדמה|כפר נוער קדמה/, lat: 31.654, lng: 34.878 },
    { test: /גת|גניר|פגש/, lat: 31.618, lng: 34.772 },
    { test: /יבולי|Y פארק|סיביי|cby|sby/i, lat: 31.666, lng: 34.839 },
    { test: /מועצה אזורית|שטח כללי|סובב/, lat: 31.695, lng: 34.812 },
  ];

  for (const candidate of areaCenters) {
    if (candidate.test.test(text)) {
      return { lat: candidate.lat, lng: candidate.lng };
    }
  }

  return { lat: 31.695, lng: 34.812 };
}

function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function deterministicOffset(seedText, spread) {
  const hash = hashString(seedText);
  const normalized = (hash % 1000000) / 1000000; // 0..1
  return (normalized - 0.5) * 2 * spread;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function assignYoavCoordinate(record) {
  const area = normalizeAreaName(record.businessArea);
  const base = areaCenter(area);
  const seed = `${record.fileNumber || ''}|${record.businessName || ''}|${record.occupationItem || ''}`;

  const latOffset = deterministicOffset(`${seed}:lat`, 0.0065);
  const lngOffset = deterministicOffset(`${seed}:lng`, 0.0080);

  const lat = clamp(base.lat + latOffset, 31.58, 31.78);
  const lng = clamp(base.lng + lngOffset, 34.72, 34.92);

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
  };
}

function main() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('businesses.json must be an array');
  }

  const updated = data.map((record) => {
    const businessArea = normalizeAreaName(record.businessArea);
    const coords = assignYoavCoordinate({ ...record, businessArea });

    return {
      ...record,
      businessArea,
      address: normalizeText(record.address) || businessArea,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  });

  fs.writeFileSync(dataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  const uniqueAreas = new Set(updated.map((item) => item.businessArea));
  console.log(`Updated ${updated.length} records with Yoav-area coordinates.`);
  console.log(`Unique business areas: ${uniqueAreas.size}`);
}

main();
