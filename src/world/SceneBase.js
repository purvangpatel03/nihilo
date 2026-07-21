import * as THREE from 'three';

// Minimal lifecycle every act shares. Cosmos computes a 0..1 `fade` from the
// scroll window and pushes it in; scenes translate that into opacity/scale.
export default class SceneBase {
  constructor(experience, act) {
    this.exp = experience;
    this.act = act;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.fade = 0;
    this.built = false;
  }

  build() {} // override
  ensureBuilt() {
    if (!this.built) {
      this.build();
      this.built = true;
    }
  }

  setFade(f) {
    this.fade = f;
    const on = f > 0.0015;
    if (on && !this.built) this.ensureBuilt();
    this.group.visible = on;
  }

  update(/* ctx */) {}
}

// Perspective-correct point sizing snippet + DPR uniform convention.
export const POINT_SIZE_GLSL = /* glsl */ `
  gl_PointSize = aScale * uScale * uPixelRatio * (1.0 / -mvPosition.z);
`;

export function baseUniforms(exp, extra = {}) {
  return Object.assign(
    {
      uTime: { value: 0 },
      uFade: { value: 0 },
      uLocal: { value: 0 },
      uPixelRatio: { value: exp.sizes.dpr },
      // pixels-per-world-unit-ish at unit distance; tuned so aScale values in
      // the ~5–40 range map to crisp few-pixel sprites, not screen-filling blobs.
      uScale: { value: exp.sizes.height * 0.012 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    },
    extra
  );
}
