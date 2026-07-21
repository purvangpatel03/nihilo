import * as THREE from 'three';
import SceneBase, { baseUniforms } from '../SceneBase.js';
import { POINT_MASK } from '../../lib/glsl.js';
import { buildGalaxyGeometry } from '../lib/galaxy.js';

// A hundred billion suns learn to turn together. Stars assemble from a scattered
// halo into spiral arms, then rotate with a flat rotation curve (inner faster).
export default class Galaxy extends SceneBase {
  build() {
    const q = this.exp.quality;
    const geo = buildGalaxyGeometry(Math.floor(24000 * q), { R: 28, arms: 3, twist: 2.6, seed: 5 });

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uSpin: { value: 6.0 }, uAssemble: { value: 0 } }),
      vertexShader: /* glsl */ `
        attribute vec3 aPolar;
        attribute float aScale;
        attribute vec3 aColor;
        attribute float aSeed;
        uniform float uTime;
        uniform float uSpin;
        uniform float uAssemble;
        uniform float uScale;
        uniform float uPixelRatio;
        varying vec3 vCol;
        varying float vTw;
        void main(){
          float r = aPolar.x;
          float ang = aPolar.y + uTime * (uSpin / (r * 0.32 + 1.2));
          float rr = mix(r * 2.8, r, uAssemble);
          vec3 p = vec3(cos(ang) * rr, aPolar.z * uAssemble, sin(ang) * rr);
          vCol = aColor;
          vTw = 0.7 + 0.3 * sin(uTime * 2.5 + aSeed);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aScale * uScale * uPixelRatio * (1.0 / -mvPosition.z);
          gl_PointSize = min(gl_PointSize * (0.5 + uAssemble * 0.7), 34.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying vec3 vCol;
        varying float vTw;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          gl_FragColor = vec4(vCol * m * vTw * 0.62 * uFade, 1.0);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.group.rotation.x = 1.05; // tilt the disk toward camera
  }

  update(ctx) {
    this.mat.uniforms.uTime.value = ctx.time;
    this.mat.uniforms.uFade.value = ctx.fade;
    this.mat.uniforms.uAssemble.value = Math.min(1, ctx.local / 0.42);
    this.group.rotation.z = ctx.time * 0.02;
    // subtle drift of the tilt for life
    this.group.rotation.x = 1.05 + Math.sin(ctx.time * 0.05) * 0.06;
  }
}
