import * as THREE from 'three';
import SceneBase, { baseUniforms } from '../SceneBase.js';
import { POINT_MASK } from '../../lib/glsl.js';
import { buildGalaxyGeometry } from '../lib/galaxy.js';
import { lerp, smoothstep } from '../../lib/math.js';

// Even galaxies fall toward one another. Two spirals sweep in, tides tear long
// luminous tails from their edges, and their cores blaze as they graze.
export default class Collision extends SceneBase {
  build() {
    const q = this.exp.quality;
    this.centerA = new THREE.Vector3(-46, -6, -14);
    this.centerB = new THREE.Vector3(46, 8, 14);

    this.galA = this._buildGalaxy(Math.floor(15000 * q), {
      R: 22, arms: 3, twist: 2.4, seed: 11,
      coreColor: new THREE.Color(1.0, 0.85, 0.5),
      edgeColor: new THREE.Color(0.5, 0.62, 1.0),
    });
    this.galB = this._buildGalaxy(Math.floor(15000 * q), {
      R: 20, arms: 2, twist: 2.9, seed: 27,
      coreColor: new THREE.Color(1.0, 0.7, 0.85),
      edgeColor: new THREE.Color(0.55, 0.75, 1.0),
    });
    this.group.rotation.x = 0.5;
  }

  _buildGalaxy(count, opts) {
    const geo = buildGalaxyGeometry(count, opts);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, {
        uSpin: { value: 5.0 },
        uTidal: { value: 0 },
        uSpark: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uOther: { value: new THREE.Vector3() },
      }),
      vertexShader: /* glsl */ `
        attribute vec3 aPolar;
        attribute float aScale;
        attribute vec3 aColor;
        attribute float aSeed;
        uniform float uTime;
        uniform float uSpin;
        uniform float uTidal;
        uniform float uScale;
        uniform float uPixelRatio;
        uniform vec3 uCenter;
        uniform vec3 uOther;
        varying vec3 vCol;
        varying float vTw;
        void main(){
          float r = aPolar.x;
          float ang = aPolar.y + uTime * (uSpin / (r * 0.32 + 1.2));
          vec3 local = vec3(cos(ang) * r, aPolar.z, sin(ang) * r);
          vec3 p = uCenter + local;

          // tidal tails: outer stars are dragged toward the other galaxy
          vec3 toOther = uOther - uCenter;
          float dist = length(toOther);
          vec3 dirOther = toOther / max(dist, 0.001);
          float outer = smoothstep(4.0, 16.0, r);
          float pull = uTidal * outer * (r * 0.5);
          p += dirOther * pull;
          // fling the near side outward a touch for a tail arc
          p += normalize(local) * uTidal * outer * 6.0;

          vCol = aColor;
          vTw = 0.7 + 0.3 * sin(uTime * 2.5 + aSeed);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aScale * uScale * uPixelRatio * (1.0 / -mvPosition.z), 30.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        uniform float uSpark;
        varying vec3 vCol;
        varying float vTw;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 col = vCol * (1.0 + uSpark * 0.6);
          gl_FragColor = vec4(col * m * vTw * 0.6 * uFade, 1.0);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    return { pts, mat };
  }

  update(ctx) {
    const { time, fade, local } = ctx;
    // approach: centers sweep together, cross near local ~0.55, then drift.
    const app = smoothstep(0.0, 0.62, local);
    const drift = smoothstep(0.62, 1.0, local);
    const ax = lerp(-46, 6, app) + lerp(0, 22, drift);
    const bx = lerp(46, -6, app) + lerp(0, -22, drift);
    this.centerA.set(ax, lerp(-6, 2, app), lerp(-14, 4, app));
    this.centerB.set(bx, lerp(8, -2, app), lerp(14, -4, app));

    const tidal = smoothstep(0.28, 0.62, local) * (1.0 - drift * 0.3);
    const spark = Math.exp(-Math.pow((local - 0.6) * 5.0, 2)) * 1.2;

    const setG = (g, center, other) => {
      g.mat.uniforms.uTime.value = time;
      g.mat.uniforms.uFade.value = fade;
      g.mat.uniforms.uTidal.value = tidal;
      g.mat.uniforms.uSpark.value = spark;
      g.mat.uniforms.uCenter.value.copy(center);
      g.mat.uniforms.uOther.value.copy(other);
    };
    setG(this.galA, this.centerA, this.centerB);
    setG(this.galB, this.centerB, this.centerA);

    this.group.rotation.y = time * 0.03;
  }
}
