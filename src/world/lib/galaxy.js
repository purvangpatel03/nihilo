import * as THREE from 'three';
import { mulberry32 } from '../../lib/math.js';

// Generates spiral-galaxy attributes in polar form so the same data can drive
// both a lone rotating galaxy and the two galaxies of the collision.
// Returns a BufferGeometry with: position (rest, for bounds), aPolar (r,angle,y),
// aScale, aColor, aSeed.
export function buildGalaxyGeometry(count, opts = {}) {
  const {
    R = 26,
    arms = 3,
    twist = 2.4,
    spread = 0.5,
    thickness = 2.2,
    seed = 1,
    coreColor = new THREE.Color(1.0, 0.86, 0.55),
    edgeColor = new THREE.Color(0.45, 0.6, 1.0),
    hiiColor = new THREE.Color(1.0, 0.45, 0.7),
  } = opts;

  const rand = mulberry32(seed);
  const position = new Float32Array(count * 3);
  const polar = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const sd = new Float32Array(count);

  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const branch = (i % arms) / arms * Math.PI * 2;
    const r = Math.pow(rand(), 0.5) * R;
    const spin = r * (twist / R);
    const ra = () => Math.pow(rand(), 3) * (rand() < 0.5 ? 1 : -1) * spread * (0.4 + r / R);
    const angle = branch + spin + ra() * 1.2;
    const y = (Math.pow(rand(), 3) * (rand() < 0.5 ? 1 : -1) * thickness) * (1 - (r / R) * 0.5);

    polar[i * 3 + 0] = r;
    polar[i * 3 + 1] = angle;
    polar[i * 3 + 2] = y + (r < R * 0.12 ? (rand() - 0.5) * thickness * 1.6 : 0); // bulge

    position[i * 3 + 0] = Math.cos(angle) * r;
    position[i * 3 + 1] = polar[i * 3 + 2];
    position[i * 3 + 2] = Math.sin(angle) * r;

    const tRad = r / R;
    c.copy(coreColor).lerp(edgeColor, Math.pow(tRad, 0.8));
    if (rand() < 0.05 && tRad > 0.25) c.lerp(hiiColor, 0.6); // pink star-forming knots
    color[i * 3 + 0] = c.r;
    color[i * 3 + 1] = c.g;
    color[i * 3 + 2] = c.b;

    scale[i] = (4 + Math.pow(rand(), 2.5) * 26) * (tRad < 0.1 ? 1.5 : 1);
    sd[i] = rand() * 20;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aPolar', new THREE.BufferAttribute(polar, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 3);
  return geo;
}
