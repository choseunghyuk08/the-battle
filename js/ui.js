(function (g) {
  const TG = g.TG;
  const P = TG.P;
  const $ = (s) => document.querySelector(s);

  const SAVE_KEY = 'mudeun-deonjyeo-v1';
  const ui = { game: null, drag: null, sheet: null, muted: false, storyOn: true, comicOpen: false };

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
    $('#stageSub').textContent = game.mode === 'chase' ? `추격전 · 남은 시간 ${Math.ceil(game.chaseT)}초 · 볼트 +${game.chaseGot}` : game.mode === 'mine' ? `광산 · 남은 시간 ${Math.ceil(game.mineT)}초 · 철광석 +${game.mineGot}` : game.mode === 'boss' ? `보스전 ${game.s.boss} · 남은 시간 ${Math.ceil(game.bossT)}초` : game.phase === 'run' ? `${th.name} · 다음 스테이지로` : `${th.name} · 웨이브 ${Math.max(1, game.wave)}/${P.waves}`;
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
    for (const [id, btn, lv] of SKILL_BTN) {
      const on = id === 'rage' ? game.raging : id === 'shadow' ? game.shadowT > 0 : id === 'barrage' ? !!game.barrage : id === 'dark' ? game.darkT > 0 : id === 'bolt' ? !!game.bolt : false;
      cdView($(btn), on ? 0 : game.s.skillCd[id], game.skillCdOf(id), game.skillReady(id));
      $(btn).classList.toggle('on', on);
      $(btn).classList.toggle('locked', !!lv && !game.s.lv[lv]);
    }
    $('#questDot').hidden = !game.claimable;
    if (ui.sheet === 'quest') refreshQuest();
    cdView($('#bossBtn'), game.s.bossCd, game.s.bossCd > P.bossFailCd ? P.bossCd : P.bossFailCd, game.canBoss());
    $('#bossLabel').textContent = game.mode === 'boss' ? `${Math.ceil(game.bossT)}초` : `보스 ${game.s.boss}`;
    const mineOpen = game.s.best >= P.mineOpen;
    cdView($('#mineBtn'), game.s.mineCd, P.mineCd, game.canMine());
    $('#mineBtn').classList.toggle('locked', !mineOpen);
    $('#mineLabel').textContent = game.mode === 'mine' ? `${Math.ceil(game.mineT)}초` : mineOpen ? '광산' : `${P.mineOpen}층`;
    const chaseOpen = game.s.best >= P.chaseOpen;
    cdView($('#chaseBtn'), game.s.chaseCd, P.chaseCd, game.canChase());
    $('#chaseBtn').classList.toggle('locked', !chaseOpen);
    $('#chaseLabel').textContent = game.mode === 'chase' ? `${Math.ceil(game.chaseT)}초` : chaseOpen ? '추격' : `${P.chaseOpen}층`;
    $('#abDot').hidden = !(game.s.abEquip.length < game.abSlots && TG.ABILITIES.some((a) => game.s.ab[a.id] && !game.s.abEquip.includes(a.id))) && !(game.s.ruby >= TG.abCost(0) && !Object.keys(game.s.ab).length);
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
    volley *= (1 + TG.PET.powerChance(game.s.lv.awaken)) * (1 + TG.PET.doubleChance(game.s.lv.awaken)); /* 각성 기대값 */
    $('#meHp').textContent = `${TG.fmt(Math.max(0, game.hero.hp))}/${TG.fmt(game.maxHp)}`;
    $('#meHpBar').style.width = `${Math.max(0, Math.min(100, (game.hero.hp / game.maxHp) * 100))}%`;
    $('#meAtk').textContent = TG.fmt(volley);
    const f = game.front() || game.mobs[0];
    if (f) {
      const def = TG.SPR.mob[f.kind] || TG.SPR.mob.slime;
      $('#foeName').textContent = f.tank ? `${def.name || '폭주 거북'} ${f.k + 1}번째 장갑` : f.ore ? `${def.name || '광석 바위'} ${f.k + 1}번째` : f.boss ? `보스 ${game.s.boss}: ${def.name || f.kind}` : `${f.giant ? '거대 ' : ''}${def.name || f.kind} Lv.${game.s.stage}`;
      $('#foeHp').textContent = `${TG.fmt(Math.max(0, f.hp))}/${TG.fmt(f.max)}`;
      $('#foeHpBar').style.width = `${Math.max(0, Math.min(100, (f.hp / f.max) * 100))}%`;
      $('#foeAtk').textContent = f.ore || f.tank ? '-' : TG.fmt(f.atk);
      $('#foe').classList.toggle('giant', !!f.giant);
    } else {
      $('#foeName').textContent = game.phase === 'run' ? '다음 스테이지로' : '다음 웨이브';
      $('#foeHp').textContent = '-';
      $('#foeHpBar').style.width = '0%';
      $('#foeAtk').textContent = '-';
      $('#foe').classList.remove('giant');
    }
    $('#upDot').hidden = !TG.UPGRADES.some((u) => u.tab !== 'pet' && game.canBuy(u.id));
    $('#petDot').hidden = !PETS.some((id) => game.canBuy(id));
    if (ui.sheet === 'up') refreshUpgrades();
    if (ui.sheet === 'pet') {
      refreshUpgrades();
      refreshPets();
    }
    if (ui.sheet === 'ab') refreshAbilities();
  }

  const SKILL_BTN = [
    ['rain', '#skRain', null],
    ['rage', '#skRage', null],
    ['shadow', '#skShadow', 'skShadow'],
    ['barrage', '#skBarrage', 'skBarrage'],
    ['bolt', '#skBolt', 'skBolt'],
    ['dark', '#skDark', 'skDark'],
  ];

  /* ---- 강화 판 ---- */
  const UP_ICON = { atk: 'atk', hp: 'hp', craft: 'craftLv', climb: 'climb', slots: 'slots', autoCraft: 'autoCraft', autoMerge: 'autoMerge', rAtk: 'atk', rGold: 'coin', skRain: 'skillRain', skRage: 'skillRage', autoSkill: 'autoSkill', monkey: 'monkey', hippo: 'hippo', awaken: 'awaken', bear: 'bear', dragon: 'dragon', skShadow: 'skillShadow', skBarrage: 'skillBarrage', autoShop: 'autoShop', pig: 'pig', mole: 'mole', skBolt: 'skillBolt', skDark: 'skillDark', carFuel: 'car', carGun: 'chase', carEngine: 'volt' };
  const CUR = {
    gold: { icon: 'coin', cls: '', title: '골드 강화' },
    ruby: { icon: 'ruby', cls: 'ruby', title: '루비 강화 (보스전과 거대 몬스터에게서 얻는다)' },
    shards: { icon: 'shard', cls: 'shard', title: '각성 (합칠 때 얻는 조각으로 올린다. 상점과 같은 조각)' },
    volt: { icon: 'volt', cls: 'shard', title: '추격차 (추격전에서 얻는 볼트로 올린다)' },
  };
  function buildUpgrades() {
    const body = $('#sheetBody');
    body.replaceChildren();
    let section = null;
    for (const u of TG.UPGRADES) {
      if (u.tab === 'pet') continue;
      const cur = u.cur || 'gold';
      if (cur !== section) {
        section = cur;
        body.append(el('p', { class: 'sec' }, cur === 'volt' ? [uiIcon('volt'), '추격차 (볼트 ', el('b', { id: 'voltNum' }), '개, 추격전에서 얻는다)'] : [uiIcon(CUR[cur].icon), CUR[cur].title]));
      }
      const btn = el('button', { type: 'button', 'data-id': u.id, class: CUR[cur].cls, onclick: () => buy(u.id) });
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
    if ($('#voltNum')) $('#voltNum').textContent = TG.fmt(game.s.volt);
    for (const u of TG.UPGRADES) {
      const row = document.querySelector(`[data-row="${u.id}"]`);
      if (!row) continue;
      const L = game.s.lv[u.id];
      row.querySelector('.lv').textContent = u.max < 100 ? `${L}/${u.max}` : `Lv ${L}`;
      row.querySelector('.desc').textContent = u.desc(L);
      const btn = row.querySelector('button');
      const cost = game.cost(u.id);
      btn.disabled = !game.canBuy(u.id);
      const label = cost === null ? '최대' : u.tab === 'pet' && !L ? `${TG.fmt(cost)} 데려오기` : TG.fmt(cost);
      if (btn.dataset.label !== label) {
        btn.dataset.label = label;
        btn.replaceChildren(cost === null ? '' : uiIcon(CUR[u.cur || 'gold'].icon), label);
      }
    }
  }
  function buy(id) {
    const fresh = TG.UPGRADES.find((u) => u.id === id).tab === 'pet' && !ui.game.s.lv[id];
    if (ui.game.buy(id)) {
      sfx.coin();
      if (fresh) {
        const u = TG.UPGRADES.find((x) => x.id === id);
        toast(null, `${u.name} 합류!`, '이제 주인공 뒤에서 같이 싸운다.');
        sfx.discover();
        if (ui.sheet === 'pet') buildPets();
      }
      refreshUpgrades();
      updateHud();
      save();
    }
  }

  /* ---- 동료 ---- */
  const PETS = ['monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole'];
  function buildPets() {
    const body = $('#sheetBody');
    const list = el('div', { class: 'pets' });
    for (const id of PETS) {
      const u = TG.UPGRADES.find((x) => x.id === id);
      const def = TG.SPR.pet[id];
      const cv = def ? spriteCanvas(def, 'idle') : uiIcon(id, 'icon x2');
      cv.dataset.pet = id;
      list.append(
        el('div', { class: 'pet', 'data-row': id }, [
          cv,
          el('div', { class: 'nm' }, [u.name, ' ', el('small', { class: 'lv' })]),
          el('div', { class: 'stars' }),
          el('div', { class: 'desc' }),
          el('button', { type: 'button', class: 'ruby', onclick: () => buy(id) }),
          el('button', { type: 'button', class: 'evo', onclick: () => evolve(id) }),
        ]),
      );
    }
    body.replaceChildren(el('p', { class: 'note' }, ['동료는 루비로 데려오고 키운다. 광산에서 캔 철광석으로 진화하면 더 세진다. 철광석 ', el('b', { id: 'oreNum', text: TG.fmt(ui.game.s.ore) }), '개']), list);
    refreshUpgrades();
    refreshPets();
  }
  function refreshPets() {
    const game = ui.game;
    for (const id of PETS) {
      const row = document.querySelector(`[data-row="${id}"]`);
      if (!row) continue;
      const L = game.s.lv[id];
      row.classList.toggle('locked', !L);
      if (!L) row.querySelector('.lv').textContent = '';
      const st = game.s.stars[id];
      row.querySelector('.stars').textContent = '★'.repeat(st) + '☆'.repeat(P.evoCost.length - st);
      const need = game.evoNeed(id);
      const evo = row.querySelector('button.evo');
      evo.disabled = !need || L < need.lv || game.s.ore < need.ore;
      const label = !need ? '진화 끝' : L < need.lv ? `진화: ${need.lv}레벨부터` : `진화 ${TG.fmt(need.ore)}`;
      if (evo.dataset.label !== label) {
        evo.dataset.label = label;
        evo.replaceChildren(need && L >= need.lv ? uiIcon('ore') : '', label);
      }
    }
    if ($('#oreNum')) $('#oreNum').textContent = TG.fmt(game.s.ore);
  }
  function evolve(id) {
    if (ui.game.evolve(id) === 'ok') {
      handleEvents();
      refreshPets();
      save();
    }
  }
  /* 동료 판의 그림을 idle 동작으로 움직인다 */
  function animPets(dt) {
    ui.petClock = (ui.petClock || 0) + dt;
    for (const cv of document.querySelectorAll('canvas[data-pet]')) {
      const def = TG.SPR.pet[cv.dataset.pet];
      if (!def) continue;
      const c = TG.clip(def, 'idle', (def.palettes || [{}])[0], 1, 'p0');
      const i = Math.floor(ui.petClock * 8) % c.n;
      if (cv.dataset.f === String(i)) continue;
      cv.dataset.f = String(i);
      const x = cv.getContext('2d');
      x.clearRect(0, 0, cv.width, cv.height);
      x.drawImage(c.frames[i].canvas, 0, 0);
    }
  }

  /* ---- 조각 상점 ---- */
  function segBar() {
    const seg = ui.shopSeg || 'shard';
    return el('div', { class: 'seg' }, [
      el('button', { type: 'button', class: seg === 'shard' ? 'on' : '', text: '조각 상점', onclick: () => { ui.shopSeg = 'shard'; buildShop(); } }),
      el('button', { type: 'button', class: seg === 'relic' ? 'on' : '', text: '유물 뽑기', onclick: () => { ui.shopSeg = 'relic'; buildShop(); } }),
    ]);
  }
  function buildShop() {
    if (ui.shopSeg === 'relic') {
      buildRelics();
      return;
    }
    const game = ui.game;
    const body = $('#sheetBody');
    const list = el('div', { class: 'offers' });
    game.s.shop.offers.forEach((o, k) => {
      const it = TG.ITEMS[o.tier - 1];
      const btn = el('button', { type: 'button', 'data-k': k, onclick: () => shopBuy(k) });
      list.append(el('div', { class: 'offer', 'data-offer': k }, [spriteCanvas(TG.itemDef(o.tier), 'icon'), el('div', {}, [el('div', { class: 'nm' }, [it.name, el('small', { text: `${o.tier}단계` })]), el('div', { class: 'ln', text: it.line })]), btn]));
    });
    body.replaceChildren(
      segBar(),
      el('p', { class: 'note' }, ['합칠 때마다 결과 단계만큼 조각을 얻는다. 지금 조각 ', el('b', { id: 'shardNum', text: TG.fmt(game.s.shards) }), '개']),
      list,
      el('div', { class: 'row' }, [el('span', { id: 'shopTimer' }), el('button', { type: 'button', id: 'shopReroll', onclick: shopReroll }, [uiIcon('ruby'), `${P.shopRefreshRuby} 새로고침`])]),
    );
    refreshShop();
  }
  function refreshShop() {
    const game = ui.game;
    if (ui.shopSeg === 'relic') {
      refreshRelics();
      return;
    }
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

  /* ---- 유물 뽑기 ---- */
  function relicIcon(id) {
    const def = TG.SPR.ui[`relic_${id}`];
    return def ? spriteCanvas(def) : uiIcon('relic');
  }
  function buildRelics() {
    const body = $('#sheetBody');
    const grid = el('div', { class: 'relics' });
    for (const r of TG.RELICS) grid.append(el('div', { class: 'relic', 'data-relic': r.id }, [relicIcon(r.id), el('div', {}, [el('div', { class: 'nm' }, [r.name, el('small')]), el('div', { class: 'ds' })])]));
    body.replaceChildren(
      segBar(),
      el('p', { class: 'note' }, ['루비로 유물 20종 중 하나를 뽑는다. 같은 것이 또 나오면 레벨이 오른다 (최대 ', String(P.relicMax), '). 다 모은 유물은 안 나온다.']),
      el('div', { class: 'pull' }, [
        el('button', { type: 'button', id: 'pull1', onclick: () => pull(1) }, [uiIcon('ruby'), `${P.relicCost} 한 번`]),
        el('button', { type: 'button', id: 'pull10', onclick: () => pull(10) }, [uiIcon('ruby'), `${P.relicCost10} 열 번`]),
      ]),
      grid,
    );
    refreshRelics();
  }
  function refreshRelics() {
    const game = ui.game;
    if (!$('#pull1')) return;
    $('#pull1').disabled = game.s.ruby < P.relicCost;
    $('#pull10').disabled = game.s.ruby < P.relicCost10;
    for (const r of TG.RELICS) {
      const row = document.querySelector(`[data-relic="${r.id}"]`);
      if (!row) continue;
      const L = game.s.relics[r.id] || 0;
      row.classList.toggle('none', !L);
      row.classList.toggle('max', L >= P.relicMax);
      row.querySelector('small').textContent = L ? (L >= P.relicMax ? '최대' : `Lv ${L}`) : '';
      row.querySelector('.ds').textContent = L ? r.desc(r.v(L)) : `?? (Lv1: ${r.desc(r.v(1))})`;
    }
  }
  /* 뽑기 연출: 상자가 열리고 나온 것을 보여 준다 */
  function pull(n) {
    const game = ui.game;
    const res = game.relicPull(n);
    if (!res.ok) {
      toast(null, res.why === 'max' ? '유물을 다 모았다' : '루비가 모자라다', res.why === 'max' ? '모든 유물이 최대 레벨이다.' : '보스전과 업적에서 루비를 모으자.');
      return;
    }
    handleEvents();
    save();
    const box = $('#gacha');
    const got = $('#gachaGot');
    got.replaceChildren();
    $('#gachaOk').hidden = true;
    box.hidden = false;
    const cv = $('#gachaCv');
    const x = cv.getContext('2d');
    const def = TG.SPR.fx.chestOpen;
    const t0 = performance.now();
    const dur = 1400;
    sfx.craft();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      x.clearRect(0, 0, cv.width, cv.height);
      if (def) {
        const c = TG.clip(def, Object.keys(def.clips)[0], (def.palettes || [{}])[0], 1, 'p0');
        const f = c.frames[Math.min(c.n - 1, Math.floor(k * c.n))];
        x.drawImage(f.canvas, Math.round(32 - c.ax), Math.round(cv.height - (c.h - c.ay) - c.ay));
      } else {
        x.fillStyle = k < 0.6 ? '#a86a2a' : '#ffe48a';
        x.fillRect(18, 34 - (k > 0.6 ? 6 : 0), 28, 20);
      }
      if (k < 1) {
        requestAnimationFrame(step);
        return;
      }
      sfx.discover();
      for (const g2 of res.got) {
        const r = TG.RELICS.find((rr) => rr.id === g2.id);
        got.append(el('div', { class: `g${g2.lv === 1 ? ' new' : ''}` }, [relicIcon(g2.id), r.name, el('b', { text: g2.lv === 1 ? '새로!' : `Lv ${g2.lv}` })]));
      }
      $('#gachaOk').hidden = false;
    };
    requestAnimationFrame(step);
  }

  /* ---- 임무 (업적) ---- */
  function questSeg() {
    const seg = ui.questSeg || 'quest';
    return el('div', { class: 'seg' }, [
      el('button', { type: 'button', class: seg === 'quest' ? 'on' : '', text: '임무', onclick: () => { ui.questSeg = 'quest'; buildQuest(); } }),
      el('button', { type: 'button', class: seg === 'dex' ? 'on' : '', text: '도감', onclick: () => { ui.questSeg = 'dex'; buildQuest(); } }),
      el('button', { type: 'button', class: seg === 'story' ? 'on' : '', text: '이야기', onclick: () => { ui.questSeg = 'story'; buildQuest(); } }),
    ]);
  }
  function buildQuest() {
    const body = $('#sheetBody');
    if (ui.questSeg === 'dex') {
      buildDex();
      return;
    }
    if (ui.questSeg === 'story') {
      buildStoryList();
      return;
    }
    const list = el('div', {});
    for (const a of TG.ACHIEVE) {
      list.append(
        el('div', { class: 'quest', 'data-quest': a.id }, [
          el('div', { class: 'nm' }, [a.name, el('small')]),
          el('div', { class: 'pg' }),
          el('div', { class: 'bar2' }, [el('i')]),
          el('button', { type: 'button', onclick: () => claim(a.id) }),
        ]),
      );
    }
    body.replaceChildren(questSeg(), el('p', { class: 'note', text: '목표를 채우면 루비를 받는다. 단계가 오를수록 목표도 보상도 커진다.' }), list);
    refreshQuest();
  }
  function refreshQuest() {
    const game = ui.game;
    for (const a of TG.ACHIEVE) {
      const row = document.querySelector(`[data-quest="${a.id}"]`);
      if (!row) continue;
      const st = game.achState(a.id);
      row.classList.toggle('ready', st.ready);
      row.querySelector('small').textContent = `${st.done}/${a.goals.length}단계`;
      row.querySelector('.pg').textContent = st.goal === undefined ? '다 했다!' : `${TG.fmt(Math.min(st.have, st.goal))} / ${TG.fmt(st.goal)} ${a.unit}`;
      row.querySelector('.bar2 i').style.width = `${st.goal === undefined ? 100 : Math.min(100, (st.have / st.goal) * 100)}%`;
      const btn = row.querySelector('button');
      btn.disabled = !st.ready;
      const label = st.goal === undefined ? '끝' : `${st.ruby}`;
      if (btn.dataset.label !== label) {
        btn.dataset.label = label;
        btn.replaceChildren(st.goal === undefined ? '' : uiIcon('ruby'), label);
      }
    }
  }
  function claim(id) {
    if (ui.game.claim(id)) {
      sfx.coin();
      handleEvents();
      refreshQuest();
      updateHud();
      save();
    }
  }

  /* ---- 이야기: 대사창과 다시 보기 ---- */
  const story = { queue: [], cur: null, i: 0, t: 0, dur: 3 };
  ui.story = story; /* 시험용 */
  function showLine() {
    const [who, text] = story.cur.lines[story.i];
    const w = TG.STORY_WHO[who];
    $('#dlgName').textContent = w.name;
    $('#dlgTitle').textContent = story.i === 0 ? story.cur.title : '';
    $('#dlgText').textContent = text;
    const face = $('#dlgFace');
    const fx = face.getContext('2d');
    fx.clearRect(0, 0, 16, 16);
    const def = w.icon && TG.SPR.ui[w.icon];
    if (def) {
      const c = TG.clip(def, Object.keys(def.clips)[0], (def.palettes || [{}])[0], 1, 'p0');
      fx.drawImage(c.frames[0].canvas, 0, 0);
    }
    $('#dialog').classList.toggle('noface', !def);
    story.t = 0;
    story.dur = Math.max(2.6, text.length * 0.1 + 1.6);
    $('#dialog').hidden = false;
  }
  function nextLine() {
    if (!story.cur) return;
    story.i++;
    if (story.i >= story.cur.lines.length) {
      story.cur = null;
      $('#dialog').hidden = true;
    } else showLine();
  }
  function storyTick(dt) {
    if (ui.comicOpen) return;
    if (!story.cur) {
      if (!story.queue.length) return;
      story.cur = TG.STORY_BY[story.queue.shift()];
      story.i = 0;
      showLine();
      return;
    }
    story.t += dt;
    if (story.t >= story.dur) nextLine();
  }
  function playStory(id, force = false) {
    if (!ui.storyOn && !force) return;
    story.queue.push(id);
  }
  function buildStoryList() {
    const body = $('#sheetBody');
    const game = ui.game;
    const list = el('div', {});
    for (const b of TG.STORY) {
      const seen = !!game.s.story.seen[b.id];
      list.append(
        el('div', { class: `sto${seen ? '' : ' none'}` }, [
          el('div', { class: 'nm', text: seen ? b.title : '???' }),
          el('div', { class: 'ln', text: seen ? b.lines[0][1] : '아직 만나지 못한 장면' }),
          el('button', { type: 'button', text: '다시 보기', onclick: () => { closeSheet(); story.cur = null; story.queue.length = 0; playStory(b.id, true); } }),
        ]),
      );
    }
    body.replaceChildren(
      questSeg(),
      el('div', { class: 'sto' }, [el('div', { class: 'nm', text: '프롤로그 만화' }), el('div', { class: 'ln', text: '세계가 왜 고요해졌는지' }), el('button', { type: 'button', text: '다시 보기', onclick: () => { closeSheet(); openComic(); } })]),
      list,
    );
  }
  function openComic() {
    ui.comicOpen = true;
    TG.comic.show(() => {
      ui.comicOpen = false;
      ui.game.finishIntro();
      save();
    });
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
    body.replaceChildren(questSeg(), el('p', { class: 'note', text: `찾은 물건 ${found}/${TG.ITEMS.length}. 같은 물건 2개를 합치면 다음 단계가 나온다.` }), grid);
  }

  /* ---- 특수능력 ---- */
  function buildAbilities() {
    const body = $('#sheetBody');
    const list = el('div', {});
    for (const a of TG.ABILITIES) {
      const def = TG.SPR.ui[`ab_${a.id}`];
      list.append(
        el('div', { class: 'ab', 'data-ab': a.id }, [
          def ? spriteCanvas(def) : uiIcon('relic'),
          el('div', {}, [el('div', { class: 'nm' }, [a.name, el('small')]), el('div', { class: 'ds' })]),
          el('div', { class: 'btns' }, [el('button', { type: 'button', class: 'buy', onclick: () => abBuy(a.id) }), el('button', { type: 'button', class: 'eq', onclick: () => abToggle(a.id) })]),
        ]),
      );
    }
    body.replaceChildren(el('p', { class: 'slotinfo', id: 'slotInfo' }), list);
    refreshAbilities();
  }
  function refreshAbilities() {
    const game = ui.game;
    if (!$('#slotInfo')) return;
    const next = P.abSlotsAt.find((x) => game.s.best < x);
    $('#slotInfo').textContent = `장착 ${game.s.abEquip.length}/${game.abSlots}칸${next !== undefined ? ` · 최고 스테이지 ${next}에서 한 칸 더` : ''}. 던진 물건이 맞을 때 확률로 터진다.`;
    for (const a of TG.ABILITIES) {
      const row = document.querySelector(`[data-ab="${a.id}"]`);
      if (!row) continue;
      const L = game.s.ab[a.id] || 0;
      const on = game.s.abEquip.includes(a.id);
      row.classList.toggle('none', !L);
      row.classList.toggle('on', on);
      row.querySelector('small').textContent = L ? `Lv ${L}/${P.abMax}` : '';
      row.querySelector('.ds').textContent = a.desc(L || 1) + (L ? '' : ' (배우면 Lv1)');
      const buy = row.querySelector('.buy');
      const c = TG.abCost(L);
      buy.disabled = c === null || game.s.ruby < c;
      const lb = c === null ? '최대' : `${TG.fmt(c)}${L ? '' : ' 배우기'}`;
      if (buy.dataset.label !== lb) {
        buy.dataset.label = lb;
        buy.replaceChildren(c === null ? '' : uiIcon('ruby'), lb);
      }
      const eq = row.querySelector('.eq');
      eq.hidden = !L;
      eq.textContent = on ? '해제' : '장착';
      eq.disabled = !on && game.s.abEquip.length >= game.abSlots;
    }
  }
  function abBuy(id) {
    if (ui.game.abBuy(id)) {
      sfx.coin();
      handleEvents();
      refreshAbilities();
      updateHud();
      save();
    }
  }
  function abToggle(id) {
    const r = ui.game.abToggle(id);
    if (r === 'full') toast(null, '칸이 모자라다', '다른 능력을 해제하거나 더 멀리 가면 칸이 늘어난다.');
    else if (r !== 'none') sfx.craft();
    refreshAbilities();
    updateHud();
    save();
  }

  /* ---- 설정 ---- */
  function buildSettings() {
    const game = ui.game;
    const body = $('#sheetBody');
    body.replaceChildren(
      el('div', { class: 'row' }, ['이야기 대사', el('button', { type: 'button', text: ui.storyOn ? '끄기' : '켜기', onclick: () => { ui.storyOn = !ui.storyOn; save(); buildSettings(); } })]),
      el('div', { class: 'row' }, ['소리', el('button', { type: 'button', text: ui.muted ? '켜기' : '끄기', onclick: () => { ui.muted = !ui.muted; save(); buildSettings(); } })]),
      game.s.lv.autoShop ? el('div', { class: 'row' }, ['자동 구매', el('button', { type: 'button', text: game.s.autoShopOn ? '끄기' : '켜기', onclick: () => { game.s.autoShopOn = !game.s.autoShopOn; save(); buildSettings(); } })]) : null,
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
  const TITLES = { up: '강화', pet: '동료', ab: '특수능력', shop: '상점', quest: '임무·도감·이야기', set: '설정' };
  function openSheet(kind) {
    if (ui.sheet === kind) {
      closeSheet();
      return;
    }
    ui.sheet = kind;
    $('#sheetTitle').textContent = TITLES[kind];
    if (kind === 'up') buildUpgrades();
    else if (kind === 'pet') buildPets();
    else if (kind === 'ab') buildAbilities();
    else if (kind === 'quest') buildQuest();
    else if (kind === 'shop') buildShop();
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
        case 'heal':
          beep(700, 0.12, 'triangle', 0.03, 400);
          break;
        case 'banana':
          beep(300, 0.08, 'triangle', 0.025, 500);
          break;
        case 'breath':
          beep(160, 0.18, 'sawtooth', 0.03, 200);
          break;
        case 'bash':
          beep(110, 0.1, 'square', 0.04, -40);
          break;
        case 'ore':
          beep(1300, 0.05, 'square', 0.02, -300);
          break;
        case 'chase-start':
          toast(null, '추격전', `폭주 거북이 달아난다! ${P.chaseTime + game.s.lv.carFuel}초 안에 장갑을 부수자.`);
          sfx.discover();
          break;
        case 'chase-end':
          toast(null, `추격 끝: 볼트 ${e.volt}개${e.ruby ? `, 루비 ${e.ruby}개` : ''}`, `장갑을 ${e.broken}개 부쉈다. 강화 탭의 추격차에서 쓰자.`);
          sfx.clear();
          break;
        case 'volt':
          beep(1500, 0.05, 'square', 0.02, -400);
          break;
        case 'bolt':
          beep(90, 0.14, 'sawtooth', 0.04, 300);
          break;
        case 'coins':
          beep(1200, 0.08, 'triangle', 0.03, 600);
          break;
        case 'dig':
          beep(220, 0.07, 'square', 0.03, -80);
          break;
        case 'proc':
          if (e.id === 'stun' || e.id === 'execute') beep(260, 0.06, 'square', 0.02, -120);
          break;
        case 'mine-start':
          toast(null, '광산', `${P.mineTime}초 동안 바위를 부수자. 깊이 갈수록 단단하고 철광석이 많다.`);
          sfx.discover();
          break;
        case 'mine-end':
          toast(null, `광산 끝: 철광석 ${e.ore}개`, `바위 ${e.broken}개를 부쉈다. 동료 탭에서 진화에 쓰자.`);
          sfx.clear();
          break;
        case 'evolve': {
          const u = TG.UPGRADES.find((x) => x.id === e.id);
          toast(null, `${u.name} 진화! ${'★'.repeat(e.star)}`, '동료가 더 세졌다.');
          sfx.discover();
          break;
        }
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
        case 'story':
          playStory(e.id);
          break;
        case 'claim':
          toast(null, `루비 ${e.ruby}개!`, '임무 보상을 받았다.');
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
      ui.storyOn = data.story !== false;
      ui.away = Math.max(0, (Date.now() - (Number(data.at) || Date.now())) / 1000);
      return data.game;
    } catch {
      return null;
    }
  }
  function save() {
    try {
      g.localStorage.setItem(SAVE_KEY, JSON.stringify({ game: ui.game.snapshot(), muted: ui.muted, story: ui.storyOn, at: Date.now() }));
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
    $('#dialog').addEventListener('click', nextLine);
    if (!ui.game.s.story.seen.intro) openComic();
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
    $('#tabPet').addEventListener('click', () => openSheet('pet'));
    $('#tabAb').addEventListener('click', () => openSheet('ab'));
    $('#chaseBtn').addEventListener('click', () => {
      const game = ui.game;
      if (game.s.best < P.chaseOpen) toast(null, '추격전은 잠겨 있다', `최고 스테이지 ${P.chaseOpen}에 가면 열린다.`);
      else if (!game.startChase() && game.s.chaseCd > 0) toast(null, '거북이 숨었다', `${TG.fmtTime(game.s.chaseCd)} 뒤에 다시 쫓을 수 있다.`);
    });
    for (const [id, btn, lv] of SKILL_BTN) {
      $(btn).addEventListener('click', () => {
        if (lv && !ui.game.s.lv[lv]) toast(null, '아직 못 쓰는 스킬', '강화 탭의 루비 강화에서 배울 수 있다.');
        else ui.game.useSkill(id);
      });
    }
    $('#tabQuest').addEventListener('click', () => openSheet('quest'));
    $('#gachaOk').addEventListener('click', () => {
      $('#gacha').hidden = true;
      if (ui.sheet === 'shop') buildShop();
    });
    $('#mineBtn').addEventListener('click', () => {
      const game = ui.game;
      if (game.s.best < P.mineOpen) toast(null, '광산은 잠겨 있다', `최고 스테이지 ${P.mineOpen}에 가면 열린다.`);
      else if (!game.startMine() && game.s.mineCd > 0) toast(null, '광산 정비 중', `${TG.fmtTime(game.s.mineCd)} 뒤에 다시 들어갈 수 있다.`);
    });
    $('#bossBtn').addEventListener('click', () => {
      if (!ui.game.startBoss() && ui.game.s.bossCd > 0) toast(null, '보스 준비 중', `${TG.fmtTime(ui.game.s.bossCd)} 뒤에 다시 도전할 수 있다.`);
    });
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

    for (const [id, name] of [['goldIcon', 'coin'], ['craftIcon', 'craft'], ['upIcon', 'atk'], ['dexIcon', 'dex'], ['setIcon', 'stage'], ['countIcon', 'slots'], ['meAtkIcon', 'atk'], ['rubyIcon', 'ruby'], ['skRainIcon', 'skillRain'], ['skRageIcon', 'skillRage'], ['bossIcon', 'boss'], ['shopIcon', 'shop'], ['offIcon', 'offline'], ['petIcon', 'pets'], ['mineIcon', 'mine'], ['skShadowIcon', 'skillShadow'], ['skBarrageIcon', 'skillBarrage'], ['questIcon', 'quest'], ['skBoltIcon', 'skillBolt'], ['skDarkIcon', 'skillDark'], ['chaseIcon', 'chase'], ['abIcon', 'ability']]) {
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
      storyTick(dt);
      if (ui.sheet === 'pet') animPets(dt);
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
