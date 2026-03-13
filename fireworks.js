/**
 * fireworks.js — 2-D canvas particle system.
 * Caller must drive the loop: call tick() every rAF frame.
 */
export class FireworkEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    this.particles = [];
    this.pool      = [];
    this.rockets   = [];

    this._ambientTimer    = null;
    this._ambientHueIdx   = 0;
    this._ambientHues     = [45, 0, 185, 270, 140, 30, 200, 320];

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  // ── Particle pool ─────────────────────────────────────────────

  _spawn(cfg) {
    const p = this.pool.length ? this.pool.pop() : {};
    Object.assign(p, cfg);
    p.life = 1.0;
    this.particles.push(p);
    return p;
  }

  // ── Burst ─────────────────────────────────────────────────────

  createBurst(x, y, hue, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const mag   = speed * (0.4 + Math.random() * 0.6);
      const dHue  = hue + (Math.random() - 0.5) * 40;
      this._spawn({
        x, y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        ax: 0, ay: 0.10 + Math.random() * 0.04,
        decay: 0.011 + Math.random() * 0.010,
        size:  1.8 + Math.random() * 2.8,
        color: `hsl(${dHue},${75 + Math.random() * 25}%,${55 + Math.random() * 20}%)`,
        alpha: 1.0, finale: false,
      });
    }
  }

  createGrandBurst(x, y, hue, count, speed) {
    this.createBurst(x, y, hue, count, speed);
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      this._spawn({
        x, y,
        vx: Math.cos(angle) * speed * 0.25,
        vy: Math.sin(angle) * speed * 0.25,
        ax: 0, ay: 0.05,
        decay: 0.006 + Math.random() * 0.006,
        size:  2.5 + Math.random() * 2,
        color: `hsl(${(hue + 60) % 360},100%,80%)`,
        alpha: 1.0, finale: false,
      });
    }
  }

  // ── Rockets ───────────────────────────────────────────────────

  launchRocket(x, hue, speed) {
    const vy = -(speed || (8 + Math.random() * 7));
    this.rockets.push({
      x: x !== undefined ? x : this.W * (0.15 + Math.random() * 0.7),
      y: this.H + 10,
      vy,
      trailHue: hue,
    });
  }

  _updateRockets() {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vy += 0.08;
      r.y  += r.vy;
      if (Math.random() < 0.6) {
        this._spawn({
          x: r.x + (Math.random() - 0.5) * 3, y: r.y,
          vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random(),
          ax: 0, ay: 0.04,
          decay: 0.04 + Math.random() * 0.04,
          size: 1.2,
          color: `hsl(${r.trailHue},90%,70%)`,
          alpha: 0.7, finale: false,
        });
      }
      if (r.vy >= 0 || r.y < 0) {
        this.createGrandBurst(r.x, r.y, r.trailHue, 130, 7);
        this.createBurst(r.x, r.y, (r.trailHue + 120) % 360, 50, 4);
        this.rockets.splice(i, 1);
      }
    }
  }

  // ── Ambient loop ──────────────────────────────────────────────

  startAmbient() { this._scheduleAmbient(); }

  stopAmbient() {
    if (this._ambientTimer) { clearTimeout(this._ambientTimer); this._ambientTimer = null; }
  }

  _scheduleAmbient(interval) {
    const delay = interval !== undefined ? interval : 900 + Math.random() * 1600;
    this._ambientTimer = setTimeout(() => {
      const hue = this._ambientHues[this._ambientHueIdx++ % this._ambientHues.length];
      this.launchRocket(undefined, hue);
      this._scheduleAmbient();
    }, delay);
  }

  burstVolley() {
    [0.15, 0.30, 0.50, 0.70, 0.85].forEach((pos, i) => {
      setTimeout(() => {
        this.launchRocket(this.W * pos, Math.random() * 360, 10 + Math.random() * 5);
      }, i * 200);
    });
  }

  // ── Main tick (called externally every rAF) ───────────────────

  tick() {
    this._updateRockets();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.finale) continue;
      p.vx += p.ax; p.vy += p.ay;
      p.x  += p.vx; p.y  += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.pool.push(this.particles.splice(i, 1)[0]);
    }

    const { ctx, W, H } = this;
    ctx.fillStyle = 'rgba(5,8,16,0.18)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    for (const p of this.particles) {
      if (p.finale) continue;
      const a = Math.max(0, p.life) * p.alpha;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Used by finale.js to draw on the same canvas
  getContext()        { return this.ctx; }
  getDimensions()     { return { W: this.W, H: this.H }; }
}
