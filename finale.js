/**
 * finale.js — Firework particles born from explosions, converge to spell
 *             "bon anniversaire yohan", then glow forever as ember letters.
 */
export class FinaleSequence {
  constructor(fireworkEngine) {
    this.fw = fireworkEngine;
    this.finaleParticles = [];
    this._animating  = false;
    this._startTime  = null;
    this._lockedCount = 0;
    this._revealed   = false;
  }

  begin() {
    if (this._animating) return;
    this._animating = true;

    // Phase 1: Grand volley 0–1800ms
    this.fw.burstVolley();
    let n = 0;
    const rapid = setInterval(() => {
      this.fw.launchRocket(undefined, Math.random() * 360, 13 + Math.random() * 5);
      if (++n >= 10) clearInterval(rapid);
    }, 180);

    // Phase 2: Spawn text particles at 1800ms
    setTimeout(() => {
      const { W, H } = this.fw.getDimensions();
      const pts = this._sampleText(W, H);
      this._spawnParticles(pts, W, H);
      this._startTime = performance.now();
    }, 1800);
  }

  // Called every rAF frame by app.js AFTER fw.tick()
  tick(now) {
    if (!this._animating || !this._startTime) return;
    const elapsed = now - this._startTime;
    this._update(now, elapsed);
    this._draw(now);

    if (!this._revealed && this.finaleParticles.length > 0 &&
        this._lockedCount >= this.finaleParticles.length * 0.98) {
      this._revealed = true;
      this._onAllLocked();
    }
  }

  // ── Text sampling ─────────────────────────────────────────────

  _sampleText(W, H) {
    const offW = Math.min(W, 1100);
    const offH = 280;
    const off  = document.createElement('canvas');
    off.width  = offW;
    off.height = offH;
    const oc   = off.getContext('2d');

    oc.fillStyle = '#000';
    oc.fillRect(0, 0, offW, offH);
    oc.fillStyle = '#fff';
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';

    const fs1 = Math.min(54, offW * 0.068);
    const fs2 = Math.min(76, offW * 0.095);
    oc.font = `bold ${fs1}px Georgia, serif`;
    oc.fillText('bon anniversaire', offW / 2, offH * 0.32);
    oc.font = `bold ${fs2}px Georgia, serif`;
    oc.fillText('yohan', offW / 2, offH * 0.73);

    const data    = oc.getImageData(0, 0, offW, offH).data;
    const scaleX  = W / offW;
    const offsetY = H / 2 - offH / 2;
    const stride  = 4;
    const pts     = [];

    for (let y = 0; y < offH; y += stride) {
      for (let x = 0; x < offW; x += stride) {
        if (data[(y * offW + x) * 4] > 128) {
          pts.push({ tx: x * scaleX, ty: y + offsetY });
        }
      }
    }

    if (pts.length > 1600) {
      const step = Math.floor(pts.length / 1600);
      return pts.filter((_, i) => i % step === 0);
    }
    return pts;
  }

  // ── Particle spawning ─────────────────────────────────────────

  _spawnParticles(pts, W, H) {
    // 6 firework explosion sources in upper screen
    const sources = [
      { x: W * 0.12, y: H * 0.18 },
      { x: W * 0.30, y: H * 0.12 },
      { x: W * 0.50, y: H * 0.14 },
      { x: W * 0.70, y: H * 0.11 },
      { x: W * 0.88, y: H * 0.20 },
      { x: W * 0.42, y: H * 0.07 },
    ];

    // Visual explosions at source positions
    sources.forEach((src, i) => {
      setTimeout(() => this.fw.createGrandBurst(src.x, src.y, Math.random() * 360, 80, 6), i * 120);
    });

    // Warm ember palette — gold, orange, red-orange, yellow-white
    const hues = [48, 40, 30, 18, 0, 55, 58, 200, 280];

    this.finaleParticles = pts.map((pt, idx) => {
      const src   = sources[idx % sources.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      const hue   = hues[Math.floor(Math.random() * hues.length)];

      return {
        x:  src.x + (Math.random() - 0.5) * 30,
        y:  src.y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tx: pt.tx, ty: pt.ty,

        phase:          'burst',
        burstEnd:       180 + Math.random() * 280,   // ms of free burst
        homingDelay:    350 + Math.random() * 2300,  // ms before homing
        homingStartTime: null,

        hue, sat: hue < 70 ? 100 : 85,
        lit:   65 + Math.random() * 20,
        size:  1.4 + Math.random() * 2.0,
        locked: false,
        alpha:  1.0,
      };
    });

    this._lockedCount = 0;
    this._revealed    = false;
  }

  // ── Update ────────────────────────────────────────────────────

  _update(now, elapsed) {
    for (const p of this.finaleParticles) {
      if (p.locked) { p.hue = (p.hue + 0.5) % 360; continue; }

      if (p.phase === 'burst') {
        p.vy += 0.14; p.vx *= 0.97;
        p.x  += p.vx; p.y  += p.vy;
        if (elapsed >= p.burstEnd) p.phase = 'falling';

      } else if (p.phase === 'falling') {
        p.vy += 0.10; p.vx *= 0.98;
        p.x  += p.vx; p.y  += p.vy;
        if (elapsed >= p.homingDelay) {
          p.phase = 'homing';
          p.homingStartTime = now;
        }

      } else if (p.phase === 'homing') {
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2.5) {
          p.x = p.tx; p.y = p.ty;
          p.locked = true; this._lockedCount++; continue;
        }
        const t = Math.min(1, (now - p.homingStartTime) / 2500);
        const f = 0.055 + t * 0.10;
        p.vx = dx * f; p.vy = dy * f;
        p.x += p.vx;  p.y += p.vy;
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────

  _draw(now) {
    const ctx = this.fw.getContext();
    ctx.save();

    for (const p of this.finaleParticles) {
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = p.alpha;

      if (p.locked) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + p.tx * 0.08 + p.ty * 0.05);
        const lit   = p.lit + pulse * 20;
        ctx.shadowBlur  = 5 + pulse * 7;
        ctx.shadowColor = `hsl(${p.hue},${p.sat}%,${lit}%)`;
        ctx.fillStyle   = `hsl(${p.hue},${p.sat}%,${lit}%)`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle  = `hsl(${p.hue},${p.sat}%,${p.lit}%)`;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Post-lock ─────────────────────────────────────────────────

  _onAllLocked() {
    this.fw.stopAmbient();
    const fire = () => {
      this.fw.launchRocket(undefined, Math.random() * 360, 7 + Math.random() * 4);
      setTimeout(fire, 3500 + Math.random() * 3000);
    };
    setTimeout(fire, 1500);
  }
}
