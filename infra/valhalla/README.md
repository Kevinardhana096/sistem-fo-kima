## Valhalla Layout

- `entrypoint.sh`: bootstrap lokal untuk generate config, admin DB, timezone DB, tiles, lalu start service Valhalla
- `cors-proxy.js`: proxy HTTP/CORS yang menerima request browser di `:8002` dan meneruskan ke Valhalla upstream di `:8003`
- `data/`: input OSM extract, mis. `sulawesi.osm.pbf`
- `runtime/`: output generated Valhalla (`valhalla.json`, `tiles.tar`, `admins.sqlite`, `timezones.sqlite`)

Catatan: `sulawesi.osm.pbf` harus berupa file nyata yang bisa dibaca container Valhalla. Jangan gunakan symlink ke project lain, karena mount container tidak akan mengikuti path host di luar volume yang dipasang.

Untuk setup lokal via `docker compose`, browser tetap mengarah ke `http://localhost:8002` dan proxy akan meneruskan ke Valhalla upstream di `:8003`.

`data/` dan `runtime/` di-ignore dari Git agar repo tetap bersih.
