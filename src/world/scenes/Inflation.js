import * as THREE from 'three';
import SceneBase, { baseUniforms } from '../SceneBase.js';
import { mulberry32 } from '../../lib/math.js';

// Cosmic inflation: space itself stretching faster than light. Rendered as a
// storm of streaks accelerating outward past the camera.
export default class Inflation extends SceneBase {
  build() {
    const q = this.exp.quality;
    const count = Math.floor(7000 * q);
    const rand = mulberry32(43);
    const N = count * 2;
    const dir = new Float32Array(N * 3);
    const off = new Float32Array(N);
    const seed = new Float32Array(N);
    for (let i = 0; i < count; i++) {
      const u = 2 * rand() - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(t);
      const dy = s * Math.sin(t);
      const dz = u;
      const sd = rand();
      for (let k = 0; k < 2; k++) {
        const idx = i * 2 + k;
        dir[idx * 3 + 0] = dx;
        dir[idx * 3 + 1] = dy;
        dir[idx * 3 + 2] = dz;
        off[idx] = k; // 0 = tail (inner), 1 = head (outer)
        seed[idx] = sd;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        attribute vec3 aDir;
        attribute float aOff;
        attribute float aSeed;
        uniform float uTime;
        uniform float uLocal;
        varying float vBright;
        void main(){
          float sp = 0.4 + aSeed;
          float r = 1.5 + 155.0 * pow(uLocal, 2.1) * sp;
          float streak = (0.5 + 7.5 * uLocal) * sp;
          float rr = r + aOff * streak;
          vec3 pos = aDir * rr;
          // fade in as it accelerates, fade out once it blows past
          vBright = smoothstep(0.0, 0.15, uLocal) * (1.0 - smoothstep(120.0, 240.0, rr));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vBright;
        void main(){
          vec3 col = mix(vec3(0.55, 0.6, 1.0), vec3(0.95, 0.9, 1.0), vBright);
          gl_FragColor = vec4(col * vBright * uFade, 1.0);
        }
      `,
    });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.group.add(this.lines);
  }

  update(ctx) {
    this.mat.uniforms.uTime.value = ctx.time;
    this.mat.uniforms.uFade.value = ctx.fade;
    this.mat.uniforms.uLocal.value = ctx.local;
    this.group.rotation.z = ctx.time * 0.02;
  }
}
