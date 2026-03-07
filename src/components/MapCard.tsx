import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface MapCardProps {
  position: { lat: number; lng: number } | null;
  onPositionChange: (lat: number, lng: number) => void;
  onGeolocation: () => void;
  isGeolocating: boolean;
  locationLabel?: string;
}

export function MapCard({ position, onPositionChange, onGeolocation, isGeolocating, locationLabel }: MapCardProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const cbRef = useRef(onPositionChange);
  cbRef.current = onPositionChange;

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Dynamically load leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Dynamically load leaflet JS
    const loadLeaflet = () => {
      return new globalThis.Promise<void>((resolve) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !mapContainerRef.current) return;
      const L = (window as any).L;

      const map = L.map(mapContainerRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxBoundsViscosity: 1.0,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
        noWrap: true,
      }).addTo(map);

      // Restrict map bounds to prevent scrolling past the earth
      const bounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
      map.setMaxBounds(bounds);
      map.on('drag', () => map.panInsideBounds(bounds, { animate: false }));

      map.on('click', (e: any) => {
        cbRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      setMapLoaded(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    if (position) {
      if (markerRef.current) {
        markerRef.current.setLatLng([position.lat, position.lng]);
      } else {
        const marker = L.marker([position.lat, position.lng], { draggable: true }).addTo(mapInstanceRef.current);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          cbRef.current(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }
      mapInstanceRef.current.flyTo([position.lat, position.lng], 10, { duration: 1.2 });
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [position, mapLoaded]);

  return (
    <div className="relative h-[420px] bg-card rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60 animate-in fade-in slide-in-from-left-8 duration-700 delay-100 group">
      <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 1 }} />

      {/* Gradient overlay for better readability */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" style={{ zIndex: 998 }} />

      <div className="absolute top-4 right-4 flex flex-col gap-2" style={{ zIndex: 1000 }}>
        <button
          onClick={onGeolocation}
          disabled={isGeolocating}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 bg-white/85 dark:bg-card/90 px-3.5 text-sm font-semibold text-primary shadow-lg backdrop-blur-md transition-all hover:bg-white dark:hover:bg-card hover:shadow-xl active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          type="button"
        >
          {isGeolocating ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Locating...
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>My Location</span>
            </div>
          )}
        </button>
      </div>

      {position && (
        <div className="absolute bottom-4 left-4" style={{ zIndex: 1000 }}>
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg border border-white/20 dark:border-border/40">
            {locationLabel && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Location</p>
                <p className="text-sm font-semibold text-foreground">{locationLabel}</p>
              </>
            )}
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {position.lat.toFixed(4)}° N, {position.lng.toFixed(4)}° E
            </p>
          </div>
        </div>
      )}

      {!position && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-black/20 pointer-events-none" style={{ zIndex: 999 }}>
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
