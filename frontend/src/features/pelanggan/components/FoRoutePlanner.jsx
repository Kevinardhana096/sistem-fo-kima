import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./FoRoutePlanner.css";

const DEFAULT_CENTER = [-5.147665, 119.432732];
const DEFAULT_ZOOM = 13;
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

function createCompanyIcon(logoUrl) {
  if (!logoUrl) return createGlowIcon("A", "provider");

  return L.divIcon({
    className: "",
    html: `
            <div class="fo-marker fo-marker--provider">
                <span class="fo-marker__pulse"></span>
                <div class="fo-marker__core overflow-hidden bg-white p-0.5">
                    <img src="${logoUrl}" class="h-full w-full object-contain rounded-full" />
                </div>
            </div>
        `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const CUSTOMER_ICON = createGlowIcon("B", "customer");
const WAYPOINT_ICON = createGlowIcon("W", "waypoint");

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
}) {
  const [basemap, setBasemap] = useState("osm");
  const [profile, setProfile] = useState("driving");
  const [placementMode, setPlacementMode] = useState("a");
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
  const [manualInput, setManualInput] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const skipNextRouteResetRef = useRef(false);

  const providerIcon = useMemo(() => createCompanyIcon(providerIconUrl), [providerIconUrl]);

  const selectedBasemap =
    BASEMAP_OPTIONS.find((item) => item.key === basemap) ?? BASEMAP_OPTIONS[0];
  const isPreviewMode = mode === "preview";
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

    setPointA(
      providerPoint
        ? {
            id: providerPoint.id ?? "restored-a",
            lat: Number(providerPoint.lat),
            lng: Number(providerPoint.lng),
            label: providerPoint.label ?? providerPoint.pathName ?? "Provider",
          }
        : null,
    );
    setPointB(
      customerPoint
        ? {
            id: customerPoint.id ?? "restored-b",
            lat: Number(customerPoint.lat),
            lng: Number(customerPoint.lng),
            label: customerPoint.label ?? customerPoint.pathName ?? "Pelanggan",
          }
        : null,
    );
    setManualWaypoints(
      waypointPoints.map((point, index) => ({
        id: point.id ?? `restored-waypoint-${index}`,
        lat: Number(point.lat),
        lng: Number(point.lng),
        label: point.label ?? point.pathName ?? `Waypoint ${index + 1}`,
      })),
    );

    const geometryCoordinates = Array.isArray(initialRouteMeta?.geometryCoordinates)
      ? initialRouteMeta.geometryCoordinates
      : [];
    const roads = Array.isArray(initialRouteMeta?.roads)
      ? initialRouteMeta.roads
      : [];

    if (geometryCoordinates.length >= 2) {
      skipNextRouteResetRef.current = true;
      setRouteData({
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
      });
      setCustomRouteMode(initialRouteMeta?.mode === "manual");
    }
  }, [initialPlannerControlPoints, initialRouteMeta, isPreviewMode]);

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
    pushToast(
      "Waypoint Ditambahkan",
      "Titik manual masuk ke custom route.",
      "info",
    );
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

    assignPoint("waypoint", latlng.lat, latlng.lng, "");
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

    if (rawLat === undefined || rawLng === undefined) return;

    const lat = Number(rawLat);
    const lng = Number(rawLng);

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
      <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-slate-200">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/70">
              Preview Jalur
            </p>
            <h3 className="mt-1 text-xl font-bold text-on-surface">
              Peta Lintasan Tenant
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Klik peta untuk membuka halaman planner lengkap.
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            View Only
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left Column: Map Preview */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 lg:col-span-3 h-[500px]">
            <button
              aria-label="Buka halaman planner jalur"
              className="absolute inset-0 z-[450] cursor-pointer bg-transparent"
              onClick={onPreviewClick}
              type="button"
            />
            <div className="relative z-10 h-full">
              <MapContainer
                center={DEFAULT_CENTER}
                className="h-full w-full bg-slate-100"
                scrollWheelZoom
                zoom={DEFAULT_ZOOM}
              >
                <TileLayer
                  attribution={selectedBasemap.attribution}
                  url={selectedBasemap.url}
                />
                {/* Adjust viewport based on preview or actual route */}
                <MapViewportController
                  fitCoordinates={previewFitCoordinates}
                  fitRouteKey={isPreviewMode ? `preview-${previewControlPoints.length}-${previewGeometryCoordinates.length}-${previewRoadSegments.length}` : `route-${routeData?.geometryCoordinates?.length || 0}`}
                  flyTarget={null}
                />
                {previewControlPoints.map((point) => {
                  const icon =
                    point.role === "provider"
                      ? providerIcon
                      : point.role === "customer"
                        ? CUSTOMER_ICON
                        : WAYPOINT_ICON;

                  return (
                    <Marker
                      key={point.id ?? `${point.role}-${point.lat}-${point.lng}`}
                      icon={icon}
                      position={[point.lat, point.lng]}
                    />
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
              <span className="rounded-full bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200">
                Titik: {previewControlPoints.length}
              </span>
              <span className="rounded-full bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200">
                {previewRouteGeoJson ? "Jalur Aktif" : "Tanpa Koordinat"}
              </span>
            </div>
          </div>

          {/* Right Column: Insights */}
          <div className="flex flex-col lg:col-span-2">
            <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Insights
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Glosarium Jenis Titik
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Legenda simbol yang digunakan pada peta lintasan fiber optik.
              </p>

              <div className="mt-8 space-y-6 flex-1">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <span className="material-symbols-outlined text-2xl">
                      router
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Titik Awal
                    </h4>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Manhole Utama / ODP (Optical Distribution Point)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <span className="material-symbols-outlined text-2xl">
                      lan
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Titik Transit
                    </h4>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Tiang Tumpuan / Jalur Lintasan Kabel
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <span className="material-symbols-outlined text-2xl">
                      home_work
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Titik Tujuan
                    </h4>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Lokasi Akhir Perangkat Tenant (ONT/Modem)
                    </p>
                  </div>
                </div>

                {/* Road segment list */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Ruas Jalan Tersimpan
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Nama lintasan yang dibaca dari jalur terakhir yang sudah diset.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      {isPreviewMode ? previewRoadSegments.length : plannerRoads.length} ruas
                    </span>
                  </div>

                  {(isPreviewMode ? previewRoadSegments : plannerRoads).length === 0 ? (
                    <p className="mt-3 text-xs italic text-slate-400">
                      Belum ada nama ruas tersimpan untuk jalur ini.
                    </p>
                  ) : (
                    <div className="mt-3 max-h-[180px] space-y-2 overflow-auto pr-1">
                      {(isPreviewMode ? previewRoadSegments : plannerRoads).map((road, index) => (
                        <div
                          key={road?.id ?? `road-${index}`}
                          className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                {road?.name || `Ruas ${index + 1}`}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {road?.instruction || "Ikuti jalur tersimpan"}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              {Number.isFinite(Number(road?.distance))
                                ? `${(Number(road.distance) / 1000).toFixed(2)} km`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 rounded-xl bg-blue-600 p-5 text-white shadow-md shadow-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-xl">
                    info
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest">
                    Info Jalur
                  </span>
                </div>
                <p className="text-sm leading-relaxed opacity-95">
                  Garis biru bercahaya menunjukkan estimasi jalur kabel FO yang
                  akan digelar dari provider hingga ke titik tujuan tenant.
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
          <MapClickHandler onMapClick={handleMapClick} />
          <MapViewportController
            fitCoordinates={mapFitCoordinates}
            fitRouteKey={`${routeData?.source ?? "none"}-${routeData?.distance ?? 0}-${routeData?.mode ?? "idle"}`}
            flyTarget={flyTarget}
          />
          <ZoomControl position="bottomright" />

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
            />
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
              icon={CUSTOMER_ICON}
              position={[pointB.lat, pointB.lng]}
            />
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
            />
          ))}
          {routeData?.geoJson && (
            <>
              <GeoJSON data={routeData.geoJson} style={() => routeGlowStyle} />
              <GeoJSON data={routeData.geoJson} style={() => routeMainStyle} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Floating Sidebar - Responsive Card Style */}
      <aside
        className={`absolute inset-x-0 bottom-0 sm:inset-auto sm:left-4 sm:top-4 sm:bottom-4 z-[1000] w-full sm:w-[360px] max-h-[82vh] sm:max-h-none flex flex-col pointer-events-none transition-transform duration-500 ease-in-out ${isSidebarOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-[calc(100%+2rem)] sm:translate-y-0 sm:-translate-x-[calc(100%+2rem)]"
          }`}
      >
        <div className="flex flex-col h-full pointer-events-auto bg-slate-900/95 sm:bg-transparent backdrop-blur-xl sm:backdrop-blur-none sm:space-y-2.5 p-4 sm:p-0 overflow-auto sm:overflow-visible rounded-t-3xl sm:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.3)] sm:shadow-none border-t border-white/10 sm:border-t-0">
          {/* Mobile Handle (Visual only) */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

          {/* Header Panel */}
          <header className="rounded-2xl sm:border border-white/10 sm:bg-slate-900/80 sm:p-4 sm:backdrop-blur-md sm:shadow-2xl relative shrink-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Tactical Console</p>
            <h3 className="text-base font-black text-white leading-tight mt-1">FO Route Planner</h3>

            {/* Action Bar */}
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${placementMode === "a" ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setPlacementMode("a")}
              >Set A</button>
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${placementMode === "b" ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setPlacementMode("b")}
              >Set B</button>
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${customRouteMode ? "bg-amber-500 border-amber-500 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setCustomRouteMode(!customRouteMode)}
              >{customRouteMode ? "Custom ON" : "Custom OFF"}</button>
              <button
                className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition ${placementMode === "waypoint" ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                onClick={() => setPlacementMode("waypoint")}
                type="button" >
                Set W
              </button>
            </div>

            {/* Toggle Button (Absolute inside header for desktop, handles the slide) */}
            <button
              className="absolute -right-12 top- -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-slate-900/80 text-white shadow-2xl backdrop-blur-md transition-all hover:bg-primary pointer-events-auto"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
              type="button"
            >
              <span className="material-symbols-outlined">
                {isSidebarOpen ? "chevron_left" : "chevron_right"}
              </span>
            </button>
          </header>

          {/* Search Panel */}
          <section className="rounded-2xl sm:border border-white/10 sm:bg-slate-900/80 sm:p-3 sm:backdrop-blur-md sm:shadow-xl sm:block mt-2.5 sm:mt-0 shrink-0">
            <form className="flex gap-2" onSubmit={handleSearch}>
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-1.5 text-[11px] text-white outline-none focus:border-primary/50 transition"
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
                  <div key={result.place_id} className="rounded-lg bg-white/5 p-2 border border-white/5 hover:bg-white/10 transition">
                    <p className="text-[10px] text-white/90 font-medium leading-tight mb-2">{result.display_name}</p>
                    <div className="flex gap-1.5">
                      <button className="flex-1 bg-white/10 py-1 rounded text-[9px] font-bold uppercase text-white/70 hover:text-white" onClick={() => handlePickSearchResult(result, "a")}>Set A</button>
                      <button className="flex-1 bg-white/10 py-1 rounded text-[9px] font-bold uppercase text-white/70 hover:text-white" onClick={() => handlePickSearchResult(result, "b")}>Set B</button>
                      {customRouteMode && <button className="flex-1 bg-white/10 py-1 rounded text-[9px] font-bold uppercase text-white/70 hover:text-white" onClick={() => handlePickSearchResult(result, "waypoint")}>+W</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Scrollable Waypoint List */}
          <section className="flex-1 min-h-0 rounded-2xl sm:border border-white/10 sm:bg-slate-900/80 sm:p-3 sm:backdrop-blur-md sm:shadow-xl overflow-hidden flex flex-col mt-2.5 sm:mt-0">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Points & Waypoints</h4>
              <select
                className="bg-transparent text-[9px] font-bold text-white/60 outline-none border-none cursor-pointer"
                onChange={(e) => setProfile(e.target.value)}
                value={profile}
              >
                <option value="driving">Driving</option>
                <option value="cycling">Cycling</option>
                <option value="foot">Walking</option>
              </select>
            </div>

            <div className="flex-1 overflow-auto space-y-1.5 pr-1 custom-scrollbar">
              {/* Point A */}
              <div className="flex flex-col gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-blue-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg shadow-blue-500/20">A</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase text-blue-400">Titik A (Provider)</p>
                    <p className="text-[11px] font-mono text-white/90 truncate">{pointA ? `${pointA.lat.toFixed(5)}, ${pointA.lng.toFixed(5)}` : "Belum ditentukan"}</p>
                  </div>
                </div>

                <div className="flex gap-2 items-center mt-1">
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-blue-500/50"
                    onBlur={() => commitManualCoordinate("a")}
                    onChange={(e) => handleManualCoordinateChange("a", null, "lat", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("a")}
                    placeholder="Latitude"
                    value={manualInput["a-static-lat"] ?? (pointA?.lat ?? "")}
                  />
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-blue-500/50"
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
                  <div key={point.id} className="space-y-1.5">
                    {roadToThis && (
                      <div className="mx-6 flex items-center gap-2 border-l-2 border-dashed border-white/10 py-1 pl-4">
                        <span className="material-symbols-outlined text-[12px] text-sky-400">route</span>
                        <p className="text-[9px] font-medium text-white/40 truncate">{roadToThis.name}</p>
                        <span className="text-[8px] font-mono text-white/30 shrink-0">
                          {Number.isFinite(Number(roadToThis.distance)) && Number(roadToThis.distance) > 0
                            ? `${(Number(roadToThis.distance) / 1000).toFixed(2)} km`
                            : ""}
                        </span>
                      </div>
                    )}
                    
                    <div className="group flex flex-col gap-1.5 rounded-xl bg-white/5 border border-white/10 p-2.5 hover:border-primary/30 transition">
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
                            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition"
                            onClick={() => handleWaypointMove(point.id, "up")}
                            title="Pindahkan ke atas"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">keyboard_arrow_up</span>
                          </button>
                          <button
                            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition"
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

                      <div className="flex gap-2 items-center mt-1">
                        <input
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-emerald-500/50"
                          onBlur={() => commitManualCoordinate("waypoint", point.id)}
                          onChange={(e) => handleManualCoordinateChange("waypoint", point.id, "lat", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("waypoint", point.id)}
                          placeholder="Latitude"
                          value={manualInput[`waypoint-${point.id}-lat`] ?? point.lat}
                        />
                        <input
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-emerald-500/50"
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
                <div className="space-y-1.5">
                  {(() => {
                    const lastIndex = manualWaypoints.length;
                    const roadToB = plannerRoads.find(r => r.id === `manual-${lastIndex}` || r.id?.startsWith(`${lastIndex}-`));
                    if (!roadToB) return null;
                    
                    return (
                      <div className="mx-6 flex items-center gap-2 border-l-2 border-dashed border-white/10 py-1 pl-4">
                        <span className="material-symbols-outlined text-[12px] text-sky-400">route</span>
                        <p className="text-[9px] font-medium text-white/40 truncate">{roadToB.name}</p>
                        <span className="text-[8px] font-mono text-white/30 shrink-0">
                          {Number.isFinite(Number(roadToB.distance)) && Number(roadToB.distance) > 0
                            ? `${(Number(roadToB.distance) / 1000).toFixed(2)} km`
                            : ""}
                        </span>
                      </div>
                    );
                  })()}
                  
                  <div className="flex flex-col gap-1.5 rounded-xl bg-pink-500/10 border border-pink-500/20 p-2.5 mt-1">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-pink-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg shadow-pink-500/20">B</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase text-pink-400">Titik B (Pelanggan)</p>
                        <p className="text-[11px] font-mono text-white/90 truncate">{pointB ? `${pointB.lat.toFixed(5)}, ${pointB.lng.toFixed(5)}` : "Belum ditentukan"}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <input
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-pink-500/50"
                        onBlur={() => commitManualCoordinate("b")}
                        onChange={(e) => handleManualCoordinateChange("b", null, "lat", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitManualCoordinate("b")}
                        placeholder="Latitude"
                        value={manualInput["b-static-lat"] ?? (pointB?.lat ?? "")}
                      />
                      <input
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-pink-500/50"
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
                <div className="flex flex-col gap-1.5 rounded-xl bg-pink-500/10 border border-pink-500/20 p-2.5 mt-1">
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

            {/* Named Road Segments (from Valhalla) */}
            {namedPlannerRoads.length > 0 && (
              <div className="mt-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sky-400">Ruas Jalan</p>
                  <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-black text-sky-300">
                    {namedPlannerRoads.length} ruas
                  </span>
                </div>
                <div className="space-y-1 max-h-[140px] overflow-auto pr-1 custom-scrollbar">
                  {namedPlannerRoads.map((road, index) => (
                    <div
                      key={road.id ?? `named-road-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[13px] text-sky-400 shrink-0">route</span>
                        <p className="text-[10px] font-semibold text-white/90 truncate">{road.name}</p>
                      </div>
                      <span className="text-[9px] font-mono text-white/40 shrink-0">
                        {Number.isFinite(Number(road.distance)) && Number(road.distance) > 0
                          ? `${(Number(road.distance) / 1000).toFixed(2)} km`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 shrink-0">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <button
                  className="bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-black uppercase py-2.5 px-2.5 rounded-xl transition shadow-lg shadow-sky-900/20 disabled:opacity-50"
                  disabled={!canGenerateRoute || isCalculating}
                  onClick={() => void handleGenerateValhallaRoute()}
                  type="button"
                >
                  {isCalculating ? "Calculating..." : "1. Buat Jalur Valhalla"}
                </button>
                <button
                  className="bg-amber-500 hover:bg-amber-400 text-white text-[9px] font-black uppercase py-2.5 px-2.5 rounded-xl transition shadow-lg shadow-amber-900/20 disabled:opacity-50"
                  disabled={!canGenerateManualRoute || isCalculating}
                  onClick={handleGenerateManualRoute}
                  type="button"
                >
                  1. Buat Custom Jalur
                </button>
                <button
                  className="p-2.5 bg-white/5 border border-white/10 text-white/70 hover:text-white rounded-xl transition"
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
                2. Terapkan ke Draft Tenant
              </button>
            </div>
            <p className="mt-2 text-[10px] text-white/55">
              Set A, Set B, dan waypoint hanya menaruh titik. Garis baru muncul setelah Anda menekan tombol buat jalur, lalu hasilnya bisa diterapkan ke draft tenant.
            </p>
          </section>
        </div>
      </aside>

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
      <div className="absolute bottom-6 right-6 z-[800] flex flex-col gap-2 pointer-events-none transition-opacity duration-500" style={{ opacity: isSidebarOpen && window.innerWidth < 640 ? 0 : 1 }}>
        <div className="flex flex-col gap-1.5 p-2 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md pointer-events-auto">
          {BASEMAP_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition ${basemap === option.key ? "bg-primary border-primary text-white" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white"}`}
              onClick={() => setBasemap(option.key)}
              title={option.label}
            >
              <span className="material-symbols-outlined text-lg">
                {option.key === 'satellite' ? 'satellite_alt' : option.key === 'osm' ? 'map' : 'dark_mode'}
              </span>
            </button>
          ))}
        </div>
        <button className="w-10 h-10 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md text-white/70 hover:text-white transition pointer-events-auto" onClick={handleExportGeoJson} title="Export GeoJSON">
          <span className="material-symbols-outlined text-lg">download</span>
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
