import { useEffect, useRef } from 'react';
import { THEMES, usePrefs } from '@/store/prefs';
import { useTimer } from '@/store/timer';
import { prefersReducedMotion } from '@/lib/utils';

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

// Domain-warped fbm blending four palette colours, plus a soft grain.
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 c1,c2,c3,c4,bg;uniform float dark;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.6;
  float tt=t*.035;
  vec2 q=vec2(fbm(p+tt),fbm(p+vec2(5.2,1.3)-tt));
  vec2 w=vec2(fbm(p+3.*q+vec2(1.7,9.2)+tt*1.3),fbm(p+3.*q+vec2(8.3,2.8)-tt));
  float f=fbm(p+2.5*w);
  vec3 col=mix(c1,c2,smoothstep(.15,.85,f));
  col=mix(col,c3,smoothstep(.35,1.,length(q)));
  col=mix(col,c4,smoothstep(.45,1.,w.x)*.8);
  // soft light bloom near the top, gentle vignette
  col=mix(col,bg,.18+.22*smoothstep(.2,1.,uv.y)*(1.-dark));
  float v=smoothstep(1.25,.25,length(uv-vec2(.5,.45)));
  col*=mix(.82,1.,v);
  col+=(h(gl_FragCoord.xy+t)-.5)*.025;
  gl_FragColor=vec4(col,1.);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v || 'ffffff', 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function readPalette(mode: string): number[][] {
  const cs = getComputedStyle(document.documentElement);
  const get = (k: string) => hexToRgb(cs.getPropertyValue(k) || '#ffffff');
  const a = [get('--a1'), get('--a2'), get('--a3'), get('--a4'), get('--bg')];
  // Breaks tint the sky toward the break colour
  if (mode !== 'focus') {
    const tint = get(mode === 'short' ? '--break-short' : '--break-long');
    const dark = cs.getPropertyValue('color-scheme').includes('dark');
    const k = dark ? 0.28 : 0.4;
    a[1] = a[1].map((x, i) => x * (1 - k) + tint[i] * k) as [number, number, number];
    a[3] = a[3].map((x, i) => x * (1 - k * 0.7) + tint[i] * k * 0.7) as [number, number, number];
  }
  return a;
}

export function Aurora() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const theme = usePrefs((s) => s.theme);
  const mode = useTimer((s) => s.mode);
  const target = useRef<number[][] | null>(null);
  const dark = useRef(0);

  useEffect(() => {
    // wait a frame so the data-theme attribute is applied
    dark.current = THEMES.find((t) => t.id === theme)?.dark ? 1 : 0;
    const id = requestAnimationFrame(() => (target.current = readPalette(mode)));
    return () => cancelAnimationFrame(id);
  }, [theme, mode]);

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uR = u('r'), uT = u('t'), uDark = u('dark');
    const uC = ['c1', 'c2', 'c3', 'c4', 'bg'].map(u);

    const SCALE = 0.35; // it's a blurry gradient — render small, upscale for free
    const resize = () => {
      el.width = Math.max(2, Math.floor(innerWidth * SCALE));
      el.height = Math.max(2, Math.floor(innerHeight * SCALE));
      gl.viewport(0, 0, el.width, el.height);
    };
    resize();
    addEventListener('resize', resize);

    let cur = target.current ?? readPalette('focus');
    const t0 = performance.now() - Math.random() * 60000;
    let raf = 0;
    let last = 0;
    const still = prefersReducedMotion();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30fps is plenty for a slow gradient
      last = now;
      const tgt = target.current;
      if (tgt) cur = cur.map((c, i) => c.map((x, j) => x + (tgt[i][j] - x) * 0.06));
      gl.uniform2f(uR, el.width, el.height);
      gl.uniform1f(uT, still ? 12 : (now - t0) / 1000);
      gl.uniform1f(uDark, dark.current);
      uC.forEach((l, i) => gl.uniform3fv(l, cur[i]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <>
      {/* CSS fallback underneath (also what you see before WebGL warms up) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 20% 20%, var(--a1), transparent), radial-gradient(50% 50% at 80% 30%, var(--a2), transparent), radial-gradient(60% 60% at 50% 90%, var(--a3), transparent), var(--bg)',
        }}
      />
      <canvas ref={canvas} className="absolute inset-0 size-full" style={{ imageRendering: 'auto' }} aria-hidden />
    </>
  );
}
