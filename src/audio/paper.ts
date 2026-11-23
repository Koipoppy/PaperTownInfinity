// Procedural paper audio: flap, footsteps and a quiet wind bed. No audio files.
export class PaperAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private lastFlap = 0;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    const seconds = 1.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    // wind bed
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.016;
    wind.connect(lp).connect(windGain).connect(this.master);
    wind.start();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.08);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  flap(size: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const now = ctx.currentTime;
    if (now - this.lastFlap < 0.025) return;
    this.lastFlap = now;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.45;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800 + Math.random() * 900 + 700 / (0.4 + size);
    bp.Q.value = 0.7 + Math.random() * 0.9;

    const gain = ctx.createGain();
    const peak = Math.min(0.22, 0.05 + size * 0.045);
    const dur = 0.14 + Math.min(0.2, size * 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.8;

    src.connect(bp).connect(gain).connect(pan).connect(this.master);
    src.start(now, Math.random() * 0.7, dur + 0.02);

    // tiny crease crackle
    const crack = ctx.createBufferSource();
    crack.buffer = this.noise;
    crack.playbackRate.value = 1.6 + Math.random();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, now + 0.005);
    cg.gain.exponentialRampToValueAtTime(peak * 0.25, now + 0.012);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    crack.connect(hp).connect(cg).connect(pan);
    crack.start(now + 0.005, Math.random() * 0.8, 0.08);
  }

  step(run: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1.3 + Math.random() * 0.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420 + Math.random() * 180;
    const gain = ctx.createGain();
    const peak = run ? 0.045 : 0.03;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    src.connect(lp).connect(gain).connect(this.master);
    src.start(now, Math.random() * 0.8, 0.09);
  }

  get isMuted(): boolean {
    return this.muted;
  }
}
