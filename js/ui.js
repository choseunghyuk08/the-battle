(function (g) {
  const TG = g.TG;
  const P = TG.P;
  const $ = (s) => document.querySelector(s);

  const SAVE_KEY = 'mudeun-deonjyeo-v1';
  const ui = { game: null, drag: null, sheet: null, muted: false };

  /* ---- 그림을 DOM 에 넣기 ---- */
  function spriteCanvas(def, clip = null, frameIdx = 0) {
    const pals = def.palettes || [def.palette || {}];
    const c = TG.clip(def, clip || Object.keys(def.clips)[0], pals[0], 1, 'p0');
    const out = document.createElement('canvas');
    out.width = c.w;
    out.height = c.h;
    out.getContext('2d').drawImage(c.frames[frameIdx % c.n].canvas, 0, 0);
    return out;
  }
  function uiIcon(name, cls = 'icon') {
    const def = TG.SPR.ui[name];
    if (!def || !def.clips) {
      const s = document.createElement('span');
      s.className = cls;
      return s;
    }
    const c = spriteCanvas(def);
    c.className = cls;
    return c;
  }
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };

  /* ---- 소리 (짧게 합성한 효과음) ---- */
  let actx = null;
  function beep(freq, dur, type = 'square', vol = 0.05, slide = 0) {
    if (ui.muted) return;
    try {
      actx = actx || new (g.AudioContext || g.webkitAudioContext)();
      const o = actx.createOscillator();
      const v = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, actx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), actx.currentTime + dur);
      v.gain.setValueAtTime(vol, actx.currentTime);
      v.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(v).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + dur);
    } catch {
      /* 소리를 못 내는 환경 */
    }
  }
  const sfx = {
    craft: () => beep(520, 0.07, 'square', 0.03, 200),
    merge: (t) => {
      beep(440 + t * 30, 0.08, 'square', 0.04, 300);
      setTimeout(() => beep(660 + t * 30, 0.1, 'triangle', 0.04, 200), 60);
    },
    hit: () => beep(180, 0.05, 'triangle', 0.02, -80),
    coin: () => beep(980, 0.06, 'square', 0.02, 300),
    hurt: () => beep(140, 0.12, 'sawtooth', 0.03, -60),
    clear: () => [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'square', 0.04), i * 90)),
    discover: () => [660, 880, 1175].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.05), i * 80)),
  };

  /* ---- 필드: 물건이 흩어져 있고, 같은 단계 위에 끌어다 놓으면 합쳐진다 ---- */
  const field = { cv: null, ctx: null, w: 0, h: 0, dpr: 1, k: 2, size: 40, fx: [], hover: -1 };
  let shineClock = 0;

  function sizeField() {
    const box = $('#field').getBoundingClientRect();
    const dpr = g.devicePixelRatio || 1;
    field.dpr = dpr;
    field.w = Math.max(1, Math.round(box.width * dpr));
    field.h = Math.max(1, Math.round(box.height * dpr));
    field.cv.width = field.w;
    field.cv.height = field.h;
    field.ctx.imageSmoothingEnabled = false;
    /* 물건 하나가 화면에서 44~52px 쯤 되도록 정수 배율 */
    field.k = Math.max(1, Math.round((48 * dpr) / 20));
    field.size = 20 * field.k;
  }

  /* 물건 i 의 필드 위 중심 (캔버스 픽셀) */
  function spot(i) {
    const p = ui.game.s.pos[i] || [0.5, 0.5];
    const m = field.size * 0.55;
    return [m + p[0] * (field.w - m * 2), m + p[1] * (field.h - m * 2)];
  }
  function toNorm(x, y) {
    const m = field.size * 0.55;
    return [(x - m) / Math.max(1, field.w - m * 2), (y - m) / Math.max(1, field.h - m * 2)];
  }
  function order() {
    const game = ui.game;
    const ids = [];
    for (let i = 0; i < game.slots; i++) if (game.s.board[i]) ids.push(i);
    return ids.sort((a, b) => (game.s.pos[a] ? game.s.pos[a][1] : 0) - (game.s.pos[b] ? game.s.pos[b][1] : 0));
  }
  /* 화면 좌표(CSS px)에서 가장 위에 그려진 물건 */
  function itemAt(cx, cy, skip = -1) {
    const r = field.cv.getBoundingClientRect();
    const x = (cx - r.left) * field.dpr;
    const y = (cy - r.top) * field.dpr;
    const ids = order().reverse();
    for (const i of ids) {
      if (i === skip) continue;
      const [sx, sy] = spot(i);
      if (Math.abs(x - sx) < field.size * 0.48 && Math.abs(y - sy) < field.size * 0.48) return i;
    }
    return -1;
  }

  let tierText = new Map();
  function tierLabel(t) {
    if (!TG.pixelText) return null;
    if (!tierText.has(t)) {
      const r = TG.pixelText(String(t), '#ffffff', '#17121e');
      tierText.set(t, r.canvas || TG.toCanvas(r));
    }
    return tierText.get(t);
  }

  function drawItem(i, x, y, scale = 1, alpha = 1) {
    const game = ui.game;
    const tier = game.s.board[i];
    const def = TG.itemDef(tier);
    const clip = def.clips.shine ? 'shine' : 'icon';
    const c = TG.clip(def, clip, def.palettes ? def.palettes[0] : {}, 1, 'p0');
    const fr = c.frames[Math.floor(shineClock * 6 + i * 1.7) % c.n];
    const k = field.k * scale;
    const ctx = field.ctx;
    ctx.globalAlpha = alpha;
    /* 바닥 그림자 */
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + field.size * 0.36 * scale, field.size * 0.3 * scale, field.size * 0.09 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(fr.canvas, Math.round(x - c.ax * k), Math.round(y - c.ay * k), c.w * k, c.h * k);
    const lab = tierLabel(tier);
    if (lab) ctx.drawImage(lab, Math.round(x + field.size * 0.18), Math.round(y + field.size * 0.12), lab.width * Math.max(1, Math.floor(field.k / 2)), lab.height * Math.max(1, Math.floor(field.k / 2)));
    ctx.globalAlpha = 1;
  }

  function addFieldFx(name, i) {
    const def = TG.SPR.fx[name];
    if (!def) return;
    const [x, y] = spot(i);
    field.fx.push({ def, x, y, t: 0, dur: name === 'discover' ? 0.9 : 0.45 });
  }

  function drawField(dt) {
    const ctx = field.ctx;
    const game = ui.game;
    ctx.clearRect(0, 0, field.w, field.h);
    const d = ui.drag;
    for (const i of order()) {
      if (d && d.from === i) continue;
      const [x, y] = spot(i);
      const pulse = field.pop && field.pop.i === i ? 1 + 0.35 * Math.max(0, 1 - (performance.now() - field.pop.at) / 260) : 1;
      if (d && d.target === i) {
        ctx.fillStyle = 'rgba(255,207,74,0.25)';
        ctx.beginPath();
        ctx.arc(x, y, field.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      drawItem(i, x, y, pulse);
    }
    /* 효과 */
    for (let n = field.fx.length - 1; n >= 0; n--) {
      const f = field.fx[n];
      f.t += dt;
      if (f.t >= f.dur) {
        field.fx.splice(n, 1);
        continue;
      }
      const clip = Object.keys(f.def.clips)[0];
      const cc = TG.clip(f.def, clip, (f.def.palettes || [{}])[0], 1, 'p0');
      const fr = cc.frames[Math.min(cc.n - 1, Math.floor((f.t / f.dur) * cc.n))];
      const k = field.k;
      ctx.drawImage(fr.canvas, Math.round(f.x - cc.ax * k), Math.round(f.y - cc.ay * k), cc.w * k, cc.h * k);
    }
    /* 끌고 있는 물건은 손가락 위에 조금 크게 */
    if (d && d.from < game.slots && game.s.board[d.from]) drawItem(d.from, d.x, d.y, 1.18);
  }

  function fieldPoint(e) {
    const r = field.cv.getBoundingClientRect();
    return [(e.clientX - r.left) * field.dpr, (e.clientY - r.top) * field.dpr];
  }
  function onDown(e) {
    const i = itemAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    const [x, y] = fieldPoint(e);
    const [sx, sy] = spot(i);
    ui.drag = { from: i, x, y, dx: sx - x, dy: sy - y, target: -1 };
    ui.drag.x = sx;
    ui.drag.y = sy;
    field.cv.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    const d = ui.drag;
    if (!d) return;
    const [x, y] = fieldPoint(e);
    d.x = x + d.dx;
    d.y = y + d.dy - field.size * 0.15;
    const t = itemAt(e.clientX, e.clientY, d.from);
    d.target = t >= 0 && ui.game.s.board[t] === ui.game.s.board[d.from] ? t : -1;
  }
  function onUp(e) {
    const d = ui.drag;
    if (!d) return;
    ui.drag = null;
    const game = ui.game;
    const t = itemAt(e.clientX, e.clientY, d.from);
    if (t >= 0 && game.s.board[t] === game.s.board[d.from] && game.merge(d.from, t)) {
      field.pop = { i: t, at: performance.now() };
    } else {
      const [nx, ny] = toNorm(d.x, d.y);
      game.place(d.from, nx, ny);
    }
    handleEvents();
    save();
  }

  /* ---- 위쪽 줄과 제작 버튼 ---- */
  function updateHud() {
    const game = ui.game;
    const th = game.theme();
    $('#stageNum').textContent = `스테이지 ${game.s.stage}`;
    $('#stageSub').textContent = game.mode === 'boss' ? `보스전 ${game.s.boss} · 남은 시간 ${Math.ceil(game.bossT)}초` : game.phase === 'run' ? `${th.name} · 다음 스테이지로` : `${th.name} · 웨이브 ${Math.max(1, game.wave)}/${P.waves}`;
    $('#goldNum').textContent = TG.fmt(game.s.gold);
    $('#rubyNum').textContent = TG.fmt(game.s.ruby);
    /* 스킬과 보스 버튼: 남은 대기 시간만큼 어둡게 덮는다 */
    const cdView = (btn, left, total, ready) => {
      const cd = btn.querySelector('.cd');
      const k = total ? Math.max(0, Math.min(1, left / total)) : 0;
      cd.style.transform = `scaleY(${k})`;
      if (left > 0) cd.dataset.t = left >= 60 ? `${Math.ceil(left / 60)}분` : `${Math.ceil(left)}`;
      else delete cd.dataset.t;
      btn.classList.toggle('ready', ready);
    };
    cdView($('#skRain'), game.s.skillCd.rain, P.rainCd, game.skillReady('rain'));
    cdView($('#skRage'), game.raging ? 0 : game.s.skillCd.rage, P.rageCd, game.skillReady('rage'));
    $('#skRage').classList.toggle('on', game.raging);
    cdView($('#bossBtn'), game.s.bossCd, game.s.bossCd > P.bossFailCd ? P.bossCd : P.bossFailCd, game.canBoss());
    $('#bossLabel').textContent = game.mode === 'boss' ? `${Math.ceil(game.bossT)}초` : `보스 ${game.s.boss}`;
    $('#autoTag').textContent = [game.s.lv.autoCraft ? '자동 제작' : '', game.s.lv.autoMerge ? '자동 합성' : '', game.s.lv.autoSkill && game.s.autoSkillOn ? '자동 스킬' : ''].filter(Boolean).join(' · ');
    $('#shopDot').hidden = !game.s.shop.offers.some((o) => !o.sold && game.s.shards >= game.shopPrice(o.tier));
    if (ui.sheet === 'shop') refreshShop();
    const ch = Math.floor(game.s.charges);
    $('#craftCount').textContent = `${ch}/${P.craftMax}`;
    $('#craftFill').style.width = `${(game.s.charges / P.craftMax) * 100}%`;
    $('#craft').classList.toggle('empty', ch < 1);
    $('#countNum').textContent = `${game.s.board.slice(0, game.slots).filter(Boolean).length}/${game.slots}`;
    /* 전투 정보 줄: 내 체력과 공격력, 앞에 있는 적의 이름, 체력, 공격력 */
    let volley = 0;
    for (let i = 0; i < game.slots; i++) if (game.s.board[i]) volley += TG.tierAtk(game.s.board[i]) * game.atkMult;
    $('#meHp').textContent = `${TG.fmt(Math.max(0, game.hero.hp))}/${TG.fmt(game.maxHp)}`;
    $('#meHpBar').style.width = `${Math.max(0, Math.min(100, (game.hero.hp / game.maxHp) * 100))}%`;
    $('#meAtk').textContent = TG.fmt(volley);
    const f = game.front() || game.mobs[0];
    if (f) {
      const def = TG.SPR.mob[f.kind] || TG.SPR.mob.slime;
      $('#foeName').textContent = f.boss ? `보스 ${game.s.boss}: ${def.name || f.kind}` : `${f.giant ? '거대 ' : ''}${def.name || f.kind} Lv.${game.s.stage}`;
      $('#foeHp').textContent = `${TG.fmt(Math.max(0, f.hp))}/${TG.fmt(f.max)}`;
      $('#foeHpBar').style.width = `${Math.max(0, Math.min(100, (f.hp / f.max) * 100))}%`;
      $('#foeAtk').textContent = TG.fmt(f.atk);
      $('#foe').classList.toggle('giant', !!f.giant);
    } else {
      $('#foeName').textContent = game.phase === 'run' ? '다음 스테이지로' : '다음 웨이브';
      $('#foeHp').textContent = '-';
      $('#foeHpBar').style.width = '0%';
      $('#foeAtk').textContent = '-';
      $('#foe').classList.remove('giant');
    }
    const canAny = TG.UPGRADES.some((u) => game.canBuy(u.id));
    $('#upDot').hidden = !canAny;
    if (ui.sheet === 'up') refreshUpgrades();
  }

  /* ---- 강화 판 ---- */
  const UP_ICON = { atk: 'atk', hp: 'hp', craft: 'craftLv', climb: 'climb', slots: 'slots', autoCraft: 'autoCraft', autoMerge: 'autoMerge', rAtk: 'atk', rGold: 'coin', skRain: 'skillRain', skRage: 'skillRage', autoSkill: 'autoSkill' };
  function buildUpgrades() {
    const body = $('#sheetBody');
    body.replaceChildren();
    let section = null;
    for (const u of TG.UPGRADES) {
      const cur = u.cur || 'gold';
      if (cur !== section) {
        section = cur;
        body.append(el('p', { class: 'sec' }, [uiIcon(cur === 'ruby' ? 'ruby' : 'coin'), cur === 'ruby' ? '루비 강화 (보스전과 거대 몬스터에게서 얻는다)' : '골드 강화']));
      }
      const btn = el('button', { type: 'button', 'data-id': u.id, class: cur === 'ruby' ? 'ruby' : '', onclick: () => buy(u.id) });
      body.append(
        el('div', { class: 'up', 'data-row': u.id }, [
          uiIcon(UP_ICON[u.id], 'icon x2'),
          el('div', {}, [el('div', { class: 'name' }, [u.name, el('small', { class: 'lv' })]), el('div', { class: 'desc' })]),
          btn,
        ]),
      );
    }
    refreshUpgrades();
  }
  function refreshUpgrades() {
    const game = ui.game;
    for (const u of TG.UPGRADES) {
      const row = document.querySelector(`[data-row="${u.id}"]`);
      if (!row) continue;
      const L = game.s.lv[u.id];
      row.querySelector('.lv').textContent = u.max < 100 ? `${L}/${u.max}` : `Lv ${L}`;
      row.querySelector('.desc').textContent = u.desc(L);
      const btn = row.querySelector('button');
      const cost = game.cost(u.id);
      btn.disabled = !game.canBuy(u.id);
      const label = cost === null ? '최대' : TG.fmt(cost);
      if (btn.dataset.label !== label) {
        btn.dataset.label = label;
        btn.replaceChildren(cost === null ? '' : uiIcon(u.cur === 'ruby' ? 'ruby' : 'coin'), label);
      }
    }
  }
  function buy(id) {
    if (ui.game.buy(id)) {
      sfx.coin();
      refreshUpgrades();
      updateHud();
      save();
    }
  }

  /* ---- 조각 상점 ---- */
  function buildShop() {
    const game = ui.game;
    const body = $('#sheetBody');
    const list = el('div', { class: 'offers' });
    game.s.shop.offers.forEach((o, k) => {
      const it = TG.ITEMS[o.tier - 1];
      const btn = el('button', { type: 'button', 'data-k': k, onclick: () => shopBuy(k) });
      list.append(el('div', { class: 'offer', 'data-offer': k }, [spriteCanvas(TG.itemDef(o.tier), 'icon'), el('div', {}, [el('div', { class: 'nm' }, [it.name, el('small', { text: `${o.tier}단계` })]), el('div', { class: 'ln', text: it.line })]), btn]));
    });
    body.replaceChildren(
      el('p', { class: 'note' }, ['합칠 때마다 결과 단계만큼 조각을 얻는다. 지금 조각 ', el('b', { id: 'shardNum', text: TG.fmt(game.s.shards) }), '개']),
      list,
      el('div', { class: 'row' }, [el('span', { id: 'shopTimer' }), el('button', { type: 'button', id: 'shopReroll', onclick: shopReroll }, [uiIcon('ruby'), `${P.shopRefreshRuby} 새로고침`])]),
    );
    refreshShop();
  }
  function refreshShop() {
    const game = ui.game;
    if (!$('#shardNum')) return;
    $('#shardNum').textContent = TG.fmt(game.s.shards);
    game.s.shop.offers.forEach((o, k) => {
      const row = document.querySelector(`[data-offer="${k}"]`);
      if (!row) return;
      row.classList.toggle('sold', o.sold);
      const btn = row.querySelector('button');
      const price = game.shopPrice(o.tier);
      btn.disabled = o.sold || game.s.shards < price;
      const label = o.sold ? '샀음' : TG.fmt(price);
      if (btn.dataset.label !== label) {
        btn.dataset.label = label;
        btn.replaceChildren(o.sold ? '' : uiIcon('shard'), label);
      }
    });
    $('#shopTimer').textContent = `${TG.fmtTime(game.s.shop.t)} 뒤 새 물건`;
    $('#shopReroll').disabled = game.s.ruby < P.shopRefreshRuby;
  }
  function shopBuy(k) {
    const r = ui.game.shopBuy(k);
    if (r === 'full') toast(null, '필드가 꽉 찼다', '합치거나 보유 개수를 늘리자.');
    else if (r === 'ok') sfx.coin();
    handleEvents();
    refreshShop();
    save();
  }
  function shopReroll() {
    if (ui.game.shopRefresh()) {
      sfx.coin();
      buildShop();
      save();
    }
  }

  /* ---- 도감 ---- */
  function buildDex() {
    const body = $('#sheetBody');
    const game = ui.game;
    const grid = el('div', { class: 'dex' });
    TG.ITEMS.forEach((it, k) => {
      const tier = k + 1;
      const seen = game.s.seen[tier];
      const cv = spriteCanvas(TG.itemDef(tier), 'icon');
      if (!seen) {
        const x = cv.getContext('2d');
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = '#0c0d1c';
        x.fillRect(0, 0, cv.width, cv.height);
      }
      grid.append(el('div', { class: `it${seen ? '' : ' unseen'}` }, [cv, `${tier}. ${seen ? it.name : '???'}`, el('small', { text: seen ? it.line : '합쳐서 찾아보자' })]));
    });
    const found = game.s.seen.filter(Boolean).length;
    body.replaceChildren(el('p', { class: 'note', text: `찾은 물건 ${found}/${TG.ITEMS.length}. 같은 물건 2개를 합치면 다음 단계가 나온다.` }), grid);
  }

  /* ---- 설정 ---- */
  function buildSettings() {
    const game = ui.game;
    const body = $('#sheetBody');
    body.replaceChildren(
      el('div', { class: 'row' }, ['소리', el('button', { type: 'button', text: ui.muted ? '켜기' : '끄기', onclick: () => { ui.muted = !ui.muted; save(); buildSettings(); } })]),
      game.s.lv.autoSkill ? el('div', { class: 'row' }, ['자동 스킬', el('button', { type: 'button', text: game.s.autoSkillOn ? '끄기' : '켜기', onclick: () => { game.s.autoSkillOn = !game.s.autoSkillOn; save(); buildSettings(); } })]) : null,
      el('div', { class: 'row' }, [`최고 스테이지 ${game.s.best} · 쓰러짐 ${game.s.stats.deaths}회 · 합성 ${TG.fmt(game.s.stats.merges)}회`]),
      el('div', { class: 'row' }, ['처음부터 다시', el('button', { type: 'button', class: 'danger', text: ui.resetArm ? '정말 지우기' : '세이브 지우기', onclick: resetSave })]),
      el('p', { class: 'note', text: '진행은 이 브라우저에 자동 저장된다. 보드에서 같은 물건을 끌어다 겹치면 합쳐진다. 칸이 꽉 차면 새로 만든 물건이 가장 낮은 칸으로 들어간다.' }),
    );
  }
  function resetSave() {
    if (!ui.resetArm) {
      ui.resetArm = true;
      buildSettings();
      setTimeout(() => {
        ui.resetArm = false;
        if (ui.sheet === 'set') buildSettings();
      }, 3000);
      return;
    }
    try {
      g.localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 저장소 없음 */
    }
    ui.resetArm = false;
    ui.game = new TG.Game(null);
    closeSheet();
    toast(null, '새로 시작', '연필 한 자루부터 다시.');
  }

  /* ---- 판 열고 닫기 ---- */
  const TITLES = { up: '강화', shop: '조각 상점', dex: '도감', set: '설정' };
  function openSheet(kind) {
    if (ui.sheet === kind) {
      closeSheet();
      return;
    }
    ui.sheet = kind;
    $('#sheetTitle').textContent = TITLES[kind];
    if (kind === 'up') buildUpgrades();
    else if (kind === 'shop') buildShop();
    else if (kind === 'dex') buildDex();
    else buildSettings();
    $('#sheet').classList.add('open');
    $('#sheet').setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    ui.sheet = null;
    $('#sheet').classList.remove('open');
    $('#sheet').setAttribute('aria-hidden', 'true');
  }

  /* ---- 알림 ---- */
  let toastTimer = 0;
  function toast(tier, title, line) {
    const t = $('#toast');
    t.replaceChildren(...[tier ? spriteCanvas(TG.itemDef(tier), 'icon') : null, el('div', {}, [el('b', { text: title }), el('small', { text: line })])].filter(Boolean));
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* ---- 코어 일 처리 ---- */
  function handleEvents() {
    const game = ui.game;
    for (const e of game.events) {
      TG.render.onEvent(e, game);
      switch (e.type) {
        case 'craft':
          field.pop = { i: e.slot, at: performance.now() };
          addFieldFx('craft', e.slot);
          sfx.craft();
          break;
        case 'merge':
          field.pop = { i: e.slot, at: performance.now() };
          addFieldFx('merge', e.slot);
          sfx.merge(e.tier);
          break;
        case 'new':
          if (e.tier > 1) {
            const it = TG.ITEMS[e.tier - 1];
            toast(e.tier, `새 물건! ${e.tier}단계 ${it.name}`, it.line);
            sfx.discover();
            const slot = game.s.board.indexOf(e.tier);
            if (slot >= 0) addFieldFx('discover', slot);
          }
          break;
        case 'hit':
          sfx.hit();
          break;
        case 'kill':
          sfx.coin();
          break;
        case 'hurt':
          sfx.hurt();
          break;
        case 'ruby':
          sfx.coin();
          break;
        case 'boss-start': {
          const def = TG.SPR.mob[e.kind] || TG.SPR.mob.slime;
          toast(null, `보스전 ${e.boss}: ${def.name}`, `${P.bossTime}초 안에 쓰러뜨리자.`);
          sfx.discover();
          break;
        }
        case 'boss-win':
          toast(null, `보스 ${e.boss} 격파!`, `루비 ${e.ruby}개를 얻었다.`);
          sfx.clear();
          break;
        case 'boss-lose':
          toast(null, '보스를 놓쳤다', '조금 더 키운 뒤 다시 도전하자.');
          break;
        case 'skill':
          sfx.discover();
          break;
        case 'shop':
          if (ui.sheet === 'shop') buildShop();
          break;
        case 'clear':
          sfx.clear();
          if (e.skipped) toast(null, `등반술! ${e.skipped}스테이지 건너뜀`, `스테이지 ${e.next}로 간다.`);
          break;
        case 'die':
          toast(null, '쓰러졌다', `스테이지 ${e.stage}에서 다시.`);
          break;
        default:
      }
    }
    game.events.length = 0;
  }

  /* ---- 저장 ---- */
  function load() {
    try {
      const raw = g.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      ui.muted = !!data.muted;
      ui.away = Math.max(0, (Date.now() - (Number(data.at) || Date.now())) / 1000);
      return data.game;
    } catch {
      return null;
    }
  }
  function save() {
    try {
      g.localStorage.setItem(SAVE_KEY, JSON.stringify({ game: ui.game.snapshot(), muted: ui.muted, at: Date.now() }));
    } catch {
      /* 저장 못 하는 환경에서도 게임은 돈다 */
    }
  }

  /* ---- 숨은 시험 메뉴: 스테이지 글자를 5번 빠르게 누른다 ---- */
  let taps = 0;
  let tapTimer = 0;
  function secretTap() {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (taps = 0), 1000);
    if (taps < 5) return;
    taps = 0;
    ui.game.s.gold += 1e6 + ui.game.s.gold;
    ui.game.s.stage += 10;
    ui.game.s.best = Math.max(ui.game.s.best, ui.game.s.stage);
    ui.game.startStage();
    toast(null, '시험 메뉴', '골드 2배 + 백만, 스테이지 +10');
  }

  /* ---- 시작 ---- */
  function init() {
    ui.game = new TG.Game(load());
    /* 자리 비운 동안 번 골드 (1분 넘게 비웠을 때) */
    if (ui.away > 60) {
      const gold = ui.game.offlineGold(ui.away);
      if (gold > 0) {
        $('#offText').replaceChildren(`${TG.fmtTime(Math.min(ui.away, P.offlineMax))} 동안 `, el('b', { text: `골드 ${TG.fmt(gold)}` }), '를 벌었다.', ui.away > P.offlineMax ? el('br') : '', ui.away > P.offlineMax ? '(최대 8시간까지 쌓인다)' : '');
        $('#offline').hidden = false;
        $('#offOk').addEventListener('click', () => {
          ui.game.s.gold += gold;
          $('#offline').hidden = true;
          sfx.clear();
          save();
        }, { once: true });
      }
    }
    TG.render.init($('#battle'));
    field.cv = $('#fieldCv');
    field.ctx = field.cv.getContext('2d');
    sizeField();
    field.cv.addEventListener('pointerdown', onDown);
    field.cv.addEventListener('pointermove', onMove);
    field.cv.addEventListener('pointerup', onUp);
    field.cv.addEventListener('pointercancel', onUp);
    $('#craft').addEventListener('click', () => {
      if (ui.game.craft() < 0) beep(120, 0.08, 'square', 0.02);
      handleEvents();
      save();
    });
    $('#tabUp').addEventListener('click', () => openSheet('up'));
    $('#tabShop').addEventListener('click', () => openSheet('shop'));
    $('#skRain').addEventListener('click', () => ui.game.useSkill('rain'));
    $('#skRage').addEventListener('click', () => ui.game.useSkill('rage'));
    $('#bossBtn').addEventListener('click', () => {
      if (!ui.game.startBoss() && ui.game.s.bossCd > 0) toast(null, '보스 준비 중', `${TG.fmtTime(ui.game.s.bossCd)} 뒤에 다시 도전할 수 있다.`);
    });
    $('#tabDex').addEventListener('click', () => openSheet('dex'));
    $('#tabSet').addEventListener('click', () => openSheet('set'));
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#stageBox').addEventListener('click', secretTap);
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        $('#craft').click();
      } else if (e.key === 'Escape') closeSheet();
    });
    g.addEventListener('resize', () => {
      TG.render.fit();
      sizeField();
    });
    document.addEventListener('visibilitychange', save);
    setInterval(save, 4000);

    for (const [id, name] of [['goldIcon', 'coin'], ['craftIcon', 'craft'], ['upIcon', 'atk'], ['dexIcon', 'dex'], ['setIcon', 'stage'], ['countIcon', 'slots'], ['meAtkIcon', 'atk'], ['rubyIcon', 'ruby'], ['skRainIcon', 'skillRain'], ['skRageIcon', 'skillRage'], ['bossIcon', 'boss'], ['shopIcon', 'shop'], ['offIcon', 'offline']]) {
      const slot = document.getElementById(id);
      if (slot) slot.replaceWith(Object.assign(uiIcon(name), { id }));
    }

    let last = performance.now();
    let acc = 0;
    let hudT = 0;
    const STEP = 1 / 60;
    function frame(now) {
      let dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (dt > 0.25) dt = 0.25;
      acc += dt;
      while (acc >= STEP) {
        ui.game.tick(STEP);
        acc -= STEP;
      }
      handleEvents();
      TG.render.warmTheme(ui.game);
      TG.render.warmStep();
      TG.render.draw(ui.game, dt);
      shineClock += dt;
      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        updateHud();
      }
      drawField(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    g.TG.ui = ui;
  }

  TG.startUI = init;
})(globalThis);
