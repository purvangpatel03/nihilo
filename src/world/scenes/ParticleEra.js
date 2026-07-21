import * as THREE from 'three';
import SceneBase, { POINT_SIZE_GLSL, baseUniforms } from '../SceneBase.js';
import { SIMPLEX_3D, CURL_3D, POINT_MASK } from '../../lib/glsl.js';
import { mulberry32 } from '../../lib/math.js';

// The particle forge: a churning, cooling soup of the first matter, driven by
// curl-noise flow. White-hot at first, cooling toward amber as it expands.
export default class ParticleEra extends SceneBase {
  build() {
    const q = this.exp.quality;
    const count = Math.floor(15000 * q);
    const rand = mulberry32(64);
    const base = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(rand(), 0.4) * 21;
      const u = 2 * rand() - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      base[i * 3 + 0] = r * s * Math.cos(t);
      base[i * 3 + 1] = r * s * Math.sin(t);
      base[i * 3 + 2] = r * u;
      scale[i] = 5 + Math.pow(rand(), 2) * 16;
      seed[i] = rand() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.mat = new THREE.ShaderMaterial({
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
        varying float vHeat;
        ${SIMPLEX_3D}
        ${CURL_3D}
        void main(){
          vec3 p = position;
          float expand = 1.0 + uLocal * 0.6;
          vec3 flow = curlNoise(p * 0.06 + vec3(0.0, 0.0, uTime * 0.05));
          float amp = 3.4 * (1.0 - uLocal * 0.4);
          p = p * expand + flow * amp;
          p += curlNoise(p * 0.18 + aSeed) * 0.8;

          vHeat = (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 6.0)) * (1.0 - uLocal * 0.7);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          ${POINT_SIZE_GLSL}
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        uniform float uLocal;
        varying float vHeat;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 hot  = vec3(0.75, 0.85, 1.0);
          vec3 mid  = vec3(1.0, 0.95, 0.9);
          vec3 cool = vec3(1.0, 0.55, 0.28);
          float temp = 1.0 - uLocal;
          vec3 col = mix(cool, mid, smoothstep(0.2, 0.6, temp));
          col = mix(col, hot, smoothstep(0.6, 1.0, temp));
          float b = (0.4 + vHeat * 0.7);
          gl_FragColor = vec4(col * m * b * 0.6 * uFade, 1.0);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.group.add(this.points);
  }

  update(ctx) {
    this.mat.uniforms.uTime.value = ctx.time;
    this.mat.uniforms.uFade.value = ctx.fade;
    this.mat.uniforms.uLocal.value = ctx.local;
    this.group.rotation.y = ctx.time * 0.03;
  }
}
