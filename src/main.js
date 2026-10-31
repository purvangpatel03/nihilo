import './style.css';
import { webglAvailable } from './lib/webgl.js';
import Experience from './core/Experience.js';
import Scroll from './core/Scroll.js';
import Interface from './ui/Interface.js';
import Observatory from './ui/Observatory.js';
import AdaptiveContrast from './ui/AdaptiveContrast.js';
import AudioEngine from './audio/AudioEngine.js';
import Cosmos from './world/Cosmos.js';
if ('scrollRestoration' in history)
    history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const preload = document.getElementById('preload');
let preloadHidden = false;
function hidePreloader() {
    if (preloadHidden || !preload)
        return;
    preloadHidden = true;
    preload.dataset.done = 'true';
    setTimeout(() => preload.remove(), 1100);
}
function unlock() { document.documentElement.classList.remove('is-locked'); document.body.classList.remove('is-locked'); }
function showFallback() {
    unlock();
    document.getElementById('veil').dataset.gone = 'true';
    document.getElementById('webgl').hidden = true;
    document.getElementById('fallback').hidden = false;
    document.querySelectorAll('.observatory,.hud,.narration,.cue,.caption,.cosmic-credits').forEach(el => el.hidden = true);
    hidePreloader();
}
if (!webglAvailable())
    showFallback();
else {
    try {
        boot();
    }
    catch (error) {
        console.error('The graphics layer could not start.', error);
        showFallback();
    }
}
function boot() {
    const canvas = document.getElementById('webgl');
    const exp = new Experience(canvas), audio = new AudioEngine(), ui = new Interface();
    const scroll = new Scroll({ vh: 1550 });
    const cosmos = new Cosmos(exp, audio);
    let started = false, raf = 0, warmed = false, failed = false;
    function wake() { if (!raf && !document.hidden && !failed)
        raf = requestAnimationFrame(frame); }
    const observatory = new Observatory({ scroll, experience: exp, onMotion: () => wake(), onWake: wake });
    const contrast = new AdaptiveContrast(canvas);
    window.__exnihilo = { exp, audio, cosmos, scroll, ui, observatory };
    document.documentElement.classList.add('is-locked');
    document.body.classList.add('is-locked');
    ui.setBeginReady(false);
    ui.setStatus('shaping the void…');
    const about = document.getElementById('about');
    let previousFocus;
    function openAbout() {
        previousFocus = document.activeElement;
        observatory.stopDrift();
        about.dataset.open = 'true';
        about.inert = false;
        about.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('is-locked');
        document.body.classList.add('is-locked');
        document.getElementById('about-close').focus();
    }
    function closeAbout() { about.dataset.open = 'false'; about.inert = true; about.setAttribute('aria-hidden', 'true'); if (started)
        unlock(); previousFocus?.focus(); }
    document.getElementById('logo').addEventListener('click', openAbout);
    document.getElementById('about-close').addEventListener('click', closeAbout);
    document.getElementById('about-scrim').addEventListener('click', closeAbout);
    window.addEventListener('keydown', e => {
        if (about.dataset.open !== 'true')
            return;
        if (e.key === 'Escape')
            closeAbout();
        if (e.key === 'Tab') {
            const focusables = [...about.querySelectorAll('button,a[href]')];
            const first = focusables[0], last = focusables.at(-1);
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
    ui.onBegin(() => {
        started = true;
        scroll.hardReset();
        unlock();
        ui.begin();
        observatory.begin();
        scroll.enable();
        audio.start().catch(() => { audio.setMuted(true); ui.setMuted(true); });
        document.getElementById('logo').focus({ preventScroll: true });
        wake();
    });
    ui.onMute(() => { audio.setMuted(!audio.muted); ui.setMuted(audio.muted); });
    ui.onLoop(() => { observatory.stopDrift(); scroll.reset(); wake(); });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; cancelAnimationFrame(raf); audio.setMuted(true); showFallback(); });
    function frame() {
        raf = 0;
        if (failed || document.hidden)
            return;
        if (observatory.reduced) {
            exp.dt = 1 / 60;
            exp.pointer.set(0, 0);
        }
        else
            exp.tick();
        if (started)
            observatory.tick(exp.dt);
        const p = scroll.update(exp.dt);
        cosmos.update(p, exp.elapsed, exp.dt);
        audio.render(p, exp.dt);
        ui.update(p);
        observatory.update(p, scroll.velocity);
        exp.render();
        contrast.update(p, performance.now(), observatory.reduced);
        if (!observatory.reduced)
            wake();
    }
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(raf);
            raf = 0;
            audio.ctx?.suspend();
        }
        else {
            exp.clock.getDelta();
            if (started && !audio.muted)
                audio.ctx?.resume().catch(() => { });
            wake();
        }
    });
    const params = new URLSearchParams(location.search);
    function warm() {
        if (warmed || failed)
            return;
        warmed = true;
        try {
            cosmos.warm();
        }
        catch (error) {
            console.error('Scene preparation failed.', error);
            failed = true;
            showFallback();
            return;
        }
        ui.setStatus('ready — scroll to begin time');
        ui.setBeginReady(true);
        hidePreloader();
        if (params.has('p') || params.has('about')) {
            started = true;
            unlock();
            ui.begin();
            observatory.begin();
            scroll.enable();
            observatory.setReduced(true);
            scroll.seek(Math.max(0, Math.min(1, Number(params.get('p')) || 0)), true);
            exp.elapsed = Number(params.get('t')) || 6;
            exp.gradePass.uniforms.uTime.value = exp.elapsed;
            if (params.has('about'))
                openAbout();
        }
        wake();
    }
    requestAnimationFrame(warm);
    setTimeout(warm, 400);
}
