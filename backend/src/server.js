import http from "node:http";

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
    if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
                ok: true,
                service: "sistem-arsip-kima-backend",
                timestamp: new Date().toISOString(),
            })
        );
        return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
        JSON.stringify({
            message: "Backend is running",
            hint: "Use GET /api/health",
        })
    );
});

server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
