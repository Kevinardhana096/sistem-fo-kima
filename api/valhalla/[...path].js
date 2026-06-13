const DEFAULT_TIMEOUT_MS = 15_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const getUpstreamBaseUrl = () => {
  const explicitUrl = normalizeBaseUrl(process.env.VALHALLA_UPSTREAM_URL);
  if (explicitUrl) return explicitUrl;

  const viteUrl = normalizeBaseUrl(process.env.VITE_VALHALLA_HOST);
  if (viteUrl && !viteUrl.startsWith("/")) return viteUrl;

  return "";
};

const getPath = (queryPath) => {
  if (Array.isArray(queryPath)) return queryPath.join("/");
  return String(queryPath || "status");
};

const readRequestBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});

module.exports = async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const upstreamBaseUrl = getUpstreamBaseUrl();
  if (!upstreamBaseUrl) {
    res.status(503).json({
      error: "Valhalla upstream is not configured.",
      detail: "Set VALHALLA_UPSTREAM_URL in Vercel production environment variables.",
    });
    return;
  }

  const path = getPath(req.query?.path);
  const queryIndex = req.url.indexOf("?");
  const queryString = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
  const upstreamUrl = `${upstreamBaseUrl}/${path}${queryString}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const body = req.method === "POST" ? await readRequestBody(req) : undefined;
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
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? "Valhalla upstream timed out." : "Valhalla upstream request failed.",
    });
  } finally {
    clearTimeout(timeout);
  }
};
