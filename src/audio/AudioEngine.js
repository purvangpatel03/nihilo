import { clamp, lerp } from '../lib/math.js';

// Fully generative sound — no samples. An evolving drone chord, a swelling
// sub, filtered "air", sparkle events when stars ignite, and a Big-Bang
// impact built from a pitch-dropping boom + a reverberant noise roar.
// Everything is steered by scroll progress so audio and image move as one.

const A1 = 55; // Hz
const semi = (s) => A1 * Math.pow(2, s / 12);

// Chord palette across the journey (semitone offsets from A1, six voices).
const CHORDS = {
  void: [0, 7, 12, 19, 26, 31],
  open: [0, 7, 14, 19, 26, 33],
  warm: [0, 7, 16, 19, 23, 28],
  lush: [0, 9, 16, 19, 23, 28],
  tense: [0, 6, 13, 16, 19, 25],
  resolve: [0, 7, 12, 19, 24, 28],
};

const chordForProgress = (p) => {
  if (p < 0.11) return CHORDS.void;
  if (p < 0.45) return CHORDS.open;
  if (p < 0.69) return CHORDS.warm;
  if (p < 0.81) return CHORDS.lush;
  if (p < 0.92) return CHORDS.tense;
  return CHORDS.resolve;
};

const PENTA = [0, 3, 5, 7, 10, 12, 15]; // for sparkles, relative to a high root

export default class AudioEngine {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.started = false;
    this.ctx = null;
    this._chordKey = null;
    this._sparkleTimer = 0;
    this._progress = 0;
  }

  async start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        /* ignore */
      }
    }
    this._build();
    this.started = true;
    this.ready = true;
    // Gentle fade-in of the bed.
    const now = this.ctx.currentTime;
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.exponentialRampToValueAtTime(0.6, now + 3.0);
  }

  _build() {
    const ctx = this.ctx;

    // Master chain: master -> limiter -> destination
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;

    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // Reverb send bus
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.6, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.9;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);

    // Drone bus with a moving lowpass
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 220;
    this.droneFilter.Q.value = 0.9;
    this.droneBus = ctx.createGain();
    this.droneBus.gain.value = 0.5;
    this.droneFilter.connect(this.droneBus);
    this.droneBus.connect(this.master);
    this.droneBus.connect(this.reverbSend);

    // Slow cutoff LFO for life
    this.cutoffLfo = ctx.createOscillator();
    this.cutoffLfoGain = ctx.createGain();
    this.cutoffLfo.frequency.value = 0.07;
    this.cutoffLfoGain.gain.value = 90;
    this.cutoffLfo.connect(this.cutoffLfoGain);
    this.cutoffLfoGain.connect(this.droneFilter.frequency);
    this.cutoffLfo.start();

    // Six drone voices, each two slightly-detuned oscillators.
    this.voices = [];
    const chord = CHORDS.void;
    for (let i = 0; i < 6; i++) {
      const vGain = ctx.createGain();
      vGain.gain.value = 0.0;
      vGain.connect(this.droneFilter);

      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = i % 2 === 0 ? 'sine' : 'triangle';
      b.type = 'sine';
      const f = semi(chord[i]);
      a.frequency.value = f;
      b.frequency.value = f;
      a.detune.value = -6;
      b.detune.value = 7;
      a.connect(vGain);
      b.connect(vGain);
      a.start();
      b.start();

      // tremolo
      const trem = ctx.createOscillator();
      const tremGain = ctx.createGain();
      trem.frequency.value = 0.05 + i * 0.017;
      tremGain.gain.value = 0.12;
      trem.connect(tremGain);
      tremGain.connect(vGain.gain);
      trem.start();

      this.voices.push({ a, b, vGain, base: 0.16 });
    }

    // Sub layer
    this.sub = ctx.createOscillator();
    this.subGain = ctx.createGain();
    this.sub.type = 'sine';
    this.sub.frequency.value = semi(-12); // A0-ish
    this.subGain.gain.value = 0.0;
    this.sub.connect(this.subGain);
    this.subGain.connect(this.master);
    this.sub.start();

    // Air (filtered noise)
    this.airSrc = ctx.createBufferSource();
    this.airSrc.buffer = this._noise(4);
    this.airSrc.loop = true;
    this.airFilter = ctx.createBiquadFilter();
    this.airFilter.type = 'bandpass';
    this.airFilter.frequency.value = 900;
    this.airFilter.Q.value = 0.6;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0.0;
    this.airSrc.connect(this.airFilter);
    this.airFilter.connect(this.airGain);
    this.airGain.connect(this.master);
    this.airGain.connect(this.reverbSend);
    this.airSrc.start();

    this._applyChord(CHORDS.void, 0.01);
    this._chordKey = 'void';
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  _noise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _applyChord(chord, glide = 0.9) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < this.voices.length; i++) {
      const f = semi(chord[i]);
      const v = this.voices[i];
      v.a.frequency.setTargetAtTime(f, now, glide);
      v.b.frequency.setTargetAtTime(f, now, glide);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const target = muted ? 0.0001 : 0.6;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, 0.25);
  }

  // The moment. Built to be felt in the chest, not just heard.
  triggerBang() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1) Boom — a sine dropping in pitch with a punchy body.
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(140, t);
    boom.frequency.exponentialRampToValueAtTime(32, t + 1.6);
    boomGain.gain.setValueAtTime(0.0001, t);
    boomGain.gain.exponentialRampToValueAtTime(1.4, t + 0.015);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    boom.connect(boomGain);
    boomGain.connect(this.master);
    boomGain.connect(this.reverbSend);
    boom.start(t);
    boom.stop(t + 2.8);

    // 2) Sub thump underneath.
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(60, t);
    thump.frequency.exponentialRampToValueAtTime(24, t + 1.2);
    thumpGain.gain.setValueAtTime(0.0001, t);
    thumpGain.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    thump.connect(thumpGain);
    thumpGain.connect(this.master);
    thump.start(t);
    thump.stop(t + 2.3);

    // 3) Roar — white noise through a downward-sweeping lowpass, huge reverb.
    const roar = ctx.createBufferSource();
    roar.buffer = this._noise(3);
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.setValueAtTime(9000, t);
    roarFilter.frequency.exponentialRampToValueAtTime(180, t + 2.2);
    roarFilter.Q.value = 1.2;
    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.0001, t);
    roarGain.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
    roarGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    roar.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(this.master);
    roarGain.connect(this.reverbSend);
    roar.start(t);
    roar.stop(t + 3.0);

    // 4) Crack — a short bright transient on top.
    const crack = ctx.createBufferSource();
    crack.buffer = this._noise(0.4);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 2600;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.5, t);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.master);
    crackGain.connect(this.reverbSend);
    crack.start(t);
    crack.stop(t + 0.4);

    // 5) Open the drone up — the universe exhales.
    this.droneFilter.frequency.cancelScheduledValues(t);
    this.droneFilter.frequency.setValueAtTime(300, t);
    this.droneFilter.frequency.exponentialRampToValueAtTime(2600, t + 2.5);
  }

  // A bright bell for star ignition / galaxy shimmer.
  _sparkle() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const root = 24 + 12; // ~ two octaves up
    const note = root + PENTA[Math.floor(Math.random() * PENTA.length)] + (Math.random() < 0.3 ? 12 : 0);
    const f = semi(note);

    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    carrier.type = 'sine';
    mod.type = 'sine';
    carrier.frequency.value = f;
    mod.frequency.value = f * 2.01;
    modGain.gain.value = f * 1.4;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    carrier.connect(g);
    g.connect(this.master);
    g.connect(this.reverbSend);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + 1.7);
    mod.stop(t + 1.7);
  }

  // Called every frame with journey progress.
  render(p, dt) {
    this._progress = p;
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Chord changes
    const chord = chordForProgress(p);
    const key = Object.keys(CHORDS).find((k) => CHORDS[k] === chord);
    if (key !== this._chordKey) {
      this._applyChord(chord, 1.1);
      this._chordKey = key;
    }

    // Voice level: quiet & sparse in the void, full after birth.
    const bedIntensity = p < 0.11 ? lerp(0.35, 0.6, p / 0.11) : lerp(0.85, 1.0, clamp((p - 0.11) / 0.4, 0, 1));
    for (const v of this.voices) {
      v.vGain.gain.setTargetAtTime(v.base * bedIntensity, now, 0.5);
    }

    // Filter opening across the journey (with a dip during collision tension).
    let cutoff;
    if (p < 0.11) cutoff = lerp(160, 240, p / 0.11);
    else if (p < 0.69) cutoff = lerp(500, 3200, clamp((p - 0.11) / 0.58, 0, 1));
    else if (p < 0.81) cutoff = 3400;
    else if (p < 0.92) cutoff = lerp(3400, 1400, clamp((p - 0.81) / 0.11, 0, 1));
    else cutoff = lerp(1400, 2200, clamp((p - 0.92) / 0.08, 0, 1));
    this.droneFilter.frequency.setTargetAtTime(cutoff, now, 0.4);

    // Sub: heavy tension in the void, weighty through the bang, settles.
    let subLvl;
    if (p < 0.11) subLvl = lerp(0.15, 0.42, p / 0.11);
    else if (p < 0.2) subLvl = 0.5;
    else subLvl = lerp(0.4, 0.12, clamp((p - 0.2) / 0.8, 0, 1));
    this.subGain.gain.setTargetAtTime(subLvl, now, 0.5);

    // Air: builds and brightens with the cosmos.
    const airLvl = clamp(lerp(0.02, 0.26, p), 0, 0.3);
    this.airGain.gain.setTargetAtTime(airLvl, now, 0.6);
    this.airFilter.frequency.setTargetAtTime(lerp(500, 3200, p), now, 0.6);

    // Reverb more spacious in void & first light, tighter in dense eras.
    const rev = p < 0.11 ? 0.5 : p < 0.45 ? 0.28 : p < 0.69 ? 0.42 : 0.34;
    this.reverbSend.gain.setTargetAtTime(rev, now, 0.6);

    // Sparkles during star birth and galaxy assembly.
    if (p > 0.57 && p < 0.82) {
      this._sparkleTimer -= dt;
      if (this._sparkleTimer <= 0) {
        this._sparkle();
        this._sparkleTimer = 0.28 + Math.random() * 0.7;
      }
    }
  }
}
