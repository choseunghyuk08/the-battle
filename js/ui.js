(function (g) {
  const TG = g.TG;
  const P = TG.P;
  const $ = (s) => document.querySelector(s);

  const SAVE_KEY = 'mudeun-deonjyeo-v1';
  const ui = { game: null, cells: [], drag: null, sheet: null, muted: false };

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

  /* ---- 보드 ---- */
  function iconScale(cell) {
    const r = cell.getBoundingClientRect();
    const dpr = g.devicePixelRatio || 1;
    return Math.max(1, Math.floor((r.width * 0.8 * dpr) / 20)) / dpr;
  }

  function buildBoard() {
    const board = $('#board');
    board.replaceChildren();
    ui.cells = [];
    for (let i = 0; i < P.cols * P.rows; i++) {
      const cv = document.createElement('canvas');
      cv.width = 20;
      cv.height = 20;
      const cell = el('div', { class: 'cell', 'data-i': i }, [cv, el('span', { class: 'tier' })]);
      board.append(cell);
      ui.cells.push(cell);
    }
    ui.fxCanvas = el('canvas', { class: 'fx' });
    board.append(ui.fxCanvas);
    sizeBoard();
  }

  function sizeBoard() {
    if (!ui.cells.length) return;
    const s = iconScale(ui.cells[0]) * 20;
    for (const cell of ui.cells) {
      const cv = cell.querySelector('canvas');
      cv.style.width = `${s}px`;
      cv.style.height = `${s}px`;
    }
    const r = $('#board').getBoundingClientRect();
    const dpr = g.devicePixelRatio || 1;
    ui.fxCanvas.width = Math.round(r.width * dpr);
    ui.fxCanvas.height = Math.round(r.height * dpr);
  }

  let shineClock = 0;
  function drawCell(i) {
    const game = ui.game;
    const cell = ui.cells[i];
    const tier = game.s.board[i];
    const locked = i >= game.slots;
    cell.classList.toggle('locked', locked);
    cell.classList.toggle('has', !locked && tier > 0);
    const cv = cell.querySelector('canvas');
    const label = cell.querySelector('.tier');
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, 20, 20);
    if (locked) {
      label.textContent = '';
      cv.style.visibility = 'hidden';
      if (!cell.querySelector('.lockicon')) {
        const lk = uiIcon('lock', 'icon x2 lockicon');
        cell.append(lk);
      }
      return;
    }
    const lk = cell.querySelector('.lockicon');
    if (lk) lk.remove();
    cv.style.visibility = 'visible';
    label.textContent = tier ? tier : '';
    if (!tier) return;
    const def = TG.itemDef(tier);
    const clip = def.clips.shine ? 'shine' : 'icon';
    const c = TG.clip(def, clip, def.palettes ? def.palettes[0] : {}, 1, 'p0');
    const k = Math.floor(shineClock * 6 + i * 1.7) % c.n;
    cx.drawImage(c.frames[k].canvas, Math.round(10 - c.ax), Math.round(10 - c.ay));
  }
  function drawBoard() {
    for (let i = 0; i < ui.cells.length; i++) drawCell(i);
  }
  function flash(i, cls) {
    const cell = ui.cells[i];
    if (!cell) return;
    cell.classList.remove(cls);
    void cell.offsetWidth;
    cell.classList.add(cls);
  }

  /* 보드 위 효과 (합성 고리, 새 물건 퐁) */
  const boardFx = [];
  function addBoardFx(name, i) {
    const def = TG.SPR.fx[name];
    if (!def) return;
    boardFx.push({ def, i, t: 0, dur: name === 'discover' ? 0.9 : 0.45 });
  }
  function drawBoardFx(dt) {
    const c = ui.fxCanvas;
    if (!c) return;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, c.height);
    const br = $('#board').getBoundingClientRect();
    const dpr = g.devicePixelRatio || 1;
    for (let k = boardFx.length - 1; k >= 0; k--) {
      const f = boardFx[k];
      f.t += dt;
      if (f.t >= f.dur) {
        boardFx.splice(k, 1);
        continue;
      }
      const clip = Object.keys(f.def.clips)[0];
      const cc = TG.clip(f.def, clip, (f.def.palettes || [{}])[0], 1, 'p0');
      const fr = cc.frames[Math.min(cc.n - 1, Math.floor((f.t / f.dur) * cc.n))];
      const r = ui.cells[f.i].getBoundingClientRect();
      const scale = Math.max(1, Math.floor((r.width * dpr) / Math.max(cc.w, 20)));
      const cx = (r.left + r.width / 2 - br.left) * dpr;
      const cy = (r.top + r.height / 2 - br.top) * dpr;
      x.drawImage(fr.canvas, Math.round(cx - cc.ax * scale), Math.round(cy - cc.ay * scale), cc.w * scale, cc.h * scale);
    }
  }

  /* ---- 드래그로 옮기고 합치기 (터치와 마우스 공통) ---- */
  function cellAt(x, y) {
    for (let i = 0; i < ui.cells.length; i++) {
      const r = ui.cells[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return -1;
  }
  function onDown(e) {
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i >= ui.game.slots || !ui.game.s.board[i]) return;
    e.preventDefault();
    const src = ui.cells[i].querySelector('canvas');
    const ghost = document.createElement('canvas');
    ghost.width = 20;
    ghost.height = 20;
    ghost.getContext('2d').drawImage(src, 0, 0);
    ghost.className = 'ghost';
    const size = parseFloat(src.style.width) * 1.15;
    ghost.style.width = `${size}px`;
    ghost.style.height = `${size}px`;
    document.body.append(ghost);
    ui.drag = { from: i, ghost, size, x0: e.clientX, y0: e.clientY, moved: false, target: -1 };
    ui.cells[i].classList.add('dragging');
    moveGhost(e.clientX, e.clientY);
    $('#board').setPointerCapture(e.pointerId);
  }
  function moveGhost(x, y) {
    const d = ui.drag;
    d.ghost.style.left = `${x - d.size / 2}px`;
    d.ghost.style.top = `${y - d.size / 2}px`;
  }
  function onMove(e) {
    const d = ui.drag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
    moveGhost(e.clientX, e.clientY);
    const t = cellAt(e.clientX, e.clientY);
    if (t !== d.target) {
      if (d.target >= 0) ui.cells[d.target].classList.remove('target');
      d.target = t;
      if (t >= 0 && t !== d.from && t < ui.game.slots) ui.cells[t].classList.add('target');
    }
  }
  function onUp(e) {
    const d = ui.drag;
    if (!d) return;
    ui.drag = null;
    d.ghost.remove();
    ui.cells[d.from].classList.remove('dragging');
    if (d.target >= 0) ui.cells[d.target].classList.remove('target');
    const t = cellAt(e.clientX, e.clientY);
    if (t >= 0 && t !== d.from) {
      const r = ui.game.move(d.from, t);
      if (r === 'merge') flash(t, 'merge');
      handleEvents();
      drawBoard();
      save();
    }
  }

  /* ---- 위쪽 줄과 제작 버튼 ---- */
  function updateHud() {
    const game = ui.game;
    const th = game.theme();
    $('#stageNum').textContent = `스테이지 ${game.s.stage}`;
    $('#stageSub').textContent = game.phase === 'run' ? `${th.name} · 다음 스테이지로` : `${th.name} · 웨이브 ${Math.max(1, game.wave)}/${P.waves}`;
    $('#goldNum').textContent = TG.fmt(game.s.gold);
    const ch = Math.floor(game.s.charges);
    $('#craftCount').textContent = `${ch}/${P.craftMax}`;
    $('#craftFill').style.width = `${(game.s.charges / P.craftMax) * 100}%`;
    $('#craft').classList.toggle('empty', ch < 1);
    $('#chipCraft').classList.toggle('on', game.s.lv.autoCraft > 0);
    $('#chipMerge').classList.toggle('on', game.s.lv.autoMerge > 0);
    const canAny = TG.UPGRADES.some((u) => game.canBuy(u.id));
    $('#upDot').hidden = !canAny;
    if (ui.sheet === 'up') refreshUpgrades();
  }

  /* ---- 강화 판 ---- */
  const UP_ICON = { atk: 'atk', hp: 'hp', craft: 'craftLv', climb: 'climb', slots: 'slots', autoCraft: 'autoCraft', autoMerge: 'autoMerge' };
  function buildUpgrades() {
    const body = $('#sheetBody');
    body.replaceChildren();
    for (const u of TG.UPGRADES) {
      const btn = el('button', { type: 'button', 'data-id': u.id, onclick: () => buy(u.id) });
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
        btn.replaceChildren(cost === null ? '' : uiIcon('coin'), label);
      }
    }
  }
  function buy(id) {
    if (ui.game.buy(id)) {
      sfx.coin();
      refreshUpgrades();
      drawBoard();
      updateHud();
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
    drawBoard();
    toast(null, '새로 시작', '연필 한 자루부터 다시.');
  }

  /* ---- 판 열고 닫기 ---- */
  const TITLES = { up: '강화', dex: '도감', set: '설정' };
  function openSheet(kind) {
    if (ui.sheet === kind) {
      closeSheet();
      return;
    }
    ui.sheet = kind;
    $('#sheetTitle').textContent = TITLES[kind];
    if (kind === 'up') buildUpgrades();
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
          flash(e.slot, 'pop');
          addBoardFx('craft', e.slot);
          sfx.craft();
          break;
        case 'merge':
          flash(e.slot, 'merge');
          addBoardFx('merge', e.slot);
          sfx.merge(e.tier);
          break;
        case 'new':
          if (e.tier > 1) {
            const it = TG.ITEMS[e.tier - 1];
            toast(e.tier, `새 물건! ${e.tier}단계 ${it.name}`, it.line);
            sfx.discover();
            const slot = game.s.board.indexOf(e.tier);
            if (slot >= 0) addBoardFx('discover', slot);
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
        case 'clear':
          sfx.clear();
          if (e.skipped) toast(null, `등반술! ${e.skipped}스테이지 건너뜀`, `스테이지 ${e.next}로 간다.`);
          break;
        case 'die':
          toast(null, '쓰러졌다', `스테이지 ${e.stage}에서 다시.`);
          break;
        default:
      }
      if (e.type === 'craft' || e.type === 'merge') drawBoard();
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
    TG.render.init($('#battle'));
    buildBoard();
    drawBoard();
    const board = $('#board');
    board.addEventListener('pointerdown', onDown);
    board.addEventListener('pointermove', onMove);
    board.addEventListener('pointerup', onUp);
    board.addEventListener('pointercancel', onUp);
    $('#craft').addEventListener('click', () => {
      if (ui.game.craft() < 0) beep(120, 0.08, 'square', 0.02);
      handleEvents();
      save();
    });
    $('#tabUp').addEventListener('click', () => openSheet('up'));
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
      sizeBoard();
    });
    document.addEventListener('visibilitychange', save);
    setInterval(save, 4000);

    for (const [id, name] of [['goldIcon', 'coin'], ['craftIcon', 'craft'], ['upIcon', 'atk'], ['dexIcon', 'dex'], ['setIcon', 'stage'], ['chipCraftIcon', 'autoCraft'], ['chipMergeIcon', 'autoMerge']]) {
      const slot = document.getElementById(id);
      if (slot) slot.replaceWith(Object.assign(uiIcon(name), { id }));
    }

    let last = performance.now();
    let acc = 0;
    let hudT = 0;
    const STEP = 1 / 60;
    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      acc += dt;
      while (acc >= STEP) {
        ui.game.tick(STEP);
        acc -= STEP;
      }
      handleEvents();
      TG.render.draw(ui.game, dt);
      shineClock += dt;
      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        updateHud();
        drawBoard();
      }
      drawBoardFx(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    g.TG.ui = ui;
  }

  TG.startUI = init;
})(globalThis);
