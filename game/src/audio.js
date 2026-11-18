// audio.js — synthesized WebAudio for Solmar Heat: no audio files, no
// network. Engine hum, two-tone siren, gunshots, chimes and a mission
// jingle, all built from oscillators and filtered noise. Every call is
// guarded: a missing or suspended AudioContext must never throw.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenTimer = 0;
    this.noiseBuf = null;
  }

  // Call from a user gesture (New Game click / first key). Safe to call
  // repeatedly; creates the context once.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (_e) {
      /* audio is decoration, never a crash */
    }
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    } catch (_e) {}
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (_e) {}
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch (_e) {}
  }

  shot() {
    this._noise(0.14, 0.5, 2400);
    this._tone(160, 0.1, 'square', 0.12, 60);
  }

  enemyShot() {
    this._noise(0.12, 0.22, 1600);
  }

  chime() {
    this._tone(880, 0.12, 'sine', 0.2);
    setTimeout(() => this._tone(1318, 0.18, 'sine', 0.2), 90);
  }

  thud() {
    this._tone(90, 0.16, 'sine', 0.35, 45);
    this._noise(0.1, 0.2, 500);
  }

  bust() {
    this._tone(220, 0.3, 'sawtooth', 0.2, 110);
    this._tone(330, 0.3, 'sawtooth', 0.14, 165);
  }

  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.22, 'triangle', 0.22), i * 110));
  }

  // Continuous engine drone while driving; pitch follows speed.
  engine(on, speedRatio) {
    if (!this.ctx) return;
    try {
      if (on && !this.muted) {
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineOsc.type = 'sawtooth';
          this.engineGain = this.ctx.createGain();
          this.engineGain.gain.value = 0.05;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 900;
          this.engineOsc.connect(filter);
          filter.connect(this.engineGain);
          this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        const r = speedRatio || 0;
        this.engineOsc.frequency.value = 55 + r * 110;
        this.engineGain.gain.value = 0.03 + r * 0.05;
      } else if (this.engineOsc) {
        this.engineOsc.stop();
        this.engineOsc = null;
        this.engineGain = null;
      }
    } catch (_e) {}
  }

  // Two-tone siren while the player is wanted. update() is called every
  // frame with dt; it flips tone every 0.45s.
  siren(on, dt) {
    if (!this.ctx) return;
    try {
      if (on && !this.muted) {
        if (!this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenOsc.type = 'triangle';
          this.sirenGain = this.ctx.createGain();
          this.sirenGain.gain.value = 0.045;
          this.sirenOsc.connect(this.sirenGain);
          this.sirenGain.connect(this.master);
          this.sirenOsc.start();
        }
        this.sirenTimer += dt || 0;
        if (this.sirenTimer > 0.45) {
          this.sirenTimer = 0;
          this.sirenHigh = !this.sirenHigh;
          this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 700;
        }
      } else if (this.sirenOsc) {
        this.sirenOsc.stop();
        this.sirenOsc = null;
        this.sirenGain = null;
      }
    } catch (_e) {}
  }

  stopAll() {
    try {
      this.engine(false, 0);
      this.siren(false, 0);
    } catch (_e) {}
  }
}
