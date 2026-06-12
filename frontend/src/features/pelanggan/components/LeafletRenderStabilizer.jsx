import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const DEFAULT_SETTLE_DELAYS = [120, 320, 700];

export default function LeafletRenderStabilizer({
  onReady,
  refreshKey,
  settleDelays = DEFAULT_SETTLE_DELAYS,
}) {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);

  useEffect(() => {
    const container = map.getContainer();
    const timers = [];
    let animationFrame = null;
    let zoomSettleTimer = null;

    const refreshTiles = () => {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          layer.redraw();
        }
      });
    };

    const invalidate = (redrawTiles = false) => {
      map.invalidateSize({ debounceMoveend: true, pan: false });
      if (redrawTiles) {
        refreshTiles();
      }
    };

    const scheduleInvalidate = (delay, redrawTiles = false) => {
      const timer = window.setTimeout(() => invalidate(redrawTiles), delay);
      timers.push(timer);
      return timer;
    };

    invalidate();
    animationFrame = window.requestAnimationFrame(() => invalidate(true));
    settleDelays.forEach((delay) => scheduleInvalidate(delay, delay >= 700));

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => invalidate());
    resizeObserver?.observe(container);

    const intersectionObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            invalidate(true);
          }
        },
        { threshold: 0.1 },
      );
    intersectionObserver?.observe(container);

    const handleWindowResize = () => invalidate(true);
    const handleTransitionEnd = () => invalidate(true);
    const handleZoomSettled = () => {
      invalidate();
      if (zoomSettleTimer) {
        window.clearTimeout(zoomSettleTimer);
      }
      zoomSettleTimer = window.setTimeout(() => invalidate(true), 180);
    };

    window.addEventListener("resize", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleWindowResize);
    container.addEventListener("transitionend", handleTransitionEnd);
    map.on("zoomend viewreset", handleZoomSettled);

    return () => {
      if (animationFrame != null) {
        window.cancelAnimationFrame(animationFrame);
      }
      timers.forEach((timer) => window.clearTimeout(timer));
      if (zoomSettleTimer) {
        window.clearTimeout(zoomSettleTimer);
      }
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleWindowResize);
      container.removeEventListener("transitionend", handleTransitionEnd);
      map.off("zoomend viewreset", handleZoomSettled);
    };
  }, [map, refreshKey, settleDelays]);

  return null;
}
