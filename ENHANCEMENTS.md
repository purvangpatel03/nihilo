# Restored universe, enhanced observatory

The user requested the original cosmic experience back, including its Big Bang and galaxy merger. `index.html`, the main entry point, the stylesheet and the README were first restored from `b643b5f`. The original nine scene classes and collision integrator remain the foundation.

## What changed

The page remains one full-screen canvas. It does not use Halcyon's scrolling editorial sections or Anima's botanical composition. A subtle cosmic-web field gives early galaxies dimensional context. During the existing collision, camera position, field of view and galaxy orientation now follow reversible progress. Narration has individual word reveals. The new observatory controls provide chapter selection, a time slider, optional drift playback and motion reduction. The final frame includes the portfolio credit.

The nine-act timeline is artistically compressed. The opening is a poetic interpretation, not a claim that science has established what preceded the Big Bang. The early clock no longer runs backward between the Big Bang and inflation labels. Reduced motion removes camera shake and chromatic effects, lowers the flash, freezes decorative time and redraws only on input.

## Research

- [Codrops — Cinematic 3D Scroll Experiences](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/): coordinate camera, lighting, shader and typography changes around one progress value.
- [NASA — The Big Bang](https://science.nasa.gov/universe/the-big-bang/): scientific grounding for the early-universe context and uncertainty around the earliest instant.
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/): scrubbing and responsive layout principles. Nihilo retains its original native-scroll implementation.
- [W3C — Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide): controls for ongoing motion.

## Verification

The Vite production build passes. Source-level tests instantiate all nine Three.js scene geometries, including the original baked collision. They check finite values at representative epochs and deterministic camera/collision values after scrubbing backward. Simulated-DOM tests exercise chapter selection, direct scrubbing, drift controls, reduced motion, credits and word construction.

These checks do not replace a GPU-rendered browser review. That review is still blocked by the saved browser permission setting, even after the user authorized it in chat.
