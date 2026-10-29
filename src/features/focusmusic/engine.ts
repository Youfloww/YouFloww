/**
 * Web Audio graph for focus music. Built on play(), closed on stop().
 *
 *   bed (looping buffer) -> bedGain ---------------------------+
 *                                                               v
 *   LFO (sine, rate Hz) -> depthGain -> amGain.gain  ;  bed -> amGain -> master -> out
 *   amGain.gain = (1 - depth/2) + (depth/2) * sin(2*pi*rate*t)   (always >= 1 - depth, never gated hard)
 *   optional: two sines L/R, 200 Hz and 200+rate Hz, very quiet (binaural beat)
 *
 * The sine LFO + depth cap + slow parameter ramps keep it smooth (no clicks, no harsh gating).
 */
import { MODES, TRACKS, type ModeId, type TrackId } from './modes';

const cache = new Map<string, ArrayBuffer>();

async function fetchBytes(src: string): Promise<ArrayBuffer> {
  let b = cache.get(src);
  if (!b) {
    const r = await fetch(src);
    if (!r.ok) throw new Error('track missing');
    b = await r.arrayBuffer();
    cache.set(src, b);
  }
  return b.slice(0);
}

export class FocusEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private am!: GainNode;
  private lfo!: OscillatorNode;
  private depthG!: GainNode;
  private src: AudioBufferSourceNode | null = null;
  private bin: { l: OscillatorNode; r: OscillatorNode; g: GainNode } | null = null;
  private token = 0;

  get running() {
    return !!this.ctx;
  }

  async start(o: { mode: ModeId; track: TrackId; intensity: number; volume: number; binaural: boolean }) {
    const my = ++this.token;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.am = ctx.createGain();
    this.am.connect(this.master);
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.depthG = ctx.createGain();
    this.lfo.connect(this.depthG).connect(this.am.gain);
    this.lfo.start();
    this.setMode(o.mode, o.intensity, true);
    this.setBinaural(o.binaural, o.mode);
    await ctx.resume();
    await this.loadTrack(o.track, true, my);
    if (my !== this.token || !this.ctx) return;
    this.setVolume(o.volume, 2.5);
  }

  private async loadTrack(id: TrackId, first: boolean, my = this.token) {
    const ctx = this.ctx;
    if (!ctx) return;
    const info = TRACKS.find((t) => t.id === id)!;
    const buf = await ctx.decodeAudioData(await fetchBytes(info.src));
    if (my !== this.token || this.ctx !== ctx) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.am);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = info.loopStart;
    s.loopEnd = info.loopEnd;
    s.connect(g);
    s.start(0, info.loopStart);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(info.gain, t + (first ? 1.2 : 2));
    const old = this.src;
    const oldG = (old as unknown as { _g?: GainNode } | null)?._g;
    (s as unknown as { _g: GainNode })._g = g;
    this.src = s;
    if (old && oldG) {
      oldG.gain.cancelScheduledValues(t);
      oldG.gain.setValueAtTime(oldG.gain.value, t);
      oldG.gain.linearRampToValueAtTime(0, t + 2);
      old.stop(t + 2.1);
    }
  }

  changeTrack(id: TrackId) {
    if (this.ctx) void this.loadTrack(id, false).catch(() => {});
  }

  setMode(mode: ModeId, intensity: number, instant = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const m = MODES.find((x) => x.id === mode)!;
    const depth = Math.min(0.6, m.maxDepth * intensity);
    const t = ctx.currentTime;
    const ramp = instant ? 0 : 0.6;
    this.lfo.frequency.cancelScheduledValues(t);
    this.lfo.frequency.setTargetAtTime(m.hz, t, ramp / 3 + 0.001);
    this.depthG.gain.setTargetAtTime(depth / 2, t, ramp / 3 + 0.001);
    this.am.gain.setTargetAtTime(1 - depth / 2, t, ramp / 3 + 0.001);
    if (this.bin) {
      this.bin.r.frequency.setTargetAtTime(200 + m.hz, t, 0.2);
    }
  }

  setVolume(v: number, secs = 0.15) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(Math.pow(v, 1.6) * 0.9, this.ctx.currentTime, secs / 3);
  }

  setBinaural(on: boolean, mode: ModeId) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.bin) {
      const hz = MODES.find((x) => x.id === mode)!.hz;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);
      const merge = ctx.createChannelMerger(2);
      const l = ctx.createOscillator();
      const r = ctx.createOscillator();
      l.frequency.value = 200;
      r.frequency.value = 200 + hz;
      l.connect(merge, 0, 0);
      r.connect(merge, 0, 1);
      merge.connect(g).connect(this.master);
      l.start();
      r.start();
      this.bin = { l, r, g };
    } else if (!on && this.bin) {
      const b = this.bin;
      this.bin = null;
      b.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => {
        try {
          b.l.stop();
          b.r.stop();
        } catch {
          /* closed */
        }
      }, 1000);
    }
  }

  /** Fade out, then close everything. */
  async stop(fast = false) {
    this.token++;
    const ctx = this.ctx;
    if (!ctx) return;
    this.ctx = null;
    this.src = null;
    this.bin = null;
    try {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setTargetAtTime(0, ctx.currentTime, fast ? 0.03 : 0.25);
      await new Promise((r) => setTimeout(r, fast ? 120 : 1000));
      await ctx.close();
    } catch {
      /* already closed */
    }
  }
}
