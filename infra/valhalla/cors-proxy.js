const http = require('http');

const UPSTREAM_HOST = process.env.VALHALLA_UPSTREAM_HOST || 'localhost';
const UPSTREAM_PORT = Number(process.env.VALHALLA_UPSTREAM_PORT || 8003);

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const opts = { hostname: UPSTREAM_HOST, port: UPSTREAM_PORT, path: req.url, method: req.method, headers: req.headers };
  const proxy = http.request(opts, (upstream) => {
    res.writeHead(upstream.statusCode, { ...upstream.headers, 'Access-Control-Allow-Origin': '*' });
    upstream.pipe(res);
  });
  proxy.on('error', () => { res.writeHead(502); res.end('Bad Gateway'); });
  req.pipe(proxy);
}).listen(8002, () => console.log('CORS proxy for Valhalla on :8002 → :8003'));
