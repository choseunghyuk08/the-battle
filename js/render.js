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
  const FALLBACK_SKY = { field: ['#7ec8f0', '#cfeeff'], forest: ['#f0a070', '#ffd9a0'], cave: ['#1a1428', '#2c2240'], volcano: ['#4a1414', '#a8401c'], ice: ['#10203a', '#3a7090'], space: ['#05040f', '#1c1440'] };
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
    const maxH = g.innerHeight * 0.38;
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
        addText(TG.fmt(e.dmg), e.x, y - 6, '#ffffff', false);
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
      default:
    }
  }

  function draw(game, dt) {
    clock += dt;
    if (game.hero.act.kind === 'run') scroll += dt * 70;
    if (shake > 0) shake -= dt;
    const theme = game.theme();
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 2));
    drawBg(theme);

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
      let r;
      if (m.state === 'attack') r = frame(def, 'attack', m.pal, S, { progress: m.atkT / P.mobAtkDur });
      else if (m.hurt > 0) r = frame(def, 'hurt', m.pal, S, { progress: 1 - m.hurt / 0.16 });
      else if (m.state === 'walk') r = frame(def, 'walk', m.pal, S, { time: m.t, fps: 11 });
      else r = frame(def, 'idle', m.pal, S, { time: m.t, fps: 6 });
      put(r.fr, r.c, m.x, GROUND, m.hurt > 0.1);
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

    /* 주인공 */
    const hero = TG.SPR.hero.main;
    const a = game.hero.act;
    const loops = { idle: 6, reload: 9, win: 11, run: 13 };
    const hr = loops[a.kind] ? frame(hero, a.kind, 0, 1, { time: a.t, fps: loops[a.kind] }) : frame(hero, a.kind, 0, 1, { progress: Math.min(0.999, a.t / a.dur) });
    put(hr.fr, hr.c, P.heroX, GROUND, a.kind === 'hurt' && a.t < 0.08);

    /* 날아가는 물건: 손에서 목표까지 포물선을 그리며 돈다 */
    for (const p of game.proj) {
      const k = 1 - p.t / p.dur;
      const tgt = game.mobs.includes(p.target) ? p.target : game.front();
      const tx = tgt ? tgt.x : P.spawnX;
      const ty = tgt ? GROUND - heightOf(tgt) : GROUND - 20;
      const sx = P.heroX + 8;
      const sy = GROUND - 26;
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
  function warmTheme(game) {
    const th = game.theme();
    const v = game.variant();
    const key = `${th.id}|${v}`;
    if (key === warmedFor) return;
    warmedFor = key;
    warmQ.length = 0;
    const bg = TG.SPR.bg[th.id];
    if (bg) for (const c of Object.keys(bg.clips)) warmQ.push(() => TG.clip(bg, c, (bg.palettes || [{}])[0], 1, 'p0'));
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
