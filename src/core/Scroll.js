import { clamp, damp } from '../lib/math.js';

// Turns native scroll into a smoothed 0..1 journey progress.
// The scrollbar IS cosmic time — so we give it a long, deliberate track.
export default class Scroll {
  constructor({ vh = 1150 } = {}) {
    this.track = document.getElementById('scroll-track');
    this.trackVh = vh;
    this.target = 0;
    this.progress = 0;
    this.velocity = 0;
    this._last = 0;
    this._enabled = false;

    this._applyHeight();
    window.addEventListener('resize', () => this._applyHeight(), { passive: true });
    window.addEventListener('scroll', () => this._read(), { passive: true });
    this._read();
  }

  _applyHeight() {
    // Track height in px sets the total scrollable distance.
    this.trackHeightPx = (this.trackVh / 100) * window.innerHeight;
    if (this.track) this.track.style.height = `${this.trackHeightPx}px`;
    this._read();
  }

  _read() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this.target = clamp(window.scrollY / max, 0, 1);
  }

  enable() {
    this._enabled = true;
  }

  // Programmatic reset to top (used by the "scroll again" loop).
  reset() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Instant reset — used at "Begin" so the journey always opens at t = 0,
  // even if the browser tried to restore a scroll position on refresh.
  hardReset() {
    window.scrollTo(0, 0);
    this.target = 0;
    this.progress = 0;
    this.velocity = 0;
  }

  update(dt) {
    const prev = this.progress;
    // Lerp for that heavy, filmic scroll feel.
    this.progress = damp(this.progress, this.target, 5.5, dt);
    this.velocity = dt > 0 ? (this.progress - prev) / dt : 0;
    return this.progress;
  }
}
