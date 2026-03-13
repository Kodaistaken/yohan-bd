/**
 * app.js — Entry point.
 * Single requestAnimationFrame loop drives all subsystems.
 * States: IDLE → POPPING → FINALE → DONE
 */
import { FireworkEngine }  from './fireworks.js';
import { GrapeCluster }    from './grape.js';
import { FinaleSequence }  from './finale.js';

const STATE = { IDLE: 'idle', POPPING: 'popping', FINALE: 'finale', DONE: 'done' };
let state = STATE.IDLE;

// ── Init ──────────────────────────────────────────────────────────

const fxCanvas = document.getElementById('fx');
const fw       = new FireworkEngine(fxCanvas);
const grape    = new GrapeCluster(document.getElementById('grape-container'));
const finale   = new FinaleSequence(fw);

fw.startAmbient();

// ── Berry pop callback ────────────────────────────────────────────

grape.onBerryPop = (id, cx, cy, hue) => {
  if (state === STATE.FINALE || state === STATE.DONE) return;

  if (state === STATE.IDLE) {
    state = STATE.POPPING;
    const hint = document.getElementById('hint');
    if (hint) hint.classList.add('hidden');
  }

  fw.createBurst(cx, cy, hue, 95, 6.5);
  setTimeout(() => fw.createBurst(cx, cy, (hue + 130) % 360, 45, 4), 70);

  if (grape.isAllPopped()) {
    state = STATE.FINALE;
    setTimeout(() => grape.hide(), 400);
    setTimeout(() => finale.begin(), 600);
  }
};

// ── Main render loop ──────────────────────────────────────────────

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  fw.tick();            // fireworks 2-D canvas
  grape.tick();         // Three.js grape render
  finale.tick(now);     // finale particle update + draw (on same 2-D canvas as fw)
}

loop();
