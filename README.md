# Nihilo — A Brief Eternity

A cinematic story about the full life of one imagined massive star, from a molecular cloud to a black-hole remnant. Scrolling forward advances its life; scrolling backward reverses its transformations.

## Six chapters

1. Molecular cloud — gravity gathers gas and dust.
2. Protostar — contraction and ignition.
3. Main sequence — a life held in balance.
4. Red supergiant — expansion and heavier elements.
5. Supernova — core collapse and an expanding particle shell.
6. Black-hole remnant — a dark core and luminous accretion ring.

The page explicitly describes this as an artistic interpretation of one possible lifecycle, with compressed time/scale and a link to [NASA's star science](https://science.nasa.gov/universe/stars/).

## Features

- Original imagegen stellar portrait, delivered as a 196 KB WebP; full PNG retained.
- Three.js star with a procedural plasma shader, particle cloud, corona and accretion ring.
- Scroll-direction spring motion; the star becomes a small companion outside its main stage.
- An original eight-second stellar film with poster and pause control.
- Optional generated ambient sound, enabled only by a deliberate button press.
- Native scroll, chapter links, a responsive mobile composition, keyboard support, reduced motion and a non-WebGL fallback.
- Local fonts and bundled Three.js; no runtime CDN dependency.
- `made with Purvang` links to https://purvang.vercel.app/ in the footer.

## Run and build

```sh
npm install
npm run dev
npm run build
npm run preview
```

Vite serves on port 5173. Production output is `dist/`. The active entry point is `src/main.js`; `src/experience.js` owns the new lifecycle and interaction system. Earlier cosmos/audio modules are retained but no longer loaded.

## Assets and validation

Exact built-in imagegen prompt: [public/assets/ASSETS.md](public/assets/ASSETS.md). Film provenance: [public/assets/VIDEO.md](public/assets/VIDEO.md).

The production build, source asset/anchor/CSS/JS checks, interaction checks and reversible Three.js lifecycle geometry checks pass. Media passed FFmpeg decode verification. Browser visual testing was blocked by a saved browser permission setting and has not been completed.
