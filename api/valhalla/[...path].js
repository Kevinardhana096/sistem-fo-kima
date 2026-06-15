const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_OPENROUTESERVICE_BASE_URL = "https://api.openrouteservice.org";
const OPENROUTESERVICE_GEOJSON_ACCEPT = "application/geo+json, application/json";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const normalizeOpenRouteServiceBaseUrl = (value) => {
  const baseUrl = normalizeBaseUrl(value) || DEFAULT_OPENROUTESERVICE_BASE_URL;
  return baseUrl.replace(/\/v2\/directions(?:\/.*)?$/i, "");
};

const getUpstreamBaseUrl = () => {
  const explicitUrl = normalizeBaseUrl(process.env.VALHALLA_UPSTREAM_URL);
  if (explicitUrl) return explicitUrl;

  const viteUrl = normalizeBaseUrl(process.env.VITE_VALHALLA_HOST);
  if (viteUrl && !viteUrl.startsWith("/")) return viteUrl;

  return "";
};

const getOpenRouteServiceConfig = () => {
  const apiKey = String(process.env.OPENROUTESERVICE_API_KEY || "").trim();
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: normalizeOpenRouteServiceBaseUrl(process.env.OPENROUTESERVICE_BASE_URL),
  };
};

const getPath = (req) => {
  const queryPath = req?.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join("/");
  if (typeof queryPath === "string") return queryPath;

  try {
    const parsed = new URL(req.url, "http://localhost");
    const parts = parsed.pathname.split("/").filter(Boolean);
    const p = parts[parts.length - 1];
    return String(p || "status");
  } catch {
    return "status";
  }
};

const readRequestBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});

const mapValhallaCostingToOpenRouteServiceProfile = (costing) => {
  if (costing === "bicycle") return "cycling-regular";
  if (costing === "pedestrian") return "foot-walking";
  return "driving-car";
};

const encodeSignedCoordinate = (value) => {
  let coordinate = value < 0 ? ~(value << 1) : value << 1;
  let output = "";

  while (coordinate >= 0x20) {
    output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
    coordinate >>= 5;
  }

  return output + String.fromCharCode(coordinate + 63);
};

const encodeValhallaShape = (coordinates, precision = 6) => {
  const factor = 10 ** precision;
  let previousLatitude = 0;
  let previousLongitude = 0;

  return (Array.isArray(coordinates) ? coordinates : []).map((coordinate) => {
    const longitude = Number(coordinate?.[0]);
    const latitude = Number(coordinate?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";

    const scaledLatitude = Math.round(latitude * factor);
    const scaledLongitude = Math.round(longitude * factor);
    const encoded = `${encodeSignedCoordinate(scaledLatitude - previousLatitude)}${encodeSignedCoordinate(scaledLongitude - previousLongitude)}`;

    previousLatitude = scaledLatitude;
    previousLongitude = scaledLongitude;

    return encoded;
  }).join("");
};

const buildOpenRouteServiceRequest = (valhallaRequest) => {
  const locations = Array.isArray(valhallaRequest?.locations) ? valhallaRequest.locations : [];
  const coordinates = locations.map((location) => {
    const latitude = Number(location?.lat);
    const longitude = Number(location?.lon ?? location?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return [longitude, latitude];
  });

  if (coordinates.length < 2 || coordinates.some((coordinate) => !coordinate)) {
    const error = new Error("Invalid route locations.");
    error.statusCode = 400;
    throw error;
  }

  return {
    profile: mapValhallaCostingToOpenRouteServiceProfile(valhallaRequest?.costing),
    body: {
      coordinates,
      instructions: true,
      units: "m",
    },
  };
};

const mapOpenRouteServiceToValhalla = (payload) => {
  const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
  const properties = feature?.properties || {};
  let geometryCoordinates = [];
  if (feature?.geometry?.type === "LineString") {
    geometryCoordinates = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [];
  } else if (feature?.geometry?.type === "MultiLineString") {
    geometryCoordinates = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates.flat(1) : [];
  } else {
    geometryCoordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
  }

  if (!feature && Array.isArray(payload?.routes)) {
    const error = new Error("OpenRouteService returned standard JSON instead of GeoJSON. Ensure the upstream endpoint supports /geojson.");
    error.statusCode = 502;
    throw error;
  }

  if (!feature || geometryCoordinates.length < 2) {
    const error = new Error(`OpenRouteService did not return valid geometry. Format: ${feature?.geometry?.type || "unknown"}`);
    error.statusCode = 502;
    throw error;
  }
  const summary = properties.summary || {};
  const segments = Array.isArray(properties.segments) ? properties.segments : [];
  const maneuvers = segments.flatMap((segment) => {
    const steps = Array.isArray(segment?.steps) ? segment.steps : [];
    return steps.map((step, index) => {
      const name = String(step?.name || "").trim() || "Tanpa nama jalan";
      return {
        type: Number(step?.type ?? 0),
        instruction: String(step?.instruction || "").trim() || "Ikuti jalur utama",
        street_names: [name],
        length: Number(step?.distance ?? 0) / 1000,
        time: Number(step?.duration ?? 0),
        begin_shape_index: Number(step?.way_points?.[0] ?? index),
        end_shape_index: Number(step?.way_points?.[1] ?? index),
      };
    });
  });

  return {
    trip: {
      status: 0,
      status_message: "Found route between points",
      units: "kilometers",
      summary: {
        length: Number(summary.distance ?? 0) / 1000,
        time: Number(summary.duration ?? 0),
      },
      legs: [
        {
          shape: encodeValhallaShape(geometryCoordinates),
          summary: {
            length: Number(summary.distance ?? 0) / 1000,
            time: Number(summary.duration ?? 0),
          },
          maneuvers,
        },
      ],
    },
  };
};

const handleOpenRouteServiceRoute = async ({ config, body, signal }) => {
  let valhallaRequest;
  try {
    valhallaRequest = JSON.parse(body.toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON request body.");
    error.statusCode = 400;
    throw error;
  }

  const request = buildOpenRouteServiceRequest(valhallaRequest);
  const upstreamResponse = await fetch(`${config.baseUrl}/v2/directions/${request.profile}/geojson`, {
    method: "POST",
    headers: {
      "Authorization": config.apiKey,
      "Content-Type": "application/json",
      "Accept": OPENROUTESERVICE_GEOJSON_ACCEPT,
    },
    body: JSON.stringify(request.body),
    signal,
  });

  const responseText = await upstreamResponse.text();
  let responseJson = null;
  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseJson = null;
  }

  if (!upstreamResponse.ok) {
    const error = new Error(responseJson?.error?.message || "OpenRouteService request failed.");
    error.statusCode = upstreamResponse.status;
    error.provider = "openrouteservice";
    error.providerStatus = upstreamResponse.status;
    throw error;
  }

  return mapOpenRouteServiceToValhalla(responseJson);
};

module.exports = async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "HEAD") {
    res.status(204).end();
    return;
  }

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const upstreamBaseUrl = req.forceOpenRouteService ? "" : getUpstreamBaseUrl();
  const openRouteServiceConfig = getOpenRouteServiceConfig();
  const path = getPath(req);

  if (!upstreamBaseUrl && path === "status" && openRouteServiceConfig) {
    res.status(200).json({ status: "ok", provider: "openrouteservice" });
    return;
  }

  if (!upstreamBaseUrl && !openRouteServiceConfig) {
    res.status(503).json({
      error: req.forceOpenRouteService ? "OpenRouteService is not configured." : "Valhalla upstream is not configured.",
      detail: req.forceOpenRouteService
        ? "Set OPENROUTESERVICE_API_KEY in Vercel production environment variables."
        : "Set VALHALLA_UPSTREAM_URL or OPENROUTESERVICE_API_KEY in Vercel production environment variables.",
    });
    return;
  }

  const queryIndex = req.url.indexOf("?");
  const queryString = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const body = req.method === "POST" ? await readRequestBody(req) : undefined;
    if (!upstreamBaseUrl) {
      if (path !== "route" || req.method !== "POST") {
        res.status(404).json({ error: "Route is not supported by the configured routing provider." });
        return;
      }

      const route = await handleOpenRouteServiceRoute({
        config: openRouteServiceConfig,
        body,
        signal: controller.signal,
      });
      res.status(200).json(route);
      return;
    }

    const upstreamUrl = `${upstreamBaseUrl}/${path}${queryString}`;
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
      },
      body,
      signal: controller.signal,
    });

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    res.status(upstreamResponse.status);
    res.setHeader("Content-Type", upstreamResponse.headers.get("content-type") || "application/json");
    res.send(responseBody);
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    const statusCode = error?.statusCode || (isTimeout ? 504 : 502);
    res.status(statusCode).json({
      error: isTimeout ? "Routing provider timed out." : error?.message || "Routing provider request failed.",
      provider: error?.provider,
      providerStatus: error?.providerStatus,
    });
  } finally {
    clearTimeout(timeout);
  }
};
