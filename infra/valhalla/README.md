## Valhalla Layout

- `entrypoint.sh`: bootstrap lokal untuk generate config, admin DB, timezone DB, tiles, lalu start service Valhalla
- `data/`: input OSM extract, mis. `sulawesi.osm.pbf`
- `runtime/`: output generated Valhalla (`valhalla.json`, `tiles.tar`, `admins.sqlite`, `timezones.sqlite`)

`data/` dan `runtime/` di-ignore dari Git agar repo tetap bersih.
