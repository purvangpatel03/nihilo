import * as THREE from 'three';
import SceneBase, { POINT_SIZE_GLSL, baseUniforms } from '../SceneBase.js';
import { SIMPLEX_3D, CURL_3D, POINT_MASK } from '../../lib/glsl.js';
import { mulberry32 } from '../../lib/math.js';

// Cosmic dawn: gravity draws cold gas into filaments, and at their dense knots
// the first stars catch fire — igniting in staggered flares as you scroll.
export default class Stars extends SceneBase {
  build() {
    const rand = mulberry32(128);
    // a handful of collapse centers
    this.centers = [];
    for (let i = 0; i < 9; i++) {
      this.centers.push([
        (rand() * 2 - 1) * 26,
        (rand() * 2 - 1) * 16,
        (rand() * 2 - 1) * 26,
      ]);
    }
    this._buildGas(rand);
    this._buildStars(rand);
  }

  _buildGas(rand) {
    const q = this.exp.quality;
    const count = Math.floor(9000 * q);
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(rand(), 0.4) * 34;
      const u = 2 * rand() - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3 + 0] = r * s * Math.cos(t);
      pos[i * 3 + 1] = r * s * Math.sin(t) * 0.7;
      pos[i * 3 + 2] = r * u;
      scale[i] = 4 + Math.pow(rand(), 2) * 12;
      seed[i] = rand() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.gasMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aSeed;
        uniform float uTime;
        uniform float uLocal;
        uniform float uScale;
        uniform float uPixelRatio;
        varying float vB;
        ${SIMPLEX_3D}
        ${CURL_3D}
        void main(){
          vec3 p = position;
          // slow collapse inward + curl turbulence
          vec3 flow = curlNoise(p * 0.05 + vec3(0.0, uTime * 0.03, 0.0));
          p += flow * 2.2;
          p *= (1.0 - uLocal * 0.28);
          vB = 0.4 + 0.3 * sin(uTime + aSeed * 5.0);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          ${POINT_SIZE_GLSL}
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vB;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 col = vec3(0.28, 0.34, 0.6);
          gl_FragColor = vec4(col * m * vB * uFade, 1.0);
        }
      `,
    });
    this.gas = new THREE.Points(geo, this.gasMat);
    this.group.add(this.gas);
  }

  _buildStars(rand) {
    const q = this.exp.quality;
    const count = Math.floor(1400 * q);
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const ignite = new Float32Array(count);
    const warm = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const c = this.centers[Math.floor(rand() * this.centers.length)];
      const spread = 3 + rand() * 7;
      pos[i * 3 + 0] = c[0] + (rand() * 2 - 1) * spread;
      pos[i * 3 + 1] = c[1] + (rand() * 2 - 1) * spread * 0.7;
      pos[i * 3 + 2] = c[2] + (rand() * 2 - 1) * spread;
      scale[i] = 8 + Math.pow(rand(), 2) * 22;
      ignite[i] = 0.08 + rand() * 0.72;
      warm[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aIgnite', new THREE.BufferAttribute(ignite, 1));
    geo.setAttribute('aWarm', new THREE.BufferAttribute(warm, 1));

    this.starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aIgnite;
        attribute float aWarm;
        uniform float uTime;
        uniform float uLocal;
        uniform float uScale;
        uniform float uPixelRatio;
        varying float vLit;
        varying float vWarm;
        void main(){
          // flare on ignition, then settle to a steady twinkle
          float since = uLocal - aIgnite;
          float flare = exp(-max(since, 0.0) * 16.0) * 0.9;
          float lit = smoothstep(0.0, 0.04, since);
          float tw = 0.75 + 0.25 * sin(uTime * 3.0 + aIgnite * 40.0);
          vLit = lit * (1.0 + flare) * tw;
          vWarm = aWarm;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          ${POINT_SIZE_GLSL}
          gl_PointSize = min(gl_PointSize * (0.6 + vLit * 0.9), 64.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vLit;
        varying float vWarm;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 blue = vec3(0.7, 0.82, 1.0);
          vec3 gold = vec3(1.0, 0.82, 0.55);
          vec3 col = mix(blue, gold, vWarm);
          gl_FragColor = vec4(col * m * vLit * 0.8 * uFade, 1.0);
        }
      `,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.group.add(this.stars);
  }

  update(ctx) {
    for (const mat of [this.gasMat, this.starMat]) {
      mat.uniforms.uTime.value = ctx.time;
      mat.uniforms.uFade.value = ctx.fade;
      mat.uniforms.uLocal.value = ctx.local;
    }
    this.group.rotation.y = ctx.time * 0.02;
  }
}
