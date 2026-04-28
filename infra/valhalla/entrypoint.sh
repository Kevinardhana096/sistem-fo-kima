#!/usr/bin/env bash
set -euo pipefail

DATA_ROOT="${VALHALLA_DATA_ROOT:-/data}"
GRAPH_ROOT="${VALHALLA_GRAPH_ROOT:-${DATA_ROOT}/valhalla}"
IMPORT_ROOT="${VALHALLA_IMPORT_ROOT:-/imports}"
PBF_FILE="${VALHALLA_PBF_FILE:-${IMPORT_ROOT}/sulawesi.osm.pbf}"
CONFIG_FILE="${VALHALLA_CONFIG_FILE:-${DATA_ROOT}/valhalla.json}"
TILE_DIR="${VALHALLA_TILE_DIR:-${GRAPH_ROOT}/tiles}"
TILE_EXTRACT="${VALHALLA_TILE_EXTRACT:-${GRAPH_ROOT}/tiles.tar}"
TIMEZONE_DB="${VALHALLA_TIMEZONE_DB:-${GRAPH_ROOT}/timezones.sqlite}"
ADMIN_DB="${VALHALLA_ADMIN_DB:-${GRAPH_ROOT}/admins.sqlite}"

reset_graph() {
  rm -rf "${GRAPH_ROOT}"
  rm -f "${CONFIG_FILE}"
}

build_config() {
  mkdir -p "${GRAPH_ROOT}" "${TILE_DIR}"
  valhalla_build_config \
    --mjolnir-tile-dir "${TILE_DIR}" \
    --mjolnir-tile-extract "${TILE_EXTRACT}" \
    --mjolnir-timezone "${TIMEZONE_DB}" \
    --mjolnir-admin "${ADMIN_DB}" \
    > "${CONFIG_FILE}.tmp"
  
  # Inject CORS allow origin using python
  python3 -c '
import json, sys
with open(sys.argv[1], "r") as f:
    config = json.load(f)
if "httpd" in config and "service" in config["httpd"]:
    config["httpd"]["service"]["cors_allow_origin"] = "*"
with open(sys.argv[1], "w") as f:
    json.dump(config, f, indent=2)
' "${CONFIG_FILE}.tmp"
  
  mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
}

build_tiles() {
  mkdir -p "${GRAPH_ROOT}" "${TILE_DIR}"

  if [ ! -f "${TIMEZONE_DB}" ]; then
    echo "Building Valhalla timezone database..."
    valhalla_build_timezones > "${TIMEZONE_DB}"
  fi

  if [ ! -f "${ADMIN_DB}" ]; then
    echo "Building Valhalla admin database..."
    valhalla_build_admins -c "${CONFIG_FILE}" "${PBF_FILE}"
  fi

  if [ ! -f "${TILE_EXTRACT}" ]; then
    echo "Building Valhalla routing tiles..."
    valhalla_build_tiles -c "${CONFIG_FILE}" "${PBF_FILE}"

    if command -v valhalla_build_extract >/dev/null 2>&1; then
      echo "Building Valhalla tile extract..."
      valhalla_build_extract -c "${CONFIG_FILE}" -v
    else
      echo "Packing Valhalla tile tarball..."
      find "${TILE_DIR}" | sort -n | tar cf "${TILE_EXTRACT}" --no-recursion -T -
    fi
  fi
}

if [ ! -f "${PBF_FILE}" ]; then
  echo "Valhalla input PBF not found: ${PBF_FILE}" >&2
  exit 1
fi

if [ "${VALHALLA_REBUILD:-0}" = "1" ]; then
  echo "VALHALLA_REBUILD=1, clearing existing Valhalla graph artifacts..."
  reset_graph
fi

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "Generating Valhalla config..."
  build_config
fi

build_tiles

echo "Starting Valhalla service on port 8002..."
exec valhalla_service "${CONFIG_FILE}" 1
