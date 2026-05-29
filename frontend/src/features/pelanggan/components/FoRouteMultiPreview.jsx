import { useMemo, useRef } from "react";
import {
  AttributionControl,
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./FoRoutePlanner.css";

const KIMA_CENTER = [-5.0929568, 119.5018379];
const DEFAULT_ZOOM = 14;

const ROUTE_META_PREFIX = "[FO_ROUTE_META]";

const ROUTE_COLORS = [
  "#38bdf8", // sky
  "#f472b6", // pink
  "#a78bfa", // violet
  "#fb923c", // orange
  "#34d399", // emerald
  "#facc15", // yellow
  "#f87171", // red
  "#2dd4bf", // teal
  "#c084fc", // purple
  "#4ade80", // green
];

function decodeRoutePlannerMeta(encodedValue) {
  if (!encodedValue || typeof encodedValue !== "string") return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encodedValue.trim()))));
  } catch {
    return null;
  }
}

function extractGeometryFromPoints(points) {
  for (const point of Array.isArray(points) ? points : []) {
    const rawNote = typeof point?.note === "string" ? point.note : "";
    const metaIdx = rawNote.indexOf(ROUTE_META_PREFIX);
    if (metaIdx < 0) continue;
    const meta = decodeRoutePlannerMeta(rawNote.slice(metaIdx + ROUTE_META_PREFIX.length));
    const coords = Array.isArray(meta?.geometryCoordinates) ? meta.geometryCoordinates : [];
    if (coords.length >= 2) return coords;
  }
  return null;
}

function getPointCoordinates(point) {
  const rawNote = typeof point?.note === "string" ? point.note : "";
  const match = rawNote.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const lat = Number(point?.lat ?? point?.latitude ?? match?.[1]);
  const lng = Number(point?.lng ?? point?.longitude ?? match?.[2]);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}

function makePinHtml(logoUrl, fallbackLabel, bgColor, title) {
  const bg = logoUrl ? "white" : bgColor;
  const inner = logoUrl
    ? `<img src="${logoUrl}" style="width:28px;height:28px;object-fit:contain;transform:rotate(45deg);" />`
    : `<span style="transform:rotate(45deg);font-size:11px;font-weight:800;color:white;">${fallbackLabel}</span>`;
  return `
    <div title="${title}" style="position:relative;width:36px;height:44px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));cursor:pointer;">
      <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2.5px solid ${bgColor};overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${inner}
      </div>
    </div>`;
}

function createIspIcon(logoUrl, title = "ISP") {
  return L.divIcon({
    className: "",
    html: makePinHtml(logoUrl, "ISP", "#0ea5e9", title),
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

function createCustomerIcon(color, label, logoUrl, title = "") {
  return L.divIcon({
    className: "",
    html: makePinHtml(logoUrl, label, color, title),
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

function FitBounds({ bounds }) {
  const map = useMap();
  useMemo(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

function MapInstanceCapture({ onReady }) {
  const map = useMap();
  useMemo(() => { if (onReady) onReady(map); }, [map, onReady]);
  return null;
}

export default function FoRouteMultiPreview({ tenants = [], ispLogoUrl = "", ispName = "", onTenantClick }) {
  const routeData = useMemo(() => {
    return tenants
      .map((tenant, idx) => {
        const versions = Array.isArray(tenant.routeVersions)
          ? [...tenant.routeVersions].sort((a, b) => Number(b.version_number ?? b.versionNumber ?? 0) - Number(a.version_number ?? a.versionNumber ?? 0))
          : [];
        const activeVersion = versions[0];
        const points = Array.isArray(activeVersion?.points) ? activeVersion.points : [];
        if (points.length === 0) return null;

        const geometry = extractGeometryFromPoints(points);
        const pointCoords = points
          .map((p) => getPointCoordinates(p))
          .filter(Boolean);

        if (!geometry && pointCoords.length < 2) return null;

        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const awalPoint = points.find((p) => (p.point_type ?? p.pointType) === "awal");
        const tujuanPoint = points.find((p) => (p.point_type ?? p.pointType) === "tujuan");

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantLogoUrl: tenant.logo_url ?? tenant.logoUrl ?? "",
          color,
          geometry,
          pointCoords,
          awalCoord: awalPoint ? getPointCoordinates(awalPoint) : pointCoords[0],
          tujuanCoord: tujuanPoint ? getPointCoordinates(tujuanPoint) : pointCoords[pointCoords.length - 1],
        };
      })
      .filter(Boolean);
  }, [tenants]);

  const bounds = useMemo(() => {
    const allCoords = routeData.flatMap((r) => {
      if (r.geometry) return r.geometry.map(([lng, lat]) => [lat, lng]);
      return r.pointCoords;
    });
    if (allCoords.length === 0) return null;
    return L.latLngBounds(allCoords);
  }, [routeData]);

  const ispIcon = useMemo(() => createIspIcon(ispLogoUrl, ispName || "ISP"), [ispLogoUrl, ispName]);

  const mapRef = useRef(null);

  if (routeData.length === 0) {
    return (
      <section className="glass-card backdrop-blur-xl rounded-premium p-20 flex flex-col items-center justify-center border-white/10 shadow-glass-depth">
        <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 mb-8">
          <span className="material-symbols-outlined text-5xl">map</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-widest">Peta Jalur Lokasi</h2>
        <p className="mt-3 text-sm font-bold text-white/30 max-w-md text-center leading-relaxed">
          Belum ada lokasi dengan jalur FO yang terkonfigurasi di bawah ISP ini.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Map */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 h-[560px]">
        {/* Tombol Pusatkan KIMA */}
        <button
          className="absolute bottom-3 right-3 z-[1000] w-9 h-9 rounded-xl border border-gold-accent/30 bg-slate-900/80 backdrop-blur-md text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition shadow-lg flex items-center justify-center"
          onClick={() => mapRef.current?.flyTo(KIMA_CENTER, DEFAULT_ZOOM, { duration: 1.2 })}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-base">my_location</span>
        </button>
        <MapContainer
          attributionControl={false}
          center={KIMA_CENTER}
          className="h-full w-full"
          scrollWheelZoom
          zoom={DEFAULT_ZOOM}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AttributionControl position="bottomleft" />
          <MapInstanceCapture onReady={(map) => { mapRef.current = map; }} />
          {bounds && <FitBounds bounds={bounds} />}

          {/* ISP marker */}
          {routeData[0]?.awalCoord && (
            <Marker icon={ispIcon} position={routeData[0].awalCoord} />
          )}

          {/* Routes & customer markers */}
          {routeData.map((route) => {
            const geoJson = route.geometry
              ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.geometry } }] }
              : { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.pointCoords.map(([lat, lng]) => [lng, lat]) } }] };

            const icon = createCustomerIcon(route.color, route.tenantName.charAt(0), route.tenantLogoUrl, route.tenantName);

            return (
              <span key={route.tenantId}>
                <GeoJSON data={geoJson} style={() => ({ color: route.color, weight: 8, opacity: 0.18 })} />
                <GeoJSON data={geoJson} style={() => ({ color: route.color, weight: 3.5, opacity: 0.9 })} />
                {route.tujuanCoord && (
                  <Marker
                    icon={icon}
                    position={route.tujuanCoord}
                    eventHandlers={{ click: () => onTenantClick?.(route.tenantId) }}
                  />
                )}
              </span>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="glass-card backdrop-blur-xl rounded-xl p-4 border-white/10 shadow-glass-depth">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-3.5 w-1 bg-gold-accent rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Legenda Jalur</p>
          <span className="ml-auto text-[9px] font-bold text-white/30">{routeData.length} jalur aktif</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {routeData.map((route) => (
            <button
              key={route.tenantId}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left group"
              onClick={() => onTenantClick?.(route.tenantId)}
              type="button"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: route.color }}
              />
              <span className="text-[10px] font-bold text-white/70 group-hover:text-white truncate">
                {route.tenantName}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
