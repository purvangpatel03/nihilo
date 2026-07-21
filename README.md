# EX NIHILO — the birth of everything

A scroll-driven, real-time WebGL journey from before time to the present day.
The scrollbar *is* cosmic time: you scroll the universe into existence out of a
single trembling point, through the Big Bang, inflation, the first matter, the
first light, the first stars, galaxies, a galactic collision — and finally to a
pale blue dot with a little of that first light still falling on it.

Built with Three.js, custom GLSL, and a fully generative Web Audio score that
evolves with the journey and detonates at the Big Bang.

---

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**

Click **Begin** (this is the deliberate doorway that starts sound + time — it
also satisfies browser autoplay rules), then **scroll**. Use a trackpad or mouse
wheel; headphones and full-screen strongly recommended.

Production build:

```bash
npm run build && npm run preview   # also served at http://localhost:5173
```

---

## The nine acts

1. **The Quantum Dark** — a breathing singularity that leans toward your cursor.
2. **Let There Be** — the detonation: a blinding flash, a fireball, a felt bass impact.
3. **Inflation** — space itself outrunning light in a storm of streaks.
4. **The Particle Era** — the first matter, a cooling curl-noise soup.
5. **First Light** — recombination: the cosmic microwave background clears and shines.
6. **First Stars** — gravity gathers the dark until it catches fire.
7. **Galaxies** — a hundred billion suns learning to turn together.
8. **Collisions** — two galaxies falling toward one another, tidal tails and all.
9. **You Are Here** — the pull-back to a pale blue dot.

## Controls & details

- **Scroll** drives everything — visuals, camera, narration, and the generative score.
- Click **EX NIHILO** (top-left) to open the story — what the piece means and how it works.
- **SOUND** button (bottom-right) mutes/unmutes.
- A live cosmic **clock** (top-right) reads out the age of the universe as you go.
- **Cursor** interplay: the singularity and camera react to pointer movement.
- **Deep-link / still-frame mode:** append `?p=0.5` (0–1) and optionally `&t=6`
  to freeze the journey at any moment — handy for screenshots.

## Craft notes

- **Rendering:** Three.js + `EffectComposer` (UnrealBloom + a custom grade pass
  that owns vignette, film grain, chromatic aberration and the Big-Bang flash).
- **Everything is GPU particles / shaders** — simplex + curl noise, additive
  point systems, a spiral-galaxy generator, and a CMB temperature-map shader.
- **Audio** is 100% generated at runtime (no samples): an evolving six-voice
  drone chord, a swelling sub, filtered "air", sparkle bells at star birth, and
  a Big-Bang impact built from a pitch-dropping boom + a reverberant noise roar.
- **Performance:** adaptive pixel-ratio and particle budgets, a runtime FPS
  downgrade, and a graceful non-WebGL fallback.
- **Type:** Fraunces (display) + Space Mono (instrument HUD), vendored locally in
  `public/fonts` so the piece is fully self-contained.

Everything lives inside this folder; no external runtime dependencies or CDNs.
