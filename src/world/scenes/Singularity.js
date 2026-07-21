import * as THREE from 'three';
import SceneBase, { POINT_SIZE_GLSL, baseUniforms } from '../SceneBase.js';
import { SIMPLEX_3D, POINT_MASK } from '../../lib/glsl.js';
import { mulberry32 } from '../../lib/math.js';

// The seed of everything. A blinding point wrapped in swirling accretion,
// breathing, leaning toward the cursor, charging as the Big Bang approaches.
export default class Singularity extends SceneBase {
  build() {
    this._buildCore();
    this._buildHalo();
  }

  _buildCore() {
    const geo = new THREE.PlaneGeometry(26, 26, 1, 1);
    this.coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uCharge: { value: 0 } }),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uFade;
        uniform float uCharge;
        uniform vec2 uPointer;
        ${SIMPLEX_3D}
        void main(){
          vec2 uv = vUv - 0.5;
          uv -= uPointer * 0.09;          // lean toward the cursor
          float r = length(uv);
          float ang = atan(uv.y, uv.x);

          // concentrate features: rr stretches the radius so the seed stays
          // a tight point with a black void around it.
          float rr = r * 4.3;
          float t = uTime * 0.22;
          // spiral coordinate for accretion filaments
          float swirl = ang + (0.55 / (rr + 0.1)) * (0.7 + uCharge * 1.6) - t * 1.3;
          vec3 np = vec3(cos(swirl), sin(swirl), rr * 1.2 - t);
          float f = fbm(np * 2.2) * 0.5 + 0.5;

          float breathe = 0.85 + 0.15 * sin(uTime * 0.8);
          float flicker = 0.92 + 0.08 * sin(uTime * (3.0 + uCharge * 12.0) + f * 6.2831);

          float core = exp(-rr * rr * (19.0 - uCharge * 6.0));   // tiny brilliant seed
          float glow = exp(-rr * 2.8) * 0.12;
          float filaments = pow(f, 2.0) * smoothstep(1.25, 0.1, rr) * (0.4 + uCharge * 0.9);
          float ring = smoothstep(0.36, 0.0, abs(rr - 0.5)) * f * (0.3 + uCharge * 0.6);
          float bright = (core * 1.15 + glow + filaments * 0.5 + ring * 0.4) * breathe * flicker;
          bright *= (1.0 + uCharge * 1.5);

          vec3 cInner = vec3(1.0, 0.97, 1.0);
          vec3 cMid   = vec3(0.62, 0.42, 1.0);
          vec3 cOuter = vec3(0.16, 0.08, 0.42);
          vec3 col = mix(cOuter, cMid, smoothstep(0.0, 0.5, bright));
          col = mix(col, cInner, smoothstep(0.8, 1.7, bright));
          col *= bright;

          gl_FragColor = vec4(col * uFade, 1.0);
        }
      `,
    });
    this.core = new THREE.Mesh(geo, this.coreMat);
    this.core.position.z = 0;
    this.group.add(this.core);
  }

  _buildHalo() {
    const q = this.exp.quality;
    const count = Math.floor(3000 * q);
    const rand = mulberry32(7);
    const seeds = new Float32Array(count * 4); // a0, r0, speed, phase
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seeds[i * 4 + 0] = rand() * Math.PI * 2;
      seeds[i * 4 + 1] = 1.1 + Math.pow(rand(), 0.7) * 7.4;
      seeds[i * 4 + 2] = 0.15 + rand() * 0.5;
      seeds[i * 4 + 3] = rand() * Math.PI * 2;
      scales[i] = 10.0 + rand() * 26.0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    this.haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uCharge: { value: 0 } }),
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        attribute float aScale;
        uniform float uTime;
        uniform float uCharge;
        uniform float uScale;
        uniform float uPixelRatio;
        uniform vec2 uPointer;
        varying float vBright;
        void main(){
          float a0 = aSeed.x;
          float r0 = aSeed.y;
          float spd = aSeed.z;
          float ph = aSeed.w;

          float fallIn = 1.0 - uCharge * 0.3;
          float r = r0 * fallIn * (1.0 + 0.08 * sin(uTime * 0.4 + ph));
          float ang = a0 + uTime * (spd * (0.4 + 0.8 / r)) + (1.8 / r);

          vec3 pos;
          pos.x = cos(ang) * r;
          pos.y = sin(ang) * r * 0.62;
          pos.z = sin(ph + uTime * 0.2) * 0.6;

          // gravitational wake toward the cursor
          pos.xy += uPointer * 1.6 * smoothstep(9.0, 0.0, r);

          vBright = smoothstep(8.5, 0.4, r) * (0.5 + uCharge);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          ${POINT_SIZE_GLSL}
          gl_PointSize *= (0.6 + uCharge * 0.8);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vBright;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 col = mix(vec3(0.5, 0.32, 1.0), vec3(1.0, 0.95, 1.0), vBright);
          gl_FragColor = vec4(col * m * (0.22 + vBright * 0.55) * uFade, 1.0);
        }
      `,
    });
    this.halo = new THREE.Points(geo, this.haloMat);
    this.group.add(this.halo);
  }

  update(ctx) {
    const { time, fade, local, pointer } = ctx;
    // charge ramps up across the void, peaking right before the bang
    const charge = Math.pow(local, 2.2);
    for (const mat of [this.coreMat, this.haloMat]) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uFade.value = fade;
      mat.uniforms.uCharge.value = charge;
      mat.uniforms.uPointer.value.copy(pointer);
    }
    // keep the plane facing the camera
    this.core.quaternion.copy(this.exp.camera.quaternion);
  }
}
