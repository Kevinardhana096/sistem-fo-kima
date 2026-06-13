const crypto = require("crypto");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const applyCorsHeaders = (res) => {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    if (chunks.length === 0) {
      resolve({});
      return;
    }

    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (error) {
      reject(error);
    }
  });
  req.on("error", reject);
});

const secretsMatch = (providedSecret, expectedSecret) => {
  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  return providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

async function registerAccessHandler(req, res) {
  applyCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedSecret = String(process.env.REGISTER_SECRET_KEY || "").trim();
  if (!expectedSecret) {
    res.status(503).json({ error: "Register access is not configured." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const providedSecret = String(body?.secretKey || "").trim();

    if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
      res.status(401).json({ error: "Secret key tidak valid." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch {
    res.status(400).json({ error: "Payload tidak valid." });
  }
}

module.exports = registerAccessHandler;
