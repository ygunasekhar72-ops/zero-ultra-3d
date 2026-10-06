// ------------------------------------------------------------
// Sound director — fully synthesized (no assets), tuned like a
// product film mix:
//   master gain → compressor → out
//   • ambient bed: fridge hum + air (fades in with sound on)
//   • spin loop: bandpassed air whose pitch/volume follow the
//     can's real angular velocity, updated per frame
//   • foley: crack, fizz, whoosh, cart pop, UI ticks
//   • score: section whooshes, exploded servo, finale swell
// Muted until opted in (autoplay policy); choice is persisted.
// ------------------------------------------------------------

export function createSound() {
  let ctx = null;
  let master = null;
  let enabled = false;

  let ambGain = null;
  let spinGain = null;
  let spinFilter = null;

  function noiseBuffer(dur) {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return buf;
  }
  function noiseSrc(dur, loop = false) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    src.loop = loop;
    return src;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 7;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      comp.connect(ctx.destination);

      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(comp);

      // --- ambient bed ---
      ambGain = ctx.createGain();
      ambGain.gain.value = 0;
      ambGain.connect(master);
      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 52;
      const humG = ctx.createGain();
      humG.gain.value = 0.012;
      hum.connect(humG).connect(ambGain);
      hum.start();
      const air = noiseSrc(2.5, true);
      const airF = ctx.createBiquadFilter();
      airF.type = 'lowpass';
      airF.frequency.value = 320;
      const airG = ctx.createGain();
      airG.gain.value = 0.012;
      air.connect(airF).connect(airG).connect(ambGain);
      air.start();

      // --- spin-follow loop (volume/pitch track angular velocity) ---
      const spinSrc = noiseSrc(1.5, true);
      spinFilter = ctx.createBiquadFilter();
      spinFilter.type = 'bandpass';
      spinFilter.frequency.value = 500;
      spinFilter.Q.value = 0.9;
      spinGain = ctx.createGain();
      spinGain.gain.value = 0;
      spinSrc.connect(spinFilter).connect(spinGain).connect(master);
      spinSrc.start();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ---------- foley ----------

  function crack() {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    // snap
    const s1 = noiseSrc(0.05);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 2600; f1.Q.value = 1.4;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.55, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s1.connect(f1).connect(g1).connect(master);
    s1.start(t);
    // body thump
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 0.12);
  }

  function hiss() {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    for (const pan of [-0.35, 0.3]) {
      const src = noiseSrc(1.6);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 3400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(hp).connect(g);
      if (p) { p.pan.value = pan; g.connect(p).connect(master); }
      else g.connect(master);
      src.start(t); src.stop(t + 1.65);
    }
  }

  function whoosh(dur = 0.8, level = 0.09) {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const src = noiseSrc(dur + 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(1050, t + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(280, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function servo() {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    for (const [dt, f0, f1] of [[0, 950, 320], [0.14, 780, 240]]) {
      const src = noiseSrc(0.22);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(f0, t + dt);
      bp.frequency.exponentialRampToValueAtTime(f1, t + dt + 0.2);
      bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.2, t + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
      src.connect(bp).connect(g).connect(master);
      src.start(t + dt); src.stop(t + dt + 0.25);
    }
  }

  function pop() {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.13);
    const s = noiseSrc(0.04);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2000;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.18, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f).connect(sg).connect(master);
    s.start(t);
  }

  function tick() {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.035);
  }

  function swell() {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    for (const f of [174, 220, 261]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(lp).connect(g).connect(master);
      o.start(t); o.stop(t + 2.9);
    }
  }

  // ---------- state ----------

  function setEnabled(v) {
    enabled = v;
    if (v) ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(v ? 0.85 : 0, t + 0.25);
    ambGain.gain.linearRampToValueAtTime(v ? 1 : 0, t + 0.9);
  }

  function setSpin(radPerSec) {
    if (!ctx || !enabled) return;
    const s = Math.abs(radPerSec);
    const g = Math.min(0.15, s * 0.022);
    spinGain.gain.setTargetAtTime(g, ctx.currentTime, 0.09);
    spinFilter.frequency.setTargetAtTime(
      420 + Math.min(1500, s * 55), ctx.currentTime, 0.12,
    );
  }

  function section(i) {
    if (!enabled) return;
    if (i === 4) servo();               // exploded view
    else if (i === 6) swell();          // finale
    else whoosh(0.55 + i * 0.06, 0.06);
  }

  return {
    crack, hiss, whoosh, servo, pop, tick, swell, section, setSpin,
    setEnabled, isEnabled: () => enabled,
  };
}
