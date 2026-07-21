import * as THREE from 'three';
import SceneBase, { baseUniforms } from '../SceneBase.js';
import { SIMPLEX_3D } from '../../lib/glsl.js';

// Recombination — the fog lifts. The camera sits inside the surface of last
// scattering: a mottled shell (the cosmic microwave background) that gathers,
// blazes into the first light, then clears to reveal the stars beyond.
export default class FirstLight extends SceneBase {
  build() {
    const geo = new THREE.SphereGeometry(70, 96, 96);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp),
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vDir;
        uniform float uTime;
        uniform float uLocal;
        uniform float uFade;
        ${SIMPLEX_3D}
        void main(){
          vec3 d = vDir;
          // CMB-like temperature anisotropy
          float n = fbm(d * 2.4 + vec3(0.0, 0.0, uTime * 0.02));
          n += 0.5 * fbm(d * 6.0 - uTime * 0.01);
          float temp = n * 0.5 + 0.5;

          // palette: deep teal-blue cold spots -> warm gold hot spots
          vec3 cold = vec3(0.06, 0.16, 0.28);
          vec3 mid  = vec3(0.35, 0.30, 0.5);
          vec3 hot  = vec3(1.0, 0.78, 0.42);
          vec3 col = mix(cold, mid, smoothstep(0.3, 0.55, temp));
          col = mix(col, hot, smoothstep(0.6, 0.9, temp));

          // fog -> blaze -> clear
          float blaze = smoothstep(0.25, 0.6, uLocal);
          float clear = smoothstep(0.62, 1.0, uLocal);
          float bright = mix(0.1, 0.55, blaze) * (1.0 - clear);
          float grain = 0.85 + 0.15 * sin(temp * 40.0);

          gl_FragColor = vec4(col * bright * grain * uFade, 1.0);
        }
      `,
    });
    this.shell = new THREE.Mesh(geo, this.mat);
    this.group.add(this.shell);
  }

  update(ctx) {
    this.mat.uniforms.uTime.value = ctx.time;
    this.mat.uniforms.uFade.value = ctx.fade;
    this.mat.uniforms.uLocal.value = ctx.local;
    this.group.rotation.y = ctx.time * 0.01;
  }
}
