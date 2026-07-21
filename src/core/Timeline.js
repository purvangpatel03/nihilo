import { clamp, lerp } from '../lib/math.js';

// The nine acts of EX NIHILO, laid along the 0..1 scroll.
// Ranges are contiguous; each scene fades across its own soft window.
export const ACTS = [
  { id: 'void', name: 'The Quantum Dark', start: 0.0, end: 0.11 },
  { id: 'bang', name: 'Let There Be', start: 0.11, end: 0.2 },
  { id: 'inflation', name: 'Inflation', start: 0.2, end: 0.32 },
  { id: 'particles', name: 'Particle Era', start: 0.32, end: 0.45 },
  { id: 'firstlight', name: 'First Light', start: 0.45, end: 0.57 },
  { id: 'stars', name: 'First Stars', start: 0.57, end: 0.69 },
  { id: 'galaxies', name: 'Galaxies', start: 0.69, end: 0.81 },
  { id: 'collision', name: 'Collisions', start: 0.81, end: 0.92 },
  { id: 'here', name: 'You Are Here', start: 0.92, end: 1.0 },
];

// The instant the universe detonates. Everything A/V pivots around this.
export const BANG_AT = 0.152;

export function actAt(p) {
  for (let i = 0; i < ACTS.length; i++) {
    if (p < ACTS[i].end || i === ACTS.length - 1) return ACTS[i];
  }
  return ACTS[ACTS.length - 1];
}

export function localProgress(p, act) {
  return clamp((p - act.start) / (act.end - act.start), 0, 1);
}

// ---- The cosmic clock (diegetic) -----------------------------------------
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) =>
  String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');

const commas = (n) => Math.round(n).toLocaleString('en-US');

// Returns { value, epoch } for the readout in the top-right.
export function clockFor(p) {
  const act = actAt(p);
  const t = localProgress(p, act);
  switch (act.id) {
    case 'void':
      return { value: 't = 0', epoch: 'the quantum dark' };
    case 'bang': {
      const exp = Math.round(lerp(-43, -12, t));
      return { value: `t = 10${sup(exp)} s`, epoch: 'the first instant' };
    }
    case 'inflation': {
      const exp = Math.round(lerp(-36, -32, t));
      return { value: `t = 10${sup(exp)} s`, epoch: 'cosmic inflation' };
    }
    case 'particles': {
      if (t < 0.5) {
        const exp = Math.round(lerp(-6, 0, t * 2));
        return { value: `t = 10${sup(exp)} s`, epoch: 'the particle forge' };
      }
      const secs = lerp(1, 180, (t - 0.5) * 2);
      return { value: `t = ${secs < 90 ? Math.round(secs) + ' s' : '3 min'}`, epoch: 'nucleosynthesis' };
    }
    case 'firstlight':
      return { value: `t = ${commas(lerp(240000, 380000, t))} yr`, epoch: 'recombination' };
    case 'stars': {
      const myr = lerp(100, 400, t);
      return { value: `t = ${Math.round(myr)} Myr`, epoch: 'cosmic dawn' };
    }
    case 'galaxies': {
      const byr = lerp(1.0, 3.5, t);
      return { value: `t = ${byr.toFixed(1)} Byr`, epoch: 'the great assembly' };
    }
    case 'collision': {
      const byr = lerp(4.0, 10.5, t);
      return { value: `t = ${byr.toFixed(1)} Byr`, epoch: 'the age of collisions' };
    }
    case 'here':
      return { value: `t = 13.8 Byr`, epoch: 'now' };
    default:
      return { value: 't = 0', epoch: '' };
  }
}

// ---- Narrative script -----------------------------------------------------
// Sparse, reverent, second person. Each beat fades across its [start,end].
export const BEATS = [
  {
    start: 0.008,
    end: 0.055,
    kicker: 'i',
    line: 'Nothing.<br>Not even the dark.',
    sub: 'no space to cross · no time to keep',
    align: 'center',
  },
  {
    start: 0.058,
    end: 0.108,
    kicker: 'ii',
    line: 'Only a single point,<br>holding <em>everything</em>.',
    sub: 'move closer — it feels you',
    align: 'center',
  },
  {
    start: 0.115,
    end: 0.146,
    kicker: 'iii',
    line: 'It cannot hold.',
    sub: '',
    align: 'center',
  },
  {
    start: 0.156,
    end: 0.198,
    kicker: '',
    line: 'Let there be —',
    sub: '',
    align: 'center',
  },
  {
    start: 0.215,
    end: 0.305,
    kicker: 'iv',
    line: 'In less than a heartbeat,<br>space outruns <em>light</em>.',
    sub: 'the universe doubles · and doubles · and doubles',
    align: 'low',
  },
  {
    start: 0.335,
    end: 0.435,
    kicker: 'v',
    line: 'Out of pure heat,<br>the first <em>matter</em>.',
    sub: 'quarks — then the things they build',
    align: 'low',
  },
  {
    start: 0.465,
    end: 0.56,
    kicker: 'vi',
    line: 'After 380,000 years of fog,<br>it clears — and <em>shines</em>.',
    sub: 'the first light — still falling on us today',
    align: 'low',
  },
  {
    start: 0.585,
    end: 0.68,
    kicker: 'vii',
    line: 'Gravity gathers the dark<br>until it catches <em>fire</em>.',
    sub: 'the first stars ignite',
    align: 'low',
  },
  {
    start: 0.705,
    end: 0.8,
    kicker: 'viii',
    line: 'A hundred billion suns<br>learn to turn <em>together</em>.',
    sub: 'galaxies',
    align: 'low',
  },
  {
    start: 0.825,
    end: 0.91,
    kicker: 'ix',
    line: 'And even galaxies<br>fall toward one another.',
    sub: 'a collision ten billion years wide',
    align: 'low',
  },
  {
    start: 0.93,
    end: 0.99,
    kicker: 'x',
    line: '13.8 billion years later,<br>a little of that first light<br>is <em>reading this</em>.',
    sub: 'you are here',
    align: 'center',
  },
];
