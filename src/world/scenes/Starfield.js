import * as THREE from 'three';
import SceneBase, { POINT_SIZE_GLSL, baseUniforms } from '../SceneBase.js';
import { POINT_MASK } from '../../lib/glsl.js';
import { mulberry32 } from '../../lib/math.js';

// Persistent deep-field of stars for parallax and depth once the cosmos exists.
// Cosmos feeds it a fade that rises after inflation and holds.
export default class Starfield extends SceneBase {
  build() {
    const q = this.exp.quality;
    const count = Math.floor(4200 * q);
    const rand = mulberry32(99);
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const seed = new Float32Array(count);
    const tint = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // spherical volume shell for genuine parallax
      const r = 90 + Math.pow(rand(), 0.5) * 620;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      scale[i] = (6 + Math.pow(rand(), 3) * 40) * (r < 300 ? 1.4 : 1.0);
      seed[i] = rand() * 100;
      tint[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aSeed;
        attribute float aTint;
        uniform float uTime;
        uniform float uScale;
        uniform float uPixelRatio;
        varying float vTw;
        varying float vTint;
        void main(){
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vTw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 0.03) + aSeed);
          vTint = aTint;
          ${POINT_SIZE_GLSL}
          gl_PointSize *= (0.7 + vTw * 0.6);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying float vTw;
        varying float vTint;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          vec3 cool = vec3(0.75, 0.83, 1.0);
          vec3 warm = vec3(1.0, 0.86, 0.72);
          vec3 col = mix(cool, warm, smoothstep(0.7, 1.0, vTint));
          gl_FragColor = vec4(col * m * vTw * uFade, 1.0);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.group.add(this.points);
  }

  update(ctx) {
    this.mat.uniforms.uTime.value = ctx.time;
    this.mat.uniforms.uFade.value = ctx.fade;
    this.group.rotation.y = ctx.time * 0.005;
    this.group.rotation.x = Math.sin(ctx.time * 0.01) * 0.05;
  }
}
