import { ACTS, BEATS, clockFor, actAt } from '../core/Timeline.js';
import { window01, clamp } from '../lib/math.js';

// Owns every pixel of DOM chrome: the entry veil, the instrument HUD,
// the narration beats, the mute control, the scroll cue and the loop-back.
export default class Interface {
  constructor() {
    this.veil = document.getElementById('veil');
    this.veilStatus = document.getElementById('veil-status');
    this.beginBtn = document.getElementById('begin');
    this.hud = document.getElementById('hud');
    this.clockValue = document.getElementById('clock-value');
    this.clockEpoch = document.getElementById('clock-epoch');
    this.progressFill = document.getElementById('progress-fill');
    this.progressActs = document.getElementById('progress-acts');
    this.narration = document.getElementById('narration');
    this.muteBtn = document.getElementById('mute');

    this._lastClock = '';
    this._lastEpoch = '';
    this._lastAct = '';
    this._started = false;

    this._buildActLabel();
    this._buildBeats();
    this._buildCue();
    this._buildLoop();
  }

  _buildActLabel() {
    // A single, legible current-act label under the rail.
    this.actLabel = document.createElement('span');
    this.actLabel.className = 'progress__act';
    this.actLabel.style.left = '0';
    this.actLabel.style.transform = 'none';
    this.actLabel.dataset.on = 'true';
    this.progressActs.appendChild(this.actLabel);
  }

  _buildBeats() {
    this._beatEls = BEATS.map((b) => {
      const el = document.createElement('div');
      el.className = 'beat';
      el.dataset.align = b.align || 'center';
      el.innerHTML = `
        ${b.kicker ? `<span class="beat__index">${b.kicker}</span>` : ''}
        <p class="beat__line">${b.line}</p>
        ${b.sub ? `<p class="beat__sub">${b.sub}</p>` : ''}
      `;
      this.narration.appendChild(el);
      return el;
    });
  }

  _buildCue() {
    this.cue = document.createElement('div');
    this.cue.className = 'cue';
    this.cue.innerHTML = `<span>scroll to begin time</span><span class="cue__line"></span>`;
    document.body.appendChild(this.cue);
  }

  _buildLoop() {
    this.loop = document.createElement('button');
    this.loop.className = 'cue';
    this.loop.style.pointerEvents = 'auto';
    this.loop.style.background = 'none';
    this.loop.style.border = 'none';
    this.loop.style.cursor = 'pointer';
    this.loop.style.color = 'inherit';
    this.loop.innerHTML = `<span>↺ &nbsp; scroll again</span>`;
    this.loop.setAttribute('aria-label', 'Return to the beginning');
    document.body.appendChild(this.loop);
  }

  // ---- wiring ----
  onBegin(cb) {
    this.beginBtn.addEventListener('click', cb, { once: true });
  }
  onMute(cb) {
    this.muteBtn.addEventListener('click', () => cb());
  }
  onLoop(cb) {
    this.loop.addEventListener('click', cb);
  }
  setStatus(text) {
    if (this.veilStatus) this.veilStatus.textContent = text;
  }
  setBeginReady(ready) {
    this.beginBtn.disabled = !ready;
  }
  setMuted(muted) {
    this.muteBtn.setAttribute('aria-pressed', String(muted));
    this.muteBtn.querySelector('.mute__word').textContent = muted ? 'MUTED' : 'SOUND';
  }

  begin() {
    this._started = true;
    this.veil.dataset.gone = 'true';
    this.hud.dataset.hidden = 'false';
    // let the first breath land, then invite the scroll
    setTimeout(() => {
      if (this._started) this.cue.dataset.on = 'true';
    }, 2600);
  }

  update(p) {
    // clock
    const { value, epoch } = clockFor(p);
    if (value !== this._lastClock) {
      this.clockValue.textContent = value;
      this._lastClock = value;
    }
    if (epoch !== this._lastEpoch) {
      this.clockEpoch.textContent = epoch;
      this._lastEpoch = epoch;
    }

    // progress rail + current act label
    this.progressFill.style.width = `${p * 100}%`;
    const cur = actAt(p);
    if (cur.name !== this._lastAct) {
      const idx = ACTS.indexOf(cur) + 1;
      this.actLabel.textContent = `${String(idx).padStart(2, '0')} / 09 · ${cur.name}`;
      this._lastAct = cur.name;
    }

    // narration
    for (let i = 0; i < this._beatEls.length; i++) {
      const b = BEATS[i];
      const a = window01(p, b.start, b.end, 0.02);
      const el = this._beatEls[i];
      el.style.opacity = a.toFixed(3);
      if (a <= 0.001) {
        el.style.visibility = 'hidden';
        continue;
      }
      el.style.visibility = 'visible';
      const inv = 1 - a;
      el.style.filter = `blur(${(inv * 7).toFixed(2)}px)`;
      el.style.transform = `translateY(${(inv * 12).toFixed(2)}px) scale(${(0.985 + a * 0.015).toFixed(4)})`;
    }

    // scroll cue: only while at the very start
    if (this._started) {
      this.cue.dataset.on = String(p < 0.012 && this.cue.dataset.on !== undefined);
    }

    // loop-back appears at the resolution
    const loopA = clamp(window01(p, 0.965, 1.001, 0.02) + (p > 0.995 ? 1 : 0), 0, 1);
    this.loop.dataset.on = String(loopA > 0.2);
  }
}
