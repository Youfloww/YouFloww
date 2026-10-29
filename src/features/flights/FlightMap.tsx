/**
 * The live flight map: MapLibre GL (imported only here, inside the mode) on a globe with Sentinel-2 cloudless
 * imagery, the great-circle route, and the plane moving with the real timer. Removed on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
import { cn } from '@/lib/utils';
import { arc, along, bearing, flightAt, type Airport, type LngLat } from './geo';

export type CamView = 'follow' | 'overview';

interface Props {
  from: Airport;
  to: Airport;
  km: number;
  min: number;
  /** current progress 0..1 of the session (read every second) */
  getP: () => number;
  view: CamView;
  /** bump to re-centre on the plane */
  nonce: number;
  /** camera parked on the departure airport (boarding pass / takeoff) */
  parked?: boolean;
  onUserMove?: () => void;
  onFail?: () => void;
  className?: string;
}

const TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';

const line = (coords: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } });

/** Zoom that fits `km` into the smaller side of the screen. */
function fitZoom(km: number, el: HTMLElement) {
  const dim = Math.max(240, Math.min(el.clientWidth, el.clientHeight));
  return Math.min(7, Math.max(1.6, Math.log2((40075 * dim) / (512 * 1.7 * Math.max(km, 30)))));
}

function airportEl(a: Airport, kind: 'from' | 'to') {
  const el = document.createElement('div');
  el.className = 'ff-apt';
  el.innerHTML = `<span class="ff-apt-dot ${kind === 'to' ? 'ff-apt-to' : ''}"></span><span class="ff-apt-tag"><b></b> <i></i></span>`;
  el.querySelector('b')!.textContent = a.iata;
  el.querySelector('i')!.textContent = a.city;
  return el;
}

function planeEl() {
  const el = document.createElement('div');
  el.className = 'ff-plane';
  el.innerHTML = `<svg viewBox="-34 -34 68 68" width="46" height="46" aria-hidden="true"><g class="ff-plane-shadow" transform="translate(5 7)"><path d="M0 -30 C4 -30 5 -24 5 -18 L5 -6 L30 6 L30 11 L5 5 L4 20 L12 26 L12 30 L0 27 L-12 30 L-12 26 L-4 20 L-5 5 L-30 11 L-30 6 L-5 -6 L-5 -18 C-5 -24 -4 -30 0 -30 Z" fill="rgba(20,10,0,.35)"/></g><g stroke-linejoin="round" stroke-linecap="round"><path d="M0 -30 C4 -30 5 -24 5 -18 L5 -6 L30 6 L30 11 L5 5 L4 20 L12 26 L12 30 L0 27 L-12 30 L-12 26 L-4 20 L-5 5 L-30 11 L-30 6 L-5 -6 L-5 -18 C-5 -24 -4 -30 0 -30 Z" fill="#fffaf1" stroke="#5b3f2c" stroke-width="2.4"/><path d="M-3 -22 Q0 -25 3 -22" fill="none" stroke="#5b3f2c" stroke-width="2"/><path d="M5 -2 L28 8.5 M-5 -2 L-28 8.5" stroke="#e07a5f" stroke-width="2.6"/><path d="M0 21 L0 28" stroke="#e07a5f" stroke-width="2.4"/></g></svg>`;
  return el;
}

export default function FlightMap({ from, to, km, min, getP, view, nonce, parked, onUserMove, onFail, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const planeRef = useRef<Marker | null>(null);
  const userAt = useRef(0);
  const live = useRef({ getP, view, parked, onUserMove });
  live.current = { getP, view, parked, onUserMove };
  const [ready, setReady] = useState(false);

  // Build the map once per route
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let disposed = false;
    let tick: ReturnType<typeof setInterval> | null = null;
    let lastFlownAt = 0;
    let heading = bearing([from.lon, from.lat], along(from, to, 0.01));

    void (async () => {
      try {
        const [ml, worker] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'), import('maplibre-gl/dist/maplibre-gl.css')]);
        if (disposed) return;
        ml.setWorkerUrl(worker.default);
        const route = arc(from, to, 0, 1, 160);
        const map = new ml.Map({
          container: el,
          attributionControl: false,
          center: [from.lon, from.lat],
          zoom: 11.5,
          pitch: 30,
          maxPitch: 70,
          fadeDuration: 150,
          canvasContextAttributes: { antialias: true },
          style: {
            version: 8,
            projection: { type: 'globe' },
            sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
            sources: {
              s2: { type: 'raster', tiles: [TILES], tileSize: 256, maxzoom: 14 },
              route: { type: 'geojson', data: line(route) },
              flown: { type: 'geojson', data: line([route[0], route[0]]) },
            },
            layers: [
              { id: 'bg', type: 'background', paint: { 'background-color': '#5d6b5a' } },
              { id: 's2', type: 'raster', source: 's2', paint: { 'raster-saturation': 0.08, 'raster-contrast': 0.05 } },
              { id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff6ea', 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [1.2, 1.6] } },
              { id: 'flown-glow', type: 'line', source: 'flown', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffb38a', 'line-width': 9, 'line-blur': 7, 'line-opacity': 0.55 } },
              { id: 'flown', type: 'line', source: 'flown', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffe2c8', 'line-width': 3 } },
            ],
          },
        });
        mapRef.current = map;
        map.on('error', () => {
          /* a tile that didn't arrive (slow network) is fine: it retries on the next move */
        });
        map.on('movestart', (e) => {
          if ((e as { originalEvent?: Event }).originalEvent) {
            userAt.current = Date.now();
            live.current.onUserMove?.();
          }
        });

        new ml.Marker({ element: airportEl(from, 'from'), anchor: 'left', offset: [-7, 0] }).setLngLat([from.lon, from.lat]).addTo(map);
        new ml.Marker({ element: airportEl(to, 'to'), anchor: 'left', offset: [-7, 0] }).setLngLat([to.lon, to.lat]).addTo(map);
        const plane = new ml.Marker({ element: planeEl(), rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([from.lon, from.lat]).setRotation(heading).addTo(map);
        planeRef.current = plane;

        const cruiseAlt = flightAt(0.5, km, min).altM || 1;
        const followZoom = Math.min(7.6, fitZoom(km, el) + 1.6);

        const update = (force = false) => {
          if (document.hidden && !force) return;
          const p = live.current.getP();
          const st = flightAt(p, km, min);
          const pos = along(from, to, st.f);
          if (st.f < 0.999) heading = bearing(pos, along(from, to, Math.min(1, st.f + 0.003)));
          plane.setLngLat(pos).setRotation(heading);
          plane.getElement().classList.toggle('ff-plane-ground', st.altM < 50);
          const now = Date.now();
          if (force || now - lastFlownAt > 5000) {
            lastFlownAt = now;
            (map.getSource('flown') as GeoJSONSource | undefined)?.setData(line(st.f > 0 ? arc(from, to, 0, st.f, 160) : [route[0], route[0]]));
          }
          // gentle follow: re-centre when the plane drifts, zoom with the altitude
          const { view, parked } = live.current;
          if (view !== 'follow' || now - userAt.current < 20000 || map.isMoving()) return;
          const ground = parked ? 1 : Math.min(1, st.altM / cruiseAlt);
          const zoom = 12.2 + (followZoom - 12.2) * Math.pow(ground, 0.6);
          const c = map.project(pos);
          const off = Math.hypot(c.x - el.clientWidth / 2, c.y - el.clientHeight / 2) / Math.min(el.clientWidth, el.clientHeight);
          if (force || off > 0.1 || Math.abs(map.getZoom() - zoom) > 0.2)
            map.easeTo({ center: pos, zoom, pitch: parked ? 30 : 42, duration: force ? 0 : 3000, easing: (t) => t * (2 - t) });
        };

        map.once('load', () => {
          if (disposed) return;
          setReady(true);
          update(true);
        });
        tick = setInterval(() => update(), 1000);
      } catch (e) {
        console.warn('[flights] map unavailable', e);
        if (!disposed) onFail?.();
      }
    })();

    return () => {
      disposed = true;
      if (tick) clearInterval(tick);
      mapRef.current?.remove();
      mapRef.current = null;
      planeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.iata, to.iata, km, min]);

  // camera mode changes
  useEffect(() => {
    const map = mapRef.current;
    const el = box.current;
    if (!map || !el || !ready) return;
    userAt.current = 0;
    if (view === 'overview') overview(map, el, from, to, km);
    else {
      const pos = planeRef.current?.getLngLat();
      if (pos) map.easeTo({ center: pos, zoom: Math.min(7.6, fitZoom(km, el) + 1.6), pitch: 42, duration: 2200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, nonce, ready]);

  return (
    <div className={cn('ff-space absolute inset-0', className)}>
      {/* inline position: maplibre's own CSS would otherwise make the container position: relative (0 px tall) */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

function overview(map: MLMap, el: HTMLElement, from: Airport, to: Airport, km: number) {
  const mid = along(from, to, 0.5);
  map.easeTo({ center: mid, zoom: fitZoom(km, el) - 0.15, pitch: 0, bearing: 0, duration: 2200 });
}
