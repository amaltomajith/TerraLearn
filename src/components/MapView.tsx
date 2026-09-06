import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { loadLeaflet } from '@/lib/leaflet';
import { formatDistance } from '@/lib/saath/distance';
import { describeEnterprises } from '@/lib/saath/ifsMatrix';
import type { MapPointRow } from '@/lib/saath/types';

export interface MapViewProps {
  /** The pinned point. */
  value?: { lat: number; lng: number } | null;
  /** When provided, the map is in PICK mode: click + draggable marker emit a new point. */
  onChange?: (lat: number, lng: number) => void;
  onGeolocate?: () => void;
  isGeolocating?: boolean;
  /** Read-only neighbour markers (farmers / buyers) drawn as an overlay. */
  neighbours?: MapPointRow[];
  /** Called when a neighbour popup's "View profile" is clicked. */
  onNeighbourClick?: (farmerId: string) => void;
  initialView?: { center: [number, number]; zoom: number };
  fit?: 'value' | 'neighbours' | 'initial';
  locationLabel?: string;
  heightClass?: string;
  className?: string;
}

const WORLD_VIEW: { center: [number, number]; zoom: number } = { center: [20, 0], zoom: 2 };

function badgeDot(badge: string | null | undefined): string {
  if (!badge || badge === 'none') return '';
  const color = badge === 'gold' ? '#ca8a04' : badge === 'silver' ? '#64748b' : '#b45309';
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-left:4px"></span>`;
}

function markerHtml(p: MapPointRow): string {
  const dist = formatDistance(p.distance_m);
  return `
    <div style="font-family:Manrope,system-ui,sans-serif;min-width:180px">
      <div style="font-weight:700;color:#1A4D2E">${p.name}${badgeDot(p.badge)}</div>
      <div style="font-size:12px;color:#666">${p.village ?? ''}${dist ? ` · ${dist}` : ''}</div>
      <div style="font-size:12px;margin-top:4px">${
        p.role === 'buyer' ? 'Buyer' : describeEnterprises(p.enterprises)
      }</div>
      <button data-farmer-id="${p.id}" style="margin-top:6px;font-size:12px;color:#1A4D2E;font-weight:600;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">View profile</button>
    </div>`;
}

/**
 * Unified Leaflet map. Two independent capabilities:
 *  - pick a point (draggable pin) when `onChange` is set;
 *  - show read-only neighbour farmers/buyers when `neighbours` is set.
 * Both can be active at once (the simulator's farm picker uses both).
 */
export function MapView({
  value,
  onChange,
  onGeolocate,
  isGeolocating,
  neighbours,
  onNeighbourClick,
  initialView,
  fit,
  locationLabel,
  heightClass = 'h-[420px]',
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const neighbourLayerRef = useRef<any>(null);
  const readyRef = useRef(false);

  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const neighbourClickRef = useRef(onNeighbourClick);
  neighbourClickRef.current = onNeighbourClick;

  const pickMode = Boolean(onChange);

  // --- init once -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || mapRef.current) return;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const view = initialView ?? WORLD_VIEW;
      const map = L.map(containerRef.current, {
        center: view.center,
        zoom: view.zoom,
        minZoom: 2,
        scrollWheelZoom: true,
        maxBoundsViscosity: 1.0,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
        noWrap: true,
      }).addTo(map);

      const bounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
      map.setMaxBounds(bounds);
      map.on('drag', () => map.panInsideBounds(bounds, { animate: false }));

      map.on('click', (e: any) => {
        changeRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      neighbourLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      readyRef.current = true;

      syncMarker(L);
      syncNeighbours(L);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      neighbourLayerRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- pin marker --------------------------------------------------------
  function syncMarker(L: any) {
    const map = mapRef.current;
    if (!map) return;

    if (value) {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      } else {
        const marker = L.marker([value.lat, value.lng], { draggable: pickMode }).addTo(map);
        if (pickMode) {
          marker.on('dragend', () => {
            const p = marker.getLatLng();
            changeRef.current?.(p.lat, p.lng);
          });
        }
        markerRef.current = marker;
      }
      if (fit !== 'neighbours') {
        map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 10), { duration: 1.0 });
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }

  useEffect(() => {
    const L = (window as any).L;
    if (L && readyRef.current) syncMarker(L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, pickMode]);

  // --- neighbour overlay -------------------------------------------------
  function syncNeighbours(L: any) {
    const map = mapRef.current;
    const layer = neighbourLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const pts = neighbours ?? [];
    const latlngs: [number, number][] = [];

    for (const p of pts) {
      if (p.lat == null || p.lng == null) continue;
      latlngs.push([p.lat, p.lng]);
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: p.badge && p.badge !== 'none' ? 9 : 7,
        color: '#fff',
        weight: 2,
        fillColor: p.role === 'buyer' ? '#C1502E' : '#1A4D2E',
        fillOpacity: 0.95,
      }).bindPopup(markerHtml(p));

      marker.on('popupopen', (e: any) => {
        const btn: HTMLButtonElement | null = e.popup
          .getElement()
          ?.querySelector('button[data-farmer-id]');
        btn?.addEventListener('click', () => neighbourClickRef.current?.(p.id));
      });
      layer.addLayer(marker);
    }

    const shouldFit =
      fit === 'neighbours' || (fit === undefined && !value && latlngs.length > 1);
    if (shouldFit && latlngs.length > 0) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
    }
  }

  useEffect(() => {
    const L = (window as any).L;
    if (L && readyRef.current) syncNeighbours(L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighbours]);

  return (
    <div
      className={
        className ??
        `relative ${heightClass} bg-card rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60`
      }
    >
      <div ref={containerRef} className="h-full w-full" style={{ zIndex: 1 }} />

      {pickMode && (
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
          style={{ zIndex: 998 }}
        />
      )}

      {pickMode && onGeolocate && (
        <div className="absolute top-4 right-4 flex flex-col gap-2" style={{ zIndex: 1000 }}>
          <button
            onClick={onGeolocate}
            disabled={isGeolocating}
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 bg-white/85 dark:bg-card/90 px-3.5 text-sm font-semibold text-primary shadow-lg backdrop-blur-md transition-all hover:bg-white dark:hover:bg-card hover:shadow-xl active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            {isGeolocating ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Locating...
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>My location</span>
              </div>
            )}
          </button>
        </div>
      )}

      {pickMode && value && (
        <div className="absolute bottom-4 left-4" style={{ zIndex: 1000 }}>
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg border border-white/20 dark:border-border/40">
            {locationLabel && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Location
                </p>
                <p className="text-sm font-semibold text-foreground">{locationLabel}</p>
              </>
            )}
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {value.lat.toFixed(4)}° N, {value.lng.toFixed(4)}° E
            </p>
          </div>
        </div>
      )}

      {pickMode && !value && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-black/20 pointer-events-none"
          style={{ zIndex: 999 }}
        >
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-md px-6 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 border border-white/20 dark:border-border/40">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Drop a pin to begin</p>
              <p className="text-xs text-muted-foreground">Click anywhere on the map</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
