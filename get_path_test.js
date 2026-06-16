const getPathFromUrl = (url) => {
  try {
    // Vercel raw node functions req.url might be just "/route" or "/api/ors/route"
    const parsed = new URL(url, "http://localhost");
    const parts = parsed.pathname.split("/").filter(Boolean);
    // if parts are ["api", "ors", "route"], we want "route"
    // if parts are ["api", "valhalla", "route"], we want "route"
    // if parts are ["route"], we want "route"
    let p = parts[parts.length - 1];
    return p || "status";
  } catch {
    return "status";
  }
};
console.log(getPathFromUrl("/api/ors/route"));
console.log(getPathFromUrl("/route?foo=bar"));
console.log(getPathFromUrl("/"));
