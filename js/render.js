(function (g) {
  const TG = g.TG;
  const P = TG.P;

  /* 전투 화면. 200 x 120 점짜리 캔버스에 그리고, 정수 배율로 키워서 점이 고르게 보이게 한다 */
  const W = 200;
  const H = 120;
  const GROUND = 100;

  let cv = null;
  let ctx = null;
  let scroll = 0;
  let shake = 0;
  let clock = 0;
  const fx = [];
  const texts = [];

  /* ---- 그림 고르기 (그림이 아직 없으면 대신 그린다) ---- */
  const mobDef = (kind) => TG.SPR.mob[kind] || TG.SPR.mob.slime;
  const palOf = (def, i) => {
    const pals = def.palettes || [def.palette || {}];
    return { pal: pals[i % pals.length], key: `p${i % pals.length}` };
  };

  const fallbackItem = new Map();
  function itemDef(tier) {
    const d = TG.SPR.item[`t${tier}`];
    if (d) return d;
    if (!fallbackItem.has(tier)) {
      const color = TG.TIER_COLORS[tier - 1] || '#ffffff';
      fallbackItem.set(tier, {
        id: `item.fallback${tier}`,
        w: 20,
        h: 20,
        ax: 10,
        ay: 10,
        clips: { icon: 1, shine: 1 },
        draw(b) {
          b.poly([[10, 2], [17, 10], [10, 18], [3, 10]], color);
          b.px(8, 7, '#ffffff');
          for (let k = 0; k < Math.min(tier, 10); k++) b.px(5 + k, 15 - (k % 2), '#ffffff', 0.6);
        },
      });
    }
    return fallbackItem.get(tier);
  }
  TG.itemDef = itemDef;

  /* 반복 동작은 시간으로, 한 번 하는 동작은 진행도로 프레임을 고른다 */
  function frame(def, clip, palIdx, S, opt) {
    if (!def.clips[clip]) clip = Object.keys(def.clips)[0];
    const { pal, key } = palOf(def, palIdx);
    const c = TG.clip(def, clip, pal, S, key);
    let i;
    if (opt.progress !== undefined) i = Math.min(c.n - 1, Math.max(0, Math.floor(opt.progress * c.n)));
    else i = ((Math.floor(opt.time * (opt.fps || 8)) % c.n) + c.n) % c.n;
    return { fr: c.frames[i], c };
  }

  /* 반복 이펙트 (오라 같은 것): 그림이 있으면 시간에 맞춰 그린다 */
  function loopFx(name, x, y, t, fps = 10) {
    const def = TG.SPR.fx[name];
    if (!def) return false;
    const clip = def.clips.loop ? 'loop' : Object.keys(def.clips)[0];
    const r = frame(def, clip, 0, 1, { time: t, fps });
    put(r.fr, r.c, x, y, false);
    return true;
  }

  /* 그림자 분신: 주인공 그림을 보랏빛 그림자로 */
  const shadeCache = new WeakMap();
  function shade(canvas) {
    let w = shadeCache.get(canvas);
    if (!w) {
      w = document.createElement('canvas');
      w.width = canvas.width;
      w.height = canvas.height;
      const x = w.getContext('2d');
      x.drawImage(canvas, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = 'rgba(40,16,70,0.82)';
      x.fillRect(0, 0, w.width, w.height);
      shadeCache.set(canvas, w);
    }
    return w;
  }

  /* 맞았을 때 하얗게 번쩍 */
  const whiteCache = new WeakMap();
  function white(canvas) {
    let w = whiteCache.get(canvas);
    if (!w) {
      w = document.createElement('canvas');
      w.width = canvas.width;
      w.height = canvas.height;
      const x = w.getContext('2d');
      x.drawImage(canvas, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w.width, w.height);
      whiteCache.set(canvas, w);
    }
    return w;
  }

  function put(fr, c, x, y, flash) {
    const img = flash ? white(fr.canvas) : fr.canvas;
    ctx.drawImage(img, Math.round(x - c.ax), Math.round(y - c.ay));
  }

  /* ---- 배경 ---- */
  const FALLBACK_SKY = { field: ['#7ec8f0', '#cfeeff'], forest: ['#f0a070', '#ffd9a0'], cave: ['#1a1428', '#2c2240'], volcano: ['#4a1414', '#a8401c'], ice: ['#10203a', '#3a7090'], space: ['#05040f', '#1c1440'], mine: ['#120e14', '#2a2026'], road: ['#f0a060', '#ffd9a0'] };
  const MINE = { id: 'mine', name: '광산' };
  const ROAD = { id: 'road', name: '추격 도로' };
  const CAR_H = 9; /* 주인공이 서는 차 바닥 높이 */
  /* 땅 12곳을 한 바퀴 돌고 다시 오면 (13페이즈부터) 배경이 다른 빛깔로 바뀐다 */
  const PHASE_TINT = ['rgba(150,90,255,0.2)', 'rgba(255,100,60,0.2)', 'rgba(60,200,255,0.2)', 'rgba(70,255,150,0.18)', 'rgba(255,220,80,0.18)'];
  function phaseTint(game) {
    if (game.mode === 'mine' || game.mode === 'chase') return;
    const k = game.variant();
    if (k <= 0) return;
    ctx.fillStyle = PHASE_TINT[(k - 1) % PHASE_TINT.length];
    ctx.fillRect(0, 0, W, H);
  }

  /* 땅마다 떠다니는 알갱이 (분위기만, 계산에는 안 들어감). 위치는 시간의 함수라 상태가 없다 */
  const AMBIENT = {
    field: { n: 7, c: ['#fff3a0', '#ffffff'], vx: 3, vy: -2, sw: 4, s: 1, a: 0.55 },
    forest: { n: 9, c: ['#7bc65a', '#d89a3a', '#a8d86a'], vx: -4, vy: 11, sw: 8, s: 2, a: 0.8 },
    cave: { n: 9, c: ['#a8c8ff', '#d6b8ff'], vx: 1, vy: -1.5, sw: 3, s: 1, a: 0.6, tw: 1 },
    volcano: { n: 14, c: ['#ff9a3a', '#ff5a2a', '#ffd04a'], vx: 3, vy: -16, sw: 5, s: 1, a: 0.85, tw: 1 },
    ice: { n: 18, c: ['#ffffff', '#cfeaff'], vx: -5, vy: 10, sw: 6, s: 1, a: 0.85 },
    space: { n: 16, c: ['#ffffff', '#ffe9a0', '#bfd0ff'], vx: 0, vy: 0, sw: 0, s: 1, a: 0.9, tw: 2 },
    desert: { n: 14, c: ['#e8c88a', '#f5deb0'], vx: -46, vy: 2, sw: 2, s: 1, a: 0.6, streak: 4 },
    swamp: { n: 9, c: ['#d8ff6a', '#a8ff8a'], vx: 2, vy: -1, sw: 6, s: 1, a: 0.85, tw: 1.5 },
    ocean: { n: 12, c: ['#cfeaff', '#9fd8ff'], vx: 0, vy: -11, sw: 4, s: 1, a: 0.7 },
    sky: { n: 6, c: ['#ffffff'], vx: -26, vy: 0, sw: 1, s: 1, a: 0.5, streak: 8 },
    factory: { n: 10, c: ['#ffd04a', '#ff8a3a', '#9a9aa8'], vx: -3, vy: 22, sw: 3, s: 1, a: 0.85, tw: 2 },
    abyss: { n: 12, c: ['#c26bff', '#8a5aff', '#ff8ac8'], vx: 1, vy: -3, sw: 7, s: 1, a: 0.7, tw: 1.2 },
  };
  const hash01 = (i, k) => {
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b);
    h ^= h >>> 15;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 13;
    return ((h >>> 0) % 10000) / 10000;
  };
  function ambient(theme) {
    const a = AMBIENT[theme.id];
    if (!a) return;
    ctx.save();
    for (let i = 0; i < a.n; i++) {
      const x0 = hash01(i, 1) * W;
      const y0 = hash01(i, 2) * GROUND;
      const ph = hash01(i, 3) * 6.283;
      const sp = 0.7 + hash01(i, 4) * 0.6;
      const x = (((x0 + a.vx * sp * clock + Math.sin(clock * 0.9 + ph) * a.sw) % W) + W) % W;
      const y = (((y0 + a.vy * sp * clock) % GROUND) + GROUND) % GROUND;
      const tw = a.tw ? 0.5 + 0.5 * Math.sin(clock * a.tw * 3 + ph) : 1;
      ctx.globalAlpha = a.a * tw;
      ctx.fillStyle = a.c[i % a.c.length];
      ctx.fillRect(Math.round(x), Math.round(y), a.streak || a.s, a.s);
    }
    ctx.restore();
  }

  function drawBg(theme) {
    const def = TG.SPR.bg[theme.id];
    if (!def) {
      const [a, b] = FALLBACK_SKY[theme.id] || ['#223', '#446'];
      const gr = ctx.createLinearGradient(0, 0, 0, GROUND);
      gr.addColorStop(0, a);
      gr.addColorStop(1, b);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, GROUND);
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#4f8a3a';
      ctx.fillRect(0, GROUND, W, 2);
      return;
    }
    const pals = def.palettes || [def.palette || {}];
    const layer = (clip, speed, fps) => {
      if (!def.clips[clip]) return;
      const c = TG.clip(def, clip, pals[0], 1, 'p0');
      const fr = c.frames[fps ? ((Math.floor(clock * fps) % c.n) + c.n) % c.n : 0];
      const off = -Math.round((scroll * speed) % W);
      ctx.drawImage(fr.canvas, off, 0);
      if (speed) ctx.drawImage(fr.canvas, off + W, 0);
    };
    layer('sky', 0);
    layer('far', 0.3);
    layer('near', 1);
    layer('anim', 0, 6);
  }

  /* ---- 이펙트와 떠오르는 글자 ---- */
  function addFx(name, x, y, dur, S = 1) {
    const def = TG.SPR.fx[name];
    fx.push({ def, name, x, y, t: 0, dur, S });
  }
  function addText(str, x, y, color, big) {
    let img = null;
    if (TG.pixelText) {
      const t = TG.pixelText(str, color, '#17121e');
      img = t.canvas || TG.toCanvas(t);
    }
    texts.push({ img, str, x, y, color, t: 0, dur: big ? 1.1 : 0.8, vy: big ? -14 : -20 });
  }

  function heightOf(m) {
    const def = mobDef(m.kind);
    return def.h * (m.giant ? 2 : 1) * 0.55;
  }

  /* ---- 화면 크기 맞추기 ---- */
  function fit() {
    if (!cv) return;
    /* 폭에 맞춰 정수 배율로 키우되, 화면 높이의 38%를 넘지 않게 한다 */
    const box = cv.parentElement.getBoundingClientRect();
    const dpr = g.devicePixelRatio || 1;
    /* 다른 줄(위 정보, 버튼, 아래 탭)과 필드 최소 높이를 빼고 남는 만큼만 쓴다 (작은 폰에서 잘리지 않게) */
    const app = cv.closest('#app');
    let maxH = g.innerHeight * 0.38;
    if (app) {
      const cs = g.getComputedStyle(app);
      let used = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 170;
      let rows = 0;
      for (const el of app.children) {
        if (el === cv.parentElement || el.id === 'field' || getComputedStyle(el).position === 'absolute' || el.hidden) continue;
        used += el.getBoundingClientRect().height;
        rows++;
      }
      used += parseFloat(cs.rowGap || 0) * (rows + 1);
      maxH = Math.min(maxH, app.clientHeight - used - 4);
    }
    const k = Math.max(1, Math.floor(Math.min((box.width - 4) * dpr / W, (maxH * dpr) / H)));
    cv.style.width = `${(W * k) / dpr}px`;
    cv.style.height = `${(H * k) / dpr}px`;
  }

  function init(canvas) {
    cv = canvas;
    cv.width = W;
    cv.height = H;
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    fit();
  }

  /* 코어가 낸 일들을 화면 효과로 바꾼다 */
  function onEvent(e, game) {
    switch (e.type) {
      case 'hit': {
        const m = game.mobs.find((mm) => mm.id === e.id) || { x: e.x, kind: 'slime', giant: e.giant };
        const y = GROUND - heightOf(m);
        addFx(e.giant ? 'bighit' : 'hit', e.x - 2, y, 0.25);
        if (e.power) addFx('powerShot', e.x - 2, y, 0.35);
        if (e.chain) addFx('boltStrike', e.x, GROUND, 0.25);
        addText(TG.fmt(e.dmg), e.x, y - 6, e.power ? '#ffb13a' : e.fire ? '#ff7a3a' : e.banana ? '#ffe45a' : '#ffffff', e.power || e.fire);
        if (e.giant) shake = Math.max(shake, 0.12);
        break;
      }
      case 'kill':
        addFx('poof', e.x, GROUND - 6, 0.45, e.giant ? 2 : 1);
        addFx('coin', e.x, GROUND - 14, 0.6);
        addText(`+${TG.fmt(e.gold)}`, e.x, GROUND - 22, '#ffcf4a', true);
        if (e.giant) shake = 0.3;
        break;
      case 'hurt':
        shake = Math.max(shake, 0.15);
        break;
      case 'throw':
        addFx('throwfx', P.heroX + 8, GROUND - 24, 0.2);
        break;
      case 'drop':
        addFx('rainHit', e.x, GROUND - 2, 0.35);
        shake = Math.max(shake, 0.06);
        break;
      case 'sapphire':
        addFx('rubyPop', e.x, GROUND - 4, 0.8);
        addText('+1', e.x, GROUND - 34, '#6ab0ff', true);
        break;
      case 'ruby':
        addFx('rubyPop', e.x, GROUND - 4, 0.8);
        addText('+1', e.x, GROUND - 30, '#ff7a8a', true);
        break;
      case 'fire':
        addFx('fireBurst', e.x, GROUND - 2, 0.5);
        shake = Math.max(shake, 0.1);
        break;
      case 'bash':
        addFx('bash', e.x, GROUND - 14, 0.3);
        shake = Math.max(shake, 0.1);
        break;
      case 'ore':
        addText(`+${e.n}`, e.x, GROUND - 30, '#9fd8ff', true);
        break;
      case 'land-ev':
        if (e.id === 'lava-warn') {
          addFx('bossWarn', P.heroX + 4, GROUND - 22, 1.2);
          addText('땅이 끓어요', P.heroX + 4, GROUND - 40, '#ff8a3a', true);
        } else if (e.id === 'lava-hit') {
          addFx('fireBurst', P.heroX + 4, GROUND - 6, 0.5);
          shake = Math.max(shake, 0.3);
        } else if (e.id === 'meteor') {
          addFx('fireBurst', e.x, GROUND - 10, 0.5, 2);
          addFx('boltStrike', e.x, GROUND, 0.25);
          shake = Math.max(shake, 0.2);
        } else if (e.id === 'storm') addText('눈보라', 100, GROUND - 60, '#cfeaff', true);
        else if (e.id === 'fog') addText('독 안개', 100, GROUND - 60, '#b8f06a', true);
        break;
      case 'bolt':
        addFx('boltStrike', e.x, GROUND, 0.3);
        shake = Math.max(shake, 0.12);
        break;
      case 'volt':
        addFx('voltPop', e.x, GROUND - 4, 0.6);
        addText(`+${e.n}`, e.x, GROUND - 34, '#ffe45a', true);
        shake = Math.max(shake, 0.15);
        break;
      case 'coins':
        addFx('coinShower', P.pigX, GROUND - P.backRow, 0.8);
        addText(`+${TG.fmt(e.gold)}`, P.pigX, GROUND - 40, '#ffcf4a', true);
        break;
      case 'dig':
        addFx('dirtPop', P.moleX, GROUND - P.backRow, 0.5);
        addText(`+${e.n}`, P.moleX, GROUND - 30, '#9fd8ff', true);
        break;
      case 'lucky':
        addText(`+${TG.fmt(e.gold)}`, e.x, GROUND - 38, '#ffcf4a', false);
        break;
      case 'proc':
        if (e.eng) addFx('engraveHit', e.x, GROUND - 22, 0.4);
        if (e.id === 'chain') addFx('boltStrike', e.x, GROUND, 0.25);
        else if (e.id === 'blast') addFx('fireBurst', e.x, GROUND - 2, 0.4);
        break;
      case 'heal':
        addFx('heal', P.heroX, GROUND, 1.0);
        addText(`+${TG.fmt(e.amount)}`, P.heroX, GROUND - 44, '#7dff8a', true);
        break;
      case 'skill':
        if (e.id === 'shadow') addFx('shadowPuff', P.heroX - P.shadowX, GROUND, 0.6);
        break;
      case 'shadow-end':
        addFx('shadowPuff', P.heroX - P.shadowX, GROUND, 0.6);
        break;
      case 'summon':
        addFx('summonPuff', e.x, GROUND, 0.5);
        shake = Math.max(shake, 0.1);
        break;
      case 'charge-slam':
        addFx('chargeSlam', P.heroX + 12, GROUND, 0.5);
        shake = Math.max(shake, 0.4);
        break;
      case 'wall':
        shake = Math.max(shake, 0.12);
        break;
      case 'shield':
      case 'enrage':
        shake = Math.max(shake, e.type === 'enrage' ? 0.3 : 0.1);
        break;
      case 'boss-start':
        addFx('bossWarn', W / 2, H / 2 - 10, 1.0);
        shake = 0.25;
        break;
      default:
    }
  }

  function draw(game, dt) {
    clock += dt;
    if (game.hero.act.kind === 'run') scroll += dt * 70;
    if (game.mode === 'chase' && game.phase === 'fight') scroll += dt * 150;
    if (shake > 0) shake -= dt;
    const theme = game.mode === 'mine' ? MINE : game.mode === 'chase' ? ROAD : game.theme();
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 2));
    drawBg(theme);
    ambient(theme);
    phaseTint(game);

    /* 몬스터 (오른쪽부터 그려서 앞쪽이 위에 오게) */
    const mobs = [...game.mobs].sort((a, b) => b.x - a.x);
    for (const d of game.dying) {
      const def = mobDef(d.m.kind);
      const { fr, c } = frame(def, 'die', d.m.pal, d.m.giant ? 2 : 1, { progress: d.t / P.dieTime });
      put(fr, c, d.m.x, GROUND, false);
    }
    for (const m of mobs) {
      const def = mobDef(m.kind);
      const S = m.giant ? 2 : 1;
      if (m.boss && !loopFx('bossAura', m.x, GROUND, clock)) {
        ctx.fillStyle = 'rgba(160,80,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(m.x, GROUND - def.h * 0.8, def.w * 0.9, def.h * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      let r;
      if (m.state === 'attack') r = frame(def, 'attack', m.pal, S, { progress: m.atkT / P.mobAtkDur });
      else if (m.hurt > 0) r = frame(def, 'hurt', m.pal, S, { progress: 1 - m.hurt / 0.16 });
      else if (m.state === 'walk') r = frame(def, 'walk', m.pal, S, { time: m.t, fps: m.tank ? 16 : 11 });
      else r = frame(def, 'idle', m.pal, S, { time: m.t, fps: 6 });
      put(r.fr, r.c, m.x, GROUND, m.hurt > 0.1);
      /* 보스 특성 표시 */
      if (m.boss) {
        if (m.shield > 0 && !loopFx('bossShield', m.x, GROUND, clock)) {
          ctx.strokeStyle = 'rgba(120,190,255,0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(m.x, GROUND - def.h * 0.8, def.w * 0.7, def.h * 0.95, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (m.enraged && !loopFx('bossRage', m.x, GROUND, clock)) {
          ctx.fillStyle = 'rgba(255,60,40,0.2)';
          ctx.fillRect(Math.round(m.x - def.w * 0.6), Math.round(GROUND - def.h * 1.8), Math.round(def.w * 1.2), Math.round(def.h * 1.8));
        }
        if (m.charge > 0 && !loopFx('bossCharge', m.x, GROUND, clock)) {
          ctx.fillStyle = `rgba(255,50,40,${0.15 + 0.15 * Math.sin(clock * 24)})`;
          ctx.fillRect(Math.round(m.x - def.w * 0.6), Math.round(GROUND - def.h * 1.8), Math.round(def.w * 1.2), Math.round(def.h * 1.8));
        }
        if ((m.trait === 'regen' || m.trait2 === 'regen') && m.hp < m.max && !loopFx('bossHeal', m.x, GROUND, clock)) {
          ctx.fillStyle = '#7dff8a';
          ctx.fillRect(Math.round(m.x + Math.sin(clock * 5) * 6), Math.round(GROUND - ((clock * 24) % 40)), 2, 2);
        }
      }
      /* 상태 이상 표시 */
      const st = m.st;
      if (st) {
        const top = GROUND - def.h * S;
        if (st.stun > 0 && !loopFx('stunStars', m.x, top, clock, 10)) {
          ctx.fillStyle = '#ffe45a';
          for (let q = 0; q < 3; q++) ctx.fillRect(Math.round(m.x + Math.cos(clock * 6 + q * 2.1) * 6), Math.round(top - 3 + Math.sin(clock * 6 + q * 2.1) * 2), 2, 2);
        }
        if (st.slow > 0 && !loopFx('freezeAura', m.x, GROUND, clock, 10)) {
          ctx.fillStyle = 'rgba(140,210,255,0.28)';
          ctx.fillRect(Math.round(m.x - 8), Math.round(top), 16, Math.round(def.h * S));
        }
        if (st.bleed && !loopFx('bleedDrip', m.x, GROUND, clock, 10)) {
          ctx.fillStyle = '#d02030';
          ctx.fillRect(Math.round(m.x + Math.sin(clock * 9) * 4), Math.round(top + ((clock * 30) % 14)), 1, 3);
        }
      }
      /* 체력 막대 */
      if (m.hp < m.max) {
        const bw = m.giant ? 30 : 14;
        const bx = Math.round(m.x - bw / 2);
        const by = Math.round(GROUND - def.h * S * 0.9) - 4;
        ctx.fillStyle = '#17121e';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = '#5a1a24';
        ctx.fillRect(bx, by, bw, 2);
        ctx.fillStyle = m.giant ? '#ff9a3a' : '#ff5d6c';
        ctx.fillRect(bx, by, Math.max(1, Math.round((bw * m.hp) / m.max)), 2);
      }
    }

    /* 어둠장막: 전투 화면 전체에 어두운 안개 */
    if (game.darkT > 0 && !loopFx('darkVeil', 0, 0, clock, 8)) {
      ctx.fillStyle = 'rgba(30,10,60,0.35)';
      ctx.fillRect(0, 0, W, H);
    }

    /* 동료: 같은 장면을 함께 한다 (이기면 기뻐하고, 달리고, 쓰러지면 주저앉는다). 뒷줄 돼지와 두더지, 앞줄 하마와 원숭이는 주인공 뒤, 곰은 앞, 용은 공중 */
    const drawPet = (name, x, y) => {
      if (!game.s.lv[name]) return;
      const def = TG.SPR.pet[name];
      const pa = game.pets[name].act;
      if (!def) {
        ctx.fillStyle = { monkey: '#8a5a34', hippo: '#b49ad8', bear: '#6a4428', dragon: '#4caf50', pig: '#e0b030', mole: '#5a3a78' }[name];
        ctx.fillRect(x - 6, y - 16, 12, 16);
        return;
      }
      const off = { monkey: 0.37, hippo: 0, bear: 0.61, dragon: 0.19, pig: 0.23, mole: 0.51 }[name];
      let r;
      if (game.phase === 'win') r = frame(def, 'cheer', 0, 1, { time: clock + off, fps: 10 });
      else if (game.phase === 'run') r = frame(def, 'run', 0, 1, { time: clock + off, fps: 13 });
      else if (game.phase === 'dead') r = frame(def, 'sad', 0, 1, { progress: Math.min(0.999, (P.deadTime - game.phaseT) / (P.deadTime * 0.6)) });
      else if (pa.kind !== 'idle' && pa.t < pa.dur) r = frame(def, pa.kind, 0, 1, { progress: Math.min(0.999, pa.t / pa.dur) });
      else r = frame(def, 'idle', 0, 1, { time: clock + off, fps: 8 });
      put(r.fr, r.c, x, y, false);
    };
    drawPet('pig', P.pigX, GROUND - P.backRow);
    drawPet('mole', P.moleX, GROUND - P.backRow);
    drawPet('hippo', P.hippoX, GROUND);
    drawPet('monkey', P.monkeyX, GROUND);

    /* 바나나: 원숭이 손에서 화면 끝까지 빙글빙글 (주인공 뒤로 지나간다) */
    for (const b of game.bananas) {
      const y = GROUND - 16 - Math.sin(Math.min(1, (b.x - P.monkeyX) / 40) * Math.PI * 0.5) * 3;
      const def = TG.SPR.pet.banana;
      ctx.save();
      ctx.translate(Math.round(b.x), Math.round(y));
      ctx.rotate(((b.spin + b.x * 9) * Math.PI) / 180);
      if (def) {
        const c = TG.clip(def, 'icon', (def.palettes || [{}])[0], 1, 'p0');
        ctx.drawImage(c.frames[0].canvas, -c.ax, -c.ay);
      } else {
        ctx.fillStyle = '#ffe45a';
        ctx.fillRect(-4, -1, 8, 3);
      }
      ctx.restore();
    }
    /* 주인공 (분노 중이면 뒤에 불꽃 오라) */
    if (game.raging && !loopFx('rage', P.heroX, GROUND, clock, 12)) {
      ctx.fillStyle = 'rgba(255,90,40,0.25)';
      ctx.fillRect(P.heroX - 12, GROUND - 38, 24, 38);
    }
    const hero = TG.SPR.hero.main;
    const a = game.hero.act;
    const loops = { idle: 6, reload: 9, win: 11, run: 13 };
    const cs = game.s.costume || 0;
    const hr = loops[a.kind] ? frame(hero, a.kind, cs, 1, { time: a.t, fps: loops[a.kind] }) : frame(hero, a.kind, cs, 1, { progress: Math.min(0.999, a.t / a.dur) });
    const chasing = game.mode === 'chase';
    let hy = chasing ? GROUND - CAR_H : GROUND;
    let hx = P.heroX;
    if (chasing) {
      const car = TG.SPR.pet.car;
      if (car) {
        const clipName = game.phase === 'fight' ? 'run' : 'idle';
        const cr = frame(car, clipName, 0, 1, { time: clock, fps: 14 });
        put(cr.fr, cr.c, P.heroX, GROUND, false);
        /* 주인공은 차 그림이 알려 주는 발판 위에 선다 (차체가 튀면 같이 튄다) */
        if (car.deck) {
          const d = car.deck(clipName, cr.c.frames.indexOf(cr.fr), cr.c.n);
          hx = P.heroX + d.x;
          hy = GROUND + d.y;
        }
      } else {
        ctx.fillStyle = '#d0503a';
        ctx.fillRect(P.heroX - 20, GROUND - CAR_H, 40, CAR_H);
      }
    }
    if (game.shadowT > 0 && game.phase === 'fight') {
      const sx = hx - P.shadowX;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(shade(hr.fr.canvas), Math.round(sx - hr.c.ax), Math.round(hy - hr.c.ay));
      ctx.globalAlpha = 1;
    }
    put(hr.fr, hr.c, hx, hy, a.kind === 'hurt' && a.t < 0.08);
    if (game.barrage) loopFx('barrage', P.heroX + 8, hy - 22, clock, 14);
    drawPet('bear', P.bearX, GROUND);
    drawPet('dragon', P.dragonX, GROUND - P.dragonY);

    /* 불덩이: 용의 입에서 앞 몬스터까지 */
    for (const fb of game.fires) {
      const tgt = game.mobs.includes(fb.target) ? fb.target : game.front();
      const tx = tgt ? tgt.x : P.spawnX;
      const k = Math.max(0, Math.min(1, (fb.x - fb.x0) / Math.max(1, tx - fb.x0)));
      const y = GROUND - P.dragonY - 4 + (P.dragonY + 4 - (tgt ? heightOf(tgt) : 12)) * k;
      if (!loopFx('fireball', fb.x, y, clock, 14)) {
        ctx.fillStyle = '#ff8a2a';
        ctx.fillRect(Math.round(fb.x) - 3, Math.round(y) - 2, 6, 5);
      }
    }


    /* 날아가는 물건: 손에서 목표까지 포물선을 그리며 돈다 */
    for (const p of game.proj) {
      const k = 1 - p.t / p.dur;
      const tgt = game.mobs.includes(p.target) ? p.target : game.front();
      const tx = tgt ? tgt.x : P.spawnX;
      const ty = tgt ? GROUND - heightOf(tgt) : GROUND - 20;
      const sx = P.heroX + 8 - (p.shadow ? P.shadowX : 0);
      const sy = (game.mode === 'chase' ? GROUND - CAR_H : GROUND) - 26;
      const x = sx + (tx - sx) * k;
      const y = sy + (ty - sy) * k - Math.sin(Math.PI * k) * 10;
      const def = itemDef(p.tier);
      const c = TG.clip(def, 'icon', def.palettes ? def.palettes[0] : {}, 1, 'p0');
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(((p.spin + k * 900) * Math.PI) / 180);
      ctx.drawImage(c.frames[0].canvas, -c.ax * 0.75, -c.ay * 0.75, c.w * 0.75, c.h * 0.75);
      ctx.restore();
    }

    /* 쏟아지기: 하늘에서 떨어지는 물건 */
    for (const d of game.drops) {
      const k = 1 - d.t / d.dur;
      const y = -12 + (GROUND - 6 + 12) * k * k;
      const def = itemDef(d.tier);
      const c = TG.clip(def, 'icon', def.palettes ? def.palettes[0] : {}, 1, 'p0');
      ctx.save();
      ctx.translate(Math.round(d.x), Math.round(y));
      ctx.rotate(((d.spin + k * 540) * Math.PI) / 180);
      ctx.drawImage(c.frames[0].canvas, -c.ax, -c.ay);
      ctx.restore();
    }

    /* 이펙트 */
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      if (f.t >= f.dur) {
        fx.splice(i, 1);
        continue;
      }
      if (f.def) {
        const clip = Object.keys(f.def.clips)[0];
        const r = frame(f.def, clip, 0, f.S, { progress: f.t / f.dur });
        put(r.fr, r.c, f.x, f.y, false);
      } else if (f.name === 'hit' || f.name === 'bighit') {
        const r = (f.name === 'bighit' ? 8 : 5) * (f.t / f.dur);
        ctx.fillStyle = '#fff6b0';
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          ctx.fillRect(Math.round(f.x + Math.cos(ang) * r), Math.round(f.y + Math.sin(ang) * r), 2, 2);
        }
      } else if (f.name === 'poof') {
        ctx.fillStyle = `rgba(230,230,240,${1 - f.t / f.dur})`;
        const r = 3 + 8 * (f.t / f.dur) * f.S;
        ctx.fillRect(Math.round(f.x - r), Math.round(f.y - r / 2), Math.round(r * 2), Math.round(r));
      }
    }

    /* 떠오르는 글자 */
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.t += dt;
      if (t.t >= t.dur) {
        texts.splice(i, 1);
        continue;
      }
      const y = t.y + t.vy * t.t + 12 * t.t * t.t;
      ctx.globalAlpha = Math.min(1, (t.dur - t.t) * 4);
      if (t.img) ctx.drawImage(t.img, Math.round(t.x - t.img.width / 2), Math.round(y));
      else {
        ctx.font = '7px monospace';
        ctx.fillStyle = t.color;
        ctx.textAlign = 'center';
        ctx.fillText(t.str, t.x, y + 6);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* 체력은 위쪽 정보 줄에 나온다 */
    if (game.phase === 'dead') {
      ctx.fillStyle = `rgba(10,6,20,${Math.min(0.55, (P.deadTime - game.phaseT) * 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* 미리 그려 두기: 테마가 바뀌면 그 테마의 배경과 몬스터 동작을 한 프레임에 하나씩 만들어 둔다 (처음 나올 때 멈칫하지 않게) */
  const warmQ = [];
  let warmedFor = '';
  let warmedNext = '';
  function warmTheme(game) {
    if (game.mode === 'chase') {
      if (warmedFor === 'chase') return;
      warmedFor = 'chase';
      warmQ.length = 0;
      const bg = TG.SPR.bg.road;
      if (bg) for (const c of Object.keys(bg.clips)) warmQ.push(() => TG.clip(bg, c, (bg.palettes || [{}])[0], 1, 'p0'));
      for (const name of ['tank']) {
        const def = TG.SPR.mob[name];
        if (def) for (let k = 0; k < 4; k++) for (const c of Object.keys(def.clips)) warmQ.push(() => TG.clip(def, c, palOf(def, k).pal, 1, palOf(def, k).key));
      }
      const car = TG.SPR.pet.car;
      if (car) for (const c of Object.keys(car.clips)) warmQ.push(() => TG.clip(car, c, (car.palettes || [{}])[0], 1, 'p0'));
      return;
    }
    if (game.mode === 'mine') {
      if (warmedFor === 'mine') return;
      warmedFor = 'mine';
      warmQ.length = 0;
      const bg = TG.SPR.bg.mine;
      if (bg) for (const c of Object.keys(bg.clips)) warmQ.push(() => TG.clip(bg, c, (bg.palettes || [{}])[0], 1, 'p0'));
      const ore = TG.SPR.mob.ore;
      if (ore) for (let k = 0; k < 4; k++) for (const c of Object.keys(ore.clips)) warmQ.push(() => TG.clip(ore, c, palOf(ore, k).pal, 1, palOf(ore, k).key));
      return;
    }
    const th = game.theme();
    const v = game.variant();
    const key = `${th.id}|${v}`;
    if (key === warmedFor) {
      /* 페이즈가 끝나 가면 다음 땅의 그림을 미리 만들어 둔다 (넘어갈 때 끊기지 않게) */
      const ph = TG.phaseOf(game.s.stage);
      if (warmQ.length === 0 && game.s.stage >= ph.start + ph.len - 6 && warmedNext !== key) {
        warmedNext = key;
        const nx = TG.THEMES[ph.p % TG.THEMES.length];
        const nbg = TG.SPR.bg[nx.id];
        if (nbg) for (const c of Object.keys(nbg.clips)) warmQ.push(() => TG.clip(nbg, c, (nbg.palettes || [{}])[0], 1, 'p0'));
        const nv = Math.floor(ph.p / TG.THEMES.length);
        for (const kind of nx.mobs) {
          const def = mobDef(kind);
          for (const [palIdx, S] of [[nv, 1], [nv + 1, 2]]) {
            const { pal, key: pk } = palOf(def, palIdx);
            for (const c of Object.keys(def.clips)) warmQ.push(() => TG.clip(def, c, pal, S, pk));
          }
        }
      }
      return;
    }
    warmedFor = key;
    warmQ.length = 0;
    const bg = TG.SPR.bg[th.id];
    if (bg) for (const c of Object.keys(bg.clips)) warmQ.push(() => TG.clip(bg, c, (bg.palettes || [{}])[0], 1, 'p0'));
    for (const name of ['monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole']) {
      const def = TG.SPR.pet[name];
      if (def && game.s.lv[name]) for (const c of Object.keys(def.clips)) warmQ.push(() => TG.clip(def, c, (def.palettes || [{}])[0], 1, 'p0'));
    }
    for (const kind of th.mobs) {
      const def = mobDef(kind);
      for (const [palIdx, S] of [[v, 1], [v + 1, 2]]) {
        const { pal, key: pk } = palOf(def, palIdx);
        for (const c of Object.keys(def.clips)) warmQ.push(() => TG.clip(def, c, pal, S, pk));
      }
    }
  }
  function warmStep() {
    const t = performance.now();
    while (warmQ.length && performance.now() - t < 6) warmQ.shift()();
  }

  TG.render = { init, draw, fit, onEvent, warmTheme, warmStep, W, H };
})(globalThis);
