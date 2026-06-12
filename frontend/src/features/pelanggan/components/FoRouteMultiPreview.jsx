import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  AttributionControl,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import LeafletRenderStabilizer from "./LeafletRenderStabilizer";
import "./FoRoutePlanner.css";

const KIMA_CENTER = [-5.0929568, 119.5018379];
const DEFAULT_ZOOM = 14;
const MAP_MIN_ZOOM = 12;
const MAP_MAX_ZOOM = 19;
const TILE_MAX_NATIVE_ZOOM = 19;
const FIT_BOUNDS_MAX_ZOOM = 16;
const KIMA_ICON = L.icon({
  iconUrl: "/logo-kima.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -36],
  className: "fo-kima-marker",
});

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makePinHtml(logoUrl, fallbackLabel, bgColor, title) {
  const safeLogoUrl = String(logoUrl ?? "").trim();
  const safeTitle = escapeHtml(title);
  const safeFallbackLabel = escapeHtml(fallbackLabel);
  const bg = safeLogoUrl ? "white" : bgColor;
  const inner = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="${safeTitle}" style="width:28px;height:28px;object-fit:contain;transform:rotate(45deg);" />`
    : `<span style="transform:rotate(45deg);font-size:11px;font-weight:800;color:white;">${safeFallbackLabel}</span>`;
  return `
    <div title="${safeTitle}" style="position:relative;width:36px;height:44px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));cursor:pointer;">
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

function createIspEntryPointIcon(isDefault, title = "Titik Masuk ISP", logoUrl = "") {
  const color = isDefault ? "#f59e0b" : "#0ea5e9";
  return L.divIcon({
    className: "",
    html: makePinHtml(logoUrl, "FO", color, title),
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
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: FIT_BOUNDS_MAX_ZOOM });
    }
  }, [bounds, map]);
  return null;
}


export default function FoRouteMultiPreview({ tenants = [], entryPoints = [], ispLogoUrl = "", ispName = "", onTenantClick }) {
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

  const entryPointMarkers = useMemo(() => {
    return (Array.isArray(entryPoints) ? entryPoints : [])
      .map((point) => {
        const lat = Number(point?.latitude ?? point?.lat);
        const lng = Number(point?.longitude ?? point?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          id: point?.id ?? `${point?.label ?? "entry-point"}-${lat}-${lng}`,
          label: String(point?.label ?? "Titik Masuk ISP").trim() || "Titik Masuk ISP",
          status: point?.status ?? "",
          description: point?.description ?? "",
          fiberType: point?.fiberType ?? point?.fiber_type ?? "",
          coreCapacity: point?.coreCapacity ?? point?.core_capacity ?? null,
          isDefault: Boolean(point?.isDefault ?? point?.is_default),
          coord: [lat, lng],
        };
      })
      .filter(Boolean);
  }, [entryPoints]);

  const bounds = useMemo(() => {
    const routeCoords = routeData.flatMap((r) => {
      if (r.geometry) return r.geometry.map(([lng, lat]) => [lat, lng]);
      return r.pointCoords;
    });
    const allCoords = [...routeCoords, ...entryPointMarkers.map((point) => point.coord)];
    if (allCoords.length === 0) return null;
    return L.latLngBounds(allCoords);
  }, [entryPointMarkers, routeData]);

  const renderRefreshKey = bounds?.isValid()
    ? `${routeData.length}-${entryPointMarkers.length}-${bounds.toBBoxString()}`
    : `${routeData.length}-${entryPointMarkers.length}-empty`;
  const ispIcon = useMemo(() => createIspIcon(ispLogoUrl, ispName || "ISP"), [ispLogoUrl, ispName]);
  const fallbackIspMarker = entryPointMarkers.length === 0 ? routeData[0]?.awalCoord : null;

  const mapRef = useRef(null);

  if (routeData.length === 0 && entryPointMarkers.length === 0) {
    return (
      <section className="glass-card backdrop-blur-xl rounded-xl py-16 flex flex-col items-center justify-center border-white/10 shadow-glass-depth">
        <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner-glass mb-3 animate-pulse">
          <span className="material-symbols-outlined text-2xl text-gold-accent/40">route</span>
        </div>
        <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">PETA JALUR LOKASI</h4>
        <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1 text-center max-w-sm">
          Belum ada lokasi dengan jalur FO yang terkonfigurasi di bawah ISP ini.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Map */}
      <div className="relative z-0 overflow-hidden rounded-2xl border border-white/10 w-full aspect-square md:aspect-auto md:h-[560px] group hover:border-gold-accent/40 transition-all duration-500 hover:shadow-[0_0_20px_rgba(255,215,0,0.1)]">
        {/* Tombol Pusatkan KIMA */}
        <button
          className="absolute bottom-6 right-6 z-[1000] w-9 h-9 rounded-xl border border-gold-accent/30 bg-slate-900/80 backdrop-blur-md text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition shadow-lg flex items-center justify-center"
          onClick={() => mapRef.current?.flyTo(KIMA_CENTER, DEFAULT_ZOOM, { duration: 1.2 })}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">my_location</span>
        </button>
        <MapContainer
          attributionControl={false}
          zoomControl={false}
          center={KIMA_CENTER}
          className="h-full w-full"
          maxZoom={MAP_MAX_ZOOM}
          minZoom={MAP_MIN_ZOOM}
          scrollWheelZoom
          zoom={DEFAULT_ZOOM}
        >
          <ZoomControl position="topright" />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            keepBuffer={4}
            maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
            updateInterval={100}
            updateWhenIdle={false}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AttributionControl position="bottomleft" />
          <LeafletRenderStabilizer
            onReady={(map) => { mapRef.current = map; }}
            refreshKey={renderRefreshKey}
          />
          {bounds && <FitBounds bounds={bounds} />}

          <Marker icon={KIMA_ICON} position={KIMA_CENTER} zIndexOffset={1000} />

          {/* ISP entry point markers */}
          {entryPointMarkers.map((point) => (
            <Marker
              key={`isp-entry-${point.id}`}
              icon={createIspEntryPointIcon(point.isDefault, point.label, ispLogoUrl)}
              position={point.coord}
              zIndexOffset={900}
            >
              <Popup>
                <div className="min-w-[170px] space-y-1 text-xs">
                  <p className="font-bold text-slate-800">{point.label}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Titik Masuk ISP</p>
                  <p className="font-mono text-[10px] text-slate-500">{point.coord[0].toFixed(6)}, {point.coord[1].toFixed(6)}</p>
                  {point.fiberType && <p className="text-[10px] text-slate-500">Fiber: {point.fiberType}</p>}
                  {point.coreCapacity != null && point.coreCapacity !== "" && <p className="text-[10px] text-slate-500">Core: {point.coreCapacity}</p>}
                  {point.description && <p className="text-[10px] text-slate-500">{point.description}</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Fallback ISP marker for legacy route data without configured entry points */}
          {fallbackIspMarker && (
            <Marker icon={ispIcon} position={fallbackIspMarker} zIndexOffset={900} />
          )}

          {/* Routes & customer markers */}
          {routeData.map((route) => {
            const geoJson = route.geometry
              ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.geometry } }] }
              : { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.pointCoords.map(([lat, lng]) => [lng, lat]) } }] };

            const icon = createCustomerIcon(route.color, route.tenantName.charAt(0), route.tenantLogoUrl, route.tenantName);

            return (
              <Fragment key={route.tenantId}>
                <GeoJSON data={geoJson} style={() => ({ color: route.color, weight: 8, opacity: 0.18 })} />
                <GeoJSON data={geoJson} style={() => ({ color: route.color, weight: 3.5, opacity: 0.9 })} />
                {route.tujuanCoord && (
                  <Marker
                    icon={icon}
                    position={route.tujuanCoord}
                    eventHandlers={{ click: () => onTenantClick?.(route.tenantId) }}
                  />
                )}
              </Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="glass-card backdrop-blur-xl rounded-xl p-4 border-white/10 shadow-glass-depth">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-3.5 w-1 bg-gold-accent rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Legenda Jalur</p>
          <span className="ml-auto text-[9px] font-bold text-white/30">{routeData.length} jalur aktif • {entryPointMarkers.length} titik ISP</span>
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
