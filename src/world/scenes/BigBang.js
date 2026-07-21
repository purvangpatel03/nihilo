import * as THREE from 'three';
import SceneBase, { POINT_SIZE_GLSL, baseUniforms } from '../SceneBase.js';
import { POINT_MASK } from '../../lib/glsl.js';
import { mulberry32 } from '../../lib/math.js';
import { smoothstep } from '../../lib/math.js';

// The detonation. Particles wait, compressed, then explode outward the instant
// the flash hits — plus an expanding shockwave ring. Timed so the visual burst
// lands exactly on the audio impact (BANG_AT).
export default class BigBang extends SceneBase {
  build() {
    this._buildFire();
    this._buildBurst();
    this._buildShock();
  }

  _buildFire() {
    const geo = new THREE.PlaneGeometry(46, 46);
    this.fireMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uFire: { value: 0 } }),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uFire;
        uniform float uFade;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float core = exp(-r * r * 16.0);
          float glow = exp(-r * 3.6) * 0.35;
          float b = (core * 1.1 + glow) * uFire;
          vec3 col = mix(vec3(1.0, 0.6, 0.28), vec3(1.0, 0.98, 1.0), core);
          gl_FragColor = vec4(col * b * uFade, 1.0);
        }
      `,
    });
    this.fire = new THREE.Mesh(geo, this.fireMat);
    this.group.add(this.fire);
  }

  _buildBurst() {
    const q = this.exp.quality;
    const count = Math.floor(16000 * q);
    const rand = mulberry32(21);
    const dir = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // uniform sphere directions
      const u = 2 * rand() - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      dir[i * 3 + 0] = s * Math.cos(t);
      dir[i * 3 + 1] = s * Math.sin(t);
      dir[i * 3 + 2] = u;
      scale[i] = 5 + Math.pow(rand(), 2) * 22;
      seed[i] = 0.35 + rand() * 0.65; // per-particle speed
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.burstMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uExpand: { value: 0 } }),
      vertexShader: /* glsl */ `
        attribute vec3 aDir;
        attribute float aScale;
        attribute float aSeed;
        uniform float uTime;
        uniform float uExpand;
        uniform float uScale;
        uniform float uPixelRatio;
        varying float vLife;
        varying float vNear;
        void main(){
          // ease so the fireball lingers on screen before racing outward
          float e = pow(uExpand, 0.72) * aSeed;
          float r = e * 58.0;
          vec3 pos = aDir * r;
          // a little turbulence so it isn't a perfect sphere
          pos += aDir * sin(uTime * 2.0 + aSeed * 30.0) * e * 5.0;
          vLife = uExpand;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float camDist = -mvPosition.z;
          // fade particles as they streak past the camera (avoids white splats)
          vNear = smoothstep(1.5, 9.0, camDist);
          float ps = aScale * uScale * uPixelRatio * (1.0 / max(camDist, 0.3));
          gl_PointSize = min(ps, 20.0) * (1.6 - uExpand * 0.8);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vLife;
        varying float vNear;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          // white-hot -> violet -> amber as it expands and cools
          vec3 c1 = vec3(1.0, 1.0, 1.0);
          vec3 c2 = vec3(0.72, 0.52, 1.0);
          vec3 c3 = vec3(1.0, 0.6, 0.3);
          vec3 col = mix(c1, c2, smoothstep(0.0, 0.45, vLife));
          col = mix(col, c3, smoothstep(0.45, 1.0, vLife));
          float energy = (0.85 - vLife * 0.35);
          gl_FragColor = vec4(col * m * energy * vNear * 0.42 * uFade, 1.0);
        }
      `,
    });
    this.burst = new THREE.Points(geo, this.burstMat);
    this.group.add(this.burst);
  }

  _buildShock() {
    const geo = new THREE.PlaneGeometry(400, 400);
    this.shockMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uExpand: { value: 0 } }),
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
        uniform float uExpand;
        uniform float uFade;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float radius = uExpand * 1.25;
          float ring = smoothstep(0.06, 0.0, abs(r - radius));
          float fade = (1.0 - smoothstep(0.4, 1.2, uExpand));
          vec3 col = vec3(0.8, 0.6, 1.0) * ring * 2.0;
          gl_FragColor = vec4(col * fade * uFade, 1.0);
        }
      `,
    });
    this.shock = new THREE.Mesh(geo, this.shockMat);
    this.group.add(this.shock);
  }

  update(ctx) {
    const { time, fade, local } = ctx;
    // detonation lands at ~local 0.47 (== BANG_AT within this act)
    const e = smoothstep(0.46, 1.0, local);
    this.burstMat.uniforms.uTime.value = time;
    this.burstMat.uniforms.uFade.value = fade;
    this.burstMat.uniforms.uExpand.value = e;

    // fireball: a brief blaze at the instant of detonation
    const fire = smoothstep(0.45, 0.48, local) * (1 - smoothstep(0.5, 0.62, local));
    this.fireMat.uniforms.uFire.value = fire;
    this.fireMat.uniforms.uFade.value = fade;
    this.fire.quaternion.copy(this.exp.camera.quaternion);

    const shockE = smoothstep(0.46, 0.8, local);
    this.shockMat.uniforms.uExpand.value = shockE;
    this.shockMat.uniforms.uFade.value = fade * (1 - smoothstep(0.7, 1.0, local));
    this.shock.quaternion.copy(this.exp.camera.quaternion);
  }
}
