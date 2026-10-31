import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdaptiveContrast, { chooseDarkInk } from '../src/ui/AdaptiveContrast.js';

function fixture(t) {
  const previousDocument = globalThis.document;
  t.after(() => { globalThis.document = previousDocument; });
  let brightness = x => x < 50 ? 255 : 0;
  let reads = 0;
  let fail = false;
  const context = {
    drawImage() { reads++; },
    getImageData() {
      if (fail) throw new Error('Readback unavailable');
      const data = new Uint8ClampedArray(100 * 20 * 4);
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 100; x++) {
          const i = (y * 100 + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = brightness(x);
          data[i + 3] = 255;
        }
      }
      return { data };
    },
  };
  const target = left => ({
    classList: { add() {} }, dataset: {}, closest: () => null,
    getBoundingClientRect: () => ({ left, right: left + 30, top: 5, bottom: 15, width: 30, height: 10 }),
  });
  const bright = target(10), dark = target(60);
  globalThis.document = {
    createElement: () => ({ getContext: () => context }),
    querySelectorAll: () => [bright, dark],
  };
  const canvas = { width: 100, height: 20, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 20 }) };
  return {
    controller: new AdaptiveContrast(canvas), bright, dark, canvas,
    setBrightness: fn => { brightness = fn; },
    failReadback: () => { fail = true; },
    get reads() { return reads; },
  };
}

test('simultaneous bright and dark backgrounds receive independent black and white ink', t => {
  const f = fixture(t);
  f.controller.update(0, 0);
  assert.equal(f.bright.dataset.ink, 'dark');
  assert.equal(f.dark.dataset.ink, 'light');
});

test('scrolling forward and rewinding both restore the correct local ink', t => {
  const f = fixture(t);
  f.setBrightness(() => 0);
  f.controller.update(0.05, 0);
  assert.equal(f.bright.dataset.ink, 'light');
  f.setBrightness(() => 255);
  f.controller.update(0.17, 1);
  assert.equal(f.bright.dataset.ink, 'dark');
  assert.equal(f.dark.dataset.ink, 'dark');
  f.setBrightness(x => x < 50 ? 0 : 255);
  f.controller.update(0.75, 2);
  assert.equal(f.bright.dataset.ink, 'light');
  assert.equal(f.dark.dataset.ink, 'dark');
  f.setBrightness(() => 255);
  f.controller.update(0.17, 3);
  assert.equal(f.bright.dataset.ink, 'dark');
  f.setBrightness(() => 0);
  f.controller.update(0.05, 4);
  assert.equal(f.bright.dataset.ink, 'light');
  assert.equal(f.dark.dataset.ink, 'light');
});

test('hidden narration and empty viewports are ignored safely', t => {
  const f = fixture(t);
  f.controller.targets[0].beat = { style: { visibility: 'hidden' } };
  f.controller.update(0, 0);
  assert.equal(f.bright.dataset.ink, undefined);
  assert.equal(f.dark.dataset.ink, 'light');
  f.controller.targets[0].beat.style.visibility = 'visible';
  f.controller.update(0.5, 1);
  assert.equal(f.bright.dataset.ink, 'dark');
  f.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  assert.doesNotThrow(() => f.controller.update(0.6, 2));
  assert.equal(f.reads, 2);
});

test('ink is stable near the threshold and retains at least 4.5:1 contrast on uniform backgrounds', () => {
  assert.equal(chooseDarkInk(0), false);
  assert.equal(chooseDarkInk(1), true);
  assert.equal(chooseDarkInk(0.18, true), true);
  assert.equal(chooseDarkInk(0.18, false), false);
  assert.equal(chooseDarkInk(0.17, true), false);
  assert.equal(chooseDarkInk(0.19, false), true);
  for (let i = 0; i <= 1000; i++) {
    const luminance = i / 1000;
    for (const previous of [undefined, true, false]) {
      const dark = chooseDarkInk(luminance, previous);
      const contrast = dark ? (luminance + 0.05) / 0.05 : 1.05 / (luminance + 0.05);
      assert.ok(contrast >= 4.5 - 1e-12, `Insufficient contrast at luminance ${luminance}`);
    }
  }
});

test('stationary animations refresh while repeated frames are throttled', t => {
  const f = fixture(t);
  f.controller.update(0, 0);
  f.setBrightness(() => 0);
  f.controller.update(0, 40);
  assert.equal(f.reads, 1);
  f.controller.update(0, 80);
  assert.equal(f.reads, 2);
  assert.equal(f.bright.dataset.ink, 'light');
});

test('a reduced-motion scroll jump or resize updates within the throttle window', t => {
  const f = fixture(t);
  f.controller.update(0, 0);
  f.setBrightness(() => 255);
  f.controller.update(0.75, 1);
  assert.equal(f.reads, 2);
  assert.equal(f.dark.dataset.ink, 'dark');
  f.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 99, height: 20 });
  f.canvas.width = 99;
  f.controller.update(0.75, 2);
  assert.equal(f.reads, 3);
  f.setBrightness(() => 0);
  f.controller.update(0.75001, 3, true);
  assert.equal(f.reads, 4);
  assert.equal(f.bright.dataset.ink, 'light');
});

test('unavailable readback preserves the CSS fallback and stops further reads', t => {
  const f = fixture(t);
  f.controller.update(0, 0);
  assert.equal(f.bright.dataset.ink, 'dark');
  f.failReadback();
  assert.doesNotThrow(() => f.controller.update(0, 80));
  assert.equal(f.bright.dataset.ink, 'light');
  assert.doesNotThrow(() => f.controller.update(0.75, 100));
  assert.equal(f.reads, 2);
});
