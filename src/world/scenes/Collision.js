import * as THREE from 'three';
import SceneBase, { baseUniforms } from '../SceneBase.js';
import { POINT_MASK } from '../../lib/glsl.js';
import { mulberry32 } from '../../lib/math.js';

// A physically-based galaxy merger. A restricted N-body simulation is baked at
// build time: two massive cores fall together under gravity (with dynamical
// friction so the orbit decays and they coalesce), while thousands of massless
// test stars — each on a circular orbit in an inclined spiral disk — feel
// gravity from BOTH cores. The result is real tidal tails, a bridge, and a
// merger remnant. Positions for every star at every frame are stored in a float
// texture and sampled by scroll progress in the vertex shader → scrubs perfectly.
export default class Collision extends SceneBase {
  build() {
    const q = this.exp.quality;
    const K = 96; // baked frames
    const sub = 4; // substeps / frame
    const dt = 0.05;
    const G = 1.0;
    const mA = 900, mB = 650;
    const epsC = 3.0, epsS = 1.5;
    const kFric = 0.17, dFric = 13;
    this.K = K;

    const NA = Math.floor(3200 * q);
    const NB = Math.floor(2800 * q);
    const N = NA + NB;
    this.N = N;

    // ---- core state (near-coplanar prograde encounter → strong tidal tails) ----
    let Ax = -34, Ay = -7, Az = 4, Avx = 1.6, Avy = 1.3, Avz = -0.1;
    let Bx = 32, By = 7, Bz = -4, Bvx = -2.2, Bvy = -1.8, Bvz = 0.14;

    // ---- particles ----
    const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
    const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
    const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N);
    const rand = mulberry32(77);

    const norm = (v) => {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const basis = (n) => {
      n = norm(n);
      const a = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
      const u = norm(cross(a, n));
      const w = cross(n, u);
      return { u, w };
    };
    // disks nearly face-on to the camera (normal ~ +z), lightly tilted for depth
    const diskA = basis([0.16, 0.12, 0.98]);
    const diskB = basis([-0.2, 0.14, 0.97]);

    const tmp = new THREE.Color();
    const seedDisk = (start, count, cx, cy, cz, cvx, cvy, cvz, m, bs, rmax, spin, arms, coreCol, armCol) => {
      for (let i = start; i < start + count; i++) {
        const rr = 1.8 + (rmax - 1.8) * Math.pow(rand(), 0.6);
        const branch = ((i - start) % arms) / arms * Math.PI * 2;
        const scatter = Math.pow(rand(), 3) * (rand() < 0.5 ? 1 : -1) * 0.55 * (0.35 + rr / rmax);
        const ang = branch + rr * (2.4 / rmax) + scatter; // log-spiral arms
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const dx = ca * bs.u[0] + sa * bs.w[0];
        const dy = ca * bs.u[1] + sa * bs.w[1];
        const dz = ca * bs.u[2] + sa * bs.w[2];
        px[i] = cx + rr * dx; py[i] = cy + rr * dy; pz[i] = cz + rr * dz;
        const vorb = Math.sqrt((G * m) / (rr + epsS)) * 0.92;
        const tx = (-sa * bs.u[0] + ca * bs.w[0]) * spin;
        const ty = (-sa * bs.u[1] + ca * bs.w[1]) * spin;
        const tz = (-sa * bs.u[2] + ca * bs.w[2]) * spin;
        vx[i] = cvx + vorb * tx; vy[i] = cvy + vorb * ty; vz[i] = cvz + vorb * tz;
        // colour: warm core → cool arms, occasional pink star-forming knot
        tmp.copy(coreCol).lerp(armCol, Math.pow(rr / rmax, 0.8));
        if (rand() < 0.05 && rr > rmax * 0.3) tmp.lerp(new THREE.Color(1.0, 0.45, 0.72), 0.5);
        cr[i] = tmp.r; cg[i] = tmp.g; cb[i] = tmp.b;
      }
    };
    seedDisk(0, NA, Ax, Ay, Az, Avx, Avy, Avz, mA, diskA, 9, 1, 2,
      new THREE.Color(1.0, 0.86, 0.52), new THREE.Color(0.55, 0.66, 1.0));
    seedDisk(NA, NB, Bx, By, Bz, Bvx, Bvy, Bvz, mB, diskB, 7.5, 1, 3,
      new THREE.Color(1.0, 0.74, 0.6), new THREE.Color(0.62, 0.76, 1.0));

    // ---- bake (restricted N-body) ----
    const W = 2048;
    const H = Math.ceil((N * K) / W);
    const data = new Float32Array(W * H * 4);
    const coreData = new Float32Array(K * 2 * 4); // two galactic nuclei per frame

    for (let k = 0; k < K; k++) {
      for (let s = 0; s < sub; s++) {
        // softened gravity + dynamical friction — the orbit decays naturally
        // through a close first passage (tidal tails) into a merged remnant.
        const ddx = Bx - Ax, ddy = By - Ay, ddz = Bz - Az;
        const dist = Math.hypot(ddx, ddy, ddz);
        const inv = 1 / Math.sqrt(dist * dist + epsC * epsC);
        const fA = (G * mB) * inv * inv * inv;
        const fB = (G * mA) * inv * inv * inv;
        const close = 1 / (1 + (dist / dFric) * (dist / dFric));
        const fr = kFric * close;
        Avx += fA * ddx * dt - fr * Avx * dt; Avy += fA * ddy * dt - fr * Avy * dt; Avz += fA * ddz * dt - fr * Avz * dt;
        Bvx += -fB * ddx * dt - fr * Bvx * dt; Bvy += -fB * ddy * dt - fr * Bvy * dt; Bvz += -fB * ddz * dt - fr * Bvz * dt;
        Ax += Avx * dt; Ay += Avy * dt; Az += Avz * dt;
        Bx += Bvx * dt; By += Bvy * dt; Bz += Bvz * dt;

        for (let i = 0; i < N; i++) {
          const dax = Ax - px[i], day = Ay - py[i], daz = Az - pz[i];
          const dbx = Bx - px[i], dby = By - py[i], dbz = Bz - pz[i];
          const iA = 1 / Math.sqrt(dax * dax + day * day + daz * daz + epsS * epsS);
          const iB = 1 / Math.sqrt(dbx * dbx + dby * dby + dbz * dbz + epsS * epsS);
          const fA = (G * mA) * iA * iA * iA;
          const fB = (G * mB) * iB * iB * iB;
          vx[i] += (fA * dax + fB * dbx) * dt;
          vy[i] += (fA * day + fB * dby) * dt;
          vz[i] += (fA * daz + fB * dbz) * dt;
          px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
        }
      }
      for (let i = 0; i < N; i++) {
        const o = (i * K + k) * 4;
        data[o] = px[i]; data[o + 1] = py[i]; data[o + 2] = pz[i];
        data[o + 3] = Math.hypot(vx[i], vy[i], vz[i]);
      }
      const ca = k * 4, cbi = (K + k) * 4;
      coreData[ca] = Ax; coreData[ca + 1] = Ay; coreData[ca + 2] = Az;
      coreData[cbi] = Bx; coreData[cbi + 1] = By; coreData[cbi + 2] = Bz;
    }

    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;

    // ---- two galactic nuclei (bright cores that approach, pass and merge) ----
    const coreTex = new THREE.DataTexture(coreData, K, 2, THREE.RGBAFormat, THREE.FloatType);
    coreTex.minFilter = THREE.NearestFilter;
    coreTex.magFilter = THREE.NearestFilter;
    coreTex.needsUpdate = true;
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([coreData[0], coreData[1], coreData[2], coreData[K * 4], coreData[K * 4 + 1], coreData[K * 4 + 2]]), 3));
    coreGeo.setAttribute('aRow', new THREE.BufferAttribute(new Float32Array([0, 1]), 1));
    coreGeo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array([1.0, 0.85, 0.55, 1.0, 0.7, 0.82]), 3));
    coreGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 140);
    this.coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, { uCore: { value: coreTex }, uK: { value: K }, uFrame: { value: 0 }, uStarburst: { value: 0 } }),
      vertexShader: /* glsl */ `
        attribute float aRow;
        attribute vec3 aTint;
        uniform sampler2D uCore;
        uniform float uK, uFrame, uStarburst, uScale, uPixelRatio;
        varying vec3 vTint;
        varying float vBurst;
        void main(){
          float k0 = floor(uFrame);
          float k1 = min(k0 + 1.0, uK - 1.0);
          float fr = uFrame - k0;
          vec3 p0 = texture2D(uCore, vec2((k0 + 0.5) / uK, (aRow + 0.5) / 2.0)).xyz;
          vec3 p1 = texture2D(uCore, vec2((k1 + 0.5) / uK, (aRow + 0.5) / 2.0)).xyz;
          vec3 pos = mix(p0, p1, fr);
          vTint = aTint;
          vBurst = uStarburst;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = min(uScale * 240.0 * uPixelRatio * (1.0 / -mv.z), 210.0) * (1.0 + uStarburst * 0.5);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying vec3 vTint;
        varying float vBurst;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float glow = pow(1.0 - d, 2.2) * 0.6;
          float coreHot = smoothstep(0.28, 0.0, d);
          vec3 col = mix(vTint, vec3(1.0, 0.95, 1.0), coreHot);
          float b = (glow + coreHot * 1.4) * (1.0 + vBurst * 0.8);
          gl_FragColor = vec4(col * b * uFade, 1.0);
        }
      `,
    });
    this.cores = new THREE.Points(coreGeo, this.coreMat);
    this.cores.frustumCulled = false;

    // ---- geometry ----
    const geo = new THREE.BufferGeometry();
    const pos0 = new Float32Array(N * 3);
    const aIndex = new Float32Array(N);
    const aColor = new Float32Array(N * 3);
    const aScale = new Float32Array(N);
    const aSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const o = i * K * 4;
      pos0[i * 3] = data[o]; pos0[i * 3 + 1] = data[o + 1]; pos0[i * 3 + 2] = data[o + 2];
      aIndex[i] = i;
      aColor[i * 3] = cr[i]; aColor[i * 3 + 1] = cg[i]; aColor[i * 3 + 2] = cb[i];
      aScale[i] = 6 + Math.pow(rand(), 2.5) * 22;
      aSeed[i] = rand() * 20;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos0, 3));
    geo.setAttribute('aIndex', new THREE.BufferAttribute(aIndex, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(aScale, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 140);

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: baseUniforms(this.exp, {
        uPos: { value: tex },
        uW: { value: W },
        uH: { value: H },
        uK: { value: K },
        uFrame: { value: 0 },
        uStarburst: { value: 0 },
      }),
      vertexShader: /* glsl */ `
        attribute float aIndex;
        attribute vec3 aColor;
        attribute float aScale;
        attribute float aSeed;
        uniform sampler2D uPos;
        uniform float uW, uH, uK, uFrame, uStarburst, uTime, uScale, uPixelRatio;
        varying vec3 vCol;
        varying float vB;
        vec4 fetch(float idx){
          float tx = mod(idx, uW);
          float ty = floor(idx / uW);
          return texture2D(uPos, vec2((tx + 0.5) / uW, (ty + 0.5) / uH));
        }
        void main(){
          float k0 = floor(uFrame);
          float k1 = min(k0 + 1.0, uK - 1.0);
          float fr = uFrame - k0;
          float base = aIndex * uK;
          vec4 s0 = fetch(base + k0);
          vec4 s1 = fetch(base + k1);
          vec3 pos = mix(s0.xyz, s1.xyz, fr);
          float speed = mix(s0.w, s1.w, fr);

          // shocked / fast stars ignite a starburst (pink-white) near the merger
          float shock = smoothstep(3.0, 9.0, speed) * uStarburst;
          vCol = mix(aColor, vec3(1.0, 0.7, 0.85), shock * 0.85);
          vB = (0.6 + 0.4 * sin(uTime * 2.2 + aSeed)) * (1.0 + shock * 1.3);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = min(aScale * uScale * uPixelRatio * (1.0 / -mv.z), 34.0) * (1.0 + shock * 0.8);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uFade;
        varying vec3 vCol;
        varying float vB;
        ${POINT_MASK}
        void main(){
          float m = pointMask(gl_PointCoord);
          if (m < 0.01) discard;
          gl_FragColor = vec4(vCol * m * vB * 0.8 * uFade, 1.0);
        }
      `,
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.group.add(this.cores);
    this.group.rotation.x = 0.28;
  }

  update(ctx) {
    const { time, fade, local } = ctx;
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uFade.value = fade;
    u.uFrame.value = local * (this.K - 1);
    // starburst blazes at the first close passage, then again as it settles
    const burst = Math.min(
      1,
      Math.exp(-Math.pow((local - 0.52) * 4.0, 2)) * 0.85 + Math.exp(-Math.pow((local - 0.75) * 4.5, 2)) * 0.7
    );
    u.uStarburst.value = burst;
    const cu = this.coreMat.uniforms;
    cu.uFrame.value = u.uFrame.value;
    cu.uStarburst.value = burst;
    cu.uFade.value = fade;
    this.group.rotation.y = time * 0.02;
  }
}
