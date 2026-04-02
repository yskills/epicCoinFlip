/* ═══════════════════════════════════════════════════════
   FIGHTER v2 — smooth multi-layer idle, squash & stretch,
                eye blink, fluid interpolated poses
   ═══════════════════════════════════════════════════════ */

class Fighter {
  constructor(name, side, x, sc) {
    this.name = name;
    this.side = side;
    this.facing = side === 'hero' ? 1 : -1;
    this.bx = x; this.x = x; this.dx = x; /* dx = display x (smoothed) */
    this.y = gY();
    this.sc = sc || 1;
    this.hp = 100; this.maxHp = 100;

    /* ── Pose interpolation ── */
    this.pose = 'idle';
    this.prevPose = 'idle';
    this.poseLerp = 1;       /* 0→1 blending from prev to current */
    this.poseSpeed = 8;      /* blend speed */

    /* ── Idle layers ── */
    this.bob   = 0;          /* breathing cycle */
    this.sway  = 0;          /* weight shift */
    this.idle2 = 0;          /* secondary idle timer */
    this.idle3 = 0;          /* extra snap for more agile silhouettes */

    /* ── Eye blink ── */
    this.blinkTimer = rf(2, 5);
    this.blinkPhase = 0;     /* 0=open, >0 = closing/opening */

    /* ── Squash & stretch ── */
    this.sqX = 1; this.sqY = 1;  /* current */
    this.sqTX = 1; this.sqTY = 1; /* target */

    /* ── Effects ── */
    this.fl = 0;              /* hurt flash */
    this.aura = 0;
    this.auraMx = 0;
    this.afters = [];         /* afterimages */
    this.sp = 0;              /* energy gauge */
    this.domain = false;

    /* ── Smooth position ── */
    this.velX = 0;
  }

  setPose(p, speed) {
    if (this.pose === p) return;
    this.prevPose = this.pose;
    this.pose = p;
    this.poseLerp = 0;
    this.poseSpeed = speed || 8;

    /* squash/stretch on pose change */
    if (p === 'attack')   { this.sqTX = 1.15; this.sqTY = .88; }
    else if (p === 'hit') { this.sqTX = .85; this.sqTY = 1.18; }
    else                  { this.sqTX = 1; this.sqTY = 1; }
  }

  /* target angles per pose */
  _poseAngles(pose) {
    switch (pose) {
      case 'idle':
        return this.side === 'hero'
          ? { la: -.48, ra: .2, ll: .08, rl: -.1, h: -.025, hd: -.03 }
          : { la: -.2, ra: .5, ll: -.08, rl: .12, h: .025, hd: .035 };
      case 'attack':   return { la: -1.7, ra: .9, ll: .2, rl: -.18, h: .1, hd: -.06 };
      case 'hit':      return { la: .6, ra: 1.2, ll: -.2, rl: .35, h: -.18, hd: .18 };
      case 's_charge': return { la: -1.1, ra: 1.1, ll: .12, rl: -.12, h: 0, hd: 0 };
      case 's_fire':   return { la: -1.9, ra: -1.9, ll: .22, rl: -.22, h: .15, hd: 0 };
      case 'domain':   return { la: -1.4, ra: 1.4, ll: .05, rl: -.05, h: 0, hd: -.1 };
      case 'victory':  return { la: -2.6, ra: -.8, ll: .06, rl: -.06, h: 0, hd: -.1 };
      case 'defeat':   return { la: .8, ra: 1.1, ll: .3, rl: -.45, h: -.35, hd: .3 };
      default:         return { la: 0, ra: 0, ll: 0, rl: 0, h: 0, hd: 0 };
    }
  }

  /* blend between prev and current pose + idle layers */
  angles() {
    const prev = this._poseAngles(this.prevPose);
    const cur  = this._poseAngles(this.pose);
    const t = ease.outCubic(clamp(this.poseLerp, 0, 1));
    const a = {};
    for (const k of ['la', 'ra', 'll', 'rl', 'h', 'hd']) {
      a[k] = lerp(prev[k], cur[k], t);
    }

    /* idle breathing layers (only when idle-ish) */
    if (this.pose === 'idle' || this.pose === 's_charge') {
      const breathAmp = this.pose === 's_charge' ? .09 : .045;
      const b = Math.sin(this.bob) * breathAmp;
      const sw = Math.sin(this.sway) * .03;
      const i2 = Math.sin(this.idle2) * .02;
      const snap = Math.sin(this.idle3) * .015;
      a.la += b + sw + snap;
      a.ra += b - sw - snap * .4;
      a.ll += i2 + sw * .22;
      a.rl -= i2 - sw * .22;
      a.h  += Math.sin(this.bob * .8) * .018 + Math.sin(this.idle2 * 1.2) * .008;
      a.hd += Math.sin(this.sway * .75) * .012 + snap * .2;
    }
    return a;
  }

  update(d) {
    /* pose interpolation */
    this.poseLerp = Math.min(1, this.poseLerp + d * this.poseSpeed);

    /* idle timers (different frequencies for organic feel) */
    this.bob   += d * 5.6;
    this.sway  += d * 3.3;
    this.idle2 += d * 4.7;
    this.idle3 += d * 7.8;

    /* eye blink */
    this.blinkTimer -= d;
    if (this.blinkTimer <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = .2;
      this.blinkTimer = rf(2, 6);
    }
    if (this.blinkPhase > 0) this.blinkPhase = Math.max(0, this.blinkPhase - d);

    /* squash/stretch spring */
    this.sqX = lerp(this.sqX, this.sqTX, d * 12);
    this.sqY = lerp(this.sqY, this.sqTY, d * 12);
    /* snap back to 1 */
    this.sqTX = lerp(this.sqTX, 1, d * 6);
    this.sqTY = lerp(this.sqTY, 1, d * 6);

    /* smooth position */
    this.dx = lerp(this.dx, this.x, d * 14);

    /* effects */
    this.fl = Math.max(0, this.fl - d * 5);
    this.aura = lerp(this.aura, this.auraMx, d * 3);

    /* afterimages decay */
    this.afters = this.afters.filter(a => { a.a -= d * 2.5; return a.a > 0; });
  }

  addAfter() {
    this.afters.push({ x: this.dx, y: this.y, a: .45, pose: this.pose });
  }

  /* ══════════ DRAW ══════════ */
  draw(c) {
    const s = this.sc, f = this.facing, an = this.angles();
    const idlePhase = this.pose === 'idle' || this.pose === 's_charge';
    const ox = this.dx + (idlePhase ? Math.sin(this.sway) * 5 * s + Math.sin(this.idle3) * 1.5 * s : 0);
    const oy = this.y + (idlePhase ? Math.sin(this.bob * 1.1) * 5 * s + Math.sin(this.idle2 * 1.5) * 2 * s : 0);

    /* afterimages */
    for (const ai of this.afters) {
      c.save(); c.globalAlpha = ai.a * .2;
      c.translate(ai.x, ai.y); c.scale(f * s, s);
      this._drawBody(c, an, true);
      c.restore();
    }

    /* aura glow */
    if (this.aura > .02) {
      c.save(); c.globalAlpha = this.aura * .25;
      const g = c.createRadialGradient(ox, oy - 40 * s, 0, ox, oy - 40 * s, 90 * s);
      if (this.side === 'hero') {
        g.addColorStop(0, 'rgba(59,130,246,.5)'); g.addColorStop(.4, 'rgba(139,92,246,.25)');
      } else {
        g.addColorStop(0, 'rgba(239,68,68,.5)'); g.addColorStop(.4, 'rgba(249,115,22,.25)');
      }
      g.addColorStop(1, 'transparent');
      c.fillStyle = g; c.fillRect(ox - 90 * s, oy - 130 * s, 180 * s, 130 * s);
      c.restore();
      if (Math.random() < this.aura * .4) {
        const col = this.side === 'hero' ? '#6366f1' : '#ef4444';
        emit(ox + rf(-22, 22) * s, oy - rf(0, 80) * s, 1, {
          col, tp: 'c', szMin: 1.5, szMax: 3.5, sMin: 10, sMax: 50,
          ang: -Math.PI / 2, sp: .6, lMin: .3, lMax: .7
        });
      }
    }

    /* ── main body with squash/stretch ── */
    c.save();
    c.translate(ox, oy);
    c.scale(f * s * this.sqX, s * this.sqY);
    c.rotate(an.h);
    this._drawBody(c, an, false);
    c.restore();

    /* hurt flash overlay */
    if (this.fl > 0) {
      c.save(); c.globalAlpha = this.fl * .4;
      c.globalCompositeOperation = 'lighter';
      c.translate(ox, oy); c.scale(f * s, s); c.rotate(an.h);
      this._drawBody(c, an, true);
      c.restore();
    }
  }

  _drawBody(c, an, sil) {
    const isH = this.side === 'hero';
    const skin  = sil ? '#fff' : (isH ? '#f5d0a9' : '#e0c8a8');
    const hair  = sil ? '#fff' : (isH ? '#1a1a40' : '#4a0e0e');
    const hairH = sil ? '#fff' : (isH ? '#2a2a70' : '#7a1515');
    const coat  = sil ? '#fff' : (isH ? '#15173a' : '#1a0a0a');
    const coatA = sil ? '#fff' : (isH ? '#3b4ef6' : '#aa2222');
    const pants = sil ? '#fff' : (isH ? '#0a0a20' : '#100505');
    const eyeC  = sil ? '#fff' : (isH ? '#60a5fa' : '#ef4444');
    const glow  = isH ? '#3b82f6' : '#ef4444';

    /* legs */
    this._drawLeg(c, -9, -2, an.ll, pants, skin, sil, isH);
    this._drawLeg(c, 9, 2, an.rl, pants, skin, sil, isH);

    /* hips */
    c.save();
    c.fillStyle = sil ? '#fff' : (isH ? '#101427' : '#160909');
    c.beginPath();
    c.moveTo(-15, -18); c.lineTo(15, -18); c.lineTo(12, -28); c.lineTo(-12, -28);
    c.closePath(); c.fill();
    c.restore();

    /* torso */
    c.save();
    c.beginPath();
    c.moveTo(-18, -20); c.quadraticCurveTo(-24, -44, -15, -70);
    c.lineTo(-8, -82); c.quadraticCurveTo(0, -88, 8, -82);
    c.lineTo(15, -70); c.quadraticCurveTo(24, -44, 18, -20);
    c.quadraticCurveTo(0, -12, -18, -20);
    c.closePath();
    c.fillStyle = coat; c.fill();
    if (!sil) {
      c.strokeStyle = coatA; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, -23); c.lineTo(0, -78); c.stroke();
      c.beginPath(); c.moveTo(-12, -72); c.lineTo(-3, -58); c.lineTo(0, -74); c.lineTo(3, -58); c.lineTo(12, -72); c.stroke();
      c.save(); c.globalAlpha = .18; c.shadowBlur = 10; c.shadowColor = glow;
      c.strokeStyle = glow;
      c.beginPath(); c.moveTo(-16, -22); c.quadraticCurveTo(-22, -44, -14, -68); c.stroke();
      c.beginPath(); c.moveTo(16, -22); c.quadraticCurveTo(22, -44, 14, -68); c.stroke();
      c.restore();
    }
    c.fillStyle = sil ? '#fff' : '#222';
    c.fillRect(-15, -26, 30, 5);
    if (!sil) { c.fillStyle = isH ? '#3b82f6' : '#aa2222'; c.fillRect(-4, -26, 8, 5); }
    c.restore();

    /* arms */
    this._drawArm(c, -18, -70, an.la, coat, coatA, skin, sil, glow, isH);
    this._drawArm(c, 18, -70, an.ra, coat, coatA, skin, sil, glow, isH);

    /* neck */
    c.fillStyle = skin;
    c.beginPath(); c.roundRect(-5, -84, 10, 10, 3); c.fill();

    /* head: rotate around neck pivot, not world origin */
    c.save();
    c.translate(0, -82);
    c.rotate(an.hd);
    this._drawHead(c, skin, hair, hairH, eyeC, glow, sil, isH);
    c.restore();
  }

  _drawLeg(c, offX, offY, angle, pantsCol, skinCol, sil, isH) {
    c.save(); c.translate(offX, offY); c.rotate(angle);
    c.fillStyle = pantsCol;
    c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.lineTo(7, -30); c.lineTo(-7, -30); c.closePath(); c.fill();
    c.fillRect(-5.5, -30, 11, -18);
    c.fillStyle = sil ? '#fff' : (isH ? '#0b1020' : '#140808');
    c.beginPath(); c.moveTo(-6, -48); c.lineTo(9, -48); c.lineTo(11, -42); c.lineTo(-5, -42); c.closePath(); c.fill();
    c.restore();
  }

  _drawArm(c, offX, offY, angle, coatCol, accentCol, skinCol, sil, glow, isH) {
    c.save(); c.translate(offX, offY); c.rotate(angle);
    c.fillStyle = coatCol;
    c.beginPath(); c.roundRect(-5, 0, 10, 26, 4); c.fill();
    if (!sil) { c.fillStyle = accentCol; c.fillRect(-4, 22, 8, 2); }
    c.fillStyle = coatCol;
    c.beginPath(); c.roundRect(-4.5, 24, 9, 22, 4); c.fill();
    if (!sil) {
      c.fillStyle = isH ? '#dbe4ff' : '#2a1515';
      c.fillRect(-3, 42, 6, 5);
      if (this.aura > .1 && (this.pose === 's_charge' || this.pose === 's_fire' || this.pose === 'domain')) {
        c.save(); c.globalAlpha = this.aura * .5;
        c.shadowBlur = 22; c.shadowColor = glow;
        c.beginPath(); c.arc(0, 46, 7, 0, Math.PI * 2);
        c.fillStyle = glow; c.fill(); c.restore();
      }
    }
    c.fillStyle = skinCol;
    c.beginPath(); c.arc(0, 50, 4.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  _drawHead(c, skin, hair, hairH, eyeC, glow, sil, isH) {
    const hx = 0, hy = 0;

    /* hair back layer */
    c.fillStyle = hair;
    if (isH) {
      c.beginPath();
      c.moveTo(hx - 14, hy + 6); c.lineTo(hx - 18, hy - 6); c.lineTo(hx - 13, hy - 12);
      c.lineTo(hx - 16, hy - 22); c.lineTo(hx - 7, hy - 18); c.lineTo(hx - 3, hy - 28);
      c.lineTo(hx + 1, hy - 20); c.lineTo(hx + 6, hy - 28); c.lineTo(hx + 10, hy - 16);
      c.lineTo(hx + 16, hy - 22); c.lineTo(hx + 15, hy - 9); c.lineTo(hx + 18, hy - 2);
      c.lineTo(hx + 14, hy + 6); c.closePath(); c.fill();
      if (!sil) {
        c.save(); c.globalAlpha = .35; c.fillStyle = hairH;
        c.beginPath(); c.moveTo(hx - 5, hy - 8); c.lineTo(hx - 2, hy - 23);
        c.lineTo(hx + 1, hy - 15); c.lineTo(hx + 4, hy - 24); c.lineTo(hx + 6, hy - 8);
        c.closePath(); c.fill(); c.restore();
      }
    } else {
      c.beginPath();
      c.moveTo(hx - 14, hy + 4); c.lineTo(hx - 18, hy - 4); c.lineTo(hx - 18, hy - 16);
      c.lineTo(hx - 10, hy - 12); c.lineTo(hx - 7, hy - 24); c.lineTo(hx - 1, hy - 18);
      c.lineTo(hx + 2, hy - 26); c.lineTo(hx + 7, hy - 17); c.lineTo(hx + 12, hy - 24);
      c.lineTo(hx + 15, hy - 12); c.lineTo(hx + 20, hy - 8); c.lineTo(hx + 14, hy + 4);
      c.closePath(); c.fill();
      if (!sil) {
        c.save(); c.globalAlpha = .3; c.fillStyle = hairH;
        c.beginPath(); c.moveTo(hx - 3, hy - 8); c.lineTo(hx - 1, hy - 22);
        c.lineTo(hx + 3, hy - 22); c.lineTo(hx + 5, hy - 8); c.closePath(); c.fill(); c.restore();
      }
    }

    /* face */
    c.fillStyle = skin;
    c.beginPath(); c.ellipse(hx, hy, 12, 14, 0, 0, Math.PI * 2); c.fill();
    if (sil) return;

    /* eyes with blink */
    const blinkSq = this.blinkPhase > 0 ? Math.max(.08, 1 - (this.blinkPhase / .1)) : 1;
    if (isH) {
      this._drawEye(c, hx - 5, hy - 1, 3.6, 4.2 * blinkSq, eyeC, glow, '#fff');
      this._drawEye(c, hx + 5, hy - 1, 3.6, 4.2 * blinkSq, eyeC, glow, '#fff');
      c.strokeStyle = hair; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(hx - 8, hy - 7); c.lineTo(hx - 2, hy - 9); c.stroke();
      c.beginPath(); c.moveTo(hx + 2, hy - 9); c.lineTo(hx + 8, hy - 7); c.stroke();
    } else {
      this._drawEye(c, hx - 5, hy - 1, 3.4, 3 * blinkSq, eyeC, glow, '#200');
      this._drawEye(c, hx + 5, hy - 1, 3.4, 3 * blinkSq, eyeC, glow, '#200');
      c.strokeStyle = hair; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(hx - 9, hy - 4); c.lineTo(hx - 2, hy - 7); c.stroke();
      c.beginPath(); c.moveTo(hx + 2, hy - 7); c.lineTo(hx + 9, hy - 4); c.stroke();
      /* scar + markings */
      c.strokeStyle = 'rgba(170,40,40,.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(hx + 3, hy - 5); c.lineTo(hx + 9, hy + 5); c.stroke();
      c.strokeStyle = 'rgba(170,40,40,.3)'; c.lineWidth = .8;
      c.beginPath(); c.moveTo(hx - 7, hy + 1); c.lineTo(hx - 4, hy + 5); c.stroke();
      c.beginPath(); c.moveTo(hx + 7, hy + 1); c.lineTo(hx + 4, hy + 5); c.stroke();
    }

    /* mouth */
    c.strokeStyle = '#8b5c5c'; c.lineWidth = .8;
    if (this.pose === 'attack' || this.pose === 's_fire') {
      c.beginPath(); c.ellipse(hx, hy + 8, 3, 2, 0, 0, Math.PI); c.stroke();
    } else if (this.pose === 'hit') {
      c.beginPath(); c.arc(hx, hy + 8, 2, 0, Math.PI); c.stroke();
    } else if (this.pose === 'victory') {
      c.beginPath(); c.arc(hx, hy + 7, 2.5, .1, Math.PI - .1); c.stroke();
    } else {
      if (!isH) { c.beginPath(); c.moveTo(hx - 3, hy + 7); c.lineTo(hx + 3, hy + 6); c.stroke(); }
      else      { c.beginPath(); c.moveTo(hx - 3, hy + 7); c.lineTo(hx + 3, hy + 7); c.stroke(); }
    }
  }

  _drawEye(c, ex, ey, ew, eh, irisCol, glowCol, sclera) {
    if (eh < .5) { /* closed — just a line */
      c.strokeStyle = '#333'; c.lineWidth = .8;
      c.beginPath(); c.moveTo(ex - ew, ey); c.lineTo(ex + ew, ey); c.stroke();
      return;
    }
    c.fillStyle = sclera;
    c.beginPath(); c.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = irisCol;
    c.beginPath(); c.arc(ex, ey + .5, Math.min(ew, eh) * .65, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(ex, ey + .5, Math.min(ew, eh) * .3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(ex - 1, ey - 1, 1.2, 0, Math.PI * 2); c.fill();
    if (this.aura > .4) {
      c.save(); c.globalAlpha = (this.aura - .4) * .6;
      c.shadowBlur = 12; c.shadowColor = glowCol;
      c.fillStyle = glowCol;
      c.beginPath(); c.ellipse(ex, ey, ew + 1, eh + 1, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  /* ── HP BAR ── */
  drawHP(c) {
    const bw = Math.min(220, W * .26), bh = 20;
    const bx = this.side === 'hero' ? 20 : W - 20 - bw;
    const by = 24;
    const pct = clamp(this.hp / this.maxHp, 0, 1);

    c.font = `bold ${Math.min(18, W * .024)}px sans-serif`; c.fillStyle = '#ccc';
    c.textAlign = this.side === 'hero' ? 'left' : 'right';
    c.fillText(this.name.toUpperCase(), this.side === 'hero' ? bx : bx + bw, by - 6);

    c.fillStyle = 'rgba(0,0,0,.5)';
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(bx, by, bw, bh, 3); c.fill(); c.stroke();

    if (pct > 0) {
      const g = c.createLinearGradient(bx, by, bx + bw * pct, by + bh);
      if (this.side === 'hero') { g.addColorStop(0, '#3b82f6'); g.addColorStop(1, '#8b5cf6'); }
      else { g.addColorStop(0, '#ef4444'); g.addColorStop(1, '#f97316'); }
      c.fillStyle = g;
      c.beginPath(); c.roundRect(bx + 1, by + 1, (bw - 2) * pct, bh - 2, 2); c.fill();
      c.save(); c.globalAlpha = .15; c.fillStyle = '#fff';
      c.fillRect(bx + 1, by + 1, (bw - 2) * pct, (bh - 2) / 2); c.restore();
    }

    c.font = `bold ${Math.min(13, W * .016)}px sans-serif`;
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText(`${Math.max(0, Math.ceil(this.hp))} / ${this.maxHp}`, bx + bw / 2, by + bh - 3);

    /* energy bar */
    const sy = by + bh + 6, sh = 7;
    const sp = clamp(this.sp / 100, 0, 1);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(bx, sy, bw, sh);
    if (sp > 0) {
      c.fillStyle = this.side === 'hero' ? 'rgba(167,139,250,.65)' : 'rgba(251,191,36,.65)';
      c.fillRect(bx, sy, bw * sp, sh);
    }
  }
}
