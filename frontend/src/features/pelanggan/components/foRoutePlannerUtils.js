/**
 * Utility functions extracted from FoRoutePlanner for testability.
 */

export function normalizeCoordinateValue(value) {
  const normalized = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

export function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function createCoordinatePair(lat, lng) {
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { lat, lng };
}

export function collectCoordinateSearchSources(rawText) {
  const text = String(rawText ?? "").trim();
  if (!text) return [];
  const sources = [text];
  try {
    const url = new URL(text);
    const queryValues = ["q", "query", "ll", "destination", "origin", "center", "daddr", "saddr"]
      .map((key) => url.searchParams.get(key))
      .filter(Boolean);
    sources.unshift(url.href, `${url.pathname}${url.hash}`, ...queryValues);
  } catch { /* not a URL */ }
  return [...new Set(sources.map((item) => String(item).trim()).filter(Boolean))];
}

export function extractCoordinatePairFromText(text) {
  const patterns = [
    /@([+-]?\d{1,3}(?:[.,]\d+)?),([+-]?\d{1,3}(?:[.,]\d+)?)(?:,|\b)/,
    /!3d([+-]?\d{1,3}(?:[.,]\d+)?)!4d([+-]?\d{1,3}(?:[.,]\d+)?)/,
    /([+-]?\d{1,3}(?:[.,]\d+)?)[\s,;]+([+-]?\d{1,3}(?:[.,]\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (!match) continue;
    const lat = normalizeCoordinateValue(match[1]);
    const lng = normalizeCoordinateValue(match[2]);
    const pair = lat !== null && lng !== null ? createCoordinatePair(lat, lng) : null;
    if (pair) return pair;
  }
  return null;
}

export function extractCoordinatePair(rawText) {
  const searchSources = collectCoordinateSearchSources(rawText);
  for (const source of searchSources) {
    const pair = extractCoordinatePairFromText(source);
    if (pair) return pair;
  }
  return null;
}

export function haversineDistance(pointA, pointB) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const latitudeA = toRadians(pointA.lat);
  const latitudeB = toRadians(pointB.lat);
  const base =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(base), Math.sqrt(1 - base));
}

export function decodeValhallaShape(encodedShape, precision = 6) {
  if (!encodedShape || typeof encodedShape !== "string") return [];
  const coordinates = [];
  const factor = 10 ** precision;
  let latitude = 0;
  let longitude = 0;
  let index = 0;
  while (index < encodedShape.length) {
    let shift = 0, result = 0, byte = 0;
    do { byte = encodedShape.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encodedShape.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([longitude / factor, latitude / factor]);
  }
  return coordinates;
}

export function mapProfileToValhallaCosting(profile) {
  if (profile === "cycling") return "bicycle";
  if (profile === "foot") return "pedestrian";
  return "auto";
}

export function extractRoadSegments(legs) {
  return (Array.isArray(legs) ? legs : []).flatMap((leg, legIndex) => {
    const maneuvers = Array.isArray(leg?.maneuvers) ? leg.maneuvers : [];
    return maneuvers
      .filter((m) => Array.isArray(m?.street_names) && m.street_names.length > 0 && m.street_names[0]?.trim())
      .map((m, i) => ({
        id: `${legIndex}-${i}-${m.street_names[0]}`,
        name: m.street_names[0].trim(),
        distance: Number(m?.length ?? 0) * 1000,
        duration: Number(m?.time ?? 0),
        instruction: m?.instruction?.trim() || "Ikuti jalur utama",
      }));
  });
}

export function buildPointLabel(point, index, total) {
  if (point?.label && String(point.label).trim()) return String(point.label).trim();
  if (index === 0) return "Titik A / Provider";
  if (index === total - 1) return "Titik B / Pelanggan";
  return `Waypoint Manual ${index}`;
}

export const KIMA_CENTER = [-5.0929568, 119.5018379];
