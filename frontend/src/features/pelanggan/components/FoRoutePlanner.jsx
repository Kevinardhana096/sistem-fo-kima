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
    attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
  },
  {
    key: "light",
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
  },
  {
    key: "osm",
    label: "OSM",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    key: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
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

function createEntryPointIcon(label, isDefault) {
  return createPinIcon(
    makePinHtml(
      "",
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

  if (profile === "foot") {
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

function buildPointLabel(point, index, total) {
  if (point?.label && String(point.label).trim()) {
    return String(point.label).trim();
  }

  if (index === 0) {
    return "Titik A / Provider";
  }

  if (index === total - 1) {
    return "Titik B / Pelanggan";
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

function MapInstanceCapture({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (onReady) onReady(map);
  }, [map, onReady]);
  return null;
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="absolute right-4 top-4 z-[500] flex w-[min(360px,calc(100%-2rem))] flex-col gap-2.5 md:right-8 md:top-8">
      {toasts.map((toast) => {
        const bgClasses =
          {
            info: "bg-blue-600",
            success: "bg-emerald-600",
            warning: "bg-amber-500",
            error: "bg-rose-600",
          }[toast.tone] || "bg-slate-800";

        return (
          <div
            key={toast.id}
            className={`flex items-start justify-between gap-3 rounded-xl p-4 text-white shadow-lg ${bgClasses}`}
            role="status"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                {toast.title}
              </p>
              <p className="mt-1 text-sm text-white/90 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              className="text-white/70 transition hover:text-white"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <span className="material-symbols-outlined text-sm">close</span>
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
}) {
  const [basemap, setBasemap] = useState("osm");
  const [profile, setProfile] = useState("driving");
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
  const [manualInput, setManualInput] = useState({});
  const [coordinateImportValue, setCoordinateImportValue] = useState("");
  const [valhallaStatus, setValhallaStatus] = useState("checking"); // "checking" | "online" | "offline"
  const [coordinateImportTarget, setCoordinateImportTarget] = useState("auto");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRoadPanelOpen, setIsRoadPanelOpen] = useState(true);
  const [sidebarMaxHeight, setSidebarMaxHeight] = useState("calc(100vh - 2rem)");
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
    return match ? Number(match[1]) : null;
  }, [pointA?.id]);
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
      return createEntryPointIcon(pointA?.label, entryPoint?.isDefault);
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
  const visiblePreviewProviderEntryPoints = useMemo(
    () =>
      selectedProviderEntryPoints.filter(
        (entryPoint) =>
          !previewControlPoints.some(
            (point) =>
              point.role === "provider" &&
              Math.abs(Number(point.lat) - entryPoint.lat) < 0.000001 &&
              Math.abs(Number(point.lng) - entryPoint.lng) < 0.000001,
          ),
      ),
    [previewControlPoints, selectedProviderEntryPoints],
  );
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
  const controlPoints = useMemo(() => {
    const points = [];
    if (pointA) {
      points.push({ ...pointA, role: "provider" });
    }
    manualWaypoints.forEach((point) => {
      points.push({ ...point, role: "waypoint" });
    });
    if (pointB) {
      points.push({ ...pointB, role: "customer" });
    }
    return points;
  }, [manualWaypoints, pointA, pointB]);
  const canGenerateRoute = Boolean(pointA && pointB);
  const canGenerateManualRoute = Boolean(customRouteMode && pointA && pointB);
  const activeCoordinateImportTarget = coordinateImportTarget === "auto"
    ? (!pointA ? "a" : !pointB ? "b" : "waypoint")
    : coordinateImportTarget;
  const importedCoordinatePreview = useMemo(
    () => extractCoordinatePair(coordinateImportValue),
    [coordinateImportValue],
  );
  const activeRouteModeLabel = customRouteMode ? "Custom" : "Otomatis";
  const pointSummary = useMemo(
    () => ({
      provider: pointA ? "1" : "0",
      customer: pointB ? "1" : "0",
      waypoint: String(manualWaypoints.length),
    }),
    [manualWaypoints.length, pointA, pointB],
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
  }, [customRouteMode, manualWaypoints, pointA, pointB, profile]);

  const mapFitCoordinates = useMemo(() => {
    if (!routeData?.geometryCoordinates) {
      return [];
    }

    return routeData.geometryCoordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData?.geometryCoordinates]);

  const plannerRoads = Array.isArray(routeData?.roads) ? routeData.roads : [];
  const showKimaMarker =
    !isPreviewMode &&
    !pointA &&
    !pointB &&
    manualWaypoints.length === 0 &&
    !routeData;
  // Unique named roads only (deduplicate by name and filter placeholders)
  const namedPlannerRoads = plannerRoads.reduce((acc, road) => {
    if (road?.name && road.name.trim() && !acc.some((r) => r.name === road.name)) {
      const lowerName = road.name.toLowerCase();
      if (lowerName !== "tanpa nama jalan" && !lowerName.includes("segmen manual")) {
        acc.push(road);
      }
    }
    return acc;
  }, []);

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

    let restoredRouteData = null;
    const restoredCustomRouteMode = initialRouteMeta?.mode === "manual";
    if (geometryCoordinates.length >= 2) {
      restoredRouteData = {
        mode: initialRouteMeta?.mode ?? "manual",
        source: initialRouteMeta?.source ?? "planner-restored",
        distance: Number(initialRouteMeta?.distance ?? 0),
        duration: Number(initialRouteMeta?.duration ?? 0),
        geometryCoordinates,
        geoJson: createRouteGeoJson(geometryCoordinates, {
          source: initialRouteMeta?.source ?? "planner-restored",
          mode: initialRouteMeta?.mode ?? "manual",
          distance: Number(initialRouteMeta?.distance ?? 0),
          duration: Number(initialRouteMeta?.duration ?? 0),
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
    };
  }, [initialPlannerControlPoints, initialRouteMeta, isPreviewMode]);

  const applyProviderEntryPoint = (entryPoint) => {
    if (!entryPoint) return;
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
    if (isPreviewMode || !initialPlannerStateRef.current) {
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
    setRouteError("");
    pushToast(
      "Perubahan Dibatalkan",
      "Planner dikembalikan ke setelan awal.",
      "info",
    );
  };

  const handleGenerateManualRoute = () => {
    if (!canGenerateManualRoute) {
      setRouteError("Tentukan Titik A dan Titik B sebelum membuat custom jalur.");
      return;
    }

    const manualPoints = [pointA, ...manualWaypoints, pointB];
    const totalDistance = manualPoints.reduce((total, point, index) => {
      if (index === 0) {
        return total;
      }
      return total + haversineDistance(manualPoints[index - 1], point);
    }, 0);

    const coordinates = manualPoints.map((point) => [point.lng, point.lat]);
    const roads = manualPoints.slice(1).map((point, index) => ({
      id: `manual-${index}`,
      name: point.label?.trim() || `Segmen Manual ${index + 1}`,
      distance: haversineDistance(manualPoints[index], point),
      duration: 0,
      instruction: "Waypoint manual",
    }));

    setRouteData({
      mode: "manual",
      source: "custom-route",
      distance: totalDistance,
      duration: 0,
      geometryCoordinates: coordinates,
      geoJson: createRouteGeoJson(coordinates, {
        source: "custom-route",
        mode: "manual",
        distance: totalDistance,
      }),
      roads,
    });
    setRouteError("");
    pushToast(
      "Custom Jalur Dibuat",
      "Garis manual berhasil dibuat dari titik yang sudah Anda tetapkan.",
      "success",
    );
  };

  const handleGenerateValhallaRoute = async () => {
    if (!canGenerateRoute) {
      setRouteError("Tentukan Titik A dan Titik B sebelum menghitung jalur.");
      return;
    }

    const routingPoints = [pointA, ...manualWaypoints, pointB];
    const costing = mapProfileToValhallaCosting(profile);
    const requestBody = {
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

    setIsCalculating(true);
    setRouteError("");
    try {
      const response = await fetch(`${VALHALLA_LOCAL_HOST}/route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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
      const geometryCoordinates = legs.flatMap((leg) =>
        decodeValhallaShape(leg?.shape),
      );

      if (geometryCoordinates.length < 2) {
        throw new Error("Valhalla tidak mengembalikan geometri rute.");
      }

      const roads = extractRoadSegments(legs);
      const distance = Number(trip?.summary?.length ?? 0) * 1000;
      const duration = Number(trip?.summary?.time ?? 0);
      const source = "valhalla-local";

      setRouteData({
        mode: "valhalla",
        source,
        distance,
        duration,
        geometryCoordinates,
        geoJson: createRouteGeoJson(geometryCoordinates, {
          source,
          mode: "valhalla",
          distance,
          duration,
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
        "Titik B Diperbarui",
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
        "Pilih Set A, Set B, atau Set W sebelum menempatkan titik di peta.",
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

  const handlePickSearchResult = (result, role) => {
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    setFlyTarget({ lat, lng, zoom: 17 });
    assignPoint(role, lat, lng, result.display_name);
  };

  const handleWaypointLabelChange = (pointId, value) => {
    setManualWaypoints((previous) =>
      previous.map((point) =>
        point.id === pointId ? { ...point, label: value } : point,
      ),
    );
  };

  const handleWaypointMove = (pointId, direction) => {
    setManualWaypoints((previous) => {
      const index = previous.findIndex((point) => point.id === pointId);
      if (index < 0) {
        return previous;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= previous.length) {
        return previous;
      }

      const nextPoints = [...previous];
      const [target] = nextPoints.splice(index, 1);
      nextPoints.splice(nextIndex, 0, target);
      return nextPoints;
    });
  };

  const handleWaypointDelete = (pointId) => {
    setManualWaypoints((previous) =>
      previous.filter((point) => point.id !== pointId),
    );
  };

  const handleManualCoordinateChange = (role, id, field, value) => {
    setManualInput((prev) => ({
      ...prev,
      [`${role}-${id || "static"}-${field}`]: value,
    }));
  };

  const commitManualCoordinate = (role, id) => {
    const latKey = `${role}-${id || "static"}-lat`;
    const lngKey = `${role}-${id || "static"}-lng`;
    const rawLat = manualInput[latKey];
    const rawLng = manualInput[lngKey];

    if (rawLat === undefined && rawLng === undefined) return;

    const parsedFromLat = extractCoordinatePair(rawLat);
    const parsedFromLng = extractCoordinatePair(rawLng);
    const lat = parsedFromLat?.lat ?? (rawLat !== undefined ? Number(rawLat) : Number.NaN);
    const lng = parsedFromLat?.lng ?? parsedFromLng?.lng ?? (rawLng !== undefined ? Number(rawLng) : Number.NaN);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      pushToast("Input Error", "Koordinat harus berupa angka valid", "error");
      return;
    }

    if (role === "a") {
      assignPoint("a", lat, lng, "");
    } else if (role === "b") {
      assignPoint("b", lat, lng, "");
    } else if (role === "waypoint" && id) {
      setManualWaypoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, lat, lng } : p)),
      );
    }
  };

  const handleApplyImportedCoordinate = () => {
    const parsed = extractCoordinatePair(coordinateImportValue);
    if (!parsed) {
      pushToast(
        "Format Koordinat Tidak Valid",
        "Gunakan format seperti -5.0929568, 119.5018379 atau teks Maps yang memuat koordinat.",
        "error",
      );
      return;
    }

    if (activeCoordinateImportTarget === "a") {
      assignPoint("a", parsed.lat, parsed.lng, "Provider");
    } else if (activeCoordinateImportTarget === "b") {
      assignPoint("b", parsed.lat, parsed.lng, "Pelanggan");
    } else {
      assignPoint("waypoint", parsed.lat, parsed.lng, "");
    }

    setCoordinateImportValue("");
  };

  const handlePasteImportedCoordinate = async (preferredTarget = null) => {
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

  const handleResetPlanner = () => {
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
    if (!pointA || !pointB) {
      pushToast(
        "Titik Belum Lengkap",
        "Tentukan Titik A dan Titik B sebelum menerapkan draft.",
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
      <section className="rounded-2xl glass-card border border-white/10 p-6 shadow-glass-depth">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-accent/70">
              Preview Jalur
            </p>
            <h3 className="mt-1 text-xl font-black text-white tracking-tight">
              Peta Lintasan Tenant
            </h3>
            <p className="mt-1 text-sm text-white/40">
              Klik peta untuk membuka halaman planner lengkap.
            </p>
          </div>
          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/40">
            View Only
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left Column: Map Preview */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 lg:col-span-3 h-[500px]">
            <button
              aria-label="Buka halaman planner jalur"
              className="absolute inset-0 z-[450] cursor-pointer bg-transparent"
              onClick={onPreviewClick}
              type="button"
            />
            {/* Tombol Pusat KIMA - preview */}
            <button
              className="absolute bottom-3 right-3 z-[460] w-9 h-9 rounded-xl border border-gold-accent/30 bg-slate-900/80 backdrop-blur-md text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition shadow-lg flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); setFlyTarget({ lat: KIMA_CENTER[0], lng: KIMA_CENTER[1], zoom: DEFAULT_ZOOM }); }}
              title="Pusatkan ke KIMA"
              type="button"
            >
              <span className="material-symbols-outlined text-base">my_location</span>
            </button>
            <div className="relative z-10 h-full">
              <MapContainer
                attributionControl={false}
                center={DEFAULT_CENTER}
                className="h-full w-full bg-slate-100"
                scrollWheelZoom
                zoom={DEFAULT_ZOOM}
              >
                <TileLayer
                  attribution={selectedBasemap.attribution}
                  url={selectedBasemap.url}
                />
                <AttributionControl position="bottomleft" />
                {/* Adjust viewport based on preview or actual route */}
                <MapViewportController
                  fitCoordinates={previewFitCoordinates}
                  fitRouteKey={isPreviewMode ? `preview-${previewControlPoints.length}-${previewGeometryCoordinates.length}-${previewRoadSegments.length}` : `route-${routeData?.geometryCoordinates?.length || 0}`}
                  flyTarget={flyTarget}
                />
                {visiblePreviewProviderEntryPoints.map((entryPoint) => (
                  <Marker
                    key={`preview-provider-entry-marker-${entryPoint.id}`}
                    icon={createEntryPointIcon(entryPoint.label, entryPoint.isDefault)}
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
                {previewControlPoints.map((point, index) => {
                  const icon =
                    point.role === "provider"
                      ? createEntryPointIcon(point.label, activeProviderEntryPointId !== null)
                      : point.role === "customer"
                        ? createCustomerCompanyIcon(customerIconUrl, point.label ?? "")
                        : WAYPOINT_ICON;

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
              <span className="rounded-full bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-white/70 shadow-sm border border-white/10">
                Titik: {previewControlPoints.length}
              </span>
              <span className={`rounded-full backdrop-blur-sm px-3 py-1.5 text-xs font-bold shadow-sm border ${previewRouteGeoJson ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-slate-900/80 border-white/10 text-white/40"}`}>
                {previewRouteGeoJson ? "Jalur Aktif" : "Tanpa Koordinat"}
              </span>
            </div>

            {/* Empty state CTA */}
            {previewControlPoints.length === 0 && !previewRouteGeoJson && onPreviewClick && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl px-8 py-7 text-center max-w-xs">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-accent/10 border border-gold-accent/20">
                    <span className="material-symbols-outlined text-3xl text-gold-accent">route</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-white tracking-tight">Belum ada jalur FO</p>
                    <p className="mt-1.5 text-xs text-white/40 leading-relaxed">Mulai mapping lintasan kabel fiber optik untuk tenant ini.</p>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-accent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#0f141e] shadow-lg hover:brightness-110 transition-all active:scale-95"
                    onClick={onPreviewClick}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Buka Planner Jalur
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Insights */}
          <div className="flex flex-col lg:col-span-2">
            <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-accent/70">
                Insights
              </p>
              <h3 className="mt-1 text-xl font-black text-white tracking-tight">
                Glosarium Jenis Titik
              </h3>
              <p className="mt-2 text-sm text-white/40 leading-relaxed">
                Legenda simbol yang digunakan pada peta lintasan fiber optik.
              </p>

              <div className="mt-8 space-y-5 flex-1">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <span className="material-symbols-outlined text-xl">router</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Titik Awal</h4>
                    <p className="mt-0.5 text-xs text-white/40">Manhole Utama / ODP (Optical Distribution Point)</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <span className="material-symbols-outlined text-xl">lan</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Titik Transit</h4>
                    <p className="mt-0.5 text-xs text-white/40">Tiang Tumpuan / Jalur Lintasan Kabel</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="material-symbols-outlined text-xl">home_work</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Titik Tujuan</h4>
                    <p className="mt-0.5 text-xs text-white/40">Lokasi Akhir Perangkat Tenant (ONT/Modem)</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-sky-500/10 border border-sky-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-lg text-sky-400">info</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Info Jalur</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Garis biru bercahaya menunjukkan estimasi jalur kabel FO yang akan digelar dari provider hingga ke titik tujuan tenant.
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
          scrollWheelZoom
          zoom={DEFAULT_ZOOM}
          zoomControl={false}
        >
          <TileLayer
            attribution={selectedBasemap.attribution}
            url={selectedBasemap.url}
          />
          <AttributionControl position="bottomleft" />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapViewportController
            fitCoordinates={mapFitCoordinates}
            fitRouteKey={`${routeData?.source ?? "none"}-${routeData?.distance ?? 0}-${routeData?.mode ?? "idle"}`}
            flyTarget={flyTarget}
          />
          <MapInstanceCapture onReady={setMapInstance} />

          {visibleProviderEntryPoints.map((entryPoint) => (
            <Marker
              key={`provider-entry-marker-${entryPoint.id}`}
              icon={createEntryPointIcon(entryPoint.label, entryPoint.isDefault)}
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
                  <p className="font-bold text-slate-800">{pointB.label || "Titik B / Pelanggan"}</p>
                  <p className="text-[10px] text-slate-500">
                    {pointB.lat.toFixed(6)}, {pointB.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
          {showKimaMarker && (
            <Marker icon={KIMA_ICON} position={KIMA_CENTER}>
              <Popup>Kawasan Industri Makassar (KIMA)</Popup>
            </Marker>
          )}
          {manualWaypoints.map((point) => (
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

      <div className="pointer-events-none absolute right-4 top-20 z-[1001] w-[min(280px,calc(100%-2rem))] sm:w-[320px] md:right-6 md:top-24 md:w-[380px] xl:w-[460px]">
        <section className="pointer-events-auto rounded-[1.75rem] border border-white/10 bg-slate-900/88 p-4 shadow-2xl backdrop-blur-md">
          <form className="flex gap-2" onSubmit={handleSearch}>
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-1.5 text-[11px] text-white outline-none focus:border-primary/50 transition backdrop-blur-md"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari lokasi penarikan..."
                type="text"
                value={searchQuery}
              />
            </div>
            <button className="rounded-xl bg-primary px-3 py-1.5 text-[9px] font-bold text-white uppercase" disabled={isSearching}>
              {isSearching ? "..." : "Cari"}
            </button>
          </form>
          {searchError && (
            <p className="mt-2 text-[10px] text-rose-400 font-medium px-1">{searchError}</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-2.5 max-h-[145px] overflow-auto space-y-1.5 pr-1 custom-scrollbar">
              {searchResults.map((result) => (
                <div key={result.place_id} className="rounded-lg bg-white/5 p-2 border border-white/5 hover:bg-white/10 transition backdrop-blur-md">
                  <p className="text-[10px] text-white/90 font-medium leading-tight mb-2">{result.display_name}</p>
                  <div className="flex gap-1.5">
                    <button className="flex-1 bg-white/10 py-1 rounded text-[9px] font-bold uppercase text-white/70 hover:text-white backdrop-blur-md" onClick={() => handlePickSearchResult(result, "a")}>Set A</button>
                    <button className="flex-1 bg-white/10 py-1 rounded text-[9px] font-bold uppercase text-white/70 hover:text-white backdrop-blur-md" onClick={() => handlePickSearchResult(result, "b")}>Set B</button>
                    {customRouteMode && <button className="flex-1 bg-white/10 py-1 rounded text-[9px] font-bold uppercase text-white/70 hover:text-white backdrop-blur-md" onClick={() => handlePickSearchResult(result, "waypoint")}>+W</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Floating Sidebar - Responsive Card Style */}
      <aside
        className={`absolute inset-x-0 bottom-0 sm:inset-auto sm:left-4 sm:top-4 sm:bottom-auto z-[1000] w-full sm:w-[300px] lg:w-[330px] xl:w-[360px] max-h-[82vh] sm:max-h-[var(--fo-route-sidebar-max-height)] sm:overflow-y-auto sm:overflow-x-visible flex flex-col pointer-events-none transition-transform duration-500 ease-in-out custom-scrollbar ${isSidebarOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-[calc(100%+2rem)] sm:translate-y-0 sm:-translate-x-[calc(100%+2rem)]"
          }`}
        style={{ "--fo-route-sidebar-max-height": sidebarMaxHeight }}
      >
        <div className="flex flex-col pointer-events-auto bg-slate-900/95 sm:bg-transparent backdrop-blur-xl sm:backdrop-blur-none sm:space-y-2.5 p-4 sm:p-0 overflow-y-auto sm:overflow-visible rounded-t-3xl sm:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.3)] sm:shadow-none border-t border-white/10 sm:border-t-0 custom-scrollbar">
          {/* Mobile Handle (Visual only) */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 sm:hidden backdrop-blur-md" />

          {/* Header Panel */}
          <header className="rounded-2xl sm:border border-white/10 sm:bg-slate-900/80 sm:p-4 sm:backdrop-blur-md sm:shadow-2xl relative shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Points Console</p>
                <h3 className="text-base font-black text-white leading-tight mt-1">Points & Waypoints</h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/70">
                <span className={`h-1.5 w-1.5 rounded-full ${activeRouteModeLabel === "Custom" ? "bg-amber-400" : "bg-emerald-400"}`} />
                {activeRouteModeLabel}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Provider</p>
                <p className="mt-1 text-sm font-black text-white">{pointSummary.provider}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Customer</p>
                <p className="mt-1 text-sm font-black text-white">{pointSummary.customer}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Waypoint</p>
                <p className="mt-1 text-sm font-black text-white">{pointSummary.waypoint}</p>
              </div>
            </div>

            {selectedProviderEntryPoints.length > 0 && (
              <div className="mt-3 rounded-[1.25rem] border border-gold-accent/25 bg-gold-accent/10 p-3 backdrop-blur-md">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gold-accent/80">Titik Masuk ISP</p>
                <div className="mt-2 space-y-1.5">
                  {selectedProviderEntryPoints.slice(0, 4).map((entryPoint, index) => (
                    <button
                      key={entryPoint.id}
                      className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-gold-accent/40 hover:bg-gold-accent/10"
                      onClick={() => applyProviderEntryPoint(entryPoint)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-black text-white">{entryPoint.label}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-gold-accent">{index === 0 ? "Utama" : `Backup ${index}`}</span>
                      </div>
                      <p className="mt-1 text-[9px] font-mono text-white/40">{entryPoint.lat.toFixed(6)}, {entryPoint.lng.toFixed(6)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-[1.25rem] border border-sky-400/30 bg-gradient-to-br from-sky-500/15 to-cyan-500/10 p-3 backdrop-blur-md shadow-[0_0_0_1px_rgba(125,211,252,0.08)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-sky-300">content_paste_go</span>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-sky-200">Input koordinat</p>
                  </div>
                  <p className="mt-1 text-[10px] font-medium leading-relaxed text-sky-50/70">
                    Tempel URL Google Maps penuh atau koordinat mentah.
                    Mode otomatis akan mengisi A lalu B lalu waypoint.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { value: "auto", label: "Auto A/B" },
                  { value: "a", label: "Target A" },
                  { value: "b", label: "Target B" },
                  { value: "waypoint", label: "Waypoint" },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${
                      coordinateImportTarget === option.value
                        ? "border-sky-300/40 bg-sky-400/20 text-sky-50"
                        : "border-white/10 bg-slate-950/55 text-white/60 hover:bg-white/10"
                    }`}
                    onClick={() => setCoordinateImportTarget(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
                <span className="ml-auto rounded-full border border-sky-300/20 bg-slate-950/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-sky-200">
                  {activeCoordinateImportTarget === "a"
                    ? "A aktif"
                    : activeCoordinateImportTarget === "b"
                      ? "B aktif"
                      : "Waypoint aktif"}
                </span>
              </div>

              <div className="mt-2.5 grid gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <textarea
                  className="min-h-[80px] rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2 text-[10px] font-mono leading-relaxed text-white outline-none placeholder:text-white/30 resize-none"
                  onChange={(e) => setCoordinateImportValue(e.target.value)}
                  placeholder="Tempel URL Maps atau koordinat seperti: https://www.google.com/maps/@-5.09,119.50,17z"
                  rows={3}
                  value={coordinateImportValue}
                  spellCheck={false}
                />
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">
                    Preview Deteksi
                  </p>
                  {importedCoordinatePreview ? (
                    <div className="mt-2 space-y-2">
                      <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                          Terdeteksi
                        </p>
                        <p className="mt-1 text-[11px] font-mono text-white">
                          {importedCoordinatePreview.lat.toFixed(7)}, {importedCoordinatePreview.lng.toFixed(7)}
                        </p>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/60">
                        Jika diterapkan sekarang, data akan masuk ke{" "}
                        <span className="font-bold text-white">
                          {activeCoordinateImportTarget === "a"
                            ? "A / Provider"
                            : activeCoordinateImportTarget === "b"
                              ? "B / Pelanggan"
                              : "Waypoint berikutnya"}
                        </span>.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] leading-relaxed text-white/55">
                      Belum ada koordinat valid. Tempel tautan Google Maps penuh atau pasangan angka lat/lng.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <button
                  className="rounded-lg border border-sky-300/20 bg-sky-500/20 px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-sky-100 transition hover:bg-sky-500/30"
                  onClick={() => handlePasteImportedCoordinate("a")}
                  type="button"
                >
                  Tempel ke A
                </button>
                <button
                  className="rounded-lg border border-sky-300/20 bg-sky-500/20 px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-sky-100 transition hover:bg-sky-500/30"
                  onClick={() => handlePasteImportedCoordinate("b")}
                  type="button"
                >
                  Tempel ke B
                </button>
                <button
                  className="rounded-lg border border-sky-300/20 bg-sky-500/20 px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-sky-100 transition hover:bg-sky-500/30"
                  onClick={() => handlePasteImportedCoordinate()}
                  type="button"
                >
                  Tempel Otomatis
                </button>
                <button
                  className="rounded-lg border border-sky-300/20 bg-sky-500/20 px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-sky-100 transition hover:bg-sky-500/30"
                  onClick={handleApplyImportedCoordinate}
                  type="button"
                >
                  Terapkan Teks
                </button>
              </div>

              <p className="mt-1.5 text-[8px] font-medium text-sky-50/55">
                Contoh: `-5.0929568, 119.5018379`, `@-5.09,119.50`, atau link `google.com/maps`.
              </p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${placementMode === "a" ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setPlacementMode("a")}
                type="button"
              >
                Set A
              </button>
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${placementMode === "b" ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setPlacementMode("b")}
                type="button"
              >
                Set B
              </button>
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${customRouteMode ? "bg-amber-500 border-amber-500 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setCustomRouteMode(!customRouteMode)}
                type="button"
              >
                {customRouteMode ? "Mode Custom" : "Mode Otomatis"}
              </button>
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${placementMode === "waypoint" ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setPlacementMode("waypoint")}
                type="button"
              >
                Set W
              </button>
              <button
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold uppercase text-white/80 transition hover:bg-white/10 backdrop-blur-md"
                onClick={handleRecenterToKima}
                type="button"
              >
                <span className="material-symbols-outlined text-[12px]">my_location</span>
                Pusatkan KIMA
              </button>
            </div>

            {/* Toggle Button moved outside aside */}
          </header>

          {/* Scrollable Waypoint List */}
          <section className="relative mt-2.5 flex min-h-0 flex-1 flex-col rounded-2xl border-white/10 sm:mt-0 sm:border sm:bg-slate-900/80 sm:p-3 sm:shadow-xl sm:backdrop-blur-md">
            {namedPlannerRoads.length > 0 && (
              <>
                {isRoadPanelOpen && (
                  <section className="flex max-h-[30vh] flex-col rounded-2xl border border-white/10 bg-slate-900/85 p-3 shadow-2xl backdrop-blur-md pointer-events-auto mb-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-widest text-sky-400">Ruas Jalan</p>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-black text-sky-300">
                          {namedPlannerRoads.length} ruas
                        </span>
                        <button
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:text-white backdrop-blur-md"
                          onClick={() => setIsRoadPanelOpen(false)}
                          title="Tutup panel ruas jalan"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1 overflow-auto pr-1 custom-scrollbar">
                      {namedPlannerRoads.map((road, index) => (
                        <div
                          key={road.id ?? `named-road-${index}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 backdrop-blur-md"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="material-symbols-outlined shrink-0 text-[13px] text-gold-accent/70">route</span>
                            <p className="truncate text-[10px] font-semibold text-white/90">{road.name}</p>
                          </div>
                          <span className="shrink-0 text-[9px] font-mono text-white/40">
                            {Number.isFinite(Number(road.distance)) && Number(road.distance) > 0
                              ? `${(Number(road.distance) / 1000).toFixed(2)} km`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {!isRoadPanelOpen && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl glass-card backdrop-blur-xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white/70 shadow-glass-depth transition hover:border-gold-accent hover:text-gold-accent pointer-events-auto mb-2"
                    onClick={() => setIsRoadPanelOpen(true)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">route</span>
                    Ruas Jalan
                  </button>
                )}
              </>
            )}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-white/90">Points & Waypoints</h4>
              <select
                className="bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-white/60 outline-none cursor-pointer px-2 py-1"
                onChange={(e) => setProfile(e.target.value)}
                value={profile}
              >
                <option value="driving">Driving</option>
                <option value="cycling">Cycling</option>
                <option value="foot">Walking</option>
              </select>
            </div>

            <div className="flex-1 overflow-auto space-y-2 pr-1 custom-scrollbar">
              {/* Point A */}
              <div className="flex flex-col gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-blue-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg shadow-blue-500/20">A</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase text-blue-400">Titik A (Provider)</p>
                    <p className="text-[11px] font-mono text-white/90 truncate">{pointA ? `${pointA.lat.toFixed(5)}, ${pointA.lng.toFixed(5)}` : "Belum ditentukan"}</p>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white outline-none focus:border-blue-500/50 backdrop-blur-md"
                    onBlur={() => commitManualCoordinate("a")}
                    onChange={(e) => handleManualCoordinateChange("a", null, "lat", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("a")}
                    placeholder="Latitude"
                    value={manualInput["a-static-lat"] ?? (pointA?.lat ?? "")}
                  />
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white outline-none focus:border-blue-500/50 backdrop-blur-md"
                    onBlur={() => commitManualCoordinate("a")}
                    onChange={(e) => handleManualCoordinateChange("a", null, "lng", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("a")}
                    placeholder="Longitude"
                    value={manualInput["a-static-lng"] ?? (pointA?.lng ?? "")}
                  />
                </div>
              </div>

              {/* Waypoints with road segments */}
              {manualWaypoints.map((point, index) => {
                const roadToThis = plannerRoads.find(r => r.id === `manual-${index}` || r.id?.startsWith(`${index}-`));

                return (
                  <div key={point.id} className="space-y-2">
                    {roadToThis && (
                      <div className="mx-6 flex items-center gap-2 border-l-2 border-dashed border-white/10 py-1 pl-4">
                        <span className="material-symbols-outlined text-[12px] text-gold-accent/70">route</span>
                        <p className="text-[9px] font-medium text-white/40 truncate">{roadToThis.name}</p>
                        <span className="text-[8px] font-mono text-white/30 shrink-0">
                          {Number.isFinite(Number(roadToThis.distance)) && Number(roadToThis.distance) > 0
                            ? `${(Number(roadToThis.distance) / 1000).toFixed(2)} km`
                            : ""}
                        </span>
                      </div>
                    )}
                    
                    <div className="group flex flex-col gap-2 rounded-xl bg-white/5 border border-white/10 p-3 hover:border-primary/30 transition backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg shadow-emerald-500/20">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <input
                            className="bg-transparent w-full text-[10px] font-bold text-white outline-none mb-0.5"
                            onChange={(e) => handleWaypointLabelChange(point.id, e.target.value)}
                            placeholder={`Waypoint ${index + 1}`}
                            value={point.label}
                          />
                          <p className="text-[9px] font-mono text-white/50">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>
                        </div>
                        <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                          <button
                            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition backdrop-blur-md"
                            onClick={() => handleWaypointMove(point.id, "up")}
                            title="Pindahkan ke atas"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">keyboard_arrow_up</span>
                          </button>
                          <button
                            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition backdrop-blur-md"
                            onClick={() => handleWaypointMove(point.id, "down")}
                            title="Pindahkan ke bawah"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">keyboard_arrow_down</span>
                          </button>
                        </div>
                        <button className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:bg-rose-500/20 rounded transition" onClick={() => handleWaypointDelete(point.id)}>
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>

                      <div className="flex gap-2 items-center">
                        <input
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white outline-none focus:border-emerald-500/50 backdrop-blur-md"
                          onBlur={() => commitManualCoordinate("waypoint", point.id)}
                          onChange={(e) => handleManualCoordinateChange("waypoint", point.id, "lat", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("waypoint", point.id)}
                          placeholder="Latitude"
                          value={manualInput[`waypoint-${point.id}-lat`] ?? point.lat}
                        />
                        <input
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white outline-none focus:border-emerald-500/50 backdrop-blur-md"
                          onBlur={() => commitManualCoordinate("waypoint", point.id)}
                          onChange={(e) => handleManualCoordinateChange("waypoint", point.id, "lng", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("waypoint", point.id)}
                          placeholder="Longitude"
                          value={manualInput[`waypoint-${point.id}-lng`] ?? point.lng}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Point B */}
              {pointB && (
                <div className="space-y-2">
                  {(() => {
                    const lastIndex = manualWaypoints.length;
                    const roadToB = plannerRoads.find(r => r.id === `manual-${lastIndex}` || r.id?.startsWith(`${lastIndex}-`));
                    if (!roadToB) return null;
                    
                    return (
                      <div className="mx-6 flex items-center gap-2 border-l-2 border-dashed border-white/10 py-1 pl-4">
                        <span className="material-symbols-outlined text-[12px] text-gold-accent/70">route</span>
                        <p className="text-[9px] font-medium text-white/40 truncate">{roadToB.name}</p>
                        <span className="text-[8px] font-mono text-white/30 shrink-0">
                          {Number.isFinite(Number(roadToB.distance)) && Number(roadToB.distance) > 0
                            ? `${(Number(roadToB.distance) / 1000).toFixed(2)} km`
                            : ""}
                        </span>
                      </div>
                    );
                  })()}
                  
                  <div className="flex flex-col gap-2 rounded-xl bg-pink-500/10 border border-pink-500/20 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-pink-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg shadow-pink-500/20">B</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase text-pink-400">Titik B (Pelanggan)</p>
                        <p className="text-[11px] font-mono text-white/90 truncate">{pointB ? `${pointB.lat.toFixed(5)}, ${pointB.lng.toFixed(5)}` : "Belum ditentukan"}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <input
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white outline-none focus:border-pink-500/50 backdrop-blur-md"
                        onBlur={() => commitManualCoordinate("b")}
                        onChange={(e) => handleManualCoordinateChange("b", null, "lat", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("b")}
                        placeholder="Latitude"
                        value={manualInput["b-static-lat"] ?? (pointB?.lat ?? "")}
                      />
                      <input
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white outline-none focus:border-pink-500/50 backdrop-blur-md"
                        onBlur={() => commitManualCoordinate("b")}
                        onChange={(e) => handleManualCoordinateChange("b", null, "lng", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("b")}
                        placeholder="Longitude"
                        value={manualInput["b-static-lng"] ?? (pointB?.lng ?? "")}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {!pointB && (
                <div className="flex flex-col gap-2 rounded-xl bg-pink-500/10 border border-pink-500/20 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-pink-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg shadow-pink-500/20">B</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase text-pink-400">Titik B (Pelanggan)</p>
                      <p className="text-[11px] font-mono text-white/90 truncate">Belum ditentukan</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5 shrink-0">
              {/* Valhalla status indicator */}
              {valhallaStatus === "offline" ? (
                <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-2">
                  <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 leading-tight">
                    Valhalla Offline — pakai Custom Jalur
                  </span>
                </div>
              ) : valhallaStatus === "online" ? (
                <div className="flex items-center gap-2 px-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70">Valhalla Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Memeriksa server...</span>
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                <button
                  className="btn-premium text-[9px] font-black uppercase tracking-widest py-2.5 px-2.5 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:transform-none"
                  disabled={!canGenerateRoute || isCalculating || valhallaStatus === "offline"}
                  onClick={() => void handleGenerateValhallaRoute()}
                  title={valhallaStatus === "offline" ? "Server Valhalla tidak aktif" : "Hitung jalur otomatis via Valhalla"}
                  type="button"
                >
                  {isCalculating ? "Calculating..." : "Jalur Otomatis"}
                </button>
                <button
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-2.5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/80 transition hover:border-gold-accent/40 hover:bg-white/10 hover:text-gold-accent disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={!canGenerateManualRoute || isCalculating}
                  onClick={handleGenerateManualRoute}
                  type="button"
                >
                  Custom Jalur
                </button>
                <button
                  className="p-2.5 bg-white/5 border border-white/10 text-white/70 hover:text-white rounded-xl transition backdrop-blur-md"
                  onClick={handleUndoToInitial}
                  title="Undo ke setelan awal"
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">undo</span>
                </button>
                <button
                  className="p-2.5 bg-white/5 border border-white/10 text-white/70 hover:text-white rounded-xl transition backdrop-blur-md"
                  onClick={handleResetPlanner}
                  title="Reset"
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                </button>
              </div>
              <button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase py-2.5 rounded-xl transition shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                disabled={!routeData?.geometryCoordinates || routeData.geometryCoordinates.length < 2 || isCalculating}
                onClick={handleApplyPlanner}
                type="button"
              >
                Terapkan Draft
              </button>
            </div>

          </section>
        </div>
      </aside>

      {/* Desktop Sidebar Toggle Button (Outside aside to avoid overflow clipping) */}
      <button
        className={`hidden sm:flex absolute z-[1001] top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-slate-900/80 text-white shadow-2xl backdrop-blur-md transition-all duration-500 ease-in-out hover:bg-primary pointer-events-auto ${isSidebarOpen ? "left-[calc(theme(spacing.4)+300px)] lg:left-[calc(theme(spacing.4)+330px)] xl:left-[calc(theme(spacing.4)+360px)]" : "left-4"}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        type="button"
      >
        <span className="material-symbols-outlined">
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

      {/* Basemap Switcher Overlay - Bottom Right */}
      <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-[800] flex flex-col gap-1.5 sm:gap-2 pointer-events-none transition-opacity duration-500" style={{ opacity: isSidebarOpen && window.innerWidth < 640 ? 0 : 1 }}>
        <div className="flex flex-col gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md pointer-events-auto">
          {/* Zoom Controls */}
          <button
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapInstance && mapInstance.zoomIn()}
            title="Perbesar"
            type="button"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">add</span>
          </button>
          <button
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapInstance && mapInstance.zoomOut()}
            title="Perkecil"
            type="button"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">remove</span>
          </button>
          <div className="h-px bg-white/10 mx-1" />
          {/* Tombol Pusat KIMA - di dalam grup */}
          <button
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-gold-accent/30 flex items-center justify-center transition text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] bg-white/5"
            onClick={handleRecenterToKima}
            title="Pusatkan ke KIMA"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">my_location</span>
          </button>
          <div className="h-px bg-white/10 mx-1" />
          {BASEMAP_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition ${basemap === option.key ? "bg-primary border-primary text-white" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white"}`}
              onClick={() => setBasemap(option.key)}
              title={option.label}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">
                {option.key === 'satellite' ? 'satellite_alt' : option.key === 'osm' ? 'map' : 'dark_mode'}
              </span>
            </button>
          ))}
        </div>
        <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md text-white/70 hover:text-white transition pointer-events-auto flex items-center justify-center" onClick={handleExportGeoJson} title="Export GeoJSON">
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
