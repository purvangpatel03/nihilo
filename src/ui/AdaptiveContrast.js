// Read a small copy of the finished frame, including bloom, grading and flash.
// Each word/control chooses its own ink: a bright core shouldn't darken the HUD
// in a different, dark corner of the screen. Read immediately after rendering;
// WebGL's default drawing buffer is not preserved between animation frames.
const LINEAR = Float32Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});

// Black and white have equal contrast at this relative luminance.
const CROSSOVER = Math.sqrt(1.05 * 0.05) - 0.05;

export function chooseDarkInk(luminance, previous) {
  // A small dead band prevents flicker when stars cross the threshold, without
  // passing through low-contrast grey. Both inks remain readable in this band.
  if (previous === undefined) return luminance > CROSSOVER;
  return previous ? luminance >= 0.175 : luminance > 0.183;
}

export default class AdaptiveContrast {
  constructor(canvas) {
    this.canvas = canvas;
    this.sample = document.createElement('canvas');
    this.context = this.sample.getContext('2d', { willReadFrequently: true });
    this.lastRead = -Infinity;
    this.lastProgress = -1;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.targets = [...document.querySelectorAll([
      '.hud__corner', '.mute', '.beat__index', '.beat__word', '.beat__sub',
      '.caption', '.cue', '.observatory__tools > button',
      '.observatory__timeline > span', '.observatory__timeline > input',
      '.observatory__direction', '.cosmic-credits > *',
    ].join(','))].map(element => {
      element.classList.add('scene-ink');
      return { element, beat: element.closest('.beat'), dark: undefined };
    });
  }

  update(progress, now = performance.now(), immediate = false) {
    if (!this.context) return;
    const resized = this.canvas.width !== this.lastWidth || this.canvas.height !== this.lastHeight;
    // Check the drawing-buffer size before touching layout, so skipped frames
    // don't force the browser to lay out the animated narration.
    if (!immediate && !resized && Math.abs(progress - this.lastProgress) < 0.001 && now - this.lastRead < 80) return;
    const canvas = this.canvas.getBoundingClientRect();
    if (!canvas.width || !canvas.height) return;
    // Update stationary scenes at most every 80 ms. Scrubbing and still-frame jumps
    // refresh immediately, including when reduced motion renders just one frame.
    this.lastRead = now;
    this.lastProgress = progress;
    this.lastWidth = this.canvas.width;
    this.lastHeight = this.canvas.height;

    const width = Math.min(256, Math.ceil(canvas.width));
    const height = Math.max(1, Math.round(width * canvas.height / canvas.width));
    if (this.sample.width !== width || this.sample.height !== height) {
      this.sample.width = width;
      this.sample.height = height;
    }

    let pixels;
    try {
      this.context.drawImage(this.canvas, 0, 0, width, height);
      pixels = this.context.getImageData(0, 0, width, height).data;
    } catch {
      // Retain white ink and its contrasting outline if readback is unavailable.
      for (const target of this.targets) {
        target.element.dataset.ink = 'light';
        target.dark = false;
      }
      this.context = null;
      return;
    }

    // Read layout before writing any styles to avoid interleaved reflows.
    const visible = this.targets.flatMap(target => {
      const { element, beat } = target;
      if (beat?.style.visibility === 'hidden') return [];
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return [{ target, rect }];
    });

    for (const { target, rect } of visible) {
      const x0 = Math.max(0, Math.floor((rect.left - canvas.left) / canvas.width * width));
      const x1 = Math.min(width, Math.ceil((rect.right - canvas.left) / canvas.width * width));
      const y0 = Math.max(0, Math.floor((rect.top - canvas.top) / canvas.height * height));
      const y1 = Math.min(height, Math.ceil((rect.bottom - canvas.top) / canvas.height * height));
      let luminance = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const index = (y * width + x) * 4;
          luminance += LINEAR[pixels[index]] * 0.2126
            + LINEAR[pixels[index + 1]] * 0.7152
            + LINEAR[pixels[index + 2]] * 0.0722;
          count++;
        }
      }
      if (!count) continue;
      const dark = chooseDarkInk(luminance / count, target.dark);
      if (dark === target.dark) continue;
      target.dark = dark;
      target.element.dataset.ink = dark ? 'dark' : 'light';
    }
  }
}
