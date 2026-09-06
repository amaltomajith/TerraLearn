import { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { formatDistance } from '@/lib/saath/distance';
import { describeEnterprises } from '@/lib/saath/ifsMatrix';
import type { MapPointRow } from '@/lib/saath/types';

/** A circular-agriculture connection between the current farmer and a neighbour. */
export interface IfsConnection {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  /** 'i_supply' = my output feeds their enterprise; 'i_need' = their output feeds mine. */
  direction: 'i_supply' | 'i_need';
  theirName: string;
  resources: string[];
}

export interface MapViewProps {
  /** The pinned point ([lat, lng]). */
  value?: { lat: number; lng: number } | null;
  /** When provided, the map is in PICK mode: click + draggable marker emit a new point. */
  onChange?: (lat: number, lng: number) => void;
  onGeolocate?: () => void;
  isGeolocating?: boolean;
  /** Read-only neighbour markers (farmers / buyers) drawn as an overlay. */
  neighbours?: MapPointRow[];
  /** Called when a neighbour popup's "View profile" is clicked. */
  onNeighbourClick?: (farmerId: string) => void;
  /** IFS circular-agriculture lines. Rendered behind the "IFS loops" toggle (off by default). */
  connections?: IfsConnection[];
  /** center is [lat, lng] (kept for call-site compatibility). */
  initialView?: { center: [number, number]; zoom: number };
  fit?: 'value' | 'neighbours' | 'initial';
  locationLabel?: string;
  heightClass?: string;
  className?: string;
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Esri — free, key-less, CORS-enabled raster tiles (same provider for both layers).
const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_REFERENCE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ESRI_STREETS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const STREET_ATTRIBUTION = 'Esri, HERE, Garmin, © OpenStreetMap contributors';

// Room for a Mapbox satellite basemap later: set VITE_MAPBOX_TOKEN and it takes over.
const satelliteTiles = MAPBOX_TOKEN
  ? [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=${MAPBOX_TOKEN}`]
  : [ESRI_IMAGERY];
const satelliteAttribution = MAPBOX_TOKEN
  ? '© Mapbox © Maxar'
  : 'Imagery © Esri, Maxar, Earthstar Geographics';

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: { type: 'raster', tiles: satelliteTiles, tileSize: 256, attribution: satelliteAttribution },
      'satellite-ref': { type: 'raster', tiles: [ESRI_REFERENCE], tileSize: 256, attribution: '' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b0f0c' } },
      { id: 'satellite-layer', type: 'raster', source: 'satellite' },
      {
        id: 'satellite-ref-layer',
        type: 'raster',
        source: 'satellite-ref',
        paint: { 'raster-opacity': 0.85 },
      },
    ],
  };
}

function badgeDot(badge: string | null | undefined): string {
  if (!badge || badge === 'none') return '';
  const color = badge === 'gold' ? '#ca8a04' : badge === 'silver' ? '#64748b' : '#b45309';
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-left:4px"></span>`;
}

function neighbourPopupHtml(p: Record<string, any>): string {
  let enterprises: string[] = [];
  try {
    enterprises = JSON.parse(p.enterprises || '[]');
  } catch {
    /* ignore */
  }
  const dist = formatDistance(p.distance_m);
  return `
    <div style="font-family:Manrope,system-ui,sans-serif;min-width:170px">
      <div style="font-weight:700;color:#1A4D2E">${p.name}${badgeDot(p.badge)}</div>
      <div style="font-size:12px;color:#666">${p.village ?? ''}${dist ? ` · ${dist}` : ''}</div>
      <div style="font-size:12px;margin-top:4px">${
        p.role === 'buyer' ? 'Buyer' : describeEnterprises(enterprises)
      }</div>
      <button data-farmer-id="${p.id}" style="margin-top:6px;font-size:12px;color:#1A4D2E;font-weight:600;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">View profile</button>
    </div>`;
}

/**
 * Unified map (MapLibre GL). Two independent capabilities:
 *  - pick a point (draggable pin) when `onChange` is set;
 *  - show read-only neighbour farmers/buyers + IFS loops when `neighbours` / `connections` are set.
 * Satellite (Esri World Imagery) by default; a layer control toggles basemap / farms / IFS.
 */
export function MapView({
  value,
  onChange,
  onGeolocate,
  isGeolocating,
  neighbours,
  onNeighbourClick,
  connections,
  initialView,
  fit,
  locationLabel,
  heightClass = 'h-[420px]',
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const neighbourClickRef = useRef(onNeighbourClick);
  neighbourClickRef.current = onNeighbourClick;

  const pickMode = Boolean(onChange);

  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<'satellite' | 'streets'>('satellite');
  const [showFarms, setShowFarms] = useState(true);
  const [showIfs, setShowIfs] = useState(false);

  const hasNeighbours = Array.isArray(neighbours);
  const hasConnections = Array.isArray(connections) && connections.length > 0;

  // --- init once --------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const iv = initialView;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(),
      center: iv ? [iv.center[1], iv.center[0]] : [20, 20],
      zoom: iv ? iv.zoom : 2,
      minZoom: 2,
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      map.on('error', (e: any) => console.error('[maplibre]', e?.sourceId || '', e?.error?.message || e));
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    map.on('load', () => {
      map.addSource('neighbours', { type: 'geojson', data: EMPTY_FC as any });
      map.addSource('ifs', { type: 'geojson', data: EMPTY_FC as any });

      map.addLayer({
        id: 'ifs-casing',
        type: 'line',
        source: 'ifs',
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.3 },
      });
      map.addLayer({
        id: 'ifs-line',
        type: 'line',
        source: 'ifs',
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: {
          'line-color': ['case', ['==', ['get', 'direction'], 'i_supply'], '#4C9A2A', '#C58A3B'],
          'line-width': 2.5,
          'line-opacity': 0.85,
          'line-dasharray': [2, 1.4],
        },
      });
      map.addLayer({
        id: 'neighbours-circle',
        type: 'circle',
        source: 'neighbours',
        paint: {
          'circle-radius': ['case', ['!=', ['get', 'badge'], 'none'], 8, 6],
          'circle-color': ['case', ['==', ['get', 'role'], 'buyer'], '#C1502E', '#1A4D2E'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      setReady(true);
    });

    map.on('click', (e) => {
      if (!changeRef.current) return;
      const layers = ['neighbours-circle'].filter((l) => map.getLayer(l));
      if (layers.length && map.queryRenderedFeatures(e.point, { layers }).length) return;
      changeRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('mouseenter', 'neighbours-circle', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'neighbours-circle', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', 'neighbours-circle', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      popupRef.current?.remove();
      const props = f.properties as Record<string, any>;
      const el = document.createElement('div');
      el.innerHTML = neighbourPopupHtml(props);
      el
        .querySelector('button[data-farmer-id]')
        ?.addEventListener('click', () => {
          neighbourClickRef.current?.(props.id);
          popupRef.current?.remove();
        });
      popupRef.current = new maplibregl.Popup({ offset: 14, maxWidth: '240px' })
        .setLngLat((f.geometry as any).coordinates)
        .setDOMContent(el)
        .addTo(map);
    });

    map.on('mouseenter', 'ifs-line', () => {
      map.getCanvas().style.cursor = 'help';
    });
    map.on('mouseleave', 'ifs-line', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', 'ifs-line', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const pr = f.properties as Record<string, any>;
      const msg =
        pr.direction === 'i_supply'
          ? `You supply <b>${pr.resources}</b> → ${pr.theirName}`
          : `${pr.theirName} supplies <b>${pr.resources}</b> → you`;
      const el = document.createElement('div');
      el.innerHTML = `<div style="font-family:Manrope,system-ui,sans-serif;font-size:12px;max-width:210px;line-height:1.4">${msg}</div>`;
      new maplibregl.Popup({ offset: 8, maxWidth: '230px' })
        .setLngLat(e.lngLat)
        .setDOMContent(el)
        .addTo(map);
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- basemap toggle ------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const sat = basemap === 'satellite';
    // Add the CARTO street source lazily the first time it's needed.
    if (!sat && !map.getLayer('street-layer')) {
      if (!map.getSource('street')) {
        map.addSource('street', {
          type: 'raster',
          tiles: [ESRI_STREETS],
          tileSize: 256,
          attribution: STREET_ATTRIBUTION,
        });
      }
      map.addLayer({ id: 'street-layer', type: 'raster', source: 'street' }, 'satellite-layer');
    }
    ['satellite-layer', 'satellite-ref-layer'].forEach(
      (l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', sat ? 'visible' : 'none'),
    );
    if (map.getLayer('street-layer')) {
      map.setLayoutProperty('street-layer', 'visibility', sat ? 'none' : 'visible');
    }
  }, [ready, basemap]);

  // --- farms / ifs visibility ----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer('neighbours-circle')) {
      map.setLayoutProperty('neighbours-circle', 'visibility', showFarms ? 'visible' : 'none');
    }
    ['ifs-line', 'ifs-casing'].forEach(
      (l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', showIfs ? 'visible' : 'none'),
    );
  }, [ready, showFarms, showIfs]);

  // --- pick marker ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (value) {
      if (!markerRef.current) {
        const m = new maplibregl.Marker({ draggable: pickMode, color: '#1A4D2E' })
          .setLngLat([value.lng, value.lat])
          .addTo(map);
        if (pickMode) {
          m.on('dragend', () => {
            const ll = m.getLngLat();
            changeRef.current?.(ll.lat, ll.lng);
          });
        }
        markerRef.current = m;
      } else {
        markerRef.current.setLngLat([value.lng, value.lat]);
      }
      if (fit !== 'neighbours') {
        map.flyTo({
          center: [value.lng, value.lat],
          zoom: Math.max(map.getZoom(), 10),
          duration: 900,
        });
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value?.lat, value?.lng, pickMode]);

  // --- neighbour overlay -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('neighbours') as GeoJSONSource | undefined;
    if (!ready || !map || !src) return;

    const feats = (neighbours ?? [])
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          name: p.name,
          village: p.village ?? '',
          role: p.role,
          badge: p.badge,
          distance_m: p.distance_m,
          enterprises: JSON.stringify(p.enterprises ?? []),
        },
      }));
    src.setData({ type: 'FeatureCollection', features: feats } as any);

    const wantFit =
      fit === 'neighbours' || (fit === undefined && !value && feats.length > 1);
    if (wantFit && feats.length) {
      const b = new maplibregl.LngLatBounds();
      feats.forEach((f) => b.extend(f.geometry.coordinates as [number, number]));
      map.fitBounds(b, { padding: 56, maxZoom: 13, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, neighbours]);

  // --- IFS connections -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('ifs') as GeoJSONSource | undefined;
    if (!ready || !map || !src) return;
    const feats = (connections ?? []).map((c) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [c.fromLng, c.fromLat],
          [c.toLng, c.toLat],
        ],
      },
      properties: {
        direction: c.direction,
        theirName: c.theirName,
        resources: c.resources.join(', '),
      },
    }));
    src.setData({ type: 'FeatureCollection', features: feats } as any);
  }, [ready, connections]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 text-xs font-semibold transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div
      className={
        className ??
        `relative ${heightClass} bg-card rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60`
      }
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* layer control */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1.5">
        <div className="flex rounded-lg overflow-hidden border border-white/20 bg-white/85 dark:bg-card/90 shadow-lg backdrop-blur-md">
          <button type="button" onClick={() => setBasemap('satellite')} className={chip(basemap === 'satellite')}>
            Satellite
          </button>
          <button type="button" onClick={() => setBasemap('streets')} className={chip(basemap === 'streets')}>
            Streets
          </button>
        </div>
        {(hasNeighbours || hasConnections) && (
          <div className="rounded-lg border border-white/20 bg-white/85 dark:bg-card/90 shadow-lg backdrop-blur-md px-2.5 py-1.5 space-y-1">
            {hasNeighbours && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer">
                <input type="checkbox" checked={showFarms} onChange={(e) => setShowFarms(e.target.checked)} className="accent-primary" />
                Farms
              </label>
            )}
            {hasConnections && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer">
                <input type="checkbox" checked={showIfs} onChange={(e) => setShowIfs(e.target.checked)} className="accent-primary" />
                IFS loops
              </label>
            )}
          </div>
        )}
      </div>

      {pickMode && (
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
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
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Location</p>
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
          className="absolute inset-0 flex items-center justify-center bg-black/10 dark:bg-black/25 pointer-events-none"
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
