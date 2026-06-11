import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./FoRoutePlanner.css";

const KIMA_CENTER = [-5.0929568, 119.5018379];
const DEFAULT_CENTER = KIMA_CENTER;
const DEFAULT_ZOOM = 14;
const MAP_MIN_ZOOM = 12;
const MAP_MAX_ZOOM = 22;
const DEFAULT_TILE_MAX_NATIVE_ZOOM = 19;
const VALHALLA_LOCAL_HOST =
  typeof import.meta.env.VITE_VALHALLA_HOST === "string" &&
    import.meta.env.VITE_VALHALLA_HOST.trim()
    ? import.meta.env.VITE_VALHALLA_HOST.trim().replace(/\/$/, "")
    : "http://localhost:8002";

const BASEMAP_OPTIONS = [
  {
    key: "dark",
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    maxNativeZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
  },
  {
    key: "light",
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    maxNativeZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
  },
  {
    key: "osm",
    label: "OSM",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    key: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 19,
    attribution: "Tiles &copy; Esri",
  },
];

function createGlowIcon(label, variant) {
  return L.divIcon({
    className: "",
    html: `
            <div class="fo-marker fo-marker--${variant}">
                <span class="fo-marker__pulse"></span>
                <span class="fo-marker__core">${label}</span>
            </div>
        `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makePinHtml(logoUrl, fallbackLabel, bgColor, title, cursor = "pointer") {
  const safeTitle = escapeHtml(title);
  const safeFallbackLabel = escapeHtml(fallbackLabel);
  const bg = logoUrl ? "white" : bgColor;
  const inner = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" style="width:28px;height:28px;object-fit:contain;transform:rotate(45deg);" />`
    : `<span style="transform:rotate(45deg);font-size:11px;font-weight:800;color:white;">${safeFallbackLabel}</span>`;

  return `
    <div title="${safeTitle}" style="position:relative;width:36px;height:44px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));cursor:${cursor};">
      <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2.5px solid ${bgColor};overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${inner}
      </div>
    </div>`;
}

function createPinIcon(html) {
  return L.divIcon({
    className: "",
    html,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

function createEntryPointIcon(label, isDefault, logoUrl = "") {
  return createPinIcon(
    makePinHtml(
      logoUrl,
      "ISP",
      isDefault ? "#f59e0b" : "#0ea5e9",
      label || "Titik Masuk ISP",
      "grab",
    ),
  );
}

function createCompanyIcon(logoUrl, label = "") {
  return createPinIcon(
    makePinHtml(logoUrl, "ISP", "#0ea5e9", label || "ISP"),
  );
}

function createCustomerCompanyIcon(logoUrl, label = "") {
  return createPinIcon(
    makePinHtml(logoUrl, "B", "#ec4899", label || "Pelanggan"),
  );
}

const CUSTOMER_ICON = createGlowIcon("B", "customer");
const WAYPOINT_ICON = createGlowIcon("W", "waypoint");
const KIMA_ICON = L.icon({
  iconUrl: "/logo-kima.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -36],
  className: "fo-kima-marker",
});

function haversineDistance(pointA, pointB) {
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

function buildControlPointFeature(point, role, index) {
  return {
    type: "Feature",
    properties: {
      role,
      orderNumber: index + 1,
      label: point.label || role,
      lat: point.lat,
      lng: point.lng,
    },
    geometry: {
      type: "Point",
      coordinates: [point.lng, point.lat],
    },
  };
}

function createRouteGeoJson(geometryCoordinates, properties) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: {
          type: "LineString",
          coordinates: geometryCoordinates,
        },
      },
    ],
  };
}

function decodeValhallaShape(encodedShape, precision = 6) {
  if (!encodedShape || typeof encodedShape !== "string") {
    return [];
  }

  const coordinates = [];
  const factor = 10 ** precision;
  let latitude = 0;
  let longitude = 0;
  let index = 0;

  while (index < encodedShape.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encodedShape.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encodedShape.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([longitude / factor, latitude / factor]);
  }

  return coordinates;
}

function mapProfileToValhallaCosting(profile) {
  if (profile === "cycling") {
    return "bicycle";
  }

  if (profile === "walking" || profile === "foot") {
    return "pedestrian";
  }

  return "auto";
}

function extractRoadSegments(legs) {
  return (Array.isArray(legs) ? legs : []).flatMap((leg, legIndex) => {
    const maneuvers = Array.isArray(leg?.maneuvers) ? leg.maneuvers : [];
    return maneuvers
      .filter((maneuver) => Array.isArray(maneuver?.street_names) && maneuver.street_names.length > 0 && maneuver.street_names[0]?.trim())
      .map((maneuver, index) => ({
        id: `${legIndex}-${index}-${maneuver.street_names[0]}`,
        name: maneuver.street_names[0].trim(),
        distance: Number(maneuver?.length ?? 0) * 1000,
        duration: Number(maneuver?.time ?? 0),
        instruction: maneuver?.instruction?.trim() || "Ikuti jalur utama",
      }));
  });
}

function getUniqueNamedRoads(roads) {
  return (Array.isArray(roads) ? roads : []).reduce((acc, road) => {
    const rawName = typeof road?.name === "string" ? road.name.trim() : "";
    const lowerName = rawName.toLowerCase();

    if (!rawName || lowerName === "tanpa nama jalan" || lowerName.includes("segmen manual")) {
      return acc;
    }

    if (!acc.some((item) => item.name.toLowerCase() === lowerName)) {
      acc.push({ ...road, name: rawName });
    }

    return acc;
  }, []);
}

function buildValhallaRouteRequest(routingPoints, profile) {
  const costing = mapProfileToValhallaCosting(profile);

  return {
    locations: routingPoints.map((point, index) => ({
      lat: point.lat,
      lon: point.lng,
      type: index === 0 || index === routingPoints.length - 1 ? "break" : "via",
    })),
    costing,
    units: "kilometers",
    directions_options: {
      units: "kilometers",
    },
    costing_options: {
      [costing]: {
        shortest: true,
        disable_hierarchy_pruning: true,
        ...(costing === "auto" ? { use_distance: 1 } : {}),
      },
    },
  };
}

function buildPointLabel(point, index, total) {
  if (point?.label && String(point.label).trim()) {
    return String(point.label).trim();
  }

  if (index === 0) {
    return "Titik A / Provider";
  }

  if (index === total - 1) {
    return "Titik Lokasi";
  }

  return `Waypoint Manual ${index}`;
}

function normalizeCoordinateValue(value) {
  const normalized = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function createCoordinatePair(lat, lng) {
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    return null;
  }

  return { lat, lng };
}

function collectCoordinateSearchSources(rawText) {
  const text = String(rawText ?? "").trim();
  if (!text) {
    return [];
  }

  const sources = [text];

  try {
    const url = new URL(text);
    const queryValues = [
      "q",
      "query",
      "ll",
      "destination",
      "origin",
      "center",
      "daddr",
      "saddr",
    ]
      .map((key) => url.searchParams.get(key))
      .filter(Boolean);

    sources.unshift(
      url.href,
      `${url.pathname}${url.hash}`,
      ...queryValues,
    );
  } catch {
    // Not a full URL. Keep raw text only.
  }

  return [...new Set(sources.map((item) => String(item).trim()).filter(Boolean))];
}

function extractCoordinatePairFromText(text) {
  const patterns = [
    /@([+-]?\d{1,3}(?:[.,]\d+)?),([+-]?\d{1,3}(?:[.,]\d+)?)(?:,|\b)/,
    /!3d([+-]?\d{1,3}(?:[.,]\d+)?)!4d([+-]?\d{1,3}(?:[.,]\d+)?)/,
    /([+-]?\d{1,3}(?:[.,]\d+)?)[\s,;]+([+-]?\d{1,3}(?:[.,]\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (!match) {
      continue;
    }

    const lat = normalizeCoordinateValue(match[1]);
    const lng = normalizeCoordinateValue(match[2]);
    const pair = lat !== null && lng !== null
      ? createCoordinatePair(lat, lng)
      : null;

    if (pair) {
      return pair;
    }
  }

  return null;
}

function extractCoordinatePair(rawText) {
  const searchSources = collectCoordinateSearchSources(rawText);
  for (const source of searchSources) {
    const pair = extractCoordinatePairFromText(source);
    if (pair) return pair;
  }

  return null;
}

function normalizePreviewPointRole(pointType, index, total) {
  if (pointType === "awal" || index === 0) {
    return "provider";
  }

  if (pointType === "tujuan" || index === total - 1) {
    return "customer";
  }

  return "waypoint";
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });

  return null;
}

function MapViewportController({ flyTarget, fitRouteKey, fitCoordinates }) {
  const map = useMap();

  useEffect(() => {
    if (!flyTarget) {
      return;
    }

    map.flyTo([flyTarget.lat, flyTarget.lng], flyTarget.zoom ?? 16, {
      duration: 1.2,
    });
  }, [flyTarget, map]);

  useEffect(() => {
    if (!Array.isArray(fitCoordinates) || fitCoordinates.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(
      fitCoordinates.map(([lat, lng]) => [lat, lng]),
    );
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [fitCoordinates, fitRouteKey, map]);

  return null;
}

function MapRenderStabilizer({ onReady, refreshKey }) {
  const map = useMap();

  useEffect(() => {
    if (onReady) onReady(map);
  }, [map, onReady]);

  useEffect(() => {
    const container = map.getContainer();
    const refreshTiles = () => {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          layer.redraw();
        }
      });
    };
    const invalidate = (redrawTiles = false) => {
      map.invalidateSize({ debounceMoveend: true, pan: false });
      if (redrawTiles) {
        refreshTiles();
      }
    };

    const animationFrame = requestAnimationFrame(() => invalidate(true));
    const timers = [120, 320, 700].map((delay) =>
      window.setTimeout(() => invalidate(delay >= 700), delay),
    );

    const resizeObserver = new ResizeObserver(() => invalidate());
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          invalidate(true);
        }
      },
      { threshold: 0.1 },
    );
    intersectionObserver.observe(container);

    const handleWindowResize = () => invalidate(true);
    const handleTransitionEnd = () => invalidate(true);
    let zoomSettleTimer = null;
    const handleZoomSettled = () => {
      invalidate();
      if (zoomSettleTimer) {
        window.clearTimeout(zoomSettleTimer);
      }
      zoomSettleTimer = window.setTimeout(() => invalidate(true), 180);
    };

    window.addEventListener("resize", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleWindowResize);
    container.addEventListener("transitionend", handleTransitionEnd);
    map.on("zoomend viewreset", handleZoomSettled);

    return () => {
      cancelAnimationFrame(animationFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (zoomSettleTimer) {
        window.clearTimeout(zoomSettleTimer);
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleWindowResize);
      container.removeEventListener("transitionend", handleTransitionEnd);
      map.off("zoomend viewreset", handleZoomSettled);
    };
  }, [map, refreshKey]);

  return null;
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div 
      className="absolute right-4 top-[200px] bottom-[80px] z-[500] flex w-[min(260px,calc(100%-2rem))] flex-col gap-1.5 md:right-6 sm:top-[240px] pointer-events-none overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)'
      }}
    >
      {[...toasts].reverse().map((toast) => {
        const bgClasses =
          {
            info: "bg-blue-500/90 border-blue-400/30 shadow-blue-900/20",
            success: "bg-emerald-500/90 border-emerald-400/30 shadow-emerald-900/20",
            warning: "bg-amber-500/90 border-amber-400/30 shadow-amber-900/20",
            error: "bg-rose-500/90 border-rose-400/30 shadow-rose-900/20",
          }[toast.tone] || "bg-slate-800/90 border-slate-700/30 shadow-slate-900/20";

        return (
          <div
            key={toast.id}
            className={`shrink-0 pointer-events-auto flex items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-white shadow-[0_15px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl border ${bgClasses}`}
            role="status"
          >
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/95">
                {toast.title}
              </p>
              <p className="text-[9px] font-medium text-white/80 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              className="shrink-0 text-white/60 transition-colors hover:text-white active:scale-95 flex items-center justify-center p-0.5 hover:bg-white/10 rounded-md"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function FoRoutePlanner({
  onApplyPlannedRoute,
  disabled = false,
  mode = "full",
  previewPoints = [],
  previewGeometryCoordinates = [],
  previewRoads = [],
  initialControlPoints = [],
  initialRouteMeta = null,
  onPreviewClick,
  providerIconUrl = "",
  customerIconUrl = "",
  providerEntryPoints = [],
  selectedProviderEntryPointIds = [],
  customHeaderInfo,
  customExitButton,
}) {
  const routeProfiles = [
    { value: "driving", label: "Drive", icon: "directions_car" },
    { value: "cycling", label: "Cycling", icon: "directions_bike" },
    { value: "walking", label: "Walking", icon: "directions_walk" },
  ];
  const [basemap, setBasemap] = useState("osm");
  const [placementMode, setPlacementMode] = useState("none");
  const [pointA, setPointA] = useState(null);
  const [pointB, setPointB] = useState(null);
  const [manualWaypoints, setManualWaypoints] = useState([]);
  const [customRouteMode, setCustomRouteMode] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [profile, setProfile] = useState("driving");
  const [coordinateImportValue, setCoordinateImportValue] = useState("");
  const [valhallaStatus, setValhallaStatus] = useState("checking"); // "checking" | "online" | "offline"
  const [coordinateImportTarget, setCoordinateImportTarget] = useState("auto");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarMaxHeight, setSidebarMaxHeight] = useState("calc(100vh - 2rem)");
  const [editReason, setEditReason] = useState("");
  const skipNextRouteResetRef = useRef(false);
  const initialPlannerStateRef = useRef(null);

  const selectedBasemap =
    BASEMAP_OPTIONS.find((item) => item.key === basemap) ?? BASEMAP_OPTIONS[0];
  const isPreviewMode = mode === "preview";
  const selectableProviderEntryPoints = useMemo(
    () => (Array.isArray(providerEntryPoints) ? providerEntryPoints : [])
      .filter((point) => point?.status !== "nonaktif")
      .map((point) => ({
        ...point,
        id: Number(point.id),
        lat: Number(point.latitude ?? point.lat),
        lng: Number(point.longitude ?? point.lng),
      }))
      .filter((point) => Number.isFinite(point.id) && isValidLatitude(point.lat) && isValidLongitude(point.lng)),
    [providerEntryPoints],
  );
  const selectedProviderEntryPoints = useMemo(() => {
    const selectedIds = (Array.isArray(selectedProviderEntryPointIds) ? selectedProviderEntryPointIds : [])
      .map(Number)
      .filter(Number.isFinite);
    if (selectedIds.length === 0) return selectableProviderEntryPoints;
    return selectedIds
      .map((id) => selectableProviderEntryPoints.find((point) => Number(point.id) === id))
      .filter(Boolean);
  }, [selectableProviderEntryPoints, selectedProviderEntryPointIds]);
  const activeProviderEntryPointId = useMemo(() => {
    const match = String(pointA?.id ?? "").match(/^provider-entry-(\d+)$/);
    if (match) return Number(match[1]);

    if (!pointA) return null;

    const matchedEntryPoint = selectedProviderEntryPoints.find(
      (entryPoint) =>
        Math.abs(Number(pointA.lat) - entryPoint.lat) < 0.000001 &&
        Math.abs(Number(pointA.lng) - entryPoint.lng) < 0.000001,
    );

    return matchedEntryPoint ? Number(matchedEntryPoint.id) : null;
  }, [pointA, selectedProviderEntryPoints]);
  const visibleProviderEntryPoints = useMemo(
    () =>
      selectedProviderEntryPoints.filter(
        (entryPoint) => Number(entryPoint.id) !== activeProviderEntryPointId,
      ),
    [activeProviderEntryPointId, selectedProviderEntryPoints],
  );
  const providerIcon = useMemo(() => {
    if (activeProviderEntryPointId !== null) {
      const entryPoint = selectedProviderEntryPoints.find(
        (point) => Number(point.id) === activeProviderEntryPointId,
      );
      return createEntryPointIcon(pointA?.label, entryPoint?.isDefault, providerIconUrl);
    }

    return createCompanyIcon(providerIconUrl, pointA?.label ?? "");
  }, [activeProviderEntryPointId, pointA?.label, providerIconUrl, selectedProviderEntryPoints]);
  const customerIcon = useMemo(
    () => createCustomerCompanyIcon(customerIconUrl, pointB?.label ?? ""),
    [customerIconUrl, pointB?.label],
  );
  const initialPlannerControlPoints = useMemo(
    () => (Array.isArray(initialControlPoints) ? initialControlPoints : []),
    [initialControlPoints],
  );
  const previewControlPoints = useMemo(
    () =>
      (Array.isArray(previewPoints) ? previewPoints : []).map(
        (point, index, list) => ({
          ...point,
          role:
            point.role ??
            normalizePreviewPointRole(point.pointType, index, list.length),
        }),
      ),
    [previewPoints],
  );
  const visiblePreviewProviderEntryPoints = useMemo(() => {
    const routeAlreadyShowsProvider = previewControlPoints.some(
      (point) => point.role === "provider",
    );

    if (routeAlreadyShowsProvider) {
      return [];
    }

    return selectedProviderEntryPoints.slice(0, 1);
  }, [previewControlPoints, selectedProviderEntryPoints]);
  const previewRouteGeoJson = useMemo(() => {
    if (!isPreviewMode) {
      return null;
    }

    if (
      Array.isArray(previewGeometryCoordinates) &&
      previewGeometryCoordinates.length >= 2
    ) {
      return createRouteGeoJson(previewGeometryCoordinates, {
        source: "tenant-route-preview",
        mode: "preview",
      });
    }

    if (previewControlPoints.length < 2) {
      return null;
    }

    return createRouteGeoJson(
      previewControlPoints.map((point) => [point.lng, point.lat]),
      {
        source: "tenant-route-preview",
        mode: "preview",
      },
    );
  }, [isPreviewMode, previewControlPoints, previewGeometryCoordinates]);
  const previewFitCoordinates = useMemo(
    () => {
      if (
        Array.isArray(previewGeometryCoordinates) &&
        previewGeometryCoordinates.length >= 2
      ) {
        return previewGeometryCoordinates.map(([lng, lat]) => [lat, lng]);
      }

      return previewControlPoints.map((point) => [point.lat, point.lng]);
    },
    [previewControlPoints, previewGeometryCoordinates],
  );
  const previewRoadSegments = useMemo(
    () => {
      const arr = Array.isArray(previewRoads) ? previewRoads : [];
      return arr.reduce((acc, road) => {
        if (road?.name && road.name.trim() && !acc.some((r) => r.name === road.name)) {
          const lowerName = road.name.toLowerCase();
          if (lowerName !== "tanpa nama jalan" && !lowerName.includes("segmen manual")) {
            acc.push(road);
          }
        }
        return acc;
      }, []);
    },
    [previewRoads],
  );
  const activeWaypoints = useMemo(
    () => (customRouteMode ? manualWaypoints : []),
    [customRouteMode, manualWaypoints],
  );
  const activeWaypointsKey = activeWaypoints.map((point) => point.id).join("|");
  const controlPoints = useMemo(() => {
    const points = [];
    if (pointA) {
      points.push({ ...pointA, role: "provider" });
    }
    activeWaypoints.forEach((point) => {
      points.push({ ...point, role: "waypoint" });
    });
    if (pointB) {
      points.push({ ...pointB, role: "customer" });
    }
    return points;
  }, [activeWaypoints, pointA, pointB]);
  const canGenerateRoute = Boolean(pointA && pointB);
  const canGenerateManualRoute = Boolean(customRouteMode && pointA && pointB);
  const activeCoordinateImportTarget = coordinateImportTarget === "auto"
    ? (!pointA ? "a" : !pointB ? "b" : "waypoint")
    : coordinateImportTarget;
  const pointSummary = useMemo(
    () => ({
      provider: pointA ? "1" : "0",
      customer: pointB ? "1" : "0",
      waypoint: String(activeWaypoints.length),
    }),
    [activeWaypoints.length, pointA, pointB],
  );

  const pushToast = (title, message, tone = "info") => {
    const toastId = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((previous) => [
      ...previous,
      { id: toastId, title, message, tone },
    ]);
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== toastId));
    }, 3600);
  };

  const dismissToast = (toastId) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== toastId));
  };

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    if (!VALHALLA_LOCAL_HOST) {
      setValhallaStatus("offline");
      return () => { cancelled = true; };
    }

    fetch(`${VALHALLA_LOCAL_HOST}/status`, { method: "GET", signal: AbortSignal.timeout(3000) })
      .then((res) => { if (!cancelled) setValhallaStatus(res.ok ? "online" : "offline"); })
      .catch(() => { if (!cancelled) setValhallaStatus("offline"); });
    return () => { cancelled = true; };
  }, [isPreviewMode]);

  useEffect(() => {
    if (isPreviewMode) return undefined;

    const updateSidebarMaxHeight = () => {
      const computedZoom = Number.parseFloat(window.getComputedStyle(document.body).zoom);
      const zoom = Number.isFinite(computedZoom) && computedZoom > 0 ? computedZoom : 1;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const availableHeight = Math.max(240, Math.floor(viewportHeight / zoom - 32));
      setSidebarMaxHeight(`${availableHeight}px`);
    };

    updateSidebarMaxHeight();

    const observer = new MutationObserver(updateSidebarMaxHeight);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", updateSidebarMaxHeight);
    window.visualViewport?.addEventListener("resize", updateSidebarMaxHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSidebarMaxHeight);
      window.visualViewport?.removeEventListener("resize", updateSidebarMaxHeight);
    };
  }, [isPreviewMode]);

  useEffect(() => {
    if (skipNextRouteResetRef.current) {
      skipNextRouteResetRef.current = false;
      return;
    }

    setRouteData(null);
    setRouteError("");
    setIsCalculating(false);
  }, [customRouteMode, activeWaypointsKey, pointA, pointB, profile]);

  const selectedRouteProfile =
    routeProfiles.find((item) => item.value === profile) ?? routeProfiles[0];

  const mapFitCoordinates = useMemo(() => {
    if (!routeData?.geometryCoordinates) {
      return [];
    }

    return routeData.geometryCoordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData?.geometryCoordinates]);

  const plannerRoads = Array.isArray(routeData?.roads) ? routeData.roads : [];
  const displayPlannerRoads = getUniqueNamedRoads(plannerRoads);
  const fallbackPlannerRoads = displayPlannerRoads.length > 0
    ? []
    : plannerRoads.slice(0, 5).map((road, index) => ({
        ...road,
        name: typeof road?.name === "string" && road.name.trim()
          ? road.name.trim()
          : `Segmen ${index + 1}`,
      }));
  const visiblePlannerRoads = displayPlannerRoads.length > 0 ? displayPlannerRoads : fallbackPlannerRoads;
  // Unique named roads only (deduplicate by name and filter placeholders)
  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    const providerPoint =
      initialPlannerControlPoints.find((point) => point?.role === "provider") ??
      initialPlannerControlPoints.find((point) => point?.pointType === "awal") ??
      null;
    const customerPoint =
      initialPlannerControlPoints.find((point) => point?.role === "customer") ??
      initialPlannerControlPoints.find((point) => point?.pointType === "tujuan") ??
      null;
    const waypointPoints = initialPlannerControlPoints.filter(
      (point) =>
        point?.role === "waypoint" ||
        point?.pointType === "transit",
    );

    const restoredPointA = providerPoint
      ? {
          id: providerPoint.id ?? "restored-a",
          lat: Number(providerPoint.lat),
          lng: Number(providerPoint.lng),
          label: providerPoint.label ?? providerPoint.pathName ?? "Provider",
        }
      : null;
    const restoredPointB = customerPoint
      ? {
          id: customerPoint.id ?? "restored-b",
          lat: Number(customerPoint.lat),
          lng: Number(customerPoint.lng),
          label: customerPoint.label ?? customerPoint.pathName ?? "Pelanggan",
        }
      : null;
    const restoredWaypoints = waypointPoints.map((point, index) => ({
      id: point.id ?? `restored-waypoint-${index}`,
      lat: Number(point.lat),
      lng: Number(point.lng),
      label: point.label ?? point.pathName ?? `Waypoint ${index + 1}`,
    }));

    setPointA(restoredPointA);
    setPointB(restoredPointB);
    setManualWaypoints(restoredWaypoints);

    const geometryCoordinates = Array.isArray(initialRouteMeta?.geometryCoordinates)
      ? initialRouteMeta.geometryCoordinates
      : [];
    const roads = Array.isArray(initialRouteMeta?.roads)
      ? initialRouteMeta.roads
      : [];
    const restoredProfile = typeof initialRouteMeta?.profile === "string"
      ? initialRouteMeta.profile
      : "driving";

    let restoredRouteData = null;
    const restoredCustomRouteMode = initialRouteMeta?.mode === "manual";
    if (geometryCoordinates.length >= 2) {
      restoredRouteData = {
        mode: initialRouteMeta?.mode ?? "manual",
        source: initialRouteMeta?.source ?? "planner-restored",
        distance: Number(initialRouteMeta?.distance ?? 0),
        duration: Number(initialRouteMeta?.duration ?? 0),
        profile: restoredProfile,
        geometryCoordinates,
        geoJson: createRouteGeoJson(geometryCoordinates, {
          source: initialRouteMeta?.source ?? "planner-restored",
          mode: initialRouteMeta?.mode ?? "manual",
          distance: Number(initialRouteMeta?.distance ?? 0),
          duration: Number(initialRouteMeta?.duration ?? 0),
          profile: restoredProfile,
          roads,
        }),
        roads,
      };
      skipNextRouteResetRef.current = true;
    }
    setRouteData(restoredRouteData);
    setCustomRouteMode(restoredCustomRouteMode);
    initialPlannerStateRef.current = {
      pointA: restoredPointA,
      pointB: restoredPointB,
      manualWaypoints: restoredWaypoints,
      routeData: restoredRouteData,
      customRouteMode: restoredCustomRouteMode,
      profile: restoredProfile,
    };
  }, [initialPlannerControlPoints, initialRouteMeta, isPreviewMode]);

  const applyProviderEntryPoint = (entryPoint) => {
    if (disabled || !entryPoint) return;
    setPointA({
      id: `provider-entry-${entryPoint.id}`,
      lat: entryPoint.lat,
      lng: entryPoint.lng,
      label: entryPoint.label || "Titik Masuk ISP",
    });
    setFlyTarget({ lat: entryPoint.lat, lng: entryPoint.lng, zoom: 17 });
    pushToast("Titik A Diperbarui", `${entryPoint.label || "Titik masuk ISP"} diterapkan sebagai provider.`, "success");
  };

  const handleUndoToInitial = () => {
    if (disabled || isPreviewMode || !initialPlannerStateRef.current) {
      return;
    }

    const initialState = initialPlannerStateRef.current;
    const restoredPointA = initialState.pointA
      ? { ...initialState.pointA }
      : null;
    const restoredPointB = initialState.pointB
      ? { ...initialState.pointB }
      : null;
    const restoredWaypoints = Array.isArray(initialState.manualWaypoints)
      ? initialState.manualWaypoints.map((point) => ({ ...point }))
      : [];
    const restoredRouteData = initialState.routeData
      ? {
          ...initialState.routeData,
          geometryCoordinates: Array.isArray(initialState.routeData.geometryCoordinates)
            ? initialState.routeData.geometryCoordinates.map((coordinate) => [...coordinate])
            : [],
          roads: Array.isArray(initialState.routeData.roads)
            ? initialState.routeData.roads.map((road) => ({ ...road }))
            : [],
        }
      : null;

    if (restoredRouteData?.geometryCoordinates?.length >= 2) {
      skipNextRouteResetRef.current = true;
      restoredRouteData.geoJson = createRouteGeoJson(restoredRouteData.geometryCoordinates, {
        source: restoredRouteData.source,
        mode: restoredRouteData.mode,
        distance: Number(restoredRouteData.distance ?? 0),
        duration: Number(restoredRouteData.duration ?? 0),
        roads: restoredRouteData.roads,
      });
    }

    setPointA(restoredPointA);
    setPointB(restoredPointB);
    setManualWaypoints(restoredWaypoints);
    setRouteData(restoredRouteData);
    setCustomRouteMode(Boolean(initialState.customRouteMode));
    setProfile(typeof initialState.profile === "string" ? initialState.profile : "driving");
    setRouteError("");
    pushToast(
      "Perubahan Dibatalkan",
      "Planner dikembalikan ke setelan awal.",
      "info",
    );
  };

  const fetchValhallaRouteForPoints = async (routingPoints) => {
    if (!VALHALLA_LOCAL_HOST) {
      throw new Error("Valhalla belum dikonfigurasi.");
    }

    const response = await fetch(`${VALHALLA_LOCAL_HOST}/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildValhallaRouteRequest(routingPoints, profile)),
    });

    if (!response.ok) {
      throw new Error(`Valhalla gagal merespons (${response.status}).`);
    }

    const result = await response.json();
    if (Number(result?.error_code ?? 0) > 0) {
      throw new Error(result?.error ?? "Valhalla gagal menghitung rute.");
    }

    const trip = result?.trip;
    const legs = Array.isArray(trip?.legs) ? trip.legs : [];

    return {
      trip,
      legs,
      geometryCoordinates: legs.flatMap((leg) => decodeValhallaShape(leg?.shape)),
      roads: extractRoadSegments(legs),
      distance: Number(trip?.summary?.length ?? 0) * 1000,
      duration: Number(trip?.summary?.time ?? 0),
    };
  };

  const handleGenerateManualRoute = async () => {
    if (disabled) {
      setRouteError("Mode lihat saja aktif. Jalur tidak dapat diubah.");
      return;
    }

    if (!canGenerateManualRoute) {
      setRouteError("Tentukan Titik ISP (A) dan Titik Lokasi sebelum membuat custom jalur.");
      return;
    }

    const manualPoints = [pointA, ...activeWaypoints, pointB];
    const totalDistance = manualPoints.reduce((total, point, index) => {
      if (index === 0) {
        return total;
      }
      return total + haversineDistance(manualPoints[index - 1], point);
    }, 0);

    const coordinates = manualPoints.map((point) => [point.lng, point.lat]);
    const fallbackRoads = manualPoints.slice(1).map((point, index) => ({
      id: `manual-${index}`,
      name: point.label?.trim() || `Segmen Manual ${index + 1}`,
      distance: haversineDistance(manualPoints[index], point),
      duration: 0,
      instruction: "Waypoint manual",
    }));
    let roads = fallbackRoads;
    let source = "custom-route";

    setIsCalculating(true);
    setRouteError("");
    try {
      const valhallaRoute = await fetchValhallaRouteForPoints(manualPoints);
      const namedRoads = getUniqueNamedRoads(valhallaRoute.roads);

      if (namedRoads.length > 0) {
        roads = namedRoads;
        source = "custom-route-valhalla-roads";
      }
    } catch {
      // Custom route generation must remain available even when Valhalla road-name lookup fails.
    } finally {
      setIsCalculating(false);
    }

    setRouteData({
      mode: "manual",
      source,
      distance: totalDistance,
      duration: 0,
      profile,
      geometryCoordinates: coordinates,
      geoJson: createRouteGeoJson(coordinates, {
        source,
        mode: "manual",
        distance: totalDistance,
        profile,
        roads,
      }),
      roads,
    });
    setRouteError("");
    pushToast(
      "Custom Jalur Dibuat",
      source === "custom-route-valhalla-roads"
        ? "Garis manual dibuat dan nama ruas jalan berhasil dideteksi."
        : "Garis manual berhasil dibuat dari titik yang sudah Anda tetapkan.",
      "success",
    );
  };

  const handleGenerateValhallaRoute = async () => {
    if (disabled) {
      setRouteError("Mode lihat saja aktif. Jalur tidak dapat diubah.");
      return;
    }

    if (!canGenerateRoute) {
      setRouteError("Tentukan Titik ISP (A) dan Titik Lokasi sebelum menghitung jalur.");
      return;
    }

    if (!VALHALLA_LOCAL_HOST) {
      setRouteError("Valhalla belum dikonfigurasi. Isi VITE_VALHALLA_HOST terlebih dahulu.");
      setValhallaStatus("offline");
      return;
    }

    const routingPoints = [pointA, ...activeWaypoints, pointB];

    setIsCalculating(true);
    setRouteError("");
    try {
      const { geometryCoordinates, roads, distance, duration } = await fetchValhallaRouteForPoints(routingPoints);

      if (geometryCoordinates.length < 2) {
        throw new Error("Valhalla tidak mengembalikan geometri rute.");
      }
      const source = "valhalla-local";

      setRouteData({
        mode: "valhalla",
        source,
        distance,
        duration,
        profile,
        geometryCoordinates,
        geoJson: createRouteGeoJson(geometryCoordinates, {
          source,
          mode: "valhalla",
          distance,
          duration,
          profile,
          roads,
        }),
        roads,
      });
      setRouteError("");
      pushToast(
        "Rute Berhasil Dihitung",
        "Jalur otomatis dari server Valhalla berhasil dirender.",
        "success",
      );
    } catch (error) {
      setRouteData(null);
      setRouteError(
        error instanceof Error
          ? error.message
          : "Gagal menghitung rute Valhalla.",
      );
      pushToast(
        "Rute Gagal Dihitung",
        error instanceof Error
          ? error.message
          : "Server Valhalla tidak tersedia.",
        "error",
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const assignPoint = (role, lat, lng, label) => {
    if (disabled) {
      return;
    }

    const nextPoint = {
      id: `${role}-${Date.now()}`,
      lat: Number(lat),
      lng: Number(lng),
      label: label ?? "",
    };

    if (role === "a") {
      setPointA(nextPoint);
      pushToast(
        "Titik A Diperbarui",
        "Koordinat provider/source berhasil ditetapkan.",
        "success",
      );
      return;
    }

    if (role === "b") {
      setPointB(nextPoint);
      pushToast(
        "Titik Lokasi Diperbarui",
        "Koordinat pelanggan/destination berhasil ditetapkan.",
        "success",
      );
      return;
    }

    setManualWaypoints((previous) => [...previous, nextPoint]);
  };

  const handleMapClick = (latlng) => {
    if (disabled) {
      return;
    }

    // Auto-close search results when interacting with the map
    if (searchResults.length > 0 || searchError) {
      setSearchResults([]);
      setSearchError(null);
    }

    if (placementMode === "a") {
      assignPoint("a", latlng.lat, latlng.lng, "Provider");
      return;
    }

    if (placementMode === "b") {
      assignPoint("b", latlng.lat, latlng.lng, "Pelanggan");
      return;
    }

    if (placementMode !== "waypoint") {
      pushToast(
        "Pilih Mode Titik",
        "Pilih Klik: Lokasi atau Set W sebelum menempatkan titik di peta.",
        "info",
      );
      return;
    }

    assignPoint("waypoint", latlng.lat, latlng.lng, "");
  };
  const handleRecenterToKima = () => {
    setFlyTarget({
      lat: KIMA_CENTER[0],
      lng: KIMA_CENTER[1],
      zoom: DEFAULT_ZOOM,
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      // Menggunakan Photon API dengan bias lokasi Makassar
      const params = new URLSearchParams({
        q: query,
        lat: "-5.147665",
        lon: "119.432732",
        limit: "10",
      });

      const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Photon gagal merespons (${response.status}).`);
      }

      const data = await response.json();
      const normalized = (data.features || []).map(feature => {
        const p = feature.properties;
        const name = p.name || "";
        const context = [p.street, p.city, p.state]
          .filter(v => v && v !== name)
          .join(", ");

        return {
          place_id: Math.random().toString(36).substr(2, 9),
          display_name: name + (context ? ` (${context})` : ""),
          lat: feature.geometry.coordinates[1].toString(),
          lon: feature.geometry.coordinates[0].toString(),
        };
      });

      setSearchResults(normalized);
      pushToast(
        "Pencarian Selesai",
        `${normalized.length} lokasi ditemukan.`,
        "success",
      );
    } catch (error) {
      setSearchResults([]);
      setSearchError(
        error instanceof Error ? error.message : "Gagal mencari lokasi.",
      );
      pushToast(
        "Pencarian Gagal",
        error instanceof Error ? error.message : "Nominatim tidak tersedia.",
        "error",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handlePasteImportedCoordinate = async (preferredTarget = null) => {
    if (disabled) {
      pushToast("Mode Lihat Saja", "Titik dan jalur tidak dapat diubah oleh role ini.", "info");
      return;
    }

    if (!navigator?.clipboard?.readText) {
      pushToast(
        "Clipboard Tidak Didukung",
        "Browser ini tidak mengizinkan pembacaan clipboard.",
        "error",
      );
      return;
    }

    try {
      const pastedText = await navigator.clipboard.readText();
      const trimmedText = String(pastedText ?? "").trim();
      if (!trimmedText) {
        pushToast("Clipboard Kosong", "Tidak ada teks yang bisa ditempel.", "warning");
        return;
      }

      setCoordinateImportValue(trimmedText);
      const parsed = extractCoordinatePair(trimmedText);
      if (!parsed) {
        pushToast(
          "Clipboard Ditempel",
          "Teks berhasil ditempel, tetapi belum terbaca sebagai koordinat.",
          "info",
        );
        return;
      }

      const target = preferredTarget ?? activeCoordinateImportTarget;
      if (target === "a") {
        assignPoint("a", parsed.lat, parsed.lng, "Provider");
      } else if (target === "b") {
        assignPoint("b", parsed.lat, parsed.lng, "Pelanggan");
      } else {
        assignPoint("waypoint", parsed.lat, parsed.lng, "");
      }

      setCoordinateImportValue("");
      pushToast("Koordinat Ditempel", "Koordinat dari clipboard berhasil diterapkan.", "success");
    } catch {
      pushToast(
        "Gagal Membaca Clipboard",
        "Browser menolak akses clipboard atau teks tidak tersedia.",
        "error",
      );
    }
  };

  const handleMarkerDrag = (role, id, lat, lng) => {
    if (disabled) {
      return;
    }

    if (role === "provider") {
      setPointA((previous) =>
        previous ? { ...previous, lat, lng } : previous,
      );
      return;
    }

    if (role === "customer") {
      setPointB((previous) =>
        previous ? { ...previous, lat, lng } : previous,
      );
      return;
    }

    setManualWaypoints((previous) =>
      previous.map((point) =>
        point.id === id ? { ...point, lat, lng } : point,
      ),
    );
  };

  const handleDeleteWaypoint = (pointId) => {
    if (disabled) {
      return;
    }

    setManualWaypoints((previous) => previous.filter((point) => point.id !== pointId));
    pushToast("Waypoint Dihapus", "Titik lintasan berhasil dihapus.", "info");
  };

  const handleClearWaypoints = () => {
    if (disabled) {
      return;
    }

    if (manualWaypoints.length === 0) {
      return;
    }

    setManualWaypoints([]);
    pushToast("Waypoint Dikosongkan", "Semua titik lintasan custom berhasil dihapus.", "info");
  };

  const handleResetPlanner = () => {
    if (disabled) {
      return;
    }

    setPointA(null);
    setPointB(null);
    setManualWaypoints([]);
    setRouteData(null);
    setRouteError("");
    setSearchResults([]);
    setSearchError("");
    setSearchQuery("");
    pushToast(
      "Planner Direset",
      "Semua titik dan hasil rute dibersihkan.",
      "info",
    );
  };

  const handleExportGeoJson = () => {
    if (
      !routeData?.geometryCoordinates ||
      routeData.geometryCoordinates.length < 2
    ) {
      pushToast(
        "Export Gagal",
        "Belum ada rute aktif untuk diekspor.",
        "error",
      );
      return;
    }

    const featureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            source: routeData.source,
            mode: routeData.mode,
            distanceMeters: routeData.distance,
            durationSeconds: routeData.duration,
            roads: plannerRoads,
          },
          geometry: {
            type: "LineString",
            coordinates: routeData.geometryCoordinates,
          },
        },
        ...controlPoints.map((point, index) =>
          buildControlPointFeature(point, point.role, index),
        ),
      ],
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: "application/geo+json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fo-route-${Date.now()}.geojson`;
    link.click();
    URL.revokeObjectURL(link.href);
    pushToast(
      "GeoJSON Diekspor",
      "File rute aktif berhasil diunduh.",
      "success",
    );
  };

  const handleApplyPlanner = () => {
    if (disabled) {
      pushToast("Mode Lihat Saja", "Role ini tidak dapat menerapkan perubahan jalur.", "info");
      return;
    }

    if (!pointA || !pointB) {
      pushToast(
        "Titik Belum Lengkap",
        "Tentukan Titik ISP (A) dan Titik Lokasi sebelum menerapkan draft.",
        "error",
      );
      return;
    }

    const draftPoints = controlPoints.map((point, index) => {
      const pointType =
        index === 0
          ? "awal"
          : index === controlPoints.length - 1
            ? "tujuan"
            : "transit";

      return {
        id: `planner-draft-${Date.now()}-${index}`,
        pathName: buildPointLabel(point, index, controlPoints.length),
        pointType,
        note: `${routeData?.mode === "manual" ? "Custom Route" : "Valhalla Route"} • ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        orderNumber: index + 1,
      };
    });

    onApplyPlannedRoute(draftPoints, {
      profile,
      source: routeData?.source ?? "planner",
      mode: routeData?.mode ?? "manual",
      distance: routeData?.distance ?? 0,
      duration: routeData?.duration ?? 0,
      geometryCoordinates: routeData?.geometryCoordinates ?? [],
      roads: plannerRoads,
      editReason: editReason,
    });
    pushToast(
      "Draft Jalur Diperbarui",
      "Hasil planner diterapkan ke draft jalur tenant.",
      "success",
    );
  };

  const routeMainStyle = {
    color: "#38bdf8",
    weight: 4,
    opacity: 0.92,
  };
  const routeGlowStyle = {
    color: "#0ea5e9",
    weight: 10,
    opacity: 0.22,
  };

  if (isPreviewMode) {
    return (
      <section className="rounded-xl glass-card border border-white/10 shadow-glass-depth overflow-hidden bg-white/[0.02]">
        <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg text-gold-accent drop-shadow-md">map</span>
            <div className="space-y-0.5">
              <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-white drop-shadow-md">
                Peta Lintasan Tenant
              </h3>
              <p className="text-[9px] font-bold tracking-wide text-white/40">
                Klik peta untuk membuka halaman planner lengkap.
              </p>
            </div>
          </div>
          <span className="hidden sm:flex h-8 px-4 rounded-lg bg-white/5 border border-white/10 items-center text-[9px] font-black uppercase tracking-widest text-white/40 shadow-sm self-start sm:self-auto">
            View Only
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 gap-4 lg:grid-cols-5 bg-black/40 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          
          {/* Left Column: Map Preview */}
          <div className="relative overflow-hidden rounded-xl border border-white/10 lg:col-span-3 min-h-[250px] shadow-sm z-10 h-full w-full">
            {onPreviewClick && (
              <button
                aria-label="Buka halaman planner jalur"
                className="absolute inset-0 z-[450] cursor-pointer bg-transparent"
                onClick={onPreviewClick}
                type="button"
              />
            )}
            {/* Tombol Pusat KIMA - preview */}
            <button
              className="absolute bottom-3 right-3 z-[460] w-9 h-9 rounded-xl border border-gold-accent/30 bg-slate-900/80 backdrop-blur-md text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition shadow-lg flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); setFlyTarget({ lat: KIMA_CENTER[0], lng: KIMA_CENTER[1], zoom: DEFAULT_ZOOM }); }}
              title="Pusatkan ke KIMA"
              type="button"
            >
              <span className="material-symbols-outlined text-base">my_location</span>
            </button>
            <div className="absolute inset-0 z-10">
              <MapContainer
                attributionControl={false}
                center={DEFAULT_CENTER}
                className="h-full w-full bg-slate-100"
                maxZoom={MAP_MAX_ZOOM}
                minZoom={MAP_MIN_ZOOM}
                scrollWheelZoom
                zoom={DEFAULT_ZOOM}
              >
                <TileLayer
                  attribution={selectedBasemap.attribution}
                  keepBuffer={4}
                  maxNativeZoom={selectedBasemap.maxNativeZoom ?? DEFAULT_TILE_MAX_NATIVE_ZOOM}
                  maxZoom={MAP_MAX_ZOOM}
                  updateInterval={100}
                  updateWhenIdle={false}
                  url={selectedBasemap.url}
                />
                {/* Adjust viewport based on preview or actual route */}
                <MapViewportController
                  fitCoordinates={previewFitCoordinates}
                  fitRouteKey={isPreviewMode ? `preview-${previewControlPoints.length}-${previewGeometryCoordinates.length}-${previewRoadSegments.length}` : `route-${routeData?.geometryCoordinates?.length || 0}`}
                  flyTarget={flyTarget}
                />
                <MapRenderStabilizer refreshKey={`preview-${basemap}`} />
                <Marker icon={KIMA_ICON} position={KIMA_CENTER} zIndexOffset={1000}>
                  <Popup>Kawasan Industri Makassar (KIMA)</Popup>
                </Marker>
                {visiblePreviewProviderEntryPoints.map((entryPoint) => (
                  <Marker
                    key={`preview-provider-entry-marker-${entryPoint.id}`}
                    icon={createEntryPointIcon(entryPoint.label, entryPoint.isDefault, providerIconUrl)}
                    position={[entryPoint.lat, entryPoint.lng]}
                  >
                    <Popup>
                      <div className="min-w-[150px] space-y-1 text-xs">
                        <p className="font-bold text-slate-800">{entryPoint.label || "Titik Masuk ISP"}</p>
                        <p className="text-[10px] text-slate-500">
                          {entryPoint.lat.toFixed(6)}, {entryPoint.lng.toFixed(6)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {previewControlPoints
                  .filter((point) => point.role === "provider" || point.role === "customer")
                  .map((point, index) => {
                    const icon = point.role === "provider"
                      ? createEntryPointIcon(point.label, activeProviderEntryPointId !== null, providerIconUrl)
                      : createCustomerCompanyIcon(customerIconUrl, point.label ?? "");

                    return (
                      <Marker
                        key={point.id ?? `${point.role}-${point.lat}-${point.lng}`}
                        icon={icon}
                        position={[point.lat, point.lng]}
                      >
                        <Popup>
                          <div className="min-w-[150px] space-y-1 text-xs">
                            <p className="font-bold text-slate-800">
                              {point.label || buildPointLabel(point, index, previewControlPoints.length)}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                {previewRouteGeoJson && (
                  <>
                    <GeoJSON
                      data={previewRouteGeoJson}
                      style={() => routeGlowStyle}
                    />
                    <GeoJSON
                      data={previewRouteGeoJson}
                      style={() => routeMainStyle}
                    />
                  </>
                )}
              </MapContainer>
            </div>

            <div className="absolute bottom-4 left-4 z-[450] flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest font-black shadow-sm border ${previewRouteGeoJson ? "bg-emerald-500 border-emerald-500 text-white" : "bg-slate-900/80 border-white/10 text-white/40"}`}>
                {previewRouteGeoJson ? "Jalur Aktif" : "Tanpa Koordinat"}
              </span>
            </div>

            {/* Empty state CTA */}
            {previewControlPoints.length === 0 && !previewRouteGeoJson && onPreviewClick && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl bg-[#0f141e]/90 backdrop-blur-xl border border-white/10 shadow-2xl py-4 px-5 text-center w-[240px]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-accent/10 border border-gold-accent/20">
                    <span className="material-symbols-outlined text-[18px] text-gold-accent">conversion_path</span>
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[13px] font-black text-white tracking-tight">Belum Ada Jalur FO</h4>
                    <p className="text-[9px] font-bold text-white/40 leading-snug">Mulai petakan lintasan kabel untuk lokasi ini.</p>
                  </div>
                  <button
                    className="mt-1 flex h-7 items-center justify-center gap-1.5 rounded-lg bg-gold-accent px-4 text-[9px] font-black uppercase tracking-widest text-[#0f141e] shadow-gold-glow hover:scale-105 transition-transform active:scale-95"
                    onClick={onPreviewClick}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[12px]">map</span>
                    Buka Planner
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Insights */}
          <div className="flex flex-col lg:col-span-2">
            <div className="flex flex-col h-full rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-accent/70">
                Insights
              </p>
              <h3 className="mt-0.5 text-[13px] font-black text-white tracking-[0.1em] uppercase">
                Glosarium Jenis Titik
              </h3>
              <p className="mt-1 text-[9px] font-bold tracking-wide text-white/40 leading-relaxed">
                Legenda simbol yang digunakan pada peta lintasan fiber optik.
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <span className="material-symbols-outlined text-[15px]">router</span>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white tracking-tight uppercase">Titik Awal</h4>
                    <p className="mt-0.5 text-[9px] font-bold text-white/40">Manhole Utama / ODP (Optical Distribution Point)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <span className="material-symbols-outlined text-[15px]">lan</span>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white tracking-tight uppercase">Titik Transit</h4>
                    <p className="mt-0.5 text-[9px] font-bold text-white/40">Tiang Tumpuan / Jalur Lintasan Kabel</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="material-symbols-outlined text-[15px]">business</span>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white tracking-tight uppercase">Titik Tujuan</h4>
                    <p className="mt-0.5 text-[9px] font-bold text-white/40">ONT / Perangkat Klien Akhir</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-sky-500/10 border border-sky-500/20 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[13px] text-sky-400">info</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-sky-400">Info Jalur</span>
                </div>
                <p className="text-[8px] font-bold text-white/50 leading-relaxed">
                  Garis biru bercahaya menunjukkan estimasi jalur kabel FO yang akan digelar dari provider hingga ke titik tujuan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-on-surface shadow-lg">
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      {/* Background Map - Fills entire container */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          attributionControl={false}
          center={DEFAULT_CENTER}
          className="h-full w-full bg-slate-100"
          maxZoom={MAP_MAX_ZOOM}
          minZoom={MAP_MIN_ZOOM}
          scrollWheelZoom
          zoom={DEFAULT_ZOOM}
          zoomControl={false}
        >
          <TileLayer
            attribution={selectedBasemap.attribution}
            keepBuffer={4}
            maxNativeZoom={selectedBasemap.maxNativeZoom ?? DEFAULT_TILE_MAX_NATIVE_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
            updateInterval={100}
            updateWhenIdle={false}
            url={selectedBasemap.url}
          />
          <AttributionControl position="bottomleft" />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapViewportController
            fitCoordinates={mapFitCoordinates}
            fitRouteKey={`${routeData?.source ?? "none"}-${routeData?.distance ?? 0}-${routeData?.mode ?? "idle"}`}
            flyTarget={flyTarget}
          />
          <MapRenderStabilizer
            onReady={setMapInstance}
            refreshKey={`${basemap}-${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
          />

          {visibleProviderEntryPoints.map((entryPoint) => (
            <Marker
              key={`provider-entry-marker-${entryPoint.id}`}
              icon={createEntryPointIcon(entryPoint.label, entryPoint.isDefault, providerIconUrl)}
              position={[entryPoint.lat, entryPoint.lng]}
            >
              <Popup>
                <div className="min-w-[150px] space-y-1 text-xs">
                  <p className="font-bold text-slate-800">{entryPoint.label || "Titik Masuk ISP"}</p>
                  <p className="text-[10px] text-slate-500">
                    {entryPoint.lat.toFixed(6)}, {entryPoint.lng.toFixed(6)}
                  </p>
                  {!disabled && (
                    <button
                      className="pt-1 text-[10px] font-bold text-blue-600 hover:underline"
                      onClick={() => applyProviderEntryPoint(entryPoint)}
                      type="button"
                    >
                      Jadikan Titik A
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {pointA && (
            <Marker
              draggable={!disabled}
              eventHandlers={{
                dragend: (event) => {
                  const position = event.target.getLatLng();
                  handleMarkerDrag("provider", pointA.id, position.lat, position.lng);
                },
              }}
              icon={providerIcon}
              position={[pointA.lat, pointA.lng]}
            >
              <Popup>
                <div className="min-w-[150px] space-y-1 text-xs">
                  <p className="font-bold text-slate-800">{pointA.label || "Titik A / Provider"}</p>
                  <p className="text-[10px] text-slate-500">
                    {pointA.lat.toFixed(6)}, {pointA.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
          {pointB && (
            <Marker
              draggable={!disabled}
              eventHandlers={{
                dragend: (event) => {
                  const position = event.target.getLatLng();
                  handleMarkerDrag("customer", pointB.id, position.lat, position.lng);
                },
              }}
              icon={customerIcon}
              position={[pointB.lat, pointB.lng]}
            >
              <Popup>
                <div className="min-w-[150px] space-y-1 text-xs">
                  <p className="font-bold text-slate-800">{pointB.label || "Titik Lokasi"}</p>
                  <p className="text-[10px] text-slate-500">
                    {pointB.lat.toFixed(6)}, {pointB.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
          <Marker icon={KIMA_ICON} position={KIMA_CENTER} zIndexOffset={1000}>
            <Popup>Kawasan Industri Makassar (KIMA)</Popup>
          </Marker>
          {activeWaypoints.map((point) => (
            <Marker
              key={point.id}
              draggable={!disabled}
              eventHandlers={{
                dragend: (event) => {
                  const position = event.target.getLatLng();
                  handleMarkerDrag("waypoint", point.id, position.lat, position.lng);
                },
              }}
              icon={WAYPOINT_ICON}
              position={[point.lat, point.lng]}
            >
              <Popup>
                <div className="min-w-[150px] space-y-1 text-xs">
                  <p className="font-bold text-slate-800">{point.label || "Waypoint Manual"}</p>
                  <p className="text-[10px] text-slate-500">
                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </p>
                  {!disabled && (
                    <button
                      className="pt-1 text-[10px] font-bold text-rose-600 hover:underline"
                      onClick={() => handleDeleteWaypoint(point.id)}
                      type="button"
                    >
                      Hapus Waypoint
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          {routeData?.geoJson && (
            <>
              <GeoJSON data={routeData.geoJson} style={() => routeGlowStyle} />
              <GeoJSON data={routeData.geoJson} style={() => routeMainStyle} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Top Overlay Controls: Data Info, Search, and Exit Button */}
      <div className={`absolute top-4 inset-x-4 md:top-6 md:inset-x-6 z-[1002] pointer-events-none transition-all duration-500 ease-in-out ${isSidebarOpen ? 'sm:pl-[316px] lg:pl-[346px] xl:pl-[376px]' : 'pl-0'}`}>
        
        {/* Center: Data Info (Perfectly centered in the remaining viewport) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto flex justify-center shrink-0 w-max z-10">
          {customHeaderInfo}
        </div>

        {/* Right: Search and Exit Button */}
        <div className="absolute top-0 right-0 flex justify-end gap-2 md:gap-3 items-start pointer-events-none">
          <div className="pointer-events-auto w-[220px] sm:w-[300px] shrink-0">
            <section className="w-full rounded-xl border border-white/10 bg-slate-900/80 p-1 shadow-2xl backdrop-blur-md">
              <form className="flex gap-1" onSubmit={handleSearch}>
                <div className="relative flex-1">
                  <input
                    className="w-full h-7 sm:h-8 rounded-lg border border-white/5 bg-white/5 px-3 text-[10px] sm:text-[11px] text-white outline-none focus:border-primary/50 transition backdrop-blur-md"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Telusuri lokasi disini"
                    type="text"
                    value={searchQuery}
                  />
                </div>
                <button className="h-7 sm:h-8 w-8 flex items-center justify-center shrink-0 rounded-lg bg-primary text-white transition-transform active:scale-95 hover:bg-primary-hover disabled:opacity-50" disabled={isSearching} title="Cari lokasi" type="submit">
                  {isSearching ? (
                    <span className="material-symbols-outlined text-[14px] animate-spin">autorenew</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px]">search</span>
                  )}
                </button>
              </form>
              {searchError && (
                <p className="mt-1 text-[9px] text-rose-400 font-medium px-1">{searchError}</p>
              )}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-[145px] overflow-auto space-y-1.5 pr-1 custom-scrollbar">
                  {searchResults.map((result) => (
                    <button
                      key={result.place_id}
                      className="w-full text-left rounded-lg bg-white/5 p-2.5 border border-white/5 hover:bg-white/10 transition backdrop-blur-md flex items-start gap-2 group"
                      onClick={() => {
                        setFlyTarget({ lat: Number(result.lat), lng: Number(result.lon), zoom: 18 });
                        setSearchResults([]);
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sky-400 text-[16px] shrink-0 mt-0.5 group-hover:scale-110 transition-transform">location_on</span>
                      <p className="text-[10px] text-white/90 font-medium leading-relaxed">{result.display_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
          
          <div className="pointer-events-auto shrink-0">
            {customExitButton}
          </div>
        </div>
      </div>


      {/* Floating Sidebar - Responsive Card Style */}
      <aside
        className={`absolute inset-x-0 bottom-0 sm:inset-auto sm:left-4 sm:top-4 sm:bottom-auto z-[1000] w-full sm:w-[300px] lg:w-[330px] xl:w-[360px] max-h-[82vh] sm:max-h-[var(--fo-route-sidebar-max-height)] flex flex-col pointer-events-none transition-transform duration-500 ease-in-out ${isSidebarOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-[calc(100%+2rem)] sm:translate-y-0 sm:-translate-x-[calc(100%+2rem)]"
          }`}
        style={{ "--fo-route-sidebar-max-height": sidebarMaxHeight }}
      >
        <div className="flex flex-col min-h-0 pointer-events-auto bg-slate-900/95 sm:bg-slate-900/80 backdrop-blur-xl sm:backdrop-blur-md rounded-t-3xl sm:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] sm:shadow-2xl border-t sm:border border-white/10 overflow-hidden relative">
          <div className="flex flex-col overflow-y-auto custom-scrollbar p-4 scroll-smooth">
          {/* Mobile Handle (Visual only) */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 sm:hidden backdrop-blur-md" />

          {/* Header Panel */}
          <header className="relative shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Points Console</p>
                <h3 className="text-base font-black text-white leading-tight mt-1">Route & Waypoints</h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/70">
                <span className={`h-1.5 w-1.5 rounded-full ${customRouteMode ? "bg-amber-400" : "bg-emerald-400"}`} />
                {customRouteMode ? "Custom Mode" : "Auto Mode"}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Provider</p>
                <p className="mt-1 text-[11px] font-black text-white truncate">{pointSummary.provider}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Customer</p>
                <p className="mt-1 text-[11px] font-black text-white truncate">{pointSummary.customer}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Waypoint</p>
                <p className="mt-1 text-[11px] font-black text-white truncate">{pointSummary.waypoint}</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="mt-4 flex rounded-xl bg-slate-950/50 p-1 border border-white/5 shadow-inner">
              <button
                className={`w-1/2 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${!customRouteMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                disabled={disabled}
                onClick={() => setCustomRouteMode(false)}
                type="button"
              >
                Otomatis
              </button>
              <button
                className={`w-1/2 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${customRouteMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                disabled={disabled}
                onClick={() => setCustomRouteMode(true)}
                type="button"
              >
                Custom
              </button>
            </div>

            {!customRouteMode ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Profile Jalur</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                    {selectedRouteProfile.label}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {routeProfiles.map((item) => {
                    const active = profile === item.value;

                    return (
                      <button
                        key={item.value}
                        className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${active ? "border-sky-400/50 bg-sky-500/20 text-sky-100 shadow-lg shadow-sky-500/10" : "border-white/8 bg-slate-950/35 text-white/45 hover:border-white/15 hover:bg-white/5 hover:text-white/75"}`}
                        disabled={disabled}
                        onClick={() => setProfile(item.value)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px] leading-none">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[8px] font-medium leading-relaxed text-white/35">
                  Drive memakai jalan kendaraan, Cycling untuk jalur sepeda, Walking untuk rute pejalan kaki.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 animate-fade-in-up">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Set Waypoint</p>
                  </div>
                  <button
                    className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${placementMode === 'waypoint' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-950/50 text-white/40 border border-white/5 hover:text-white/80'}`}
                    disabled={disabled}
                    onClick={() => {
                      setPlacementMode('waypoint');
                      setCoordinateImportTarget('waypoint');
                    }}
                    type="button"
                  >
                    {placementMode === 'waypoint' ? 'Aktif' : 'Aktifkan'}
                  </button>
                </div>

                {placementMode === 'waypoint' ? (
                  <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20 text-center animate-fade-in-up">
                    <span className="material-symbols-outlined text-amber-500 mb-1 text-lg">add_location_alt</span>
                    <p className="text-[9px] text-amber-500/90 leading-relaxed font-medium">
                      Klik pada peta untuk menambahkan titik lintasan (waypoint).
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5 text-center">
                    <p className="text-[9px] text-white/40 font-medium">Klik tombol Aktifkan di atas untuk mulai menambah Waypoint di peta.</p>
                  </div>
                )}

                {manualWaypoints.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg border border-white/5 bg-slate-950/35 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/45">
                        {manualWaypoints.length} Waypoint
                      </p>
                      <button
                        className="rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={disabled || manualWaypoints.length === 0}
                        onClick={handleClearWaypoints}
                        type="button"
                      >
                        Hapus Semua
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {manualWaypoints.map((point, index) => (
                        <div
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2"
                          key={point.id}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[8px] font-black text-amber-200">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[9px] font-bold text-white/75">
                                {point.label?.trim() || `Waypoint Manual ${index + 1}`}
                              </p>
                              <p className="mt-0.5 truncate text-[8px] font-mono text-white/30">
                                {Number(point.lat).toFixed(5)}, {Number(point.lng).toFixed(5)}
                              </p>
                            </div>
                          </div>
                          <button
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/5 bg-white/5 text-white/35 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={disabled}
                            onClick={() => handleDeleteWaypoint(point.id)}
                            title="Hapus waypoint"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </header>

          {/* Configuration Steps */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col relative">
            <section className="flex flex-col space-y-3">
            
            {/* Step 1: Titik Awal */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-black text-primary">1</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Pilih Titik Awal (ISP)</p>
              </div>
              {selectedProviderEntryPoints.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedProviderEntryPoints.slice(0, 4).map((entryPoint, index) => (
                    <button
                      key={entryPoint.id}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${pointA?.id === entryPoint.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-black/20 hover:border-gold-accent/40'}`}
                      disabled={disabled}
                      onClick={() => applyProviderEntryPoint(entryPoint)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-black text-white">{entryPoint.label}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-gold-accent">{index === 0 ? "Utama" : `Backup ${index}`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/40 font-medium">Belum ada titik masuk ISP yang tersedia.</p>
              )}
            </div>

            {/* Step 2: Titik Tujuan */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-black text-primary">2</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Pilih Titik Tujuan</p>
                </div>
                <div className="flex rounded-md bg-slate-950/50 p-0.5 border border-white/5">
                  <button
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${placementMode === 'b' ? 'bg-primary text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
                    disabled={disabled}
                    onClick={() => {
                      setPlacementMode('b');
                      setCoordinateImportTarget('b');
                    }}
                    type="button"
                  >
                    Klik
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${coordinateImportTarget === 'b' && placementMode !== 'b' ? 'bg-sky-500 text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
                    disabled={disabled}
                    onClick={() => {
                      setPlacementMode('none');
                      setCoordinateImportTarget('b');
                    }}
                    type="button"
                  >
                    Paste
                  </button>
                </div>
              </div>

              {placementMode === 'b' ? (
                <div className="rounded-lg bg-primary/10 p-2.5 border border-primary/20 text-center animate-fade-in-up">
                  <span className="material-symbols-outlined text-primary mb-1 text-lg">location_on</span>
                  <p className="text-[9px] text-primary/90 leading-relaxed font-medium">
                    Klik pada peta untuk memilih titik lokasi tujuan.
                  </p>
                  <p className="text-[8px] text-primary/50 mt-1">
                    Jika lokasi tidak bisa terdeteksi, silakan gunakan fitur Paste.
                  </p>
                </div>
              ) : coordinateImportTarget === 'b' ? (
                <div className="space-y-2 animate-fade-in-up">
                  <textarea
                    className="w-full min-h-[60px] rounded-lg border border-white/10 bg-slate-950/65 px-2.5 py-2 text-[10px] font-mono leading-relaxed text-white outline-none resize-none placeholder-white/30 transition focus:border-sky-500/50"
                    disabled={disabled}
                    onChange={(e) => setCoordinateImportValue(e.target.value)}
                    placeholder="Tempel URL Maps atau koordinat"
                    value={coordinateImportValue}
                  />
                  <button
                    className="w-full rounded-md bg-sky-500/20 border border-sky-400/30 py-2 text-[9px] font-black text-sky-200 uppercase tracking-widest hover:bg-sky-500/30 transition-all active:scale-[0.98]"
                    disabled={disabled}
                    onClick={() => handlePasteImportedCoordinate("b")}
                    type="button"
                  >
                    Terapkan Paste
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5 text-center">
                  <p className="text-[9px] text-white/40 font-medium">Pilih metode penentuan lokasi di atas.</p>
                </div>
              )}
            </div>


            {/* Step 4: Lihat Jalur */}
            <div className="mt-2">
              <button
                className={`w-full rounded-xl py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-lg transition-all flex justify-center items-center gap-2 active:scale-[0.98] ${
                  isCalculating 
                    ? 'bg-slate-700 text-white/50 cursor-not-allowed' 
                    : !pointA || !pointB
                    ? 'bg-primary/50 text-white/40 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-hover shadow-primary/30'
                }`}
                onClick={customRouteMode ? handleGenerateManualRoute : () => void handleGenerateValhallaRoute()}
                disabled={disabled || isCalculating || !pointA || !pointB || (!customRouteMode && valhallaStatus === "offline")}
                type="button"
              >
                {isCalculating ? (
                  <>
                    <span className="material-symbols-outlined text-[12px] animate-spin">autorenew</span>
                    Menghitung...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[12px]">route</span>
                    Lihat Jalur
                  </>
                )}
              </button>
              {!customRouteMode && valhallaStatus === "offline" && (
                <p className="text-center text-[9px] text-rose-400 mt-2 font-medium">
                  Server otomatis sedang offline. Silakan gunakan mode Custom.
                </p>
              )}
            </div>

            {routeData?.geometryCoordinates?.length > 1 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 animate-fade-in-up">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-sky-300">alt_route</span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Ruas Jalur</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-white/45">
                    {plannerRoads.length} Ruas
                  </span>
                </div>

                {visiblePlannerRoads.length > 0 ? (
                  <div className="space-y-1.5">
                    {visiblePlannerRoads.slice(0, 6).map((road, index) => (
                      <div
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-950/40 px-2.5 py-2"
                        key={`${road.name}-${index}`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[8px] font-black text-sky-200">
                            {index + 1}
                          </span>
                          <p className="truncate text-[9px] font-bold text-white/70">{road.name}</p>
                        </div>
                        {Number.isFinite(Number(road.distance)) && Number(road.distance) > 0 && (
                          <span className="shrink-0 text-[8px] font-mono font-bold text-white/35">
                            {(Number(road.distance) / 1000).toFixed(2)} km
                          </span>
                        )}
                      </div>
                    ))}
                    {visiblePlannerRoads.length > 6 && (
                      <p className="pt-1 text-center text-[8px] font-medium text-white/35">
                        +{visiblePlannerRoads.length - 6} ruas lainnya
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5 text-center">
                    <p className="text-[9px] font-medium text-white/40">Ruas jalur belum teridentifikasi.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Terapkan Jalur */}
            {routeData?.geometryCoordinates?.length > 1 && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-fade-in-up">
                {/* Route Result Summary */}
                <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Jalur Tersedia</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white">
                    {(Number(routeData.distance) / 1000).toFixed(2)} km
                  </span>
                </div>

                {/* Edit Reason Input (Only if editing an existing route) */}
                {initialControlPoints.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-white/60">Alasan Ubah Jalur</label>
                    <textarea 
                      className="w-full min-h-[60px] rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2 text-[10px] font-medium leading-relaxed text-white outline-none placeholder:text-white/30 resize-none focus:border-amber-500/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={disabled}
                      placeholder="Masukkan alasan mengapa jalur ini diubah..."
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    className="py-1.5 px-2 bg-white/5 border border-white/10 text-white/70 hover:text-white rounded-xl transition backdrop-blur-md flex justify-center items-center gap-1.5 text-[8px] font-black uppercase tracking-widest"
                    disabled={disabled}
                    onClick={handleUndoToInitial}
                    title="Undo ke setelan awal"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[12px]">undo</span> Undo
                  </button>
                  <button
                    className="py-1.5 px-2 bg-white/5 border border-white/10 text-white/70 hover:text-rose-400 hover:border-rose-400/30 rounded-xl transition backdrop-blur-md flex justify-center items-center gap-1.5 text-[8px] font-black uppercase tracking-widest"
                    disabled={disabled}
                    onClick={handleResetPlanner}
                    title="Reset Semua"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[12px]">restart_alt</span> Reset
                  </button>
                </div>

                <button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl transition shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                  disabled={disabled || !routeData?.geometryCoordinates || routeData.geometryCoordinates.length < 2 || isCalculating || (initialControlPoints.length > 0 && editReason.trim() === '')}
                  onClick={handleApplyPlanner}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[12px]">save</span>
                  {initialControlPoints.length > 0 ? "Terapkan Perubahan" : "Terapkan Jalur"}
                </button>
              </div>
            )}
            </section>
          </div>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar Toggle Button (Outside aside to avoid overflow clipping) */}
      <button
        className={`hidden sm:flex absolute z-[1001] top-1/2 -translate-y-1/2 h-14 w-6 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-slate-900/80 text-white/70 hover:text-white shadow-[4px_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-500 ease-in-out hover:bg-slate-800/90 pointer-events-auto ${isSidebarOpen ? "left-[calc(theme(spacing.4)+300px)] lg:left-[calc(theme(spacing.4)+330px)] xl:left-[calc(theme(spacing.4)+360px)]" : "left-4"}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        type="button"
      >
        <span className="material-symbols-outlined text-lg">
          {isSidebarOpen ? "chevron_left" : "chevron_right"}
        </span>
      </button>

      {/* Mobile Toggle Button (Outside aside so it stays visible when aside slides down) */}
      <button
        className="sm:hidden absolute bottom-6 right-6 z-[1001] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl shadow-primary/30 pointer-events-auto border border-white/10 backdrop-blur-md transition-transform active:scale-95"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        type="button"
      >
        <span className="material-symbols-outlined text-2xl">
          {isSidebarOpen ? "close" : "edit_location_alt"}
        </span>
      </button>

      {/* Top Right Controls - Below Exit Button */}
      <div className="absolute top-16 right-4 sm:top-[88px] md:right-6 z-[800] flex flex-col items-end gap-2 pointer-events-none transition-opacity duration-500" style={{ opacity: isSidebarOpen && window.innerWidth < 640 ? 0 : 1 }}>
        {/* Zoom Controls */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md pointer-events-auto shadow-xl overflow-hidden w-9 sm:w-10">
          <button
            className="w-full h-9 sm:h-10 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapInstance && mapInstance.zoomIn()}
            title="Perbesar"
            type="button"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">add</span>
          </button>
          <div className="h-px bg-white/10 w-full" />
          <button
            className="w-full h-9 sm:h-10 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapInstance && mapInstance.zoomOut()}
            title="Perkecil"
            type="button"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">remove</span>
          </button>
        </div>

        {/* Map Type Dropdown */}
        <div className="relative group pointer-events-auto focus-within:z-10" tabIndex={-1}>
          <button
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-white/20 bg-slate-900 shadow-xl overflow-hidden transition-all focus:outline-none focus:border-primary relative block group-focus-within:ring-2 group-focus-within:ring-primary/50"
            title="Ubah Mode Peta"
            type="button"
          >
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform hover:scale-110"
              style={{
                backgroundImage: basemap === 'satellite' 
                  ? 'url(https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/8/13)'
                  : basemap === 'osm'
                  ? 'url(https://a.tile.openstreetmap.org/4/13/8.png)'
                  : basemap === 'light'
                  ? 'url(https://a.basemaps.cartocdn.com/light_all/4/13/8.png)'
                  : 'url(https://a.basemaps.cartocdn.com/dark_all/4/13/8.png)'
              }}
            />
          </button>
          
          {/* Dropdown menu appearing on click (focus-within) */}
          <div className="absolute right-0 top-full mt-2 flex flex-col gap-1 opacity-0 pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all origin-top scale-95 group-focus-within:scale-100 z-50">
            {BASEMAP_OPTIONS.filter(o => o.key !== basemap).map((option) => (
              <button
                key={option.key}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 hover:border-primary bg-slate-900 shadow-xl overflow-hidden relative transition-all block"
                onClick={() => setBasemap(option.key)}
                title={option.label}
                type="button"
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform hover:scale-110"
                  style={{
                    backgroundImage: option.key === 'satellite' 
                      ? 'url(https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/8/13)'
                      : option.key === 'osm'
                      ? 'url(https://a.tile.openstreetmap.org/4/13/8.png)'
                      : option.key === 'light'
                      ? 'url(https://a.basemaps.cartocdn.com/light_all/4/13/8.png)'
                      : 'url(https://a.basemaps.cartocdn.com/dark_all/4/13/8.png)'
                  }}
                />
                <div className="absolute inset-0 bg-black/10 transition-opacity hover:bg-transparent" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Right Controls */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-[800] flex flex-col items-end gap-2 pointer-events-none transition-opacity duration-500" style={{ opacity: isSidebarOpen && window.innerWidth < 640 ? 0 : 1 }}>
        <button
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-gold-accent/30 flex items-center justify-center transition text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] bg-slate-900/80 backdrop-blur-md pointer-events-auto shadow-xl"
          onClick={handleRecenterToKima}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">my_location</span>
        </button>
        
        <button 
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md text-white/70 hover:text-white hover:border-white/20 transition pointer-events-auto flex items-center justify-center shadow-xl" 
          onClick={handleExportGeoJson} 
          title="Export GeoJSON"
          type="button"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">download</span>
        </button>
      </div>

      {
        routeError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] rounded-xl border border-rose-500/50 bg-rose-900/90 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md shadow-2xl">
            {routeError}
          </div>
        )
      }
    </section >
  );
}
