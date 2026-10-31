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
8. **Collisions** — a real restricted N-body merger: two galaxies fall together
   under gravity, graze, tear tidal tails, and coalesce into one remnant.
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
- **The collision is simulated, not faked** — a restricted N-body run (gravity +
  dynamical friction) is baked to a float texture at load and replayed by scroll,
  so it scrubs backward and forward through the real encounter.
- **Adaptive text** — the HUD, narration and a documentary "physics caption"
  layer sense the scene's brightness and fade between light and dark ink so the
  type never disappears against the Big-Bang flash or the bright first light.
- **Audio** is 100% generated at runtime (no samples): an evolving six-voice
  drone chord, a swelling sub, filtered "air", sparkle bells at star birth, and
  a Big-Bang impact built from a pitch-dropping boom + a reverberant noise roar.
- **Performance:** adaptive pixel-ratio and particle budgets, a runtime FPS
  downgrade, and a graceful non-WebGL fallback.
- **Type:** Fraunces (display) + Space Mono (instrument HUD), vendored locally in
  `public/fonts` so the piece is fully self-contained.

Everything lives inside this folder; no external runtime dependencies or CDNs.

## Observatory edition — 2026-10-31

The original Big Bang → inflation → matter → first light → stars → galaxies → collision → pale-blue-dot journey has been restored from `b643b5f`. The later single-star editorial layout is no longer loaded.

Enhancements stay within that original experience:

- A seeded, dimensional cosmic filament field during the dawn and assembly of galaxies.
- An authored orbital camera path through the original restricted N-body galaxy collision. Collision orientation now follows scroll progress, so rewinding returns to the same view.
- Word-by-word perspective reveals in the original narrative overlay, with a larger Big Bang typography moment.
- An observatory chapter map, direct time scrubber, optional 150-second drift playback and live direction feedback.
- Motion controls, reduced-flash/static rendering, paused hidden tabs, and a restored end credit linking **made with Purvang** to the portfolio.
- A longer native scroll track that gives the scenes more room.

Research and implementation notes are in [ENHANCEMENTS.md](ENHANCEMENTS.md). The original star-film/image assets remain archived in `public/assets/` and are not part of the active universe.

The production build and simulated-DOM/real Three.js geometry checks pass. Browser visual review remains incomplete because of the app's saved browser permission denial.
