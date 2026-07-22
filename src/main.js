import './style.css';
import { webglAvailable } from './lib/webgl.js';
import Experience from './core/Experience.js';
import Scroll from './core/Scroll.js';
import Interface from './ui/Interface.js';
import AudioEngine from './audio/AudioEngine.js';
import Cosmos from './world/Cosmos.js';

// Always start the journey at the beginning, even on refresh.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// Preloader: fade + remove once the app is ready (kills the unstyled flash).
const preload = document.getElementById('preload');
let preloadHidden = false;
function hidePreloader() {
  if (preloadHidden || !preload) return;
  preloadHidden = true;
  preload.dataset.done = 'true';
  setTimeout(() => preload.remove(), 1100);
}

// ---- WebGL gate: a graceful fallback if the graphics layer is unreachable ----
if (!webglAvailable()) {
  document.getElementById('veil')?.setAttribute('data-gone', 'true');
  document.getElementById('webgl')?.remove();
  const fb = document.getElementById('fallback');
  if (fb) fb.hidden = false;
  hidePreloader();
} else {
  boot();
}

function boot() {
  const canvas = document.getElementById('webgl');
  const exp = new Experience(canvas);
  const audio = new AudioEngine();
  const ui = new Interface();
  const scroll = new Scroll({ vh: 1150 });
  const cosmos = new Cosmos(exp, audio);

  // expose for QA / deep-link still frames
  window.__exnihilo = { exp, audio, cosmos, scroll, ui };

  // hard reset to the top so we always begin at t = 0
  window.scrollTo(0, 0);
  document.documentElement.classList.add('is-locked');
  document.body.classList.add('is-locked');
  ui.setBeginReady(false);
  ui.setStatus('shaping the void…');

  let started = false;

  // ---- Story overlay (opened from the logo) ----
  const about = document.getElementById('about');
  const openAbout = () => {
    about.dataset.open = 'true';
    about.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('is-locked');
    document.body.classList.add('is-locked');
  };
  const closeAbout = () => {
    about.dataset.open = 'false';
    about.setAttribute('aria-hidden', 'true');
    if (started) {
      document.documentElement.classList.remove('is-locked');
      document.body.classList.remove('is-locked');
    }
  };
  document.getElementById('logo')?.addEventListener('click', openAbout);
  document.getElementById('about-close')?.addEventListener('click', closeAbout);
  document.getElementById('about-scrim')?.addEventListener('click', closeAbout);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && about.dataset.open === 'true') closeAbout();
  });

  // Begin: the deliberate doorway. Sound + time start here (valid user gesture).
  ui.onBegin(() => {
    started = true;
    // guarantee we open on the void, never mid-journey
    window.scrollTo(0, 0);
    scroll.hardReset();
    document.documentElement.classList.remove('is-locked');
    document.body.classList.remove('is-locked');
    ui.begin();
    audio.start();
    scroll.enable();
  });

  ui.onMute(() => {
    audio.muted = !audio.muted;
    audio.setMuted(audio.muted);
    ui.setMuted(audio.muted);
  });

  ui.onLoop(() => scroll.reset());

  // Deep-link / still-frame mode: ?p=0.5&t=6 renders a single moment of the
  // journey (also how the piece is QA'd frame by frame).
  const params = new URLSearchParams(location.search);
  if (params.has('p') || params.has('about')) {
    const p = Math.max(0, Math.min(1, parseFloat(params.get('p')) || 0));
    const t = parseFloat(params.get('t') || '5');
    started = true;
    document.getElementById('veil').style.display = 'none';
    ui.begin();
    const draw = () => {
      cosmos.warm();
      exp._onResize(); // re-measure in case the viewport settled after load
      exp.elapsed = t;
      exp.gradePass.uniforms.uTime.value = t;
      cosmos.update(p, t, 0.016);
      ui.update(p);
      ui.setBgLuminance(cosmos.bgLum, 1);
      exp.render();
      hidePreloader();
      if (params.has('about')) openAbout();
    };
    setTimeout(draw, 80);
    setTimeout(draw, 450);
    setTimeout(draw, 950);
    return;
  }

  // The render loop runs from the start so the singularity is alive behind the
  // veil — then blooms the instant the doorway opens.
  function frame() {
    requestAnimationFrame(frame);
    exp.tick();
    const p = scroll.update(exp.dt);
    cosmos.update(p, exp.elapsed, exp.dt);
    audio.render(p, exp.dt);
    ui.update(p);
    ui.setBgLuminance(cosmos.bgLum, exp.dt);
    exp.render();
  }
  frame();

  // Warm all scenes + compile shaders while the veil is up, so nothing hitches.
  // Runs on the first spare frame, with a timeout fallback so "Begin" always
  // becomes available even if rAF is briefly throttled at load.
  let warmed = false;
  const doWarm = () => {
    if (warmed) return;
    warmed = true;
    try {
      cosmos.warm();
    } catch (e) {
      console.error('warm failed', e);
    }
    ui.setStatus('ready — turn up your sound');
    ui.setBeginReady(true);
    hidePreloader();
  };
  requestAnimationFrame(() => requestAnimationFrame(doWarm));
  setTimeout(doWarm, 400);

  // Pause the AudioContext when the tab is hidden; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (!audio.ctx) return;
    if (document.hidden) audio.ctx.suspend?.();
    else if (started && !audio.muted) audio.ctx.resume?.();
  });
}
