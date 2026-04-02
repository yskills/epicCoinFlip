/* ═══════════════════════════════════════════════════════
   ENGINE v2 — hitstop, easing, particles, background,
               chromatic aberration, mobile DPI, effects
   ═══════════════════════════════════════════════════════ */

/* ── Helpers ── */
const $ = id => document.getElementById(id);
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rf    = (a, b) => Math.random() * (b - a) + a;
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick  = arr => arr[rand(0, arr.length - 1)];

/* ── Easing functions ── */
const ease = {
  outCubic:   t => 1 - (1 - t) ** 3,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  outElastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1;
  },
  outExpo:  t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outBack:  t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * (t - 1) ** 2; },
};

/* ── Canvas (DPI-aware for mobile crispness) ── */
const cv = $('c'), cx = cv.getContext('2d');
let W, H, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width  = W * DPR;
  cv.height = H * DPR;
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize);
resize();

/* ── Timing ── */
let gt = 0, dt = 0, lt = 0, slo = 1;

/* ── Hitstop (freeze frames on impact) ── */
let hitstopTimer = 0;
function hitstop(dur) { hitstopTimer = Math.max(hitstopTimer, dur); }

/* ── Screen shake (directional) ── */
let sk = { x: 0, y: 0, i: 0, dx: 0, dy: 0 };
function shake(lv, dirX, dirY) {
  const mag = lv === 'heavy' ? 28 : lv === 'medium' ? 15 : 6;
  sk.i = Math.max(sk.i, mag);
  sk.dx = dirX || 0; sk.dy = dirY || 0;
}

/* ── Flash / dark / zoom ── */
let fa = 0;
let da = 0, dT = 0;
let zm = 1, zT = 1, zmX = .5, zmY = .5;
let domainActive = false, domainAlpha = 0, domainSide = 'hero', domainPat = 0;

function flash(dur, int) { fa = int || .7; setTimeout(() => fa = 0, (dur || .1) * 1000); }
function setDark(on) { dT = on ? 1 : 0; }
function zoomAt(z, x, y) { zT = z; zmX = (x || W / 2) / W; zmY = (y || H / 2) / H; }

/* ── Chromatic aberration ── */
let caStr = 0;
function chromaHit(str) { caStr = Math.max(caStr, str || .8); }

/* ════════════════════════════
   PARTICLE SYSTEM (object pool)
   ════════════════════════════ */
const MAX_PT = 500;
const pts = [];

class Pt {
  constructor() { this.active = false; }
  init(x, y, vx, vy, life, sz, col, tp, txt) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.ml = life; this.sz = sz;
    this.col = col; this.tp = tp || 'c'; this.txt = txt || '';
    this.rot = rf(0, 6.28); this.rv = rf(-5, 5);
    this.gv = (tp === 'ring' || tp === 'hex' || tp === 'dust') ? 0 : 280;
    this.active = true;
    return this;
  }
  update(d) {
    this.x += this.vx * d; this.y += this.vy * d;
    this.vy += this.gv * d; this.life -= d; this.rot += this.rv * d;
    if (this.life <= 0) this.active = false;
  }
  get a() { return clamp(this.life / this.ml, 0, 1); }
  draw(c) {
    const a = this.a;
    c.save(); c.globalAlpha = a;
    c.translate(this.x, this.y); c.rotate(this.rot);
    switch (this.tp) {
      case 'c':
        c.beginPath(); c.arc(0, 0, this.sz, 0, Math.PI * 2);
        c.fillStyle = this.col;
        c.shadowBlur = this.sz * 3; c.shadowColor = this.col; c.fill(); break;
      case 'ring': {
        const r = this.sz * (1 + (1 - a) * 5);
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
        c.strokeStyle = this.col; c.lineWidth = 2.5 * a;
        c.shadowBlur = 18; c.shadowColor = this.col; c.stroke(); break;
      }
      case 'hex': {
        const r = this.sz * (1 + (1 - a) * 4);
        c.beginPath();
        for (let i = 0; i < 6; i++) { const an = Math.PI / 3 * i - Math.PI / 2; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
        c.closePath(); c.strokeStyle = this.col; c.lineWidth = 1.5 * a;
        c.shadowBlur = 12; c.shadowColor = this.col; c.stroke(); break;
      }
      case 'spark':
        c.beginPath(); c.moveTo(-this.sz, 0); c.lineTo(this.sz, 0);
        c.strokeStyle = this.col; c.lineWidth = 2;
        c.shadowBlur = 8; c.shadowColor = this.col; c.stroke(); break;
      case 'dust': {
        const r = this.sz * (1 + (1 - a) * 1.5);
        c.globalAlpha = a * .3;
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
        c.fillStyle = this.col; c.fill(); break;
      }
      case 'rune':
        c.font = `${this.sz}px serif`; c.textAlign = 'center';
        c.fillStyle = this.col; c.globalAlpha = a * .4;
        c.shadowBlur = 10; c.shadowColor = this.col;
        c.fillText(this.txt, 0, 0); break;
      case 'smear': {
        const len = this.sz * 3;
        c.globalAlpha = a * .3;
        c.beginPath(); c.ellipse(0, 0, len, this.sz * .5, 0, 0, Math.PI * 2);
        c.fillStyle = this.col; c.fill(); break;
      }
    }
    c.restore();
  }
}

for (let i = 0; i < MAX_PT; i++) pts.push(new Pt());

function getP() {
  for (const p of pts) if (!p.active) return p;
  let oldest = pts[0];
  for (const p of pts) if (p.active && p.life < oldest.life) oldest = p;
  return oldest;
}

function emit(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const ang = o.ang != null ? o.ang + rf(-(o.sp || Math.PI), (o.sp || Math.PI)) : rf(0, Math.PI * 2);
    const spd = rf(o.sMin || 50, o.sMax || 200);
    getP().init(x + rf(-4, 4), y + rf(-4, 4), Math.cos(ang) * spd, Math.sin(ang) * spd,
      rf(o.lMin || .3, o.lMax || 1), rf(o.szMin || 2, o.szMax || 6), o.col || '#fff', o.tp || 'c', o.txt || '');
  }
}

function dustBurst(x, y, n, col) {
  for (let i = 0; i < (n || 5); i++) {
    const ang = rf(-Math.PI, -.15);
    const spd = rf(20, 80);
    getP().init(x + rf(-10, 10), y, Math.cos(ang) * spd, Math.sin(ang) * spd,
      rf(.3, .7), rf(4, 10), col || 'rgba(180,160,220,.5)', 'dust', '');
  }
}

function emitRunes(x, y, n, col) {
  const runes = ['◆', '◇', '⬡', '✦', '✧', '⟁', '⏣', '⟐'];
  for (let i = 0; i < n; i++) {
    getP().init(x + rf(-60, 60), y + rf(-60, 20), rf(-35, 35), rf(-90, -25),
      rf(.8, 1.8), rf(13, 26), col, 'rune', pick(runes));
  }
}

/* impact smear (motion trail at impact) */
function impactSmear(x, y, dirX, col) {
  for (let i = 0; i < 4; i++) {
    getP().init(x, y + rf(-15, 15), dirX * rf(80, 200), rf(-30, 30),
      rf(.15, .3), rf(4, 8), col, 'smear', '');
  }
}

/* floating damage numbers */
const floats = [];
function floatDmg(x, y, txt, col, sz) {
  floats.push({ x, y, txt, col, sz: sz || 24, life: 1.2, ml: 1.2, vy: -160, sc: 0 });
}

/* ════════════════════════════
   BACKGROUND
   ════════════════════════════ */
const bgStars = Array.from({ length: 90 }, () => ({
  x: Math.random(), y: Math.random(), r: rf(.3, 1.4), s: rf(.5, 2)
}));

function drawBG() {
  const bg = cx.createRadialGradient(W / 2, H * .38, 0, W / 2, H * .38, Math.max(W, H) * .7);
  bg.addColorStop(0, '#0a0520'); bg.addColorStop(.5, '#050510'); bg.addColorStop(1, '#020208');
  cx.fillStyle = bg; cx.fillRect(0, 0, W, H);

  for (let i = 0; i < 4; i++) {
    const ph = gt * .5 + i * 1.8, pr = (ph % 5) / 5, r = pr * Math.max(W, H) * .5;
    cx.beginPath(); cx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    cx.strokeStyle = i % 2 === 0 ? `rgba(99,102,241,${.018 * (1 - pr)})` : `rgba(220,38,38,${.009 * (1 - pr)})`;
    cx.lineWidth = 1.5; cx.stroke();
  }

  for (const s of bgStars) {
    const a = .12 + Math.sin(gt * s.s + s.x * 10) * .12;
    cx.beginPath(); cx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    cx.fillStyle = `rgba(160,140,200,${a})`; cx.fill();
  }

  const gy = gY();
  const gg = cx.createLinearGradient(0, gy - 2, 0, gy + 80);
  gg.addColorStop(0, 'rgba(50,20,100,.08)'); gg.addColorStop(1, 'transparent');
  cx.fillStyle = gg; cx.fillRect(0, gy - 2, W, 82);
  cx.strokeStyle = 'rgba(120,80,200,.12)'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(0, gy); cx.lineTo(W, gy); cx.stroke();

  if (domainAlpha > .01) drawDomainOverlay();
}

function drawDomainOverlay() {
  cx.save(); cx.globalAlpha = domainAlpha * .55;
  domainPat += dt * 2;
  cx.translate(W / 2, H / 2);
  for (let r = 0; r < 6; r++) {
    const rad = 40 + r * 70 + Math.sin(domainPat + r) * 18, sides = 6 + r;
    cx.beginPath();
    for (let i = 0; i < sides; i++) {
      const an = (Math.PI * 2 / sides) * i + domainPat * .25 + r * .15;
      cx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(an) * rad, Math.sin(an) * rad);
    }
    cx.closePath();
    cx.strokeStyle = (domainSide === 'hero' ? 'rgba(99,102,241,' : 'rgba(239,68,68,') + (.1 - r * .013) + ')';
    cx.lineWidth = 1.5; cx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const an = (Math.PI * 2 / 14) * i + domainPat * .4;
    cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(an) * 340, Math.sin(an) * 340);
    cx.strokeStyle = (domainSide === 'hero' ? 'rgba(99,102,241,' : 'rgba(239,68,68,') + '.03)';
    cx.lineWidth = 1; cx.stroke();
  }
  cx.restore();
  cx.save(); cx.globalAlpha = domainAlpha * .3;
  const vg = cx.createRadialGradient(W / 2, H / 2, W * .08, W / 2, H / 2, W * .7);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, domainSide === 'hero' ? '#08042a' : '#1a0505');
  cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
  cx.restore();
}

function gY() { return H * .74; }

/* ════════════════════════════
   SPEED LINES
   ════════════════════════════ */
const sLines = [];
function addSL(col, n) {
  for (let i = 0; i < (n || 10); i++) {
    sLines.push({ y: rf(.05, .95) * H, w: 0, mw: rf(.25, .6) * W,
      x: rf(0, 1) > .5 ? 0 : W, life: .4, ml: .4, col: col || 'rgba(120,100,200,.3)', h: rf(1, 2.5) });
  }
}
function updSL(d) {
  for (let i = sLines.length - 1; i >= 0; i--) {
    const l = sLines[i]; l.life -= d;
    l.w = lerp(0, l.mw, ease.outExpo(1 - l.life / l.ml));
    if (l.life <= 0) sLines.splice(i, 1);
  }
}
function drawSL(c) {
  for (const l of sLines) {
    c.save(); c.globalAlpha = clamp(l.life / l.ml, 0, 1) * .3;
    c.fillStyle = l.col;
    c.fillRect(l.x < W / 2 ? l.x : l.x - l.w, l.y, l.w, l.h);
    c.restore();
  }
}

/* ════════════════════════════
   HUD TEXT
   ════════════════════════════ */
let hudT = [];
function showHud(txt, col, sz, dur, y) {
  hudT.push({ txt, col, sz: sz || 56, life: dur || 1.2, ml: dur || 1.2, y: y || H * .4, sc: 0 });
}
function updHud(d) {
  for (const h of hudT) {
    h.life -= d;
    const pr = 1 - h.life / h.ml;
    h.sc = pr < .12 ? ease.outBack(pr / .12) : h.life < .2 ? h.life / .2 : 1;
  }
  hudT = hudT.filter(h => h.life > 0);
}
function drawHud(c) {
  for (const h of hudT) {
    c.save(); c.globalAlpha = clamp(h.sc, 0, 1);
    c.translate(W / 2, h.y); c.scale(h.sc, h.sc);
    c.font = `900 ${h.sz}px sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowBlur = 55; c.shadowColor = h.col;
    c.fillStyle = h.col; c.fillText(h.txt, 0, 0);
    c.shadowBlur = 110; c.globalAlpha *= .4;
    c.fillText(h.txt, 0, 0);
    c.restore();
  }
}

/* ════════════════════════════
   BEAM
   ════════════════════════════ */
let bmOn = false, bmPr = 0, bmSd = 'left', bmCol = '#3b82f6', bmCol2 = '#8b5cf6';

function drawBeam(c) {
  if (!bmOn || typeof hero === 'undefined') return;
  const by = gY() - 36, bh = 14 + bmPr * 28;
  const src = bmSd === 'left' ? hero : villain;
  if (!src) return;
  const fx = src.dx + src.facing * 38 * src.sc;
  const dist = W * .7 * bmPr;
  const tx = fx + src.facing * dist;
  const lx = Math.min(fx, tx), rx = Math.max(fx, tx);
  c.save();
  c.globalAlpha = .2; c.shadowBlur = 100; c.shadowColor = bmCol;
  c.fillStyle = bmCol; c.fillRect(lx, by - bh * 1.5, rx - lx, bh * 3);
  c.globalAlpha = 1;
  const g = c.createLinearGradient(lx, 0, rx, 0);
  g.addColorStop(0, 'transparent'); g.addColorStop(.02, bmCol);
  g.addColorStop(.35, bmCol2); g.addColorStop(.5, '#fff');
  g.addColorStop(.65, bmCol2); g.addColorStop(.98, bmCol); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.shadowBlur = 55; c.shadowColor = bmCol2;
  c.fillRect(lx, by - bh / 2, rx - lx, bh);
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillRect(lx, by - bh * .2, rx - lx, bh * .4);
  c.restore();
  if (bmPr > .1) emit(tx, by, 2, { col: bmCol, sMin: 18, sMax: 80, szMin: 2, szMax: 5, lMin: .1, lMax: .3, sp: Math.PI });
}
