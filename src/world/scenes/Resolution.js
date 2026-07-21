import * as THREE from 'three';
import SceneBase, { POINT_SIZE_GLSL, baseUniforms } from '../SceneBase.js';
import { POINT_MASK } from '../../lib/glsl.js';
import { mulberry32, smoothstep } from '../../lib/math.js';

// You are here. Pull back through a field of distant galaxies until a single
// pale blue dot hangs, suspended in a faint beam of light. The quiet after.
export default class Resolution extends SceneBase {
  build() {
    this._buildDeepField();
    this._buildBeam();
    this._buildDot();
  }

  _buildDeepField() {
    const q = this.exp.quality;
    const count = Math.floor(4000 * q);
    const rand = mulberry32(303);
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const tint = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 120 + Math.pow(rand(), 0.5) * 850;
      const u = 2 * rand() - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3 + 0] = r * s * Math.cos(t);
      pos[i * 3 + 1] = r * s * Math.sin(t);
      pos[i * 3 + 2] = r * u;
      scale[i] = 6 + Math.pow(rand(), 2) * 34;
      tint[i] = rand();
      seed[i] = rand() * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.fieldMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aTint;
        attribute float aSeed;
        uniform float uTime;
        uniform float uScale;
        uniform float uPixelRatio;
        varying float vTint;
        varying float vTw;
        void main(){
          vTint = aTint;
          vTw = 0.6 + 0.4 * sin(uTime * 0.8 + aSeed);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          ${POINT_SIZE_GLSL}
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vTint;
        varying float vTw;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 cold = vec3(0.6, 0.72, 1.0);
          vec3 warm = vec3(1.0, 0.85, 0.75);
          vec3 col = mix(cold, warm, smoothstep(0.75, 1.0, vTint));
          gl_FragColor = vec4(col * m * vTw * 0.7 * uFade, 1.0);
        }
      `,
    });
    this.field = new THREE.Points(geo, this.fieldMat);
    this.field.frustumCulled = false;
    this.group.add(this.field);
  }

  _buildBeam() {
    const geo = new THREE.PlaneGeometry(600, 600);
    this.beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uFade;
        void main(){
          vec2 uv = vUv - 0.5;
          // soft diagonal sunbeam through the frame
          vec2 dir = normalize(vec2(0.7, -1.0));
          float band = dot(uv, dir);
          float beam = smoothstep(0.14, 0.0, abs(band)) * 0.28;
          beam += smoothstep(0.42, 0.0, abs(band)) * 0.07;
          vec3 col = vec3(0.5, 0.64, 1.0) * beam;
          gl_FragColor = vec4(col * uFade, 1.0);
        }
      `,
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.position.z = -60;
    this.group.add(this.beam);
  }

  _buildDot() {
    const geo = new THREE.PlaneGeometry(46, 46);
    this.dotMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uFade;
        void main(){
          float r = length(vUv - 0.5);
          float core = smoothstep(0.045, 0.0, r);
          float halo = smoothstep(0.42, 0.0, r) * 0.35;
          float pulse = 0.9 + 0.1 * sin(uTime * 1.2);
          vec3 pale = vec3(0.62, 0.78, 1.0);
          vec3 col = pale * (core * 1.6 + halo) * pulse;
          gl_FragColor = vec4(col * uFade, 1.0);
        }
      `,
    });
    this.dot = new THREE.Mesh(geo, this.dotMat);
    // slightly off-center — a mote, not a monument
    this.dot.position.set(9, -5, 0);
    this.group.add(this.dot);
  }

  update(ctx) {
    const { time, fade, local } = ctx;
    this.fieldMat.uniforms.uTime.value = time;
    this.fieldMat.uniforms.uFade.value = fade;
    this.beamMat.uniforms.uFade.value = fade * smoothstep(0.15, 0.6, local);
    this.dotMat.uniforms.uTime.value = time;
    this.dotMat.uniforms.uFade.value = fade * smoothstep(0.1, 0.5, local);

    this.dot.quaternion.copy(this.exp.camera.quaternion);
    this.beam.quaternion.copy(this.exp.camera.quaternion);
    this.group.rotation.y = time * 0.006;
  }
}
