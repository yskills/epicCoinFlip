/* ═══════════════════════════════════════════════════════
   GAME v2 — combat, specials, domain, hitstop, zoom,
             chromatic aberration, mobile touch, no log
   ═══════════════════════════════════════════════════════ */

let hero, villain, gameState = 'menu';

function fightScale() {
  const base = Math.min(W / 760, H / 560);
  return clamp(base * (W < 760 ? 1.34 : 1.16), 1.02, 1.78);
}

function fightSpread() {
  return clamp(W * (W < 760 ? .22 : .18), 110, 230);
}

function layoutFighters() {
  if (!hero || !villain) return;
  const sc = fightScale();
  const spread = fightSpread();
  const heroX = W * .5 - spread;
  const villainX = W * .5 + spread;
  hero.sc = sc; villain.sc = sc;
  hero.bx = heroX; villain.bx = villainX;
  hero.x = heroX; villain.x = villainX;
  if (Math.abs(hero.dx - heroX) > 140) hero.dx = heroX;
  if (Math.abs(villain.dx - villainX) > 140) villain.dx = villainX;
}

async function dashTo(fighter, targetX, dur, focusPower) {
  const startX = fighter.x;
  const t0 = performance.now();
  return new Promise(resolve => {
    (function tick() {
      const pr = clamp((performance.now() - t0) / (dur || 120), 0, 1);
      fighter.x = lerp(startX, targetX, ease.inOutCubic(pr));
      if (pr < 1) {
        if (Math.random() < .75) fighter.addAfter();
        focusCameraOn((fighter.dx + targetX) * .5, gY() - 75 * fighter.sc, focusPower || .16);
        requestAnimationFrame(tick);
      } else {
        fighter.x = targetX;
        resolve();
      }
    })();
  });
}

async function animateBeam(target, dur) {
  const start = bmPr;
  const t0 = performance.now();
  return new Promise(resolve => {
    (function tick() {
      const pr = clamp((performance.now() - t0) / (dur || 220), 0, 1);
      bmPr = lerp(start, target, ease.outCubic(pr));
      if (pr < 1) requestAnimationFrame(tick);
      else resolve();
    })();
  });
}

/* ── Balance ── */
const DMG_MIN = 5, DMG_MAX = 11;
const CRIT_MULT = 2.8, CRIT_CHANCE = .16;
const SP_DMG_MIN = 14, SP_DMG_MAX = 24;
const DOM_DMG_MIN = 24, DOM_DMG_MAX = 36;
const SP_COST = 50, DOM_COST = 90;
const SP_GAIN_HIT = 18, SP_GAIN_RECV = 12;

/* ── Ability names ── */
const HERO_ATK  = ['STRIKE', 'PALM THRUST', 'FORCE BLOW'];
const HERO_CRIT = 'DARK IMPACT', HERO_SP = 'VOID SINGULARITY', HERO_DOM = 'INFINITE DOMAIN';
const VILL_ATK  = ['SLASH', 'CLAW', 'REND'];
const VILL_CRIT = 'DARK IMPACT', VILL_SP = 'CURSED CLEAVE', VILL_DOM = 'SHADOW DOMAIN';

/* ═══ GAME FLOW ═══ */
function startGame() {
  const n1 = ($('p1').value || 'AZURE').trim().substring(0, 16);
  const n2 = ($('p2').value || 'CRIMSON').trim().substring(0, 16);
  $('start').style.display = 'none';
  gameState = 'fight';

  const sc = fightScale();
  const spread = fightSpread();
  hero    = new Fighter(n1, 'hero',    W * .5 - spread, sc);
  villain = new Fighter(n2, 'villain', W * .5 + spread, sc);

  lt = performance.now() / 1000;
  requestAnimationFrame(loop);
  countdown();
}

async function countdown() {
  gameState = 'countdown';
  for (const t of ['3', '2', '1']) {
    showHud(t, '#fbbf24', 90, .85);
    await sleep(650);
  }
  showHud('FIGHT!', '#ef4444', 72, 1.1);
  flash(.08, .6); addSL('#fbbf24', 14);
  await sleep(420);
  gameState = 'fight';
  scheduleTurn();
}

function scheduleTurn() {
  if (gameState !== 'fight') return;
  setTimeout(() => { if (gameState === 'fight') attackTurn(); }, rand(380, 760));
}

async function attackTurn() {
  if (gameState !== 'fight') return;
  const atkHero = Math.random() < .5;
  const atk = atkHero ? hero : villain;
  const def = atkHero ? villain : hero;

  let dmg, kind, name, spType = null;

  if (atk.sp >= DOM_COST && Math.random() < .09) {
    spType = 'domain'; dmg = rand(DOM_DMG_MIN, DOM_DMG_MAX); kind = 'domain';
    name = atkHero ? HERO_DOM : VILL_DOM;
  } else if (atk.sp >= SP_COST && Math.random() < .22) {
    spType = 'special'; dmg = rand(SP_DMG_MIN, SP_DMG_MAX); kind = 'special';
    name = atkHero ? HERO_SP : VILL_SP;
  } else {
    dmg = rand(DMG_MIN, DMG_MAX);
    if (Math.random() < CRIT_CHANCE) {
      dmg = Math.round(dmg * CRIT_MULT); kind = 'crit';
      name = atkHero ? HERO_CRIT : VILL_CRIT;
    } else {
      kind = 'normal'; name = pick(atkHero ? HERO_ATK : VILL_ATK);
    }
  }

  if (spType === 'domain') await domainCutscene(atk, def, atkHero, dmg, name);
  else if (spType === 'special') await specialAttack(atk, def, atkHero, dmg, name);
  else await normalAttack(atk, def, atkHero, dmg, kind, name);

  if (def.hp <= 0) { def.hp = 0; await sleep(300); endFight(atk, def); return; }
  scheduleTurn();
}

/* ════════════ NORMAL / CRIT ════════════ */
async function normalAttack(atk, def, atkHero, dmg, kind, name) {
  const origX = atk.x;
  const dashX = lerp(atk.x, def.x, .52);
  atk.addAfter();
  atk.setPose('attack', 16);
  addSL(atkHero ? '#3b82f680' : '#ef444480', 10);
  dustBurst(atk.dx, gY(), 7, 'rgba(120,100,200,.3)');
  await dashTo(atk, dashX, kind === 'crit' ? 140 : 100, kind === 'crit' ? .2 : .14);

  if (kind === 'crit') {
    slo = .16;
    atk.auraMx = 1;
    emit(atk.dx + atk.facing * 30, gY() - 50 * atk.sc, 14, {
      col: atkHero ? '#a78bfa' : '#fbbf24', sMin: 100, sMax: 300, szMin: 3, szMax: 8, lMin: .3, lMax: .7
    });
    emitRunes(atk.dx, gY() - 60 * atk.sc, 10, atkHero ? '#6366f1' : '#ef4444');
    showHud(name, '#fbbf24', 54, 1.4);
    /* zoom punch-in toward impact */
    zoomAt(1.2, (atk.dx + def.dx) / 2, gY() - 40);
    focusCameraOn((atk.dx + def.dx) / 2, gY() - 55, .24);
  }

  await sleep(kind === 'crit' ? 220 : 120);

  /* ── IMPACT ── */
  def.hp -= dmg;
  def.setPose('hit', 10); def.fl = 1;
  atk.sp = Math.min(100, atk.sp + SP_GAIN_HIT);
  def.sp = Math.min(100, def.sp + SP_GAIN_RECV);

  /* hitstop (freeze frames) — THE key fighting game technique */
  hitstop(kind === 'crit' ? .14 : .05);

  shake(kind === 'crit' ? 'heavy' : 'light', def.facing, 0);
  flash(.05, kind === 'crit' ? .85 : .3);
  if (kind === 'crit') chromaHit(.9);

  const impX = def.dx - def.facing * 15;
  const impY = gY() - 45 * def.sc;
  focusCameraOn(impX, impY, kind === 'crit' ? .26 : .16);

  emit(impX, impY, kind === 'crit' ? 30 : 14, {
    col: atkHero ? '#60a5fa' : '#f87171', sMin: 60, sMax: 300, szMin: 2, szMax: 6, lMin: .2, lMax: .55
  });
  impactSmear(impX, impY, def.facing, atkHero ? '#6366f1' : '#ef4444');
  impactSmear(impX, impY - 10, def.facing, '#fff');
  dustBurst(def.dx, gY(), 10, 'rgba(160,120,200,.3)');

  if (kind === 'crit') {
    emit(impX, impY, 10, { col: '#fbbf24', tp: 'ring', szMin: 6, szMax: 14, lMin: .4, lMax: .8 });
    emit(impX, impY, 18, { col: '#fff', tp: 'spark', szMin: 6, szMax: 24, sMin: 120, sMax: 460, lMin: .2, lMax: .5 });
  }

  floatDmg(def.dx, gY() - 90 * def.sc, `-${dmg}`,
    kind === 'crit' ? '#fbbf24' : '#fff', kind === 'crit' ? 34 : 22);

  slo = 1; zoomAt(1);
  await sleep(kind === 'crit' ? 250 : 140);

  atk.setPose('idle'); def.setPose('idle'); atk.auraMx = 0;
  await dashTo(atk, origX, 120, .08);
  releaseCamera();
}

/* ════════════ SPECIAL ════════════ */
async function specialAttack(atk, def, atkHero, dmg, name) {
  atk.sp -= SP_COST;
  atk.setPose('s_charge', 8); atk.auraMx = 1;
  showHud(name, atkHero ? '#818cf8' : '#f97316', 48, 1.6);
  addSL(atkHero ? '#6366f180' : '#ef444480', 18);
  slo = .24;
  focusCameraOn(atk.dx, gY() - 90 * atk.sc, .16);

  for (let i = 0; i < 3; i++) {
    emit(atk.dx, gY() - 50 * atk.sc, 12, {
      col: atkHero ? '#6366f1' : '#ef4444', ang: -Math.PI / 2, sp: 1.2,
      sMin: 30, sMax: 100, szMin: 2, szMax: 6, lMin: .4, lMax: .9
    });
    emitRunes(atk.dx, gY() - 40 * atk.sc, 5, atkHero ? '#818cf8' : '#f97316');
    emit(def.dx, gY() - 42 * def.sc, 4, {
      col: atkHero ? '#d8b4fe' : '#fbbf24', ang: Math.PI / 2, sp: .9,
      sMin: 14, sMax: 44, szMin: 1.5, szMax: 4.5, lMin: .2, lMax: .45
    });
    addSL(atkHero ? '#8b5cf640' : '#f9731640', 7);
    atk.addAfter();
    await sleep(120);
  }

  atk.setPose('s_fire', 16);
  bmOn = true; bmPr = 0; bmSd = atkHero ? 'left' : 'right';
  bmCol = atkHero ? '#7c3aed' : '#ef4444';
  bmCol2 = atkHero ? '#c084fc' : '#f97316';
  if (atkHero) showHud('SINGULARITY COLLAPSE', '#d8b4fe', 34, .9, H * .32);

  await Promise.all([
    dashTo(atk, lerp(atk.x, def.x, .38), 120, .18),
    animateBeam(.58, 180)
  ]);
  await animateBeam(1, 220);

  flash(.1, .8); shake('heavy', def.facing, 0); addSL(atkHero ? '#c084fc80' : '#f9731680', 16);
  hitstop(.14); chromaHit(atkHero ? 1 : .85);
  const hits = [Math.ceil(dmg * .42), Math.ceil(dmg * .33)];
  hits.push(Math.max(1, dmg - hits[0] - hits[1]));
  def.sp = Math.min(100, def.sp + SP_GAIN_RECV);

  const impX = def.dx, impY = gY() - 45 * def.sc;
  focusCameraOn(impX, impY, .28);
  for (let i = 0; i < hits.length; i++) {
    const subDmg = hits[i];
    def.hp -= subDmg; def.setPose('hit', 10); def.fl = 1;
    emit(impX + rf(-14, 14), impY + rf(-8, 8), 18 - i * 2, {
      col: atkHero ? '#c084fc' : '#f87171', sMin: 80, sMax: 400, szMin: 3, szMax: 10, lMin: .2, lMax: .6
    });
    emit(impX, impY, 5, { col: atkHero ? '#e9d5ff' : '#fbbf24', tp: 'ring', szMin: 8 + i * 3, szMax: 18 + i * 4, lMin: .25, lMax: .55 });
    impactSmear(impX, impY + i * 6, def.facing, atkHero ? '#c084fc' : '#f97316');
    impactSmear(impX, impY + 8, def.facing, '#fff');
    emitRunes(impX, impY - 20, 3, atkHero ? '#d8b4fe' : '#f97316');
    dustBurst(def.dx, gY(), 5, atkHero ? 'rgba(180,120,255,.45)' : 'rgba(140,100,220,.4)');
    floatDmg(def.dx + rf(-12, 12), gY() - (100 + i * 12) * def.sc, `-${subDmg}`, atkHero ? '#d8b4fe' : '#f97316', i === hits.length - 1 ? 32 : 24);
    if (i < hits.length - 1) await sleep(75);
  }

  await sleep(320);
  bmOn = false; bmPr = 0; slo = 1;
  await dashTo(atk, atk.bx, 150, .08);
  atk.setPose('idle'); def.setPose('idle'); atk.auraMx = 0;
  releaseCamera();
}

/* ════════════ DOMAIN EXPANSION ════════════ */
async function domainCutscene(atk, def, atkHero, dmg, name) {
  atk.sp -= DOM_COST;
  slo = .14;
  atk.setPose('domain', 8); atk.auraMx = 1;
  setDark(true);
  focusCameraOn(atk.dx, gY() - 90 * atk.sc, .2);
  await sleep(260);

  showHud('DOMAIN EXPANSION', '#fbbf24', 38, 1.5, H * .32);
  showHud(atkHero ? 'REALITY BENDS' : 'REALITY RUPTURES', atkHero ? '#c4b5fd' : '#f87171', 24, .9, H * .39);
  addSL('#fbbf2480', 28); flash(.06, .6); shake('medium');
  await sleep(360);

  showHud(name, atkHero ? '#818cf8' : '#ef4444', 58, 2, H * .44);
  flash(.08, .9); shake('heavy');

  domainActive = true; domainSide = atkHero ? 'hero' : 'villain';
  await Promise.all([
    new Promise(r => {
      const fStart = performance.now();
      (function t() { domainAlpha = clamp((performance.now() - fStart) / 520, 0, 1);
        if (domainAlpha < 1) requestAnimationFrame(t); else r();
      })();
    }),
    (async () => {
      for (let i = 0; i < 4; i++) {
        emit(atk.dx, gY() - 50 * atk.sc, 18, {
          col: atkHero ? '#818cf8' : '#ef4444', sMin: 80, sMax: 420, szMin: 3, szMax: 10, lMin: .25, lMax: .6
        });
        emit(atk.dx, gY() - 50 * atk.sc, 4, { col: '#fff', tp: 'ring', szMin: 10 + i * 4, szMax: 25 + i * 5, lMin: .25, lMax: .5 });
        emitRunes(atk.dx, gY() - 60 * atk.sc, 5, atkHero ? '#818cf8' : '#ef4444');
        addSL(atkHero ? '#818cf850' : '#ef444450', 10);
        atk.addAfter();
        await sleep(110);
      }
    })()
  ]);

  await sleep(180);

  atk.setPose('s_fire', 16);
  bmOn = true; bmPr = 0; bmSd = atkHero ? 'left' : 'right';
  bmCol = atkHero ? '#6366f1' : '#dc2626'; bmCol2 = atkHero ? '#c4b5fd' : '#fbbf24';
  await Promise.all([
    dashTo(atk, lerp(atk.x, def.x, .34), 130, .2),
    animateBeam(.72, 260)
  ]);
  await animateBeam(1, 260);

  const hits = rand(6, 9);
  for (let i = 0; i < hits; i++) {
    const subDmg = i === hits - 1 ? Math.max(1, dmg - Math.round(dmg / hits) * (hits - 1)) : Math.round(dmg / hits);
    def.hp -= subDmg; def.fl = 1; def.setPose('hit', 14);
    hitstop(.07); shake('heavy', def.facing, 0); flash(.04, .7); chromaHit(.6);
    const ix = def.dx + rf(-30, 30), iy = gY() - rf(30, 70) * def.sc;
    focusCameraOn(ix, iy, .28);
    emit(ix, iy, 22, { col: atkHero ? '#c4b5fd' : '#fbbf24', sMin: 60, sMax: 320, szMin: 3, szMax: 9, lMin: .2, lMax: .6 });
    emit(ix, iy, 5, { col: '#fff', tp: 'hex', szMin: 8, szMax: 18, lMin: .3, lMax: .7 });
    emit(ix, iy, 8, { col: atkHero ? '#e9d5ff' : '#fde68a', tp: 'spark', szMin: 8, szMax: 22, sMin: 140, sMax: 420, lMin: .12, lMax: .24 });
    impactSmear(ix, iy, def.facing, atkHero ? '#c4b5fd' : '#fbbf24');
    dustBurst(def.dx, gY(), 4, 'rgba(251,191,36,.28)');
    addSL(atkHero ? '#c4b5fd40' : '#fbbf2440', 6);
    atk.addAfter();
    floatDmg(ix, iy - 20, `-${subDmg}`, '#fbbf24', 26);
    await sleep(95);
  }

  bmOn = false; setDark(false);
  const fEnd = performance.now();
  await new Promise(r => {
    (function t() { domainAlpha = 1 - clamp((performance.now() - fEnd) / 420, 0, 1);
      if (domainAlpha > 0) requestAnimationFrame(t); else r();
    })();
  });
  domainAlpha = 0; domainActive = false; slo = 1;
  await dashTo(atk, atk.bx, 170, .08);
  atk.setPose('idle'); def.setPose('idle'); atk.auraMx = 0;
  releaseCamera();
}

/* ════════════ END ════════════ */
async function endFight(winner, loser) {
  gameState = 'end';
  winner.setPose('victory'); winner.auraMx = .8;
  loser.setPose('defeat');

  showHud('K.O.', '#ef4444', 82, 2);
  flash(.12, 1); shake('heavy'); chromaHit(1);
  addSL('#ef444480', 20);
  emit(loser.dx, gY() - 50 * loser.sc, 35, { col: '#ef4444', sMin: 50, sMax: 250, szMin: 2, szMax: 7, lMin: .3, lMax: .9 });

  await sleep(2200);

  showHud(`${winner.name.toUpperCase()} WINS!`, '#fbbf24', 52, 3);
  emit(winner.dx, gY() - 80 * winner.sc, 25, {
    col: '#fbbf24', sMin: 50, sMax: 200, szMin: 2, szMax: 6, lMin: .5, lMax: 1.2
  });

  await sleep(2500);
  $('winnerName').textContent = `${winner.name.toUpperCase()} WINS`;
  $('end').style.display = 'flex';
}

function restart() {
  $('end').style.display = 'none';
  $('start').style.display = 'flex';
  gameState = 'menu';
  hero = villain = null;
  for (const p of pts) p.active = false;
  floats.length = 0; sLines.length = 0; hudT.length = 0;
  bmOn = false; domainAlpha = 0; domainActive = false;
  fa = 0; da = 0; dT = 0; sk.i = 0; slo = 1; zm = 1; zT = 1; caStr = 0;
  hitstopTimer = 0;
}

/* ═══════════ MAIN LOOP ═══════════ */
function loop(now) {
  now /= 1000;
  const rawDt = Math.min(now - lt, .05);
  lt = now;

  /* hitstop: freeze game time but keep rendering */
  if (hitstopTimer > 0) {
    hitstopTimer -= rawDt;
    dt = 0;
  } else {
    dt = rawDt * slo;
  }
  gt += dt;

  requestAnimationFrame(loop);

  /* physics */
  sk.i = Math.max(0, sk.i - rawDt * 70);
  if (sk.i > 0) {
    const decay = sk.i / 28;
    sk.x = (sk.dx ? sk.dx * sk.i * .4 : 0) + rf(-sk.i, sk.i) * .6;
    sk.y = (sk.dy ? sk.dy * sk.i * .4 : 0) + rf(-sk.i, sk.i) * .6;
  } else { sk.x = 0; sk.y = 0; }

  da = lerp(da, dT, rawDt * 4);
  zm = lerp(zm, zT, rawDt * 5);
  camX = lerp(camX, camTX, rawDt * 4.5);
  camY = lerp(camY, camTY, rawDt * 4.5);
  caStr = Math.max(0, caStr - rawDt * 6);

  if (hero) hero.update(dt);
  if (villain) villain.update(dt);

  for (const p of pts) if (p.active) p.update(dt);

  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.life -= rawDt; f.y += f.vy * rawDt;
    const pr = 1 - f.life / f.ml;
    f.sc = pr < .08 ? ease.outBack(pr / .08) : f.life < .2 ? f.life / .2 : 1;
    if (f.life <= 0) floats.splice(i, 1);
  }

  updSL(dt); updHud(rawDt);

  /* ═══ DRAW ═══ */
  cx.save();
  cx.translate(sk.x + camX, sk.y + camY);

  /* zoom toward impact point */
  const zox = W * zmX, zoy = H * zmY;
  cx.translate(zox, zoy); cx.scale(zm, zm); cx.translate(-zox, -zoy);

  drawBG();
  drawSL(cx);
  drawBeam(cx);

  if (hero) { hero.draw(cx); hero.drawHP(cx); }
  if (villain) { villain.draw(cx); villain.drawHP(cx); }

  for (const p of pts) if (p.active) p.draw(cx);

  /* floating damage with scale pop */
  for (const f of floats) {
    cx.save(); cx.globalAlpha = clamp(f.sc, 0, 1);
    cx.translate(f.x, f.y); cx.scale(f.sc, f.sc);
    cx.font = `900 ${f.sz}px sans-serif`;
    cx.textAlign = 'center'; cx.fillStyle = f.col;
    cx.shadowBlur = 18; cx.shadowColor = f.col;
    cx.fillText(f.txt, 0, 0);
    cx.restore();
  }

  drawHud(cx);

  /* dark overlay */
  if (da > .01) { cx.fillStyle = `rgba(0,0,0,${da * .6})`; cx.fillRect(0, 0, W, H); }

  /* chromatic aberration */
  if (caStr > .01) {
    const off = caStr * 5;
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = caStr * .12;
    cx.drawImage(cv, off * DPR, 0, cv.width, cv.height, 0, 0, W, H);
    cx.drawImage(cv, -off * DPR, 0, cv.width, cv.height, 0, 0, W, H);
    cx.restore();
  }

  cx.restore();

  /* flash */
  const fl = $('flash');
  if (fa > .01) { fl.style.opacity = fa; fl.style.display = 'block'; }
  else { fl.style.display = 'none'; }
}

/* ═══ EVENTS ═══ */
$('go').addEventListener('click', startGame);
$('restartBtn').addEventListener('click', restart);
['p1', 'p2'].forEach(id =>
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); })
);

/* ── Mobile: prevent pinch-zoom, double-tap etc ── */
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
addEventListener('resize', layoutFighters);
