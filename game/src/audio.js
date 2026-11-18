// Synthesized WebAudio sound: no audio files. Engine hum, sirens, gunshots,
// a bass groove, and small UI blips. Everything is built from oscillators
// and filtered noise, started lazily on the first user gesture.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let grooveTimer = null;
  let muted = false;
  let grooveStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { return false; }
    return true;
  }

  function noiseBuffer() {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  const api = {
    get muted() { return muted; },
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      api.startEngine();
      api.startGroove();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startEngine() {
      if (!ensure() || engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    },
    setEngine(speed01, driving) {
      if (!engineOsc) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, t, 0.08);
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.06 : 0.015, t, 0.1);
      engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.1);
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 780;
        sirenLfo = ctx.createOscillator();
        sirenLfo.type = 'square';
        sirenLfo.frequency.value = 0.9;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 260;
        sirenLfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start(); sirenLfo.start();
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenLfo.stop(); } catch (e) {}
        sirenOsc = null; sirenLfo = null; sirenGain = null;
      }
    },
    shot() {
      if (!ensure()) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass'; filt.frequency.value = 900;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.2);
      // low thump under the crack
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.35, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 0.15);
    },
    thud() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.22);
    },
    blip(freq) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = freq || 660;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.2);
    },
    cash() {
      api.blip(880);
      setTimeout(() => api.blip(1320), 90);
    },
    startGroove() {
      if (!ensure() || grooveTimer) return;
      // Simple two-bar bass groove, 96 BPM, A minor-ish walk.
      const notes = [55, 0, 55, 65.41, 0, 55, 0, 49, 55, 0, 82.41, 0, 73.42, 0, 65.41, 49];
      const stepMs = 60000 / 96 / 2;
      grooveTimer = setInterval(() => {
        if (muted || !ctx) return;
        const f = notes[grooveStep % notes.length];
        grooveStep++;
        if (!f) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.11, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepMs / 1000 * 0.9);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + stepMs / 1000);
        // hat tick on off-beats
        if (grooveStep % 2 === 0) {
          const s = ctx.createBufferSource();
          s.buffer = noiseBuffer();
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass'; hp.frequency.value = 6000;
          const hg = ctx.createGain();
          hg.gain.setValueAtTime(0.03, t);
          hg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          s.connect(hp); hp.connect(hg); hg.connect(master);
          s.start(t); s.stop(t + 0.05);
        }
      }, stepMs);
    },
  };
  return api;
}
