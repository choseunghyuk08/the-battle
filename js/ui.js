(function (g) {
  const TG = g.TG;
  const P = TG.P;
  const $ = (s) => document.querySelector(s);

  const SAVE_KEY = 'mudeun-deonjyeo-v1';
  const ui = { game: null, drag: null, sheet: null, muted: false, storyOn: true, comicOpen: false };

  /* ---- 그림을 DOM 에 넣기 ---- */
  function spriteCanvas(def, clip = null, frameIdx = 0, palIdx = 0) {
    const pals = def.palettes || [def.palette || {}];
    const c = TG.clip(def, clip || Object.keys(def.clips)[0], pals[palIdx % pals.length], 1, `p${palIdx % pals.length}`);
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
      const r = TG.pixelText(t > TG.NAMED ? `+${t - TG.NAMED}` : String(t), '#ffffff', '#17121e');
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
    $('#stageSub').textContent = game.mode === 'chase' ? `추격전 · 남은 시간 ${Math.ceil(game.chaseT)}초 · 볼트 +${game.chaseGot}` : game.mode === 'mine' ? `광산 · 남은 시간 ${Math.ceil(game.mineT)}초 · 철광석 +${game.mineGot}` : game.mode === 'boss' ? `보스전 ${game.s.boss} · 남은 시간 ${Math.ceil(game.bossT)}초` : game.mode === 'defend' ? `방어전 ${game.defendLvl}단계 · 남은 시간 ${Math.ceil(game.defendT)}초 · 처치 ${game.defendKills}` : game.phase === 'run' ? `${game.phaseNo}페이즈 · ${th.name} · 다음 스테이지로` : `${game.phaseNo}페이즈 · ${th.name} · 웨이브 ${Math.max(1, game.wave)}/${P.waves}`;
    $('#goldNum').textContent = TG.fmt(game.s.gold);
    $('#rubyNum').textContent = TG.fmt(game.s.ruby);
    $('#sapBox').hidden = !game.s.stats.sapphire && !game.s.sapphire;
    $('#sapNum').textContent = TG.fmt(game.s.sapphire);
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
    $('#mineLabel').textContent = game.mode === 'mine' ? `${Math.ceil(game.mineT)}초` : mineOpen ? '광산' : `${P.mineOpen}부터`;
    const defendOpen = game.s.best >= P.defendOpen;
    cdView($('#defendBtn'), game.s.defendCd, game.s.defendCd > P.defendFailCd ? P.defendCd : P.defendFailCd, game.canDefend());
    $('#defendBtn').classList.toggle('locked', !defendOpen);
    $('#defendLabel').textContent = game.mode === 'defend' ? `${Math.ceil(game.defendT)}초` : defendOpen ? (game.s.defendTier ? `방어 ${Math.min(P.defendTierMax, game.s.defendTier + 1)}` : '방어') : `${P.defendOpen}부터`;
    const title = TG.TITLES.find((t) => t.id === game.s.title);
    if ($('#meName').textContent !== title.name) $('#meName').textContent = title.name;
    const chaseOpen = game.s.best >= P.chaseOpen;
    cdView($('#chaseBtn'), game.s.chaseCd, P.chaseCd, game.canChase());
    $('#chaseBtn').classList.toggle('locked', !chaseOpen);
    $('#chaseLabel').textContent = game.mode === 'chase' ? `${Math.ceil(game.chaseT)}초` : chaseOpen ? '추격' : `${P.chaseOpen}부터`;
    $('#abDot').hidden = !(game.s.abEquip.length < game.abSlots && TG.ABILITIES.some((a) => game.s.ab[a.id] && !game.s.abEquip.includes(a.id))) && !(game.s.ruby >= TG.abCost(0) && !Object.keys(game.s.ab).length);
    $('#autoTag').textContent = [game.s.lv.autoCraft ? '자동 제작' : '', game.s.lv.autoMerge ? '자동 합치기' : '', game.s.lv.autoSkill && game.s.autoSkillOn ? '자동 스킬' : ''].filter(Boolean).join(' · ');
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
      $('#foeName').textContent = f.tank ? `${def.name || '폭주 거북'} ${f.k + 1}번째 장갑` : f.ore ? `${def.name || '광석 바위'} ${f.k + 1}번째` : f.boss ? `보스 ${game.s.boss}: ${def.name || f.kind}${f.trait ? ` · ${[f.trait, f.trait2].filter(Boolean).map((id) => TG.BOSS_TRAITS.find((x) => x.id === id).name).join('·')}` : ''}` : `${f.giant ? '거대 ' : ''}${def.name || f.kind} Lv.${game.s.stage}`;
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
    if (ui.sheet === 'ab') {
      refreshAbilities();
      refreshEngrave();
      refreshStars();
    }
    if (ui.sheet === 'quest' && ui.questSeg === 'title') refreshTitles();
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
  const UP_ICON = { atk: 'atk', hp: 'hp', craft: 'craftLv', climb: 'climb', slots: 'slots', autoCraft: 'autoCraft', autoMerge: 'autoMerge', rAtk: 'atk', rGold: 'coin', skRain: 'skillRain', skRage: 'skillRage', autoSkill: 'autoSkill', monkey: 'monkey', hippo: 'hippo', awaken: 'awaken', bear: 'bear', dragon: 'dragon', skShadow: 'skillShadow', skBarrage: 'skillBarrage', autoShop: 'autoShop', pig: 'pig', mole: 'mole', skBolt: 'skillBolt', skDark: 'skillDark', carFuel: 'car', carGun: 'chase', carEngine: 'volt', fAtk: 'atk', fHp: 'hp' };
  const CUR = {
    gold: { icon: 'coin', cls: '', title: '골드 강화' },
    ruby: { icon: 'ruby', cls: 'ruby', title: '루비 강화 · 보스와 거대 몬스터에게서 얻어요' },
    shards: { icon: 'shard', cls: 'shard', title: '각성 · 합칠 때 얻는 조각으로 올려요 (상점과 같은 조각)' },
    volt: { icon: 'volt', cls: 'shard', title: '추격차 · 추격전에서 얻는 볼트로 올려요' },
    sapphire: { icon: 'sapphire', cls: 'sapphire', title: '최종 강화' },
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
        body.append(el('p', { class: 'sec' }, cur === 'volt' ? [uiIcon('volt'), '추격차 · 볼트 ', el('b', { id: 'voltNum' }), '개'] : cur === 'sapphire' ? [uiIcon('sapphire'), '최종 강화 · 사파이어 ', el('b', { id: 'sapSheetNum' }), '개'] : [uiIcon(CUR[cur].icon), CUR[cur].title]));
      }
      if (cur === 'sapphire' && u.id === 'fAtk') body.append(el('p', { class: 'note', text: '몬스터를 잡을 때 아주 가끔 사파이어가 나와요. 거대 몬스터는 더 자주 떨어뜨려요. 최종 %는 다른 보너스를 다 더한 값에 곱해져요.' }));
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
    if ($('#sapSheetNum')) $('#sapSheetNum').textContent = TG.fmt(game.s.sapphire);
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
        toast(null, `${u.name} 합류!`, '이제 뒤에서 같이 싸워요.');
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
    body.replaceChildren(el('p', { class: 'note' }, ['동료는 루비로 데려오고 키워요. 광산에서 캔 철광석으로 진화하면 더 세져요. 철광석 ', el('b', { id: 'oreNum', text: TG.fmt(ui.game.s.ore) }), '개']), list);
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
      const it = TG.itemInfo(o.tier);
      const btn = el('button', { type: 'button', 'data-k': k, onclick: () => shopBuy(k) });
      list.append(el('div', { class: 'offer', 'data-offer': k }, [spriteCanvas(TG.itemDef(o.tier), 'icon'), el('div', {}, [el('div', { class: 'nm' }, [it.name, el('small', { text: `${o.tier}단계` })]), el('div', { class: 'ln', text: it.line })]), btn]));
    });
    body.replaceChildren(
      segBar(),
      el('p', { class: 'note' }, ['합칠 때마다 결과 단계만큼 조각을 얻어요. 지금 조각 ', el('b', { id: 'shardNum', text: TG.fmt(game.s.shards) }), '개']),
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
    if (r === 'full') toast(null, '필드가 가득 찼어요', '합치거나 보유 개수를 늘려 봐요.');
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
    if (ui.fuseId) {
      buildFuse(ui.fuseId);
      return;
    }
    const body = $('#sheetBody');
    const grid = el('div', { class: 'relics' });
    for (const r of TG.RELICS) grid.append(el('div', { class: 'relic', 'data-relic': r.id }, [relicIcon(r.id), el('div', {}, [el('div', { class: 'nm' }, [r.name, el('small')]), el('div', { class: 'ds' }), el('div', { class: 'ln', text: TG.RELIC_LINES[r.id] || '' }), el('button', { type: 'button', class: 'fz', hidden: true, onclick: () => { ui.fuseId = r.id; buildFuse(r.id); } }, [uiIcon('fuse'), ' 합성'])])]));
    body.replaceChildren(
      segBar(),
      el('p', { class: 'note' }, ['루비로 유물 20종 중 하나를 뽑아요. 같은 것이 또 나오면 레벨이 올라요 (최대 ', String(P.relicMax), '). 다 모은 유물은 안 나와요.']),
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
      const star = game.s.relicStar[r.id] || 0;
      row.querySelector('small').textContent = L ? (L >= P.relicMax ? `최대${star ? ` ${'★'.repeat(star)}` : ''}` : `Lv ${L}`) : '';
      row.querySelector('.ds').textContent = L ? r.desc(game.rv(r.id)) : `?? (Lv1: ${r.desc(r.v(1))})`;
      const fz = row.querySelector('.fz');
      fz.hidden = !(L >= P.relicMax && star < P.relicStarMax);
      fz.disabled = game.s.ruby < P.relicFuseCost[star];
    }
  }
  /* 뽑기 연출: 상자가 열리고 나온 것을 보여 준다 */
  function pull(n) {
    const game = ui.game;
    const res = game.relicPull(n);
    if (!res.ok) {
      toast(null, res.why === 'max' ? '유물을 다 모았어요' : '루비가 모자라요', res.why === 'max' ? '모든 유물이 최대 레벨이에요.' : '보스와 임무에서 루비를 모아 봐요.');
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
        got.append(el('div', { class: `g${g2.lv === 1 ? ' new' : ''}` }, [relicIcon(g2.id), r.name, el('b', { text: g2.lv === 1 ? '새 유물' : `Lv ${g2.lv}` })]));
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
      el('button', { type: 'button', class: seg === 'dex' ? 'on' : '', text: '물건', onclick: () => { ui.questSeg = 'dex'; buildQuest(); } }),
      el('button', { type: 'button', class: seg === 'boss' ? 'on' : '', text: '보스', onclick: () => { ui.questSeg = 'boss'; buildQuest(); } }),
      el('button', { type: 'button', class: seg === 'land' ? 'on' : '', text: '땅', onclick: () => { ui.questSeg = 'land'; buildQuest(); } }),
      el('button', { type: 'button', class: seg === 'title' ? 'on' : '', text: '칭호', onclick: () => { ui.questSeg = 'title'; buildQuest(); } }),
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
    if (ui.questSeg === 'title') {
      buildTitles();
      return;
    }
    if (ui.questSeg === 'boss') {
      buildBossDex();
      return;
    }
    if (ui.questSeg === 'land') {
      buildLands();
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
    body.replaceChildren(questSeg(), el('p', { class: 'note', text: '목표를 채우면 루비를 받아요. 단계가 오를수록 목표도 보상도 커져요.' }), list);
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
      row.querySelector('.pg').textContent = st.goal === undefined ? '모두 완료' : `${TG.fmt(Math.min(st.have, st.goal))} / ${TG.fmt(st.goal)} ${a.unit}`;
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

  function claimLand(p) {
    if (ui.game.claimLand(p)) {
      handleEvents();
      refreshQuest();
      if (ui.sheet === 'quest' && ui.questSeg === 'land') buildLands();
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
    TG.ITEM_SETS.forEach((st, si) => {
      const done = game.setDone[si];
      grid.append(
        el('div', { class: `setrow${done ? ' done' : ''}` }, [
          el('b', { text: st.name }),
          el('span', { text: `${game.setFound(si)}/${st.to - st.from + 1}` }),
          el('small', { text: `${done ? '적용 중' : '다 찾으면'} ${TG.SET_KIND[st.kind]} +${Math.round(P.setBonus * 100)}%` }),
        ]),
      );
      for (let tier = st.from; tier <= st.to; tier++) {
        const it = TG.ITEMS[tier - 1];
        const seen = game.s.seen[tier];
        const cv = spriteCanvas(TG.itemDef(tier), 'icon');
        if (!seen) {
          const x = cv.getContext('2d');
          x.globalCompositeOperation = 'source-in';
          x.fillStyle = '#0c0d1c';
          x.fillRect(0, 0, cv.width, cv.height);
        }
        grid.append(el('div', { class: `it${seen ? '' : ' unseen'}` }, [cv, `${tier}. ${seen ? it.name : '???'}`, el('small', { text: seen ? it.line : '합쳐서 찾아봐요' })]));
      }
    });
    const found = game.s.seen.slice(0, TG.NAMED + 1).filter(Boolean).length;
    const sets = game.setDone.filter(Boolean).length;
    body.replaceChildren(
      questSeg(),
      el('p', { class: 'note', text: `찾은 물건 ${found}/${TG.ITEMS.length}. 같은 물건 둘을 합치면 다음 단계가 나와요.` }),
      el('p', { class: 'note', text: `세트 ${sets}/${TG.ITEM_SETS.length}. 세트를 다 모으면 최종 공격력 +${Math.round(P.setAllBonus * 100)}%.` }),
      grid,
    );
  }

  /* ---- 땅 구경: 12곳의 배경, 스테이지 범위, 나오는 몬스터 ---- */
  function landPreview(theme) {
    const cv = document.createElement('canvas');
    cv.width = 200;
    cv.height = 100;
    cv.className = 'landbg';
    const def = TG.SPR.bg[theme.id];
    if (!def) return cv;
    const ctx = cv.getContext('2d');
    const pals = def.palettes || [def.palette || {}];
    for (const name of ['sky', 'far', 'near']) {
      if (!def.clips[name]) continue;
      ctx.drawImage(TG.clip(def, name, pals[0], 1, 'p0').frames[0].canvas, 0, 0);
    }
    return cv;
  }
  function landGiftRow(p) {
    const game = ui.game;
    const g = game.landGift(p);
    const got = !!game.s.lands[p];
    const ready = game.landReady(p);
    return el('div', { class: 'landgift' }, [
      el('span', { text: `첫 도착 선물 · 루비 ${g.ruby}, 사파이어 ${g.sapphire}` }),
      el('button', { type: 'button', text: got ? '받았어요' : '받기', ...(ready ? {} : { disabled: '' }), onclick: () => claimLand(p) }),
    ]);
  }
  function buildLands() {
    const game = ui.game;
    const here = TG.phaseOf(game.s.stage).p;
    const top = TG.phaseOf(game.s.best).p;
    const list = el('div', {});
    const jobs = [];
    TG.THEMES.forEach((th, i) => {
      const p = i + 1;
      const from = p === 1 ? 1 : 64 * 2 ** (p - 2) + 1;
      const to = 64 * 2 ** (p - 1);
      const cur = (here - 1) % TG.THEMES.length === i;
      const state = cur ? '지금 여기' : p <= top ? '다녀온 곳' : top >= 1 && p === top + 1 ? '다음 땅' : '아직 먼 곳';
      const slot = el('div', { class: 'landpic' });
      jobs.push(() => slot.append(landPreview(th)));
      const mobs = el('div', { class: 'landmobs' });
      for (const kind of th.mobs) {
        const def = TG.SPR.mob[kind];
        if (!def) continue;
        mobs.append(el('div', { class: 'lm' }, [spriteCanvas(def, 'idle', 0, 0), el('span', { text: def.name || kind })]));
      }
      list.append(
        el('div', { class: `sto land${cur ? ' now' : ''}` }, [
          el('div', { class: 'nm', text: `${p}페이즈 · ${th.name}` }),
          el('span', { class: 'bossst', text: state }),
          slot,
          ...(p >= 2 ? [landGiftRow(p)] : []),
          el('div', { class: 'ln', text: `${TG.fmt(from)}~${TG.fmt(to)} 스테이지` }),
          mobs,
        ]),
      );
    });
    $('#sheetBody').replaceChildren(questSeg(), el('p', { class: 'note', text: '페이즈가 바뀔 때마다 땅이 하나씩 바뀌어요. 열두 곳을 다 돌면 처음 땅으로 돌아오고, 몬스터 색이 더 짙어져요.' }), list);
    const run = () => {
      const j = jobs.shift();
      if (!j) return;
      j();
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  /* ---- 보스 도감: 이긴 보스와 다음 보스 ---- */
  function buildBossDex() {
    const game = ui.game;
    const list = el('div', {});
    for (let k = game.s.boss; k >= 1; k--) {
      const b = game.bossInfo(k);
      const def = TG.SPR.mob[b.kind] || TG.SPR.mob.slime;
      const beaten = k < game.s.boss;
      const traits = [b.trait, b.trait2].filter(Boolean);
      const cv = spriteCanvas(def, 'idle', 0, 2 + Math.floor(k / TG.THEMES.length));
      list.append(
        el('div', { class: `sto${beaten ? '' : ' next'}` }, [
          el('div', { class: 'bossrow' }, [cv, el('div', {}, [el('div', { class: 'nm', text: `보스 ${k} · ${def.name || b.kind}` }), el('div', { class: 'ln', text: traits.length ? traits.map((t) => `${t.name}: ${t.desc}`).join(' / ') : '특성 없음' })])]),
          el('span', { class: 'bossst', text: beaten ? `루비 ${b.ruby}` : '도전할 보스' }),
        ]),
      );
    }
    $('#sheetBody').replaceChildren(questSeg(), el('p', { class: 'note', text: `이긴 보스 ${game.s.boss - 1}명. 둘째 보스부터 특성이 붙고, 아홉째부터는 둘씩 붙어요.` }), list);
  }

  /* ---- 특수능력 ---- */
  function buildAbilities() {
    if (ui.abSeg === 'eng') {
      buildEngrave();
      return;
    }
    if (ui.abSeg === 'star') {
      buildStars();
      return;
    }
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
    body.replaceChildren(abSegBar(), el('p', { class: 'slotinfo', id: 'slotInfo' }), list);
    refreshAbilities();
  }
  function refreshAbilities() {
    const game = ui.game;
    if (!$('#slotInfo')) return;
    const next = P.abSlotsAt.find((x) => game.s.best < x);
    $('#slotInfo').textContent = `장착 ${game.s.abEquip.length}/${game.abSlots}칸${next !== undefined ? ` · 최고 스테이지 ${next}에 가면 한 칸 더` : ''}. 던진 물건이 맞을 때 확률로 터져요.`;
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
    if (r === 'full') toast(null, '칸이 모자라요', '다른 능력을 해제하거나 더 멀리 가면 칸이 늘어요.');
    else if (r !== 'none') sfx.craft();
    refreshAbilities();
    updateHud();
    save();
  }

  /* ---- v0.7: 각인, 스킬 각성, 유물 합성, 칭호와 코스튬 ---- */
  const SKILL_NAME = { rain: '쏟아지기', rage: '분노', shadow: '그림자 분신', barrage: '난사', bolt: '뇌전', dark: '어둠장막' };
  const SKILL_ICON = { rain: 'skillRain', rage: 'skillRage', shadow: 'skillShadow', barrage: 'skillBarrage', bolt: 'skillBolt', dark: 'skillDark' };
  const STAR_NOTE = { rain: '피해 +35%', rage: '지속 +2초, 배율 +0.2', shadow: '피해 +35%, 지속 +2초', barrage: '피해 +35%', bolt: '피해 +35%', dark: '지속 +1초, 받는 피해 +5%' };

  function abSegBar() {
    const seg = ui.abSeg || 'ab';
    const tab = (id, text) => el('button', { type: 'button', class: seg === id ? 'on' : '', text, onclick: () => { ui.abSeg = id; buildAbilities(); } });
    return el('div', { class: 'seg' }, [tab('ab', '능력'), tab('eng', '각인'), tab('star', '스킬 각성')]);
  }

  /* 각인: 칸마다 물건 한 종류와 능력 하나를 고른다. 고른 값은 ui.engPick 에 둔다 (판을 새로 그려도 남는다) */
  function buildEngrave() {
    const game = ui.game;
    const body = $('#sheetBody');
    ui.engPick = ui.engPick || [];
    const learned = TG.ABILITIES.filter((a) => game.s.ab[a.id]);
    const tiers = [];
    for (let t = P.tiers; t >= 1; t--) if (game.s.seen[t]) tiers.push(t);
    const list = el('div', {});
    P.engSlotsAt.forEach((open, i) => {
      if (game.s.best < open) {
        list.append(el('div', { class: 'eng locked' }, [el('div', { class: 'nm', text: `각인 ${i + 1}칸` }), el('div', { class: 'ds', text: `최고 스테이지 ${open}에 가면 열려요` })]));
        return;
      }
      const pick = (ui.engPick[i] = ui.engPick[i] || { tier: tiers[0] || 1, id: learned.length ? learned[0].id : '' });
      const tierSel = el('select', { 'aria-label': '물건' }, tiers.map((t) => el('option', { value: String(t), text: `${t}단계 ${TG.itemInfo(t).name}` })));
      tierSel.value = String(pick.tier);
      const abSel = el('select', { 'aria-label': '능력' }, learned.map((a) => el('option', { value: a.id, text: a.name })));
      abSel.value = pick.id;
      const go = el('button', { type: 'button', class: 'buy', 'data-eng': i });
      tierSel.addEventListener('change', () => { pick.tier = Number(tierSel.value); refreshEngrave(); });
      abSel.addEventListener('change', () => { pick.id = abSel.value; refreshEngrave(); });
      go.addEventListener('click', () => {
        const r = game.engrave(i, pick.tier, pick.id);
        if (r === 'ok') sfx.coin();
        else if (r === 'poor') toast(null, '조각이 모자라요', '합칠 때마다 조각을 얻어요.');
        handleEvents();
        refreshEngrave();
        updateHud();
        save();
      });
      const clear = el('button', { type: 'button', class: 'eq', text: '지우기', 'data-clear': i });
      clear.addEventListener('click', () => {
        if (game.unengrave(i)) sfx.craft();
        refreshEngrave();
        save();
      });
      list.append(el('div', { class: 'eng', 'data-slot': i }, [el('div', { class: 'nm' }, [uiIcon('engrave'), ` 각인 ${i + 1}칸`, el('small')]), el('div', { class: 'row2' }, [tierSel, abSel]), el('div', { class: 'btns' }, [go, clear])]));
    });
    body.replaceChildren(abSegBar(), el('p', { class: 'slotinfo', id: 'engInfo' }), list);
    refreshEngrave();
  }
  function refreshEngrave() {
    const game = ui.game;
    if (!$('#engInfo')) return;
    const learned = TG.ABILITIES.some((a) => game.s.ab[a.id]);
    $('#engInfo').textContent = learned
      ? `물건 한 종류에 능력을 새겨요. 그 물건이 맞을 때 능력이 ${P.engMult}배 확률로 터져요. 장착하지 않은 능력도 돼요. 조각 ${TG.fmt(game.s.shards)}개`
      : '능력을 하나 배우면 물건에 새길 수 있어요.';
    document.querySelectorAll('[data-slot]').forEach((row) => {
      const i = Number(row.dataset.slot);
      const e = game.s.eng[i];
      const pick = ui.engPick[i];
      row.querySelector('small').textContent = e ? `${TG.itemInfo(e.tier).name} · ${TG.ABILITIES.find((a) => a.id === e.id).name}` : '비어 있음';
      row.classList.toggle('on', !!e);
      const go = row.querySelector('.buy');
      const cost = P.engCost(pick.tier);
      go.disabled = !pick.id || game.s.shards < cost;
      const lb = `${e && e.tier === pick.tier && e.id === pick.id ? '다시 새기기' : '새기기'} ${TG.fmt(cost)}`;
      if (go.dataset.label !== lb) {
        go.dataset.label = lb;
        go.replaceChildren(lb.slice(0, lb.lastIndexOf(' ')), uiIcon('shard'), TG.fmt(cost));
      }
      row.querySelector('.eq').hidden = !e;
    });
  }

  /* 스킬 각성 */
  function buildStars() {
    const body = $('#sheetBody');
    const list = el('div', {});
    for (const id of TG.SKILLS) {
      const def = TG.SPR.ui[SKILL_ICON[id]];
      list.append(
        el('div', { class: 'ab', 'data-star': id }, [
          def ? spriteCanvas(def) : uiIcon('ability'),
          el('div', {}, [el('div', { class: 'nm' }, [SKILL_NAME[id], el('small')]), el('div', { class: 'ds' })]),
          el('div', { class: 'btns' }, [el('button', { type: 'button', class: 'buy', onclick: () => starBuy(id) })]),
        ]),
      );
    }
    body.replaceChildren(abSegBar(), el('p', { class: 'slotinfo', id: 'starInfo' }), list);
    refreshStars();
  }
  function refreshStars() {
    const game = ui.game;
    if (!$('#starInfo')) return;
    $('#starInfo').textContent = `스킬 레벨이 오르면 별을 달 수 있어요. 별마다 대기 시간 -${Math.round(P.skStarCd * 100)}%. 조각 ${TG.fmt(game.s.shards)}개`;
    for (const id of TG.SKILLS) {
      const row = document.querySelector(`[data-star="${id}"]`);
      if (!row) continue;
      const st = game.skStar(id);
      const lv = game.skLevel(id);
      const need = game.skNeed(id);
      row.classList.toggle('none', !lv);
      row.classList.toggle('on', st > 0);
      row.querySelector('small').textContent = `${'★'.repeat(st)}${'☆'.repeat(P.skStarLv.length - st)}`;
      row.querySelector('.ds').textContent = lv ? `별마다 ${STAR_NOTE[id]}` : '루비로 먼저 배워야 해요';
      const btn = row.querySelector('.buy');
      btn.disabled = !need || lv < need.lv || game.s.shards < need.cost;
      const ready = need && lv >= need.lv;
      const lb = !need ? '최대' : ready ? `각성 ${TG.fmt(need.cost)}` : `Lv ${need.lv}부터`;
      if (btn.dataset.label !== lb) {
        btn.dataset.label = lb;
        btn.replaceChildren(...(ready ? ['각성', uiIcon('shard'), TG.fmt(need.cost)] : [lb]));
      }
    }
  }
  function starBuy(id) {
    if (ui.game.awakenSkill(id) === 'ok') {
      sfx.discover();
      handleEvents();
      refreshStars();
      updateHud();
      save();
    }
  }

  /* 유물 합성 */
  function buildFuse(id) {
    const game = ui.game;
    const body = $('#sheetBody');
    const r = TG.RELICS.find((x) => x.id === id);
    const st = game.s.relicStar[id] || 0;
    const list = el('div', { class: 'fuse' });
    for (const f of TG.RELICS) {
      const L = game.s.relics[f.id] || 0;
      if (f.id === id || L <= P.relicFuseFodder) continue;
      list.append(
        el('div', { class: 'ab' }, [
          relicIcon(f.id),
          el('div', {}, [el('div', { class: 'nm', text: f.name }), el('div', { class: 'ds', text: `Lv ${L} → ${L - P.relicFuseFodder}` })]),
          el('div', { class: 'btns' }, [
            el('button', { type: 'button', class: 'buy', onclick: () => {
              if (game.relicFuse(id, f.id) === 'ok') {
                sfx.discover();
                handleEvents();
                ui.fuseId = null;
                buildRelics();
                updateHud();
                save();
              }
            } }, [uiIcon('ruby'), String(P.relicFuseCost[st])]),
          ]),
        ]),
      );
    }
    if (!list.children.length) list.append(el('p', { class: 'note', text: `재료로 쓸 유물이 없어요. ${P.relicFuseFodder + 1}레벨 이상이어야 해요.` }));
    body.replaceChildren(
      el('p', { class: 'slotinfo', text: `${r.name}에 다른 유물의 레벨 ${P.relicFuseFodder}을 넣어 별을 올려요. 별마다 효과 +${Math.round(P.relicStarBonus * 100)}%예요. 루비 ${TG.fmt(game.s.ruby)}개` }),
      list,
      el('button', { type: 'button', class: 'back', text: '취소', onclick: () => { ui.fuseId = null; buildRelics(); } }),
    );
  }

  /* 칭호와 코스튬 */
  function buildTitles() {
    const game = ui.game;
    const body = $('#sheetBody');
    const list = el('div', {});
    for (const t of TG.TITLES) {
      list.append(
        el('div', { class: 'sto', 'data-title': t.id }, [
          el('div', { class: 'nm', text: t.name }),
          el('div', { class: 'ln' }),
          el('button', { type: 'button', onclick: () => { if (game.setTitle(t.id)) { sfx.craft(); save(); refreshTitles(); updateHud(); } } }),
        ]),
      );
    }
    const chips = el('div', { class: 'costumes' });
    TG.COSTUMES.forEach((name, i) => {
      const def = TG.SPR.hero.main;
      const cv = document.createElement('canvas');
      const pi = i < def.palettes.length ? i : 0;
      const c = TG.clip(def, 'idle', def.palettes[pi], 1, `p${pi}`);
      cv.width = c.w;
      cv.height = c.h;
      cv.getContext('2d').drawImage(c.frames[0].canvas, 0, 0);
      chips.append(el('button', { type: 'button', class: 'cs', 'data-cs': i, onclick: () => {
        if (game.costumeOpen(i)) {
          if (game.setCostume(i)) { sfx.craft(); save(); refreshTitles(); }
        } else if (TG.COSTUME_SHOP[i]) {
          const r = game.buyCostume(i);
          if (r === 'poor') toast(null, '메달이 모자라요', '방어전을 이기면 메달을 얻어요.');
          handleEvents();
          save();
          refreshTitles();
        }
      } }, [cv, el('small', { text: name })]));
    });
    body.replaceChildren(questSeg(), el('p', { class: 'note', id: 'titleInfo' }), list, el('p', { class: 'sec' }, [uiIcon('costume'), ' 코스튬']), chips);
    refreshTitles();
  }
  function refreshTitles() {
    const game = ui.game;
    if (!$('#titleInfo')) return;
    $('#titleInfo').textContent = `칭호 ${game.titlesOwned}/${TG.TITLES.length}. 열린 칭호마다 모든 피해 +${Math.round(P.titleBonus * 100)}%예요. 고른 칭호는 내 이름 자리에 떠요. 방어 메달 ${game.s.medals}개로 코스튬을 살 수 있어요.`;
    for (const t of TG.TITLES) {
      const row = document.querySelector(`[data-title="${t.id}"]`);
      if (!row) continue;
      const open = game.titleOpen(t.id);
      const co = t.costume !== undefined && t.costume > 0 ? ` · 코스튬 ${TG.COSTUMES[t.costume]}` : '';
      row.classList.toggle('none', !open);
      row.classList.toggle('pick', game.s.title === t.id);
      row.querySelector('.ln').textContent = `${t.cond}${co}`;
      const b = row.querySelector('button');
      b.textContent = game.s.title === t.id ? '고름' : '고르기';
      b.disabled = game.s.title === t.id;
    }
    document.querySelectorAll('[data-cs]').forEach((b) => {
      const i = Number(b.dataset.cs);
      const open = game.costumeOpen(i);
      b.classList.toggle('none', !open);
      b.classList.toggle('pick', game.s.costume === i);
      b.disabled = !open && !TG.COSTUME_SHOP[i];
      b.querySelector('small').textContent = !open && TG.COSTUME_SHOP[i] ? `메달 ${TG.COSTUME_SHOP[i]}` : TG.COSTUMES[i];
    });
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
      el('div', { class: 'row' }, [`최고 스테이지 ${game.s.best} · 쓰러짐 ${game.s.stats.deaths}회 · 합치기 ${TG.fmt(game.s.stats.merges)}회`]),
      el('div', { class: 'row' }, ['처음부터 다시', el('button', { type: 'button', class: 'danger', text: ui.resetArm ? '정말 지우기' : '세이브 지우기', onclick: resetSave })]),
      saveCodeBlock(),
      el('p', { class: 'note', text: '진행은 이 브라우저에 자동으로 저장돼요. 필드에서 같은 물건을 끌어다 겹치면 합쳐져요. 필드가 가득 차면 새 물건은 가장 낮은 단계로 들어가요.' }),
    );
  }
  /* 저장 코드: 복사해 두면 다른 기기에서 불러올 수 있다 */
  function saveCodeBlock() {
    const area = el('textarea', { class: 'codebox', rows: '3', placeholder: '여기에 코드를 붙여 넣어요', spellcheck: 'false' });
    return el('div', { class: 'codeblock' }, [
      el('p', { class: 'sec', text: '저장 코드' }),
      el('p', { class: 'note', text: '코드를 복사해 두면 다른 기기나 브라우저에서 이어서 할 수 있어요. 불러오면 지금 진행은 사라져요.' }),
      area,
      el('div', { class: 'row' }, [
        el('button', { type: 'button', text: '코드 복사', onclick: () => copyCode(area) }),
        el('button', { type: 'button', class: 'danger', text: '불러오기', onclick: () => importCode(area.value) }),
      ]),
    ]);
  }
  function copyCode(area) {
    const code = TG.saveCode.encode(ui.game.snapshot());
    area.value = code;
    area.select();
    let ok = false;
    try {
      if (g.navigator && g.navigator.clipboard) {
        g.navigator.clipboard.writeText(code);
        ok = true;
      } else ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    toast(null, ok ? '복사했어요' : '코드가 칸에 나왔어요', ok ? '다른 기기에서 불러오기에 붙여 넣어요.' : '칸을 길게 눌러 직접 복사해요.');
  }
  function importCode(text) {
    const st = TG.saveCode.decode(text);
    if (!st) {
      toast(null, '코드가 올바르지 않아요', '복사한 코드를 끝까지 붙여 넣었는지 봐요.');
      return;
    }
    ui.game = new TG.Game(st);
    save();
    closeSheet();
    toast(null, '불러왔어요', `스테이지 ${ui.game.s.stage}에서 이어서 해요.`);
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
  const TITLES = { up: '강화', pet: '동료', ab: '능력', shop: '상점', quest: '임무와 도감', set: '설정' };
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
    ui.fuseId = null;
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
            const it = TG.itemInfo(e.tier);
            toast(e.tier, `새 물건 · ${e.tier}단계 ${it.name}`, it.line);
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
          toast(null, '추격전', `폭주 거북이 달아나요. ${P.chaseTime + game.s.lv.carFuel}초 안에 장갑을 부숴요.`);
          sfx.discover();
          break;
        case 'chase-end':
          toast(null, `추격 끝 · 볼트 +${e.volt}${e.ruby ? `, 루비 +${e.ruby}` : ''}`, `장갑 ${e.broken}개를 부쉈어요. 강화 탭의 추격차에 써요.`);
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
          toast(null, '광산', `${P.mineTime}초 동안 바위를 부숴요. 깊이 갈수록 단단하고 철광석이 많아요.`);
          sfx.discover();
          break;
        case 'mine-end':
          toast(null, `광산 끝 · 철광석 +${e.ore}`, `바위 ${e.broken}개를 부쉈어요. 동료 탭에서 진화에 써요.`);
          sfx.clear();
          break;
        case 'evolve': {
          const u = TG.UPGRADES.find((x) => x.id === e.id);
          toast(null, `${u.name} 진화 ${'★'.repeat(e.star)}`, '더 세졌어요.');
          sfx.discover();
          break;
        }
        case 'ruby':
          sfx.coin();
          break;
        case 'boss-start': {
          const def = TG.SPR.mob[e.kind] || TG.SPR.mob.slime;
          const trs = e.traits.map((id) => TG.BOSS_TRAITS.find((x) => x.id === id));
          toast(null, `보스전 ${e.boss}: ${def.name}`, trs.length ? `${trs.map((t) => `${t.name}: ${t.desc}`).join(' / ')}. ${P.bossTime}초 안에 쓰러뜨려요.` : `${P.bossTime}초 안에 쓰러뜨려요.`);
          sfx.discover();
          break;
        }
        case 'defend-start':
          toast(null, `방어전 ${e.lvl}단계`, `${P.defendTime}초 동안 몰려오는 몬스터를 버텨요.`);
          sfx.discover();
          break;
        case 'defend-end':
          if (e.win) toast(null, `방어전 ${e.lvl}단계 끝 · 루비 +${e.ruby}`, `${e.kills}마리를 막아냈어요. 골드 +${TG.fmt(e.gold)}, 메달 +${e.medals}`);
          else toast(null, `방어전 ${e.lvl}단계 실패`, `${e.kills}마리까지 버텼어요. 루비 +${e.ruby}${e.medals ? `, 메달 +${e.medals}` : ''}`);
          break;
        case 'title': {
          const t = TG.TITLES.find((x) => x.id === e.id);
          toast(null, `새 칭호 · ${t.name}`, `임무 탭의 칭호에서 고를 수 있어요. 모든 피해 +${Math.round(P.titleBonus * 100)}%.`);
          sfx.discover();
          break;
        }
        case 'costume':
          toast(null, `코스튬 · ${TG.COSTUMES[e.i]}`, '칭호 탭에서 골라 입어요.');
          sfx.discover();
          break;
        case 'set': {
          const st = TG.ITEM_SETS[e.i];
          toast(null, `세트 완성 · ${st.name}`, `${TG.SET_KIND[st.kind]} +${Math.round(P.setBonus * 100)}%`);
          sfx.discover();
          break;
        }
        case 'sk-star':
          toast(null, `${SKILL_NAME[e.id]} 각성 ${'★'.repeat(e.star)}`, '피해가 늘고 대기 시간이 줄었어요.');
          break;
        case 'fuse': {
          const r = TG.RELICS.find((x) => x.id === e.id);
          toast(null, `${r.name} 합성 ${'★'.repeat(e.star)}`, `효과가 ${Math.round(P.relicStarBonus * 100)}% 늘었어요.`);
          break;
        }
        case 'boss-win':
          toast(null, `보스 ${e.boss} 격파`, `루비 +${e.ruby}`);
          sfx.clear();
          break;
        case 'boss-lose':
          toast(null, '보스를 놓쳤어요', '조금 더 키운 뒤 다시 도전해요.');
          break;
        case 'skill':
          sfx.discover();
          break;
        case 'story':
          playStory(e.id);
          break;
        case 'claim':
          toast(null, `루비 +${e.ruby}`, '임무 보상이에요.');
          break;
        case 'land':
          toast(null, `${e.p}페이즈 첫 도착 선물`, `루비 +${e.ruby}, 사파이어 +${e.sapphire}`);
          sfx.discover();
          break;
        case 'shop':
          if (ui.sheet === 'shop') buildShop();
          break;
        case 'clear':
          sfx.clear();
          if (e.skipped) toast(null, `등반술 · ${e.skipped}스테이지 건너뜀`, `스테이지 ${e.next}로 가요.`);
          break;
        case 'die':
          toast(null, '쓰러졌어요', `스테이지 ${e.stage}에서 다시 시작해요.`);
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
        $('#offText').replaceChildren(`${TG.fmtTime(Math.min(ui.away, P.offlineMax))} 동안 `, el('b', { text: `골드 ${TG.fmt(gold)}` }), ' 벌었어요.', ui.away > P.offlineMax ? el('br') : '', ui.away > P.offlineMax ? '(최대 8시간까지 쌓여요)' : '');
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
      if (game.s.best < P.chaseOpen) toast(null, '추격전은 잠겨 있어요', `최고 스테이지 ${P.chaseOpen}에 가면 열려요.`);
      else if (!game.startChase() && game.s.chaseCd > 0) toast(null, '거북이 숨었어요', `${TG.fmtTime(game.s.chaseCd)} 뒤에 다시 쫓아요.`);
    });
    for (const [id, btn, lv] of SKILL_BTN) {
      $(btn).addEventListener('click', () => {
        if (lv && !ui.game.s.lv[lv]) toast(null, '아직 못 쓰는 스킬', '강화 탭의 루비 강화에서 배워요.');
        else ui.game.useSkill(id);
      });
    }
    $('#tabQuest').addEventListener('click', () => openSheet('quest'));
    $('#gachaOk').addEventListener('click', () => {
      $('#gacha').hidden = true;
      if (ui.sheet === 'shop') buildShop();
    });
    $('#defendBtn').addEventListener('click', () => {
      const game = ui.game;
      if (game.s.best < P.defendOpen) toast(null, '방어전은 잠겨 있어요', `최고 스테이지 ${P.defendOpen}에 가면 열려요.`);
      else if (!game.startDefend() && game.s.defendCd > 0) toast(null, '방어전 준비 중', `${TG.fmtTime(game.s.defendCd)} 뒤에 다시 막아요.`);
    });
    $('#mineBtn').addEventListener('click', () => {
      const game = ui.game;
      if (game.s.best < P.mineOpen) toast(null, '광산은 잠겨 있어요', `최고 스테이지 ${P.mineOpen}에 가면 열려요.`);
      else if (!game.startMine() && game.s.mineCd > 0) toast(null, '광산 정비 중', `${TG.fmtTime(game.s.mineCd)} 뒤에 다시 들어가요.`);
    });
    $('#bossBtn').addEventListener('click', () => {
      if (!ui.game.startBoss() && ui.game.s.bossCd > 0) toast(null, '보스 준비 중', `${TG.fmtTime(ui.game.s.bossCd)} 뒤에 다시 도전해요.`);
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

    for (const [id, name] of [['goldIcon', 'coin'], ['craftIcon', 'craft'], ['upIcon', 'atk'], ['dexIcon', 'dex'], ['setIcon', 'stage'], ['countIcon', 'slots'], ['meAtkIcon', 'atk'], ['rubyIcon', 'ruby'], ['sapIcon', 'sapphire'], ['skRainIcon', 'skillRain'], ['skRageIcon', 'skillRage'], ['bossIcon', 'boss'], ['shopIcon', 'shop'], ['offIcon', 'offline'], ['petIcon', 'pets'], ['mineIcon', 'mine'], ['skShadowIcon', 'skillShadow'], ['skBarrageIcon', 'skillBarrage'], ['questIcon', 'quest'], ['skBoltIcon', 'skillBolt'], ['skDarkIcon', 'skillDark'], ['chaseIcon', 'chase'], ['abIcon', 'ability'], ['defendIcon', 'defend']]) {
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
