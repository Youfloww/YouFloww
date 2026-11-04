/**
 * The train ride's picture in the progress strip, drawn on a canvas each frame: the painted steam train
 * (public/img/strip/train.webp, wheel sprite included) rolling through the watercolour countryside
 * (scenery.webp, tiles seamlessly), with spinning wheels, a coupling rod, smoke puffs, telegraph poles and the
 * ride's progress bar with its stations. The train's place along the strip is the session's progress.
 */
export interface SceneAssets {
  train: HTMLImageElement;
  scenery: HTMLImageElement;
}

export interface SceneState {
  progress: number /*0..1*/;
  moving: boolean;
  dark: boolean;
  still: boolean /*reduced motion*/;
  color: string /*route colour css*/;
  stations: number[] /*0..1 positions*/;
}

export interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r0: number;
  r1: number;
}

export interface SceneMem {
  speed: number;
  dist: number;
  scroll: number;
  puffs: Puff[];
  puffClock: number;
}

export function newMem(): SceneMem {
  return {
    speed: 0,
    dist: 0,
    scroll: 0,
    puffs: [],
    puffClock: 0,
  };
}

const CARS: readonly [number, number][] = [
  [0, 194],
  [194, 385],
  [385, 635],
];

// [x, y, radius, carIndex]
const WHEELS: readonly [number, number, number, number][] = [
  [54, 156.6, 19.7, 0],
  [141.1, 156.3, 19.7, 0],
  [246.2, 156.3, 19.7, 1],
  [333, 156.3, 19.7, 1],
  [454.4, 147.2, 34.3, 2],
  [519.7, 151.8, 29.4, 2],
  [571.9, 159.4, 19.7, 2],
];

/** a puff's three lobes: [dx, dy, radius] as fractions of its size */
const PUFF_LOBES: readonly [number, number, number][] = [
  [0, 0, 0.62],
  [-0.5, 0.18, 0.46],
  [0.48, 0.22, 0.42],
];

const CHIMNEY_X = 576.4;
const CHIMNEY_Y = 4;
const WHEEL_SX = 637;
const WHEEL_SY = 2;
const WHEEL_SW = 96;

const bobs: [number, number, number] = [0, 0, 0];

function isImgReady(img: HTMLImageElement | undefined | null): boolean {
  return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (w <= 0 || h <= 0) return;
  const r = Math.min(h * 0.5, w * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

export function drawTrainScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
  st: SceneState,
  a: SceneAssets,
  m: SceneMem
): void {
  if (w <= 0 || h <= 0) return;

  const dtClamped = clamp(dt, 0, 0.1);
  const progress = clamp(st.progress, 0, 1);

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Speed & motion integration
  if (st.still) {
    m.speed = 0;
    m.puffs.length = 0;
    m.puffClock = 0;
  } else {
    const targetSpeed = st.moving ? 1 : 0;
    const alpha = 1 - Math.exp(-dtClamped / 0.8);
    m.speed += (targetSpeed - m.speed) * alpha;
    if (m.speed < 0.0001 && targetSpeed === 0) {
      m.speed = 0;
    }
  }

  const groundSpeed = 0.9 * h * m.speed;
  m.dist += groundSpeed * dtClamped;
  m.scroll += groundSpeed * 0.22 * dtClamped;

  // Layout metrics
  const trackH = Math.max(14, h * 0.17);
  const railY = h - trackH * 0.62;
  const sceneryH = railY + trackH * 0.2;

  // 1. Scenery
  if (isImgReady(a.scenery)) {
    const natW = a.scenery.naturalWidth;
    const natH = a.scenery.naturalHeight;
    const tileW = Math.max(16, Math.round(sceneryH * (natW / natH)));
    const stride = Math.max(1, tileW - 1);
    const offset = ((m.scroll % stride) + stride) % stride;

    for (let x = -offset; x < w; x += stride) {
      ctx.drawImage(a.scenery, Math.floor(x), 0, tileW, sceneryH);
    }
  } else {
    ctx.fillStyle = st.dark ? '#1c223a' : '#dfece6';
    ctx.fillRect(0, 0, w, sceneryH);
  }

  if (st.dark) {
    ctx.fillStyle = 'rgba(18,22,58,0.42)';
    ctx.fillRect(0, 0, w, sceneryH);
  }

  // 2. Telegraph poles (behind train)
  const poleSpacing = Math.max(24, 1.7 * h);
  const poleOffset = ((m.dist % poleSpacing) + poleSpacing) % poleSpacing;
  const firstPoleX = -poleOffset;
  const poleTopY = h * 0.45;
  const poleBotY = railY - trackH * 0.1;
  const crossbarY = poleTopY + (poleBotY - poleTopY) * 0.08;
  const crossbarHalfW = Math.max(4, h * 0.045);
  const sag = Math.max(4, h * 0.07);

  ctx.save();
  ctx.strokeStyle = st.dark ? '#2b1d14' : '#4a3222';
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let px = firstPoleX; px <= w + poleSpacing; px += poleSpacing) {
    // Vertical pole
    ctx.moveTo(px, poleBotY);
    ctx.lineTo(px, poleTopY);
    // Crossbar
    ctx.moveTo(px - crossbarHalfW, crossbarY);
    ctx.lineTo(px + crossbarHalfW, crossbarY);
  }
  ctx.stroke();

  // Sagging wires
  ctx.strokeStyle = st.dark ? 'rgba(30,24,20,0.65)' : 'rgba(65,48,36,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let px = firstPoleX; px < w + poleSpacing; px += poleSpacing) {
    const nx = px + poleSpacing;
    const midX = (px + nx) * 0.5;
    ctx.moveTo(px, crossbarY);
    ctx.quadraticCurveTo(midX, crossbarY + sag, nx, crossbarY);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Track & Ballast
  const ballastBottom = h - 5;
  if (ballastBottom > railY) {
    const grad = ctx.createLinearGradient(0, railY, 0, ballastBottom);
    if (st.dark) {
      grad.addColorStop(0, '#52473f');
      grad.addColorStop(1, '#2f2722');
    } else {
      grad.addColorStop(0, '#9b8b7a');
      grad.addColorStop(1, '#685849');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, railY, w, ballastBottom - railY);
  }

  // Wooden sleepers
  const sleeperW = Math.max(2, 0.05 * h);
  const sleeperGap = Math.max(4, 0.13 * h);
  const sleeperPeriod = sleeperW + sleeperGap;
  const sleeperOffset = ((m.dist % sleeperPeriod) + sleeperPeriod) % sleeperPeriod;
  const sleeperH = Math.max(2, (ballastBottom - railY) * 0.55);

  ctx.fillStyle = st.dark ? '#2b1b10' : '#472d1b';
  for (let sx = -sleeperOffset; sx < w + sleeperPeriod; sx += sleeperPeriod) {
    ctx.fillRect(sx, railY + 1, sleeperW, sleeperH);
  }

  // Two rails: 2px light steel at railY, 1px darker line just below
  ctx.fillStyle = st.dark ? '#9aa2ad' : '#d2d7df';
  ctx.fillRect(0, railY - 1, w, 2);
  ctx.fillStyle = st.dark ? '#383d47' : '#5c626b';
  ctx.fillRect(0, railY + 1, w, 1);

  // 4. Train
  const th = Math.min(h * 0.56, w * 0.17);
  const k = th / 180;
  const minNoseX = 250 * k + 6;
  const maxNoseX = w - 6;
  const noseX = minNoseX + (maxNoseX - minNoseX) * progress;
  const x0 = noseX - 635 * k;
  const y0 = railY - 180 * k;

  const basePhase = k > 0 ? m.dist / (30 * k) : 0;
  const bobAmp = st.still ? 0 : th * 0.012 * m.speed;

  bobs[0] = Math.sin(basePhase) * bobAmp;
  bobs[1] = Math.sin(basePhase + 1.7) * bobAmp;
  bobs[2] = Math.sin(basePhase * 2 + 3.4) * bobAmp * 1.25;

  if (isImgReady(a.train) && k > 0) {
    // Draw the 3 vehicle bodies
    for (let i = 0; i < 3; i++) {
      const sx0 = CARS[i][0];
      const sx1 = CARS[i][1];
      const sw = sx1 - sx0;
      const dx = x0 + sx0 * k;
      const dy = y0 + bobs[i];
      ctx.drawImage(a.train, sx0, 0, sw, 180, dx, dy, sw * k, 180 * k);
    }

    // Draw the 7 wheels on top of their respective vehicles
    const driverAngle = m.dist / (34.3 * k);
    for (let wi = 0; wi < WHEELS.length; wi++) {
      const [wx, wy, wr, carIdx] = WHEELS[wi];
      const cx = x0 + wx * k;
      const cy = y0 + wy * k + bobs[carIdx];
      const drawR = wr * k + 0.6;
      const angle = wi === 4 || wi === 5 ? driverAngle : m.dist / (wr * k);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(
        a.train,
        WHEEL_SX,
        WHEEL_SY,
        WHEEL_SW,
        WHEEL_SW,
        -drawR,
        -drawR,
        drawR * 2,
        drawR * 2
      );
      ctx.restore();
    }

    // Coupling rod for coupled driving wheels (indices 4 and 5)
    const crankR = 13 * k;
    const cosA = Math.cos(driverAngle);
    const sinA = Math.sin(driverAngle);

    const hub4x = x0 + WHEELS[4][0] * k;
    const hub4y = y0 + WHEELS[4][1] * k + bobs[2];
    const hub5x = x0 + WHEELS[5][0] * k;
    const hub5y = y0 + WHEELS[5][1] * k + bobs[2];

    const pin4x = hub4x + crankR * cosA;
    const pin4y = hub4y + crankR * sinA;
    const pin5x = hub5x + crankR * cosA;
    const pin5y = hub5y + crankR * sinA;

    ctx.save();
    ctx.lineCap = 'round';

    // Darker outline underneath (7*k + 2*1.5*k = 10*k total width)
    ctx.strokeStyle = '#5a3714';
    ctx.lineWidth = 10 * k;
    ctx.beginPath();
    ctx.moveTo(pin4x, pin4y);
    ctx.lineTo(pin5x, pin5y);
    ctx.stroke();

    // Inner brass/gold rod
    ctx.strokeStyle = '#e2b24e';
    ctx.lineWidth = 7 * k;
    ctx.beginPath();
    ctx.moveTo(pin4x, pin4y);
    ctx.lineTo(pin5x, pin5y);
    ctx.stroke();

    // Dark pin dot at each end (diameter 3*k -> radius 1.5*k)
    const pinDotR = 1.5 * k;
    ctx.fillStyle = '#3a220c';
    ctx.beginPath();
    ctx.arc(pin4x, pin4y, pinDotR, 0, Math.PI * 2);
    ctx.moveTo(pin5x + pinDotR, pin5y);
    ctx.arc(pin5x, pin5y, pinDotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Smoke puffs (after the train)
  if (!st.still) {
    // Update existing puffs
    const vyDecay = Math.exp(-1.6 * dtClamped);
    let writeIdx = 0;
    for (let i = 0; i < m.puffs.length; i++) {
      const p = m.puffs[i];
      p.age += dtClamped;
      if (p.age < p.life) {
        p.x += p.vx * dtClamped;
        p.y += p.vy * dtClamped;
        p.vy *= vyDecay;
        m.puffs[writeIdx++] = p;
      }
    }
    m.puffs.length = writeIdx;

    // Emit new puffs while m.speed > 0.05
    if (m.speed > 0.05) {
      const rate = 3.5 * m.speed;
      m.puffClock += dtClamped * rate;
      const chimX = x0 + CHIMNEY_X * k;
      const chimY = y0 + CHIMNEY_Y * k + bobs[2];

      while (m.puffClock >= 1) {
        m.puffClock -= 1;
        if (m.puffs.length >= 28) {
          m.puffs.shift();
        }
        m.puffs.push({
          x: chimX,
          y: chimY,
          vx: -groundSpeed * 0.5 - 6 + (Math.random() - 0.5) * 8,
          vy: -h * 0.34,
          age: 0,
          life: 2.1,
          r0: 0.07 * h,
          r1: 0.17 * h + Math.random() * 0.04 * h,
        });
      }
    }

    // Draw puffs: little cartoon clouds (three soft circles), a grey underside first, cream on top
    const baseRgb = st.dark ? '214,214,226' : '253,250,244';
    const rimRgb = st.dark ? '110,110,132' : '150,142,156';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < m.puffs.length; i++) {
        const p = m.puffs[i];
        const t = clamp(p.age / p.life, 0, 1);
        const r = p.r0 + (p.r1 - p.r0) * t;
        const alpha = 0.95 * Math.min(1, t * 14) * (1 - t) ** 1.4;
        if (alpha <= 0.01 || r <= 0.1) continue;
        // pass 0: a slightly bigger grey cloud set a touch lower, so the cream one on top has a soft shaded edge
        const dy = pass === 0 ? r * 0.12 : 0;
        const grow = pass === 0 ? 1.14 : 1;
        ctx.fillStyle = pass === 0 ? `rgba(${rimRgb},${(alpha * 0.55).toFixed(3)})` : `rgba(${baseRgb},${alpha.toFixed(3)})`;
        ctx.beginPath();
        for (let c = 0; c < 3; c++) {
          const cx = p.x + PUFF_LOBES[c][0] * r;
          const cy = p.y + PUFF_LOBES[c][1] * r + dy;
          const cr = r * PUFF_LOBES[c][2] * grow;
          ctx.moveTo(cx + cr, cy);
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  }

  // 6. Progress bar at the very bottom (y = h - 4)
  const barY = h - 4;
  const barH = 4;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  drawRoundedBar(ctx, 0, barY, w, barH);

  const fillW = w * progress;
  if (fillW > 0) {
    ctx.fillStyle = st.color;
    drawRoundedBar(ctx, 0, barY, fillW, barH);
  }

  // Station dots (5px diameter = 2.5px radius)
  const dotY = barY + barH * 0.5;
  const dotR = 2.5;
  for (let i = 0; i < st.stations.length; i++) {
    const sp = clamp(st.stations[i], 0, 1);
    const sx = clamp(sp * w, dotR, w - dotR);
    ctx.fillStyle = sp <= progress ? st.color : 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(sx, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}
