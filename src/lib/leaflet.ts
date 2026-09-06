// Shared runtime loader for Leaflet from the unpkg CDN.
// Leaflet is intentionally NOT an npm dependency (keeps the bundle small).
// Accessed as `window.L`. The single consumer is `src/components/MapView.tsx`.

const LEAFLET_VERSION = '1.9.4';
const CSS_HREF = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const JS_SRC = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let loaderPromise: Promise<any> | null = null;

/** Resolves to the Leaflet namespace (`window.L`), injecting the CDN assets once. */
export function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<any>((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      document.head.appendChild(link);
    }

    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).L));
      existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = JS_SRC;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Failed to load Leaflet from CDN'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
