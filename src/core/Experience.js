import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { damp } from '../lib/math.js';

// The rendering core: renderer, camera, scene, and the post pipeline
// (bloom + a bespoke grade pass that owns vignette, grain, chroma and the
// Big-Bang flash). Also owns pointer tracking and adaptive quality.
export default class Experience {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050308');

    this.sizes = { width: window.innerWidth, height: window.innerHeight, dpr: 1 };
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.dt = 0;

    // pointer: raw target + smoothed, both in normalized device space [-1,1]
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerTarget = new THREE.Vector2(0, 0);
    this.pointerWorld = new THREE.Vector3(0, 0, 0);

    this._detectQuality();
    this._initRenderer();
    this._initCamera();
    this._initComposer();
    this._bindEvents();

    // fps sampling for runtime downgrade
    this._fpsSamples = [];
    this._downgraded = false;
  }

  _detectQuality() {
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    const small = Math.min(window.innerWidth, window.innerHeight) < 720;
    // 1 = full, 0.66 = reduced particle budgets
    let q = 1;
    if (mem <= 4 || cores <= 4) q = 0.72;
    if (mem <= 2) q = 0.5;
    if (small) q = Math.min(q, 0.8);
    this.quality = q;
    this.maxDpr = q < 0.7 ? 1.35 : 2;
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    this.renderer.setClearColor('#050308', 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this._applySize();
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      55,
      this.sizes.width / this.sizes.height,
      0.1,
      2000
    );
    this.camera.position.set(0, 0, 14);
    this.scene.add(this.camera);
    // rig lets scenes push the camera around without fighting parallax
    this.cameraBase = new THREE.Vector3(0, 0, 14);
    this.cameraLookTarget = new THREE.Vector3(0, 0, 0);
  }

  _initComposer() {
    const { width, height, dpr } = this.sizes;
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.9, // strength (driven per-act)
      0.72, // radius
      0.28 // threshold — only genuinely bright cores bloom
    );
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(this._gradeShader());
    this.composer.addPass(this.gradePass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  _gradeShader() {
    return {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uChroma: { value: 0.0 },
        uVignette: { value: 1.05 },
        uGrain: { value: 0.055 },
        uExposure: { value: 1.0 },
        uResolution: { value: new THREE.Vector2(this.sizes.width, this.sizes.height) },
      },
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
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uFlash;
        uniform float uChroma;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uExposure;
        uniform vec2 uResolution;

        float hash(vec2 p){
          p = fract(p * vec2(443.897, 441.423));
          p += dot(p, p + 19.19);
          return fract((p.x + p.y) * p.x);
        }

        void main(){
          vec2 uv = vUv;
          vec2 dir = uv - 0.5;
          float dist = length(dir);

          // Chromatic aberration grows toward the edges.
          float ca = uChroma * (0.4 + dist * 1.6);
          vec2 off = dir * ca;
          vec3 col;
          col.r = texture2D(tDiffuse, uv - off).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv + off).b;

          col *= uExposure;

          // Big-Bang flash: push toward white, brightest at center.
          float flash = uFlash * (1.0 - smoothstep(0.0, 1.2, dist));
          col = mix(col, vec3(1.35), clamp(flash, 0.0, 1.0));

          // Vignette.
          float vig = smoothstep(1.15, 0.25, dist * uVignette);
          col *= mix(0.35, 1.0, vig);

          // Film grain — subtle, animated, luminance-weighted.
          float g = hash(uv * uResolution + fract(uTime) * 71.0) - 0.5;
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col += g * uGrain * (0.6 + (1.0 - lum) * 0.8);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize(), { passive: true });
    // A ResizeObserver on the canvas catches every layout change (scrollbar
    // appearing, DPR shifts, container resizes) that a window 'resize' misses.
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this._onResize());
      this._ro.observe(this.canvas);
    }
    window.addEventListener(
      'pointermove',
      (e) => {
        this.pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointerTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true }
    );
    // Gentle drift back to center on leave so it never feels "stuck".
    window.addEventListener('pointerout', () => {
      this.pointerTarget.set(0, 0);
    });
  }

  _applySize() {
    // Measure the canvas's actual displayed box (CSS-driven, fixed inset:0) so
    // the drawing buffer always matches it exactly — no black band, ever.
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.sizes.width = w;
    this.sizes.height = h;
    this.sizes.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.renderer.setPixelRatio(this.sizes.dpr);
    // updateStyle=false: let the CSS (100%/100%) own the display size.
    this.renderer.setSize(w, h, false);
  }

  _onResize() {
    this._applySize();
    this.camera.aspect = this.sizes.width / this.sizes.height;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(this.sizes.dpr);
    this.composer.setSize(this.sizes.width, this.sizes.height);
    this.bloomPass.setSize(this.sizes.width, this.sizes.height);
    this.gradePass.uniforms.uResolution.value.set(this.sizes.width, this.sizes.height);
  }

  // Called once per frame before world update.
  tick() {
    this.dt = Math.min(this.clock.getDelta(), 1 / 20); // clamp to avoid jumps on tab switch
    this.elapsed += this.dt;

    // smooth pointer
    this.pointer.x = damp(this.pointer.x, this.pointerTarget.x, 6, this.dt);
    this.pointer.y = damp(this.pointer.y, this.pointerTarget.y, 6, this.dt);

    this.gradePass.uniforms.uTime.value = this.elapsed;

    this._sampleFps();
  }

  _sampleFps() {
    if (this.dt <= 0) return;
    const fps = 1 / this.dt;
    this._fpsSamples.push(fps);
    if (this._fpsSamples.length > 90) this._fpsSamples.shift();
    if (this._downgraded || this._fpsSamples.length < 90) return;
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    if (avg < 42) {
      // one-time gentle downgrade
      this._downgraded = true;
      this.maxDpr = Math.min(this.maxDpr, 1.3);
      this._applySize();
      this.composer.setPixelRatio(this.sizes.dpr);
      this.composer.setSize(this.sizes.width, this.sizes.height);
      this.bloomPass.setSize(this.sizes.width, this.sizes.height);
    }
  }

  render() {
    this.composer.render();
  }
}
