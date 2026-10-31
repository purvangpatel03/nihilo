import { ACTS, actAt, clockFor } from '../core/Timeline.js';
// A telescope-like transport around the original uninterrupted canvas.
export default class Observatory {
    constructor({ scroll, experience, onMotion, onWake }) {
        this.scroll = scroll;
        this.exp = experience;
        this.onMotion = onMotion;
        this.onWake = onWake;
        this.started = false;
        this.drifting = false;
        this.lastAct = -1;
        this.progress = 0;
        this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
        this.reduced = this.motionQuery.matches;
        experience.reducedMotion = this.reduced;
        this.root = document.createElement('aside');
        this.root.className = 'observatory';
        this.root.setAttribute('aria-label', 'Journey controls');
        this.root.dataset.ready = 'false';
        this.root.innerHTML = `<div class="observatory__tools"><button type="button" data-map aria-haspopup="dialog">CHAPTERS <span>＋</span></button><button type="button" data-drift aria-pressed="false">DRIFT <span>▷</span></button><button type="button" data-motion aria-pressed="${this.reduced}">${this.reduced ? 'MOTION OFF' : 'MOTION ON'}</button></div><div class="observatory__timeline"><span data-position>01 / 09</span><label class="sr-only" for="cosmic-scrub">Travel through cosmic time</label><input id="cosmic-scrub" type="range" min="0" max="1000" step="1" value="0"><span>13.8 BYR</span></div><p class="observatory__direction" aria-hidden="true">SCROLL TO MOVE THROUGH TIME</p>`;
        document.body.append(this.root);
        this.range = this.root.querySelector('input');
        this.position = this.root.querySelector('[data-position]');
        this.direction = this.root.querySelector('.observatory__direction');
        this.dialog = document.createElement('dialog');
        this.dialog.className = 'chapter-map';
        this.dialog.setAttribute('aria-label', 'Nine chapters of the universe');
        this.dialog.innerHTML = `<div class="chapter-map__head"><span>EX NIHILO / THE OBSERVATORY</span><button data-close aria-label="Close chapters">✕</button></div><h2>Choose a moment<br>in <em>everything.</em></h2><div class="chapter-map__list">${ACTS.map((a, i) => `<button data-go="${i}"><span>${String(i + 1).padStart(2, '0')}</span><strong>${a.name}</strong><small>${clockFor((a.start + a.end) / 2).value.replace('t = ', '')}</small><b>↗</b></button>`).join('')}</div><p>Every scene is alive. Every moment can be revisited.</p>`;
        document.body.append(this.dialog);
        this.root.querySelector('[data-map]').addEventListener('click', () => { this.stopDrift(); this.dialog.showModal(); });
        this.dialog.querySelector('[data-close]').addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', e => { if (e.target === this.dialog)
            this.dialog.close(); });
        this.dialog.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => {
            const a = ACTS[Number(button.dataset.go)];
            this.scroll.seek(a.start + (a.end - a.start) * .36, true);
            this.dialog.close();
            this.onWake();
        }));
        this.range.addEventListener('input', () => { this.stopDrift(); scroll.seek(Number(this.range.value) / 1000, true); this.onWake(); });
        this.root.querySelector('[data-drift]').addEventListener('click', () => { if (!this.reduced) {
            this.drifting = !this.drifting;
            this.syncDrift();
            this.onWake();
        } });
        this.root.querySelector('[data-motion]').addEventListener('click', () => this.setReduced(!this.reduced));
        this.motionQuery.addEventListener('change', e => this.setReduced(e.matches));
        for (const event of ['wheel', 'touchstart', 'pointerdown'])
            window.addEventListener(event, e => { if (!this.root.contains(e.target))
                this.stopDrift(); }, { passive: true });
        window.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key))
            this.stopDrift(); });
        this.credits = document.createElement('footer');
        this.credits.className = 'cosmic-credits';
        this.credits.hidden = true;
        this.credits.innerHTML = `<a href="https://purvang.vercel.app/" target="_blank" rel="noopener">made with Purvang ↗</a><span>A small experiment in the very large.</span>`;
        document.body.append(this.credits);
        this.syncReduced();
    }
    begin() { this.started = true; this.root.dataset.ready = 'true'; }
    syncReduced() {
        document.documentElement.dataset.motion = this.reduced ? 'reduced' : 'full';
        this.exp.reducedMotion = this.reduced;
        const button = this.root.querySelector('[data-motion]');
        button.textContent = this.reduced ? 'MOTION OFF' : 'MOTION ON';
        button.setAttribute('aria-pressed', String(this.reduced));
        this.root.querySelector('[data-drift]').disabled = this.reduced;
        this.scroll.reduced = this.reduced;
    }
    setReduced(value) { this.reduced = value; this.syncReduced(); if (value)
        this.stopDrift(); this.onMotion(value); this.onWake(); }
    syncDrift() { const b = this.root.querySelector('[data-drift]'); b.innerHTML = this.drifting ? 'PAUSE <span>Ⅱ</span>' : 'DRIFT <span>▷</span>'; b.setAttribute('aria-pressed', String(this.drifting)); }
    stopDrift() { if (this.drifting) {
        this.drifting = false;
        this.syncDrift();
    } }
    tick(dt) { if (this.started && this.drifting) {
        const next = Math.min(1, this.scroll.target + dt / 150);
        this.scroll.seek(next, false);
        if (next >= 1)
            this.stopDrift();
    } }
    update(p, velocity = 0) {
        this.progress = p;
        if (document.activeElement !== this.range)
            this.range.value = String(Math.round(p * 1000));
        this.range.style.setProperty('--time', `${p * 100}%`);
        const current = ACTS.indexOf(actAt(p));
        if (current !== this.lastAct) {
            this.lastAct = current;
            this.position.textContent = `${String(current + 1).padStart(2, '0')} / 09`;
            this.range.setAttribute('aria-valuetext', `${ACTS[current].name}, ${clockFor(p).value}`);
            this.dialog.querySelectorAll('[data-go]').forEach((b, i) => b.setAttribute('aria-current', String(i === current)));
        }
        this.direction.textContent = Math.abs(velocity) > .0002 ? (velocity > 0 ? 'TIME / FORWARD →' : '← TIME / REWIND') : 'SCROLL TO MOVE THROUGH TIME';
        this.credits.hidden = !(this.started && p > .976);
        document.documentElement.dataset.epoch = ACTS[current].id;
    }
}
