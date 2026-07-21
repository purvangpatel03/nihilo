import * as THREE from 'three';
import { ACTS, BANG_AT, localProgress } from '../core/Timeline.js';
import { window01, clamp, lerp, smoothstep } from '../lib/math.js';

import Singularity from './scenes/Singularity.js';
import BigBang from './scenes/BigBang.js';
import Inflation from './scenes/Inflation.js';
import ParticleEra from './scenes/ParticleEra.js';
import FirstLight from './scenes/FirstLight.js';
import Stars from './scenes/Stars.js';
import Galaxy from './scenes/Galaxy.js';
import Collision from './scenes/Collision.js';
import Resolution from './scenes/Resolution.js';
import Starfield from './scenes/Starfield.js';

const act = (id) => ACTS.find((a) => a.id === id);

// Keyframe interpolation across the 0..1 journey.
function kf(keys, p, key = 'v') {
  if (p <= keys[0].p) return keys[0][key];
  if (p >= keys[keys.length - 1].p) return keys[keys.length - 1][key];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (p >= a.p && p <= b.p) {
      const t = smoothstep(a.p, b.p, p);
      return lerp(a[key], b[key], t);
    }
  }
  return keys[keys.length - 1][key];
}

export default class Cosmos {
  constructor(experience, audio) {
    this.exp = experience;
    this.audio = audio;
    this.root = new THREE.Group();
    this.exp.scene.add(this.root);
    this._bangFired = false;

    // Scenes, each bound to an act.
    this.singularity = new Singularity(this.exp, act('void'));
    this.bigbang = new BigBang(this.exp, act('bang'));
    this.inflation = new Inflation(this.exp, act('inflation'));
    this.particles = new ParticleEra(this.exp, act('particles'));
    this.firstlight = new FirstLight(this.exp, act('firstlight'));
    this.stars = new Stars(this.exp, act('stars'));
    this.galaxy = new Galaxy(this.exp, act('galaxies'));
    this.collision = new Collision(this.exp, act('collision'));
    this.resolution = new Resolution(this.exp, act('here'));
    this.starfield = new Starfield(this.exp, act('inflation'));

    // [scene, in0, in1, fadeLen] — overlapping windows give clean crossfades.
    this.entries = [
      { s: this.singularity, a: act('void'), w: [-0.05, 0.135, 0.03] },
      { s: this.bigbang, a: act('bang'), w: [0.105, 0.215, 0.025] },
      { s: this.inflation, a: act('inflation'), w: [0.19, 0.335, 0.03] },
      { s: this.particles, a: act('particles'), w: [0.305, 0.465, 0.03] },
      { s: this.firstlight, a: act('firstlight'), w: [0.435, 0.585, 0.03] },
      { s: this.stars, a: act('stars'), w: [0.555, 0.705, 0.03] },
      { s: this.galaxy, a: act('galaxies'), w: [0.675, 0.825, 0.03] },
      { s: this.collision, a: act('collision'), w: [0.795, 0.935, 0.03] },
      { s: this.resolution, a: act('here'), w: [0.905, 1.06, 0.03] },
    ];

    for (const e of this.entries) this.root.add(e.s.group);
    this.root.add(this.starfield.group);

    // Camera choreography (z distance + slight elevation).
    this.camZ = [
      { p: 0.0, v: 13 }, { p: 0.11, v: 15 }, { p: 0.16, v: 17 }, { p: 0.2, v: 10 },
      { p: 0.26, v: 16 }, { p: 0.32, v: 30 }, { p: 0.42, v: 33 }, { p: 0.45, v: 32 },
      { p: 0.51, v: 30 }, { p: 0.57, v: 48 }, { p: 0.69, v: 60 },
      { p: 0.81, v: 98 }, { p: 0.92, v: 152 }, { p: 1.0, v: 168 },
    ];
    this.camY = [
      { p: 0.0, v: 0 }, { p: 0.45, v: 0 }, { p: 0.57, v: 7 }, { p: 0.69, v: 18 },
      { p: 0.81, v: 28 }, { p: 0.92, v: 12 }, { p: 1.0, v: 8 },
    ];
    this.bloomKeys = [
      { p: 0.0, v: 0.5 }, { p: 0.115, v: 0.6 }, { p: 0.16, v: 1.15 }, { p: 0.22, v: 0.85 },
      { p: 0.32, v: 0.7 }, { p: 0.45, v: 0.68 }, { p: 0.57, v: 0.95 }, { p: 0.69, v: 0.88 },
      { p: 0.81, v: 0.9 }, { p: 0.92, v: 0.7 }, { p: 1.0, v: 0.6 },
    ];

    this.bgKeys = [
      { p: 0.0, c: new THREE.Color('#050308') },
      { p: 0.16, c: new THREE.Color('#0a0512') },
      { p: 0.32, c: new THREE.Color('#060409') },
      { p: 0.45, c: new THREE.Color('#03070b') },
      { p: 0.57, c: new THREE.Color('#070409') },
      { p: 0.69, c: new THREE.Color('#05050d') },
      { p: 0.81, c: new THREE.Color('#08040b') },
      { p: 0.92, c: new THREE.Color('#02040a') },
      { p: 1.0, c: new THREE.Color('#02030a') },
    ];
    this._bg = new THREE.Color('#050308');
    this._camTarget = new THREE.Vector3();
  }

  // Build every scene + precompile shaders during the veil so the journey
  // never hitches once it starts.
  warm() {
    for (const e of this.entries) e.s.ensureBuilt();
    this.starfield.ensureBuilt();
    this.exp.renderer.compile(this.exp.scene, this.exp.camera);
  }

  _bgColor(p) {
    const keys = this.bgKeys;
    if (p <= keys[0].p) return this._bg.copy(keys[0].c);
    if (p >= keys[keys.length - 1].p) return this._bg.copy(keys[keys.length - 1].c);
    for (let i = 0; i < keys.length - 1; i++) {
      if (p >= keys[i].p && p <= keys[i + 1].p) {
        const t = smoothstep(keys[i].p, keys[i + 1].p, p);
        return this._bg.copy(keys[i].c).lerp(keys[i + 1].c, t);
      }
    }
    return this._bg;
  }

  update(p, time, dt) {
    const exp = this.exp;

    // ---- audio + visual bang trigger ----
    if (p < BANG_AT - 0.04) this._bangFired = false;
    if (!this._bangFired && p >= BANG_AT) {
      this._bangFired = true;
      this.audio?.triggerBang();
    }

    // proximity to the detonation (for flash / shake / chroma)
    const bangProx = Math.exp(-Math.pow((p - BANG_AT) * 68, 2));

    // ---- scenes ----
    for (const e of this.entries) {
      const [in0, in1, fl] = e.w;
      const fade = window01(p, in0, in1, fl);
      e.s.setFade(fade);
      if (fade > 0.0015) {
        e.s.update({
          p,
          local: localProgress(p, e.a),
          fade,
          time,
          dt,
          pointer: exp.pointer,
          exp,
        });
      }
    }
    // persistent starfield: in after inflation, out during the final pull-back
    const starFade = smoothstep(0.2, 0.34, p) * (1 - smoothstep(0.9, 0.97, p));
    this.starfield.setFade(starFade);
    if (starFade > 0.0015) {
      this.starfield.update({ p, local: 0, fade: starFade, time, dt, pointer: exp.pointer, exp });
    }

    // ---- background ----
    exp.scene.background = this._bgColor(p);

    // ---- bloom ----
    exp.bloomPass.strength = kf(this.bloomKeys, p);

    // ---- grade pass (flash / chroma / exposure) ----
    const g = exp.gradePass.uniforms;
    g.uFlash.value = bangProx * 1.25;
    const collision = window01(p, 0.81, 0.92, 0.03);
    g.uChroma.value = 0.0007 + bangProx * 0.006 + collision * 0.0022;
    g.uExposure.value = 1.0 + bangProx * 0.15;

    // ---- camera ----
    const z = kf(this.camZ, p);
    const y = kf(this.camY, p);
    const px = exp.pointer.x;
    const py = exp.pointer.y;
    const parallax = clamp(z * 0.02, 0.25, 3.2);

    // shake at the bang
    const shake = bangProx * 1.4;
    const sx = Math.sin(time * 63.0) * shake;
    const sy = Math.cos(time * 57.0) * shake;

    exp.camera.position.set(px * parallax + sx, y + py * parallax + sy, z);
    this._camTarget.set(px * parallax * 0.4, y * 0.35 + py * parallax * 0.4, 0);
    exp.camera.lookAt(this._camTarget);
  }
}
