/**
 * The view out of the train window: maplibre with Sentinel-2 cloudless satellite imagery draped over 3D terrain,
 * the camera riding along the real track and looking sideways. maplibre is imported here only, so it is
 * downloaded when a ride starts; the map is removed and the frame loop cancelled on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { headingAt, offset, pointAt, type RouteGeo } from './geo';
import type { Tod } from './tod';

const SAT = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const EXAGGERATION = 1.3;

export type MapState = 'loading' | 'ready' | 'error';

interface Props {
  geo: RouteGeo;
  /** where the train is now (km along the trip) */
  kmNow: () => number;
  /** km per second at the current session length (sets how high and how far the camera looks) */
  speed: number;
  side: 'L' | 'R';
  tod: Tod;
  /** false while another view covers the window: the frame loop stops */
  active: boolean;
  onState: (s: MapState) => void;
}

const lerpAngle = (a: number, b: number, t: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
};

export function WindowView({ geo, kmNow, speed, side, tod, active, onState }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const live = useRef({ kmNow, side, active, speed });
  live.current = { kmNow, side, active, speed };
  const [ready, setReady] = useState(false);
  const stateCb = useRef(onState);
  stateCb.current = onState;

  // create the map once per route
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let started = false;
    const cam = { brg: NaN, look: NaN, alt: NaN, last: 0 };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const m = map.current;
      if (!m || !live.current.active) return;
      const dt = cam.last ? Math.min(0.25, (t - cam.last) / 1000) : 0.016;
      if (t - cam.last < 15) return; // ~60 fps cap on fast screens
      cam.last = t;
      const { kmNow, side, speed } = live.current;
      const km = kmNow();
      const p = pointAt(geo, km);
      const span = Math.max(0.35, Math.min(6, speed * 5));
      const heading = headingAt(geo, km, span);
      cam.brg = Number.isNaN(cam.brg) ? heading : lerpAngle(cam.brg, heading, 1 - Math.exp(-dt / 1.4));
      const want = (cam.brg + (side === 'R' ? 90 : -90) + 360) % 360;
      cam.look = Number.isNaN(cam.look) ? want : lerpAngle(cam.look, want, 1 - Math.exp(-dt / 0.9));
      // high enough to see over the nearest ridge; higher still when the train is fast
      const h = Math.max(450, Math.min(1500, speed * 1000 * 3.2));
      let ground = m.queryTerrainElevation(p as [number, number]) ?? 0;
      for (const d of [0.35, 0.9]) ground = Math.max(ground - 40, m.queryTerrainElevation(offset(p, cam.look, d)) ?? 0);
      const target = ground + h;
      cam.alt = Number.isNaN(cam.alt) ? target : cam.alt + (target - cam.alt) * (1 - Math.exp(-dt / (target > cam.alt ? 0.5 : 2.2)));
      try {
        m.jumpTo(m.calculateCameraOptionsFromCameraLngLatAltRotation(p as [number, number], cam.alt, cam.look, h > 800 ? 70 : 72));
      } catch {
        /* a frame before the style is ready */
      }
    };
    const startLoop = () => {
      if (!raf && !document.hidden) {
        cam.last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const stopLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stopLoop() : startLoop());

    (async () => {
      try {
        const [ml, worker] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'), import('maplibre-gl/dist/maplibre-gl.css')]);
        // the worker sits next to maplibre's module, which bundlers move: point at it explicitly
        ml.setWorkerUrl(worker.default);
        if (!alive || !box.current) return;
        const p0 = pointAt(geo, live.current.kmNow());
        const m = new ml.Map({
          container: box.current,
          style: {
            version: 8,
            sources: {
              sat: { type: 'raster', tiles: [SAT], tileSize: 256, maxzoom: 13 },
              dem: { type: 'raster-dem', tiles: [DEM], tileSize: 256, maxzoom: 12, encoding: 'terrarium' },
            },
            layers: [
              { id: 'bg', type: 'background', paint: { 'background-color': '#9aa98d' } },
              { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 200, 'raster-contrast': 0.06 } },
            ],
            terrain: { source: 'dem', exaggeration: EXAGGERATION },
          },
          center: p0 as [number, number],
          zoom: 12,
          pitch: 70,
          maxPitch: 85,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
          pixelRatio: Math.min(devicePixelRatio || 1, 1.5),
          canvasContextAttributes: { antialias: false, powerPreference: 'low-power' },
        });
        map.current = m;
        m.on('error', () => {}); // a missing tile now and then is fine
        m.once('load', () => {
          if (!alive) return;
          setReady(true);
          startLoop();
          started = true;
          // reveal once the first terrain + imagery has arrived (or after a short wait)
          let shown = false;
          const show = () => {
            if (shown || !alive) return;
            shown = true;
            stateCb.current('ready');
          };
          m.once('idle', show);
          setTimeout(show, 4000);
        });
        document.addEventListener('visibilitychange', onVis);
      } catch (e) {
        console.warn('[train] window view failed', e);
        if (alive) stateCb.current('error');
      }
    })();

    return () => {
      alive = false;
      stopLoop();
      document.removeEventListener('visibilitychange', onVis);
      map.current?.remove();
      map.current = null;
      void started;
    };
  }, [geo]);

  // time of day: sky colours and a dimmer, cooler landscape at night
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    try {
      m.setSky({ 'sky-color': tod.sky, 'horizon-color': tod.horizon, 'fog-color': tod.fog, 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.35 });
      m.setPaintProperty('sat', 'raster-brightness-max', tod.bright);
      m.setPaintProperty('sat', 'raster-saturation', tod.sat);
    } catch {
      /* style not ready yet */
    }
  }, [tod, ready]);

  // maplibre's own CSS makes its container position: relative, so it gets a full-size box inside ours
  return (
    <div className="absolute inset-0" aria-hidden>
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
