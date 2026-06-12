import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import LeafletRenderStabilizer from "./LeafletRenderStabilizer";

const KIMA_CENTER = [-5.0929568, 119.5018379];
const DEFAULT_ZOOM = 14;
const MAP_MIN_ZOOM = 11;
const MAP_MAX_ZOOM = 19;
const FIT_BOUNDS_MAX_ZOOM = 16;
const TILE_MAX_NATIVE_ZOOM = 19;
const KIMA_ICON = L.icon({
  iconUrl: "/logo-kima.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -36],
  className: "fo-kima-marker",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createEntryPointIcon(label, isDefault, logoUrl = "") {
  const color = isDefault ? "#f59e0b" : "#0ea5e9";
  const safeLabel = escapeHtml(label || "Titik Masuk ISP");
  const safeLogoUrl = String(logoUrl ?? "").trim();
  const inner = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="${safeLabel}" style="width:22px;height:22px;object-fit:contain;transform:rotate(45deg);" />`
    : '<span style="transform:rotate(45deg);font-size:10px;font-weight:800;color:white;">FO</span>';
  const background = safeLogoUrl ? "white" : color;

  return L.divIcon({
    className: "",
    html: `<div title="${safeLabel}" style="position:relative;width:28px;height:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));cursor:grab;">
      <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${background};border:2px solid ${color};display:flex;align-items:center;justify-content:center;overflow:hidden;">
        ${inner}
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
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, {
        maxZoom: FIT_BOUNDS_MAX_ZOOM,
        padding: [40, 40],
      });
    }
  }, [bounds, map]);
  return null;
}


export default function IspEntryPointMap({
  entryPoints = [],
  onAddPoint,
  onMovePoint,
  onEditPoint,
  onDeletePoint,
  readOnly = false,
  ispLogoUrl = "",
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
      onRequestClose={() => setIsFullscreen(false)}
      onRequestFullscreen={() => setIsFullscreen(true)}
      readOnly={readOnly}
      ispLogoUrl={ispLogoUrl}
    />
  );

  return (
    <>
      {renderMap()}
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[2050] bg-slate-950">
          <div className="absolute left-4 top-4 z-[1200] flex h-9 items-center rounded-xl border border-white/10 bg-slate-900/90 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl backdrop-blur-md">
            Peta Titik Masuk ISP
          </div>
          
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
  onRequestClose,
  onRequestFullscreen,
  readOnly,
  ispLogoUrl,
}) {
  const mapRef = useRef(null);

  return (
    <div className={`isp-mini-map relative overflow-hidden border border-white/10 ${fullscreen ? "h-dvh w-screen rounded-none" : "z-0 h-[320px] rounded-xl"}`}>
      {!readOnly && (
        <div className={`absolute z-[1000] flex items-center justify-center rounded-lg border border-white/10 bg-slate-900/90 text-[9px] font-bold text-white/60 backdrop-blur-sm shadow-xl transition-all ${fullscreen ? "top-4 left-1/2 -translate-x-1/2 h-9 px-4 w-max max-w-md" : "top-2 left-2 right-2 h-9 px-2.5"}`}>
          <span><span className="text-gold-accent">Klik peta</span> untuk tambah titik • <span className="text-sky-400">Drag marker</span> untuk pindah</span>
        </div>
      )}
      <div className={`absolute z-[1000] flex flex-col gap-2 ${fullscreen ? "top-4 right-4" : (!readOnly ? "top-14 right-2" : "top-2 right-2")}`}>
        {fullscreen && (
          <button
            className="group flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-rose-500 hover:text-white hover:border-rose-500"
            onClick={onRequestClose}
            title="Tutup layar penuh"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] transition-transform group-hover:rotate-90">close</span>
          </button>
        )}

        <div className="flex flex-col rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md shadow-lg overflow-hidden w-9">
          <button
            className="w-full h-9 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom In"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <div className="h-px bg-white/10 w-full" />
          <button
            className="w-full h-9 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom Out"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">remove</span>
          </button>
        </div>
      </div>

      <div className={`absolute z-[1000] flex flex-col gap-2 ${fullscreen ? "bottom-4 right-4" : "bottom-5 right-2"}`}>
        {!fullscreen && (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            onClick={onRequestFullscreen}
            title="Layar penuh"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">open_in_full</span>
          </button>
        )}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold-accent/30 bg-slate-900/80 text-gold-accent shadow-lg backdrop-blur-md transition hover:bg-gold-accent hover:text-[#0f141e]"
          onClick={() => mapRef.current?.flyTo(KIMA_CENTER, DEFAULT_ZOOM, { duration: 0.8 })}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">my_location</span>
        </button>
      </div>
      <MapContainer
        attributionControl={false}
        zoomControl={false}
        center={KIMA_CENTER}
        className="h-full w-full"
        maxZoom={MAP_MAX_ZOOM}
        minZoom={MAP_MIN_ZOOM}
        scrollWheelZoom
        wheelPxPerZoomLevel={90}
        zoom={DEFAULT_ZOOM}
        zoomSnap={0.5}
      >
        
        <TileLayer
          keepBuffer={4}
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          updateInterval={100}
          updateWhenIdle={false}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletRenderStabilizer
          onReady={(map) => { mapRef.current = map; }}
          refreshKey={`${fullscreen ? "fullscreen" : "mini"}-${entryPoints.length}-${bounds?.toBBoxString() ?? "empty"}`}
        />
        {bounds && <FitBounds bounds={bounds} />}
        {!readOnly && <ClickHandler onMapClick={onMapClick} />}
        <Marker icon={KIMA_ICON} position={KIMA_CENTER}>
          <Popup>Kawasan Industri Makassar (KIMA)</Popup>
        </Marker>
        {entryPoints.map((point) => {
          const lat = Number(point.latitude);
          const lng = Number(point.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const icon = createEntryPointIcon(point.label, point.isDefault, ispLogoUrl);
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
