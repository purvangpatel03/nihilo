# Stellar study

`stellar-film.mp4` is an original procedural 8-second film created for Nihilo.
Multi-frequency dust filaments swirl around a turbulent plasma surface and
bright corona. This is an artistic visualization, not observational footage.

- 960 × 540 pixels, 24 fps, H.264/YUV420p, silent, faststart.
- Every motion is periodic; safe to use with the native video `loop` attribute.
- `stellar-film-poster.jpg` is a frame from the film.
- Complete reproducible renderer: `tools/render-film.py` in this repository.
  Run `python tools/render-film.py nihilo` with NumPy and FFmpeg installed.
- No third-party media or downloaded footage is used.

For browser use, prefer `muted playsinline loop`, load only when near the
viewport, and display the poster for reduced-motion preferences.
