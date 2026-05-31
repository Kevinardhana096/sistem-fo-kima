import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const KIMA_CENTER = [-5.0929568, 119.5018379];
const DEFAULT_ZOOM = 15;

function createEntryPointIcon(label, isDefault) {
  const color = isDefault ? "#f59e0b" : "#0ea5e9";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:28px;height:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));cursor:grab;">
      <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:10px;font-weight:800;color:white;">FO</span>
      </div>
    </div>`,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34],
  });
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ bounds }) {
  const map = useMap();
  useMemo(() => {
    if (bounds && bounds.isValid()) map.fitBounds(bounds);
  }, [bounds, map]);
  return null;
}

function MapCapture({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (onReady) onReady(map);
    map.invalidateSize();
    const container = map.getContainer();
    // Fix tiles not loading when map is below the fold
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) map.invalidateSize(); },
      { threshold: 0.1 },
    );
    io.observe(container);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => { io.disconnect(); ro.disconnect(); };
  }, [map, onReady]);
  return null;
}

export default function IspEntryPointMap({
  entryPoints = [],
  onAddPoint,
  onMovePoint,
  onEditPoint,
  onDeletePoint,
  readOnly = false,
}) {
  const mapRef = useRef(null);

  const bounds = useMemo(() => {
    const coords = entryPoints
      .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
      .map((p) => [Number(p.latitude), Number(p.longitude)]);
    if (coords.length === 0) return null;
    return L.latLngBounds(coords).pad(0.3);
  }, [entryPoints]);

  const handleMapClick = (lat, lng) => {
    if (readOnly) return;
    onAddPoint?.(lat.toFixed(6), lng.toFixed(6));
  };

  return (
    <div className="isp-mini-map relative rounded-xl overflow-hidden border border-white/10 h-[320px]">
      {!readOnly && (
        <div className="absolute top-2 left-2 right-2 z-[1000] rounded-lg bg-slate-900/90 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 text-[9px] font-bold text-white/60 text-center">
          <span className="text-gold-accent">Klik peta</span> untuk tambah titik • <span className="text-sky-400">Drag marker</span> untuk pindah
        </div>
      )}
      <button
        className="absolute bottom-5 right-2 z-[1000] w-8 h-8 rounded-lg border border-gold-accent/30 bg-slate-900/80 backdrop-blur-md text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition shadow-lg flex items-center justify-center"
        onClick={() => mapRef.current?.flyTo(KIMA_CENTER, DEFAULT_ZOOM, { duration: 0.8 })}
        title="Pusatkan ke KIMA"
        type="button"
      >
        <span className="material-symbols-outlined text-[12px]">my_location</span>
      </button>
      <MapContainer
        attributionControl={false}
        zoomControl={false}
        center={KIMA_CENTER}
        className="h-full w-full"
        scrollWheelZoom
        zoom={DEFAULT_ZOOM}
      >
        <ZoomControl position="topright" />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapCapture onReady={(map) => { mapRef.current = map; }} />
        {bounds && <FitBounds bounds={bounds} />}
        {!readOnly && <ClickHandler onMapClick={handleMapClick} />}
        {entryPoints.map((point) => {
          const lat = Number(point.latitude);
          const lng = Number(point.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const icon = createEntryPointIcon(point.label, point.isDefault);
          return (
            <Marker
              key={point.id}
              position={[lat, lng]}
              icon={icon}
              draggable={!readOnly}
              eventHandlers={{
                dragend(e) {
                  const pos = e.target.getLatLng();
                  onMovePoint?.(point.id, pos.lat.toFixed(6), pos.lng.toFixed(6));
                },
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[140px]">
                  <p className="font-bold text-slate-800">{point.label}</p>
                  <p className="text-slate-500 text-[10px]">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
                  {!readOnly && (
                    <div className="flex gap-2 pt-1">
                      <button type="button" className="text-[10px] font-bold text-blue-600 hover:underline" onClick={() => onEditPoint?.(point)}>Edit</button>
                      <button type="button" className="text-[10px] font-bold text-red-500 hover:underline" onClick={() => onDeletePoint?.(point.id)}>Hapus</button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
