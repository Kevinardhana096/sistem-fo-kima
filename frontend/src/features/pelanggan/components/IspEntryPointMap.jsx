import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const KIMA_CENTER = [-5.0929568, 119.5018379];
const DEFAULT_ZOOM = 15;
const KIMA_ICON = L.icon({
  iconUrl: "/logo-kima.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -36],
  className: "fo-kima-marker",
});

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
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const renderMap = ({ fullscreen = false } = {}) => (
    <EntryPointMapSurface
      bounds={bounds}
      entryPoints={entryPoints}
      fullscreen={fullscreen}
      onCenterKima={() => {}}
      onDeletePoint={onDeletePoint}
      onEditPoint={onEditPoint}
      onMapClick={handleMapClick}
      onMovePoint={onMovePoint}
      onRequestFullscreen={() => setIsFullscreen(true)}
      readOnly={readOnly}
    />
  );

  return (
    <>
      {renderMap()}
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[220] bg-slate-950">
          <div className="absolute left-4 top-4 z-[1200] rounded-xl border border-white/10 bg-slate-900/90 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl backdrop-blur-md">
            Peta Titik Masuk ISP
          </div>
          <button
            className="absolute right-4 top-4 z-[1200] flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/90 text-white/70 shadow-2xl backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            onClick={() => setIsFullscreen(false)}
            title="Tutup layar penuh"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
          {renderMap({ fullscreen: true })}
        </div>,
        document.body,
      )}
    </>
  );
}

function EntryPointMapSurface({
  bounds,
  entryPoints,
  fullscreen,
  onDeletePoint,
  onEditPoint,
  onMapClick,
  onMovePoint,
  onRequestFullscreen,
  readOnly,
}) {
  const mapRef = useRef(null);

  return (
    <div className={`isp-mini-map relative overflow-hidden border border-white/10 ${fullscreen ? "h-dvh w-screen rounded-none" : "h-[320px] rounded-xl"}`}>
      {!readOnly && (
        <div className={`absolute z-[1000] rounded-lg border border-white/10 bg-slate-900/90 text-center text-[9px] font-bold text-white/60 backdrop-blur-sm shadow-xl transition-all ${fullscreen ? "top-4 left-1/2 -translate-x-1/2 px-4 py-2 w-max max-w-md" : "top-2 left-2 right-2 px-2.5 py-1.5"}`}>
          <span className="text-gold-accent">Klik peta</span> untuk tambah titik • <span className="text-sky-400">Drag marker</span> untuk pindah
        </div>
      )}
      <div className="absolute bottom-5 right-2 z-[1000] flex flex-col gap-2">
        {!fullscreen && (
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            onClick={onRequestFullscreen}
            title="Layar penuh"
            type="button"
          >
            <span className="material-symbols-outlined text-[13px]">open_in_full</span>
          </button>
        )}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-accent/30 bg-slate-900/80 text-gold-accent shadow-lg backdrop-blur-md transition hover:bg-gold-accent hover:text-[#0f141e]"
          onClick={() => mapRef.current?.flyTo(KIMA_CENTER, DEFAULT_ZOOM, { duration: 0.8 })}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-[12px]">my_location</span>
        </button>
      </div>
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
        {!readOnly && <ClickHandler onMapClick={onMapClick} />}
        <Marker icon={KIMA_ICON} position={KIMA_CENTER}>
          <Popup>Kawasan Industri Makassar (KIMA)</Popup>
        </Marker>
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
                <div className="min-w-[140px] space-y-1 text-xs">
                  <p className="font-bold text-slate-800">{point.label}</p>
                  <p className="text-[10px] text-slate-500">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
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
