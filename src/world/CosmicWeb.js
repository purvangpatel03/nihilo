import * as THREE from 'three';
import { mulberry32, smoothstep } from '../lib/math.js';
// An authored filament field gives the cosmic dawn and galaxy assembly depth.
// Seeded geometry stays identical when time is scrubbed in either direction.
export default class CosmicWeb {
    constructor() {
        this.group = new THREE.Group();
        this.group.position.z = -95;
        const rand = mulberry32(1907), nodes = [];
        for (let i = 0; i < 38; i++)
            nodes.push(new THREE.Vector3((rand() - .5) * 360, (rand() - .5) * 220, (rand() - .5) * 160));
        const vertices = [], dust = [];
        nodes.forEach((a, i) => {
            const near = nodes.map((b, j) => ({ b, j, d: a.distanceTo(b) })).filter(x => x.j > i).sort((x, y) => x.d - y.d).slice(0, 3);
            near.forEach(({ b }) => {
                for (let j = 0; j < 20; j++) {
                    const p = a.clone().lerp(b, j / 20), q = a.clone().lerp(b, (j + 1) / 20);
                    const bend = Math.sin(j / 20 * Math.PI) * 8;
                    p.y += bend;
                    q.y += Math.sin((j + 1) / 20 * Math.PI) * 8;
                    vertices.push(...p.toArray(), ...q.toArray());
                    for (let k = 0; k < 3; k++)
                        dust.push(p.x + (rand() - .5) * 9, p.y + (rand() - .5) * 9, p.z + (rand() - .5) * 9);
                }
            });
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x5f74c9, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.group.add(this.lines);
        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
        this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xa69ad8, size: .21, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.group.add(this.dust);
    }
    update(p, time, reduced) {
        const strength = smoothstep(.56, .66, p) * (1 - smoothstep(.79, .84, p));
        this.group.visible = strength > .001;
        this.lines.material.opacity = strength * .14;
        this.dust.material.opacity = strength * .35;
        this.group.rotation.y = (p - .65) * .7 + (reduced ? 0 : Math.sin(time * .035) * .025);
        this.group.rotation.z = (p - .6) * .08;
        this.group.scale.setScalar(.8 + smoothstep(.56, .81, p) * .45);
    }
}
