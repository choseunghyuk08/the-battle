(function (g) {
  const YG = g.YG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  const reduceMotion = () => g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  const play = (name, pitch) => YG.audio && YG.audio.sfx(name, pitch);

  function el(tag, attrs = {}, kids = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of [].concat(kids)) if (kid) node.append(kid);
    return node;
  }

  const app = {
    save: null,
    screen: 'home',
    selected: null,
    chapter: null,
    filter: 'all',
    banner: 'normal',
    pullCount: 11,
    timers: {},
  };
  YG.app = app;

  const persist = () => YG.writeSave(app.save);

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    /* 모달은 맨 위 레이어를 차지해서, 임무 창이 열려 있으면 그 안으로 옮겨야 토스트가 보인다 */
    const host = $('#missionDlg[open]') || document.body;
    if (t.parentNode !== host) host.append(t);
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function renderPurse() {
    const { save } = app;
    for (const box of $$('[data-purse]')) {
      box.replaceChildren(
        el('span', { class: 'pill coin' }, ['동전 ', el('b', { text: fmt(save.coins) })]),
        el('span', { class: 'pill' }, ['경험치 ', el('b', { text: fmt(save.xp) })]),
        el('span', { class: 'pill' }, ['형광펜 ', el('b', { text: fmt(save.pens) })])
      );
    }
  }

  function gradeBadge(grade) {
    return el('span', { class: `badge g${grade}`, text: YG.GRADES[grade].name });
  }

  function traitChip(trait) {
    return el('span', { class: 'chip' }, [YG.icon(trait, 2), YG.TRAITS[trait].name]);
  }

  const screens = {
    home: { enter: enterHome, leave: () => stopLoop('home') },
    stages: { enter: renderStages },
    formation: { enter: renderFormation },
    gacha: { enter: enterGacha, leave: leaveGacha },
    battle: {},
  };

  function show(name) {
    const prev = screens[app.screen];
    if (prev && prev.leave) prev.leave();
    app.screen = name;
    for (const s of $$('.screen')) s.classList.toggle('on', s.id === name);
    renderPurse();
    const next = screens[name];
    if (next && next.enter) next.enter();
    const track = { home: ['title'], stages: ['stages', 'title'], formation: ['formation', 'title'], gacha: ['gacha', 'title'] }[name];
    if (track) YG.audio.music(track);
    g.scrollTo(0, 0);
  }

  function startLoop(key, fn, fps = 30) {
    stopLoop(key);
    let last = 0;
    let frame = 0;
    const tick = (ts) => {
      app.timers[key] = requestAnimationFrame(tick);
      if (ts - last < 1000 / fps) return;
      last = ts;
      fn(frame++);
    };
    app.timers[key] = requestAnimationFrame(tick);
  }

  function stopLoop(key) {
    if (app.timers[key]) cancelAnimationFrame(app.timers[key]);
    app.timers[key] = 0;
  }

  /* 홈 */
  function renderHomeLive() {
    const cleared = Object.keys(app.save.cleared).length;
    $('#homeLive').replaceChildren(
      '동전 ', el('b', { text: fmt(app.save.coins) }),
      ' · 클리어 ', el('b', { text: `${cleared}/${YG.STAGES.length}` }),
      ' · 마지막 접속 ', el('b', { text: YG.ago(app.lastSeen) })
    );
  }

  function enterHome() {
    renderHomeLive();
    refreshBadge();
    const ctx = $('#backdrop').getContext('2d');
    startLoop('home', (f) => YG.render.backdrop(ctx, f), 30);
  }

  /* 임무와 업적 */
  const REWARD_KINDS = [['coins', '동전'], ['xp', '경험치'], ['pens', '형광펜']];
  const rewardText = (r) => REWARD_KINDS.filter(([k]) => r[k] > 0).map(([k, label]) => `${label} +${fmt(r[k])}`).join(' · ');
  const missionUi = { tab: 'daily', opener: null, day: null, timer: 0 };

  function rewardChips(r) {
    return el('span', { class: 'rw' }, REWARD_KINDS.filter(([k]) => r[k] > 0).map(([k, label]) =>
      el('span', { class: `pill${k === 'coins' ? ' coin' : ''}` }, [`${label} `, el('b', { text: `+${fmt(r[k])}` })])
    ));
  }

  function progressBar(value, goal, label) {
    return el('div', {
      class: 'mbar', role: 'progressbar', 'aria-label': label,
      'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': Math.min(value, goal),
    }, [el('i', { style: `width:${Math.min(100, (value / goal) * 100)}%` })]);
  }

  const doneMissionIds = () => YG.dailyStatus(app.save).missions.filter((m) => m.done).map((m) => m.id);

  function refreshBadge() {
    const n = YG.claimableCount(app.save);
    const total = n.daily + n.ach;
    const badge = $('#missionBadge');
    badge.hidden = total === 0;
    badge.textContent = total > 9 ? '9+' : String(total);
    $('#openMissions').setAttribute('aria-label', total ? `임무, 받을 보상 ${total}개` : '임무');
  }

  function claimButton(label, enabled, key, onclick) {
    return el('button', { class: `btn small${enabled ? ' primary' : ''}`, disabled: !enabled, 'data-key': key, text: label, onclick });
  }

  function dailyRow(m) {
    return el('li', { class: `mrow${m.claimed ? ' claimed' : m.done ? ' ready' : ''}` }, [
      el('div', { class: 'mrow-main' }, [
        el('div', { class: 'mrow-head' }, [
          el('b', { class: 'mrow-name', text: m.name }),
          el('span', { class: `mtier ${m.tier}`, text: m.tierName }),
        ]),
        el('div', { class: 'mrow-prog' }, [
          progressBar(m.value, m.goal, m.name),
          el('span', { class: 'mnum', text: `${fmt(m.value)}/${fmt(m.goal)}` }),
        ]),
        rewardChips(m.reward),
      ]),
      claimButton(m.claimed ? '받음' : '받기', m.done && !m.claimed, `m-${m.id}`, () => claimOne(m.id)),
    ]);
  }

  function bonusRow(b) {
    return el('li', { class: `mrow bonus${b.claimed ? ' claimed' : b.ready ? ' ready' : ''}` }, [
      el('div', { class: 'mrow-main' }, [
        el('div', { class: 'mrow-head' }, [
          el('b', { class: 'mrow-name', text: '올 클리어 보너스' }),
          el('span', { class: 'mtier', text: '4개 모두 받으면' }),
        ]),
        el('div', { class: 'mrow-prog' }, [
          progressBar(b.value, b.goal, '올 클리어 보너스'),
          el('span', { class: 'mnum', text: `${b.value}/${b.goal}` }),
        ]),
        rewardChips(b.reward),
      ]),
      claimButton(b.claimed ? '받음' : '받기', b.ready, 'bonus', () => claimOne('bonus')),
    ]);
  }

  function achRow(a) {
    const shown = Math.min(a.done ? a.goal : a.value, a.goal);
    const pips = Array.from({ length: a.tiers }, (_, i) =>
      el('i', { class: `pip${i < a.tier ? ' on' : i < a.tier + a.readyCount ? ' rdy' : ''}` })
    );
    return el('li', { class: `mrow${a.done ? ' claimed' : a.ready ? ' ready' : ''}` }, [
      el('div', { class: 'mrow-main' }, [
        el('div', { class: 'mrow-head' }, [
          el('b', { class: 'mrow-name', text: a.name }),
          el('span', { class: 'pips', role: 'img', 'aria-label': `${a.tiers}단계 중 ${a.tier}단계 받음` }, pips),
        ]),
        el('p', { class: 'mrow-desc', text: a.done ? '모두 달성' : a.desc }),
        el('div', { class: 'mrow-prog' }, [
          progressBar(shown, a.goal, a.name),
          el('span', { class: 'mnum', text: `${fmt(shown)}/${fmt(a.goal)}` }),
        ]),
        a.done ? null : rewardChips(a.reward),
        a.readyCount > 1 ? el('span', { class: 'mrow-note', text: `${a.readyCount}단계를 한꺼번에 받는다` }) : null,
      ]),
      claimButton(a.done ? '완료' : '받기', a.ready, `a-${a.id}`, () => claimOne(a.id)),
    ]);
  }

  const achOrder = (a, b) => (b.ready - a.ready) || (a.done - b.done) || (b.value / b.goal - a.value / a.goal);

  const dailyLeftText = (daily) => `내일 0시에 바뀐다 · ${timeLeft(daily.endsAt - Date.now())}`;

  function renderMissions() {
    const { save } = app;
    const daily = YG.dailyStatus(save);
    const ach = YG.achievementStatus(save).sort(achOrder);
    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    missionUi.day = daily.day;

    const claimable = { daily: daily.claimable, ach: ach.filter((a) => a.ready).length };
    for (const tab of $$('#missionTabs button')) {
      const on = tab.dataset.tab === missionUi.tab;
      const n = tab.querySelector('.tab-n');
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      n.hidden = !claimable[tab.dataset.tab];
      n.textContent = String(claimable[tab.dataset.tab]);
    }
    const body = $('#missionBody');
    body.setAttribute('aria-labelledby', missionUi.tab === 'daily' ? 'tabDaily' : 'tabAch');
    if (missionUi.tab === 'daily') {
      $('#missionSub').textContent = dailyLeftText(daily);
      body.replaceChildren(el('ul', { class: 'mlist' }, [...daily.missions.map(dailyRow), bonusRow(daily.bonus)]));
    } else {
      $('#missionSub').textContent = `달성 ${ach.filter((a) => a.done).length}/${ach.length} · 목표를 넘긴 단계는 한꺼번에 받는다`;
      body.replaceChildren(el('ul', { class: 'mlist' }, ach.map(achRow)));
    }

    const n = claimable[missionUi.tab];
    $('#missionAll').disabled = n === 0;
    $('#missionAll').textContent = n ? `모두 받기 · ${n}` : '모두 받기';
    refreshBadge();

    /* 눌렀던 버튼이 꺼지거나 사라지면 다음 버튼으로 포커스를 옮겨서 키보드 흐름이 끊기지 않게 한다 */
    const dlg = $('#missionDlg');
    if (dlg.open) {
      const cur = document.activeElement;
      const same = focused && $(`#missionBody [data-key="${focused}"]`);
      if (same && !same.disabled) same.focus();
      else if (focused || !dlg.contains(cur) || cur.disabled) {
        const fallback = $('#missionAll').disabled ? $('#missionClose') : $('#missionAll');
        ($('#missionBody .mrow .btn:not(:disabled)') || fallback).focus();
      }
    }
  }

  function openMissions() {
    missionUi.opener = document.activeElement;
    $('#missionNote').textContent = '';
    renderMissions();
    $('#missionDlg').showModal();
    $('#missionBody').scrollTop = 0;
    clearInterval(missionUi.timer);
    missionUi.timer = setInterval(() => {
      if (YG.dayKey(Date.now()) !== missionUi.day) renderMissions();
      else if (missionUi.tab === 'daily') $('#missionSub').textContent = dailyLeftText(YG.dailyStatus(app.save));
    }, 30000);
  }

  function closeMissions() {
    clearInterval(missionUi.timer);
    if (missionUi.opener && missionUi.opener.focus) missionUi.opener.focus();
    refreshBadge();
  }

  function setMissionTab(tab, focus) {
    missionUi.tab = tab;
    $('#missionNote').textContent = '';
    renderMissions();
    $('#missionBody').scrollTop = 0;
    if (focus) $(`#missionTabs [data-tab="${tab}"]`).focus();
  }

  function gotReward(r, count) {
    persist();
    renderPurse();
    renderHomeLive();
    renderMissions();
    const msg = `${count > 1 ? `${count}개 ` : ''}${rewardText(r)} 받았다.`;
    $('#missionNote').textContent = msg;
    toast(msg);
    play('coin');
  }

  function claimOne(id) {
    const r = id === 'bonus' ? YG.claimDailyBonus(app.save)
      : missionUi.tab === 'daily' ? YG.claimMission(app.save, id)
        : YG.claimAchievement(app.save, id);
    if (r) gotReward(r, 1);
  }

  function claimAll() {
    const r = missionUi.tab === 'daily' ? YG.claimAllDaily(app.save) : YG.claimAllAchievements(app.save);
    if (r) gotReward(r, r.count);
  }

  /* 스테이지 */
  function stageCard(st) {
    const open = YG.isUnlocked(app.save, st);
    const done = !!app.save.cleared[st.id];
    const r = done ? st.reward.repeat : st.reward.first;
    const bossRef = (st.bosses && st.bosses[0]) || st.boss;
    const boss = bossRef ? YG.enemyById(bossRef.id) : null;
    return el('article', { class: `stage-card${open ? '' : ' locked'}${boss ? ' boss' : ''}` }, [
      el('div', { class: 'stage-top' }, [
        el('span', { class: 'stage-sub', text: st.sub }),
        el('span', { class: 'stage-tags' }, [
          boss ? el('span', { class: 'tag-boss', text: '보스' }) : null,
          done ? el('span', { class: 'tag-clear', text: '클리어' }) : null,
        ]),
      ]),
      el('h4', { text: st.name }),
      el('p', { class: 'stage-blurb', text: st.blurb }),
      el('div', { class: 'chips' }, YG.stageTraits(st).map(traitChip)),
      el('div', { class: 'stage-meta' }, [
        '적 근원', el('b', { text: fmt(st.enemyBaseHp) }),
        boss ? '보스' : null, boss ? el('b', { text: boss.name }) : null,
        done ? '반복 보상' : '첫 클리어',
        el('b', { text: `동전 ${fmt(r.coins)} · 경험치 ${fmt(r.xp)} · 형광펜 ${r.pens}` }),
      ]),
      el('button', {
        class: 'btn primary', disabled: !open,
        text: open ? '출전' : '앞 스테이지부터',
        onclick: () => startBattle(st.id),
      }),
    ]);
  }

  const chapterUnlocked = (c) => {
    const first = YG.chapterStages(c)[0];
    return !!first && YG.isUnlocked(app.save, first);
  };

  const chapterCleared = (c) => YG.chapterStages(c).filter((s) => app.save.cleared[s.id]).length;

  function currentChapter() {
    const next = YG.STAGES.find((s) => !app.save.cleared[s.id]);
    return next ? next.chapter : YG.CHAPTERS[YG.CHAPTERS.length - 1].id;
  }

  function renderStages() {
    if (!app.chapter) app.chapter = currentChapter();
    const ch = YG.CHAPTERS.find((c) => c.id === app.chapter);
    const list = YG.chapterStages(ch.id);
    $('#chName').textContent = ch.name;
    $('#chProg').textContent = `${chapterCleared(ch.id)}/${list.length} 클리어 · ${ch.blurb}`;
    $('#chPrev').disabled = ch.id <= YG.CHAPTERS[0].id;
    $('#chNext').disabled = ch.id >= YG.CHAPTERS[YG.CHAPTERS.length - 1].id;
    $('#stageList').replaceChildren(el('div', { class: 'stage-grid' }, list.map(stageCard)));
  }

  function openChapterList() {
    const total = YG.CHAPTERS.length;
    const doneChapters = YG.CHAPTERS.filter((c) => chapterCleared(c.id) === YG.chapterStages(c.id).length).length;
    $('#chapterSummary').textContent = `${doneChapters}/${total}장 완료 · 클리어 ${Object.keys(app.save.cleared).length}/${YG.STAGES.length}`;
    $('#chapterGrid').replaceChildren(
      ...YG.CHAPTERS.map((c) => {
        const n = chapterCleared(c.id);
        const size = YG.chapterStages(c.id).length;
        const open = chapterUnlocked(c.id);
        return el('button', {
          class: `chap-btn${open ? '' : ' locked'}${n === size ? ' done' : ''}${c.id === app.chapter ? ' cur' : ''}`,
          onclick: () => {
            app.chapter = c.id;
            $('#chapterDlg').close();
            renderStages();
          },
        }, [
          el('b', { text: c.name.replace(/^\d+장 /, '') }),
          el('span', { text: `${c.id}장 · ${n}/${size}` }),
        ]);
      })
    );
    $('#chapterDlg').showModal();
    const cur = $('#chapterGrid .cur');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  /* 편성 */
  const sortedUnits = () => [...YG.UNITS].sort((a, b) => a.grade - b.grade || b.cost - a.cost);

  function renderFormation() {
    const { save } = app;
    const slots = YG.slotCount(save);
    $('#deckCount').textContent = `${save.deck.length}/${slots}`;

    const cells = [];
    for (let i = 0; i < YG.PROG.maxDeck; i++) {
      const id = save.deck[i];
      if (id) {
        const def = YG.ownedDef(save, id);
        cells.push(
          el('button', {
            class: `deck-slot filled g${def.grade}`, 'aria-label': `${def.name} 빼기`,
            onclick: () => {
              YG.toggleDeck(save, id);
              persist();
              renderFormation();
            },
          }, [YG.sprites.portrait(def, 2), el('small', { text: def.name })])
        );
      } else if (i < slots) {
        cells.push(el('div', { class: 'deck-slot', text: '+' }));
      } else {
        cells.push(el('div', { class: 'deck-slot locked' }, [el('span', { text: '잠김' }), el('small', { text: `${i - 4}번째 클리어` })]));
      }
    }
    $('#deck').replaceChildren(...cells);

    if (!app.selected) app.selected = save.deck[0] || 'basic';
    $$('#rosterFilter button').forEach((btn) => btn.classList.toggle('on', btn.dataset.grade === app.filter));
    const shown = sortedUnits().filter((u) => app.filter === 'all' || String(u.grade) === app.filter);
    $('#rosterCount').textContent = `${shown.filter((u) => save.owned[u.id]).length}/${shown.length}`;
    $('#roster').replaceChildren(
      ...shown.map((base) => {
        const owned = save.owned[base.id];
        const def = owned ? YG.ownedDef(save, base.id) : base;
        return el('button', {
          class: `card-u g${base.grade}${owned ? '' : ' locked'}${app.selected === base.id ? ' sel' : ''}`,
          onclick: () => {
            app.selected = base.id;
            renderFormation();
          },
        }, [
          save.deck.includes(base.id) ? el('span', { class: 'in-deck', text: '출전' }) : null,
          owned && owned.evo ? el('span', { class: `evo-tag${owned.evo > 1 ? ' two' : ''}`, text: owned.evo > 1 ? '각성' : '진화' }) : null,
          YG.sprites.portrait(def, 2),
          el('span', { class: 'name', text: owned ? def.name : '???' }),
          gradeBadge(base.grade),
        ]);
      })
    );
    renderDetail();
  }

  function statRow(label, value) {
    return el('div', {}, [label, el('b', { text: value })]);
  }

  function evoBlock(base, o) {
    const { save } = app;
    if (o.evo >= 2) {
      return el('div', { class: 'evo done' }, [
        el('div', { class: 'evo-head' }, [el('b', { text: '각성 완료' }), el('span', { text: YG.ownedDef(save, base.id).name })]),
      ]);
    }
    const second = o.evo === 1;
    const r = YG.evoReq(base, o.evo);
    const chk = YG.canEvolve(save, base.id);
    const rows = [
      [`Lv ${r.lv} 이상 (지금 ${o.lv})`, o.lv >= r.lv],
      [`형광펜 ${r.pens} (보유 ${save.pens})`, save.pens >= r.pens],
      [`경험치 ${fmt(r.xp)} (보유 ${fmt(save.xp)})`, save.xp >= r.xp],
    ];
    const strong = !second && (base.abilities || []).some((a) => a.type === 'strong');
    const nextName = second ? base.evo.name2 || `각성 ${base.evo.name}` : base.evo.name;
    const label = second ? '각성' : '진화';
    return el('div', { class: 'evo' }, [
      el('div', { class: 'evo-head' }, [
        el('b', { text: `${label} · ${nextName}` }),
        el('span', {
          text: second
            ? '진화 대비 체력 ×1.5 · 공격 ×1.4 · 재소환 ×0.9'
            : `체력 ×1.6 · 공격 ×1.5 · 재소환 ×0.9${strong ? ' · 강하다 → 초데미지' : ''}`,
        }),
      ]),
      el('ul', { class: 'evo-req' }, rows.map(([t, ok]) => el('li', { class: ok ? 'ok' : '', text: t }))),
      el('button', {
        class: 'btn primary', disabled: !chk.ok, text: label,
        onclick: () => {
          YG.evolve(save, base.id);
          play(second ? 'awaken' : 'evolve');
          persist();
          renderPurse();
          renderFormation();
          toast(`${nextName}. ${label}했다.`);
        },
      }),
    ]);
  }

  function renderDetail() {
    const box = $('#detail');
    const base = app.selected && YG.unitById(app.selected);
    if (!base) {
      box.replaceChildren(el('p', { class: 'empty-detail', text: '유닛을 눌러서 보자.' }));
      return;
    }
    const o = app.save.owned[base.id];
    if (!o) {
      box.replaceChildren(
        el('div', { class: 'head' }, [YG.sprites.portrait(base, 3), el('div', {}, [el('h3', { text: '???' }), gradeBadge(base.grade)])]),
        el('p', { class: 'blurb', text: base.limited ? '기간 한정 뽑기에서만 나온다.' : '아직 없다. 문방구에서 뽑자.' })
      );
      return;
    }
    const def = YG.ownedDef(app.save, base.id);
    const st = YG.statsFor(def, o.lv, o.plus);
    const inDeck = app.save.deck.includes(base.id);
    const abil = YG.abilityText(def);
    const lvCost = YG.levelUpCost(o.lv);
    const maxLv = o.lv >= YG.PROG.maxLv;
    const maxPlus = o.plus >= YG.PROG.maxPlus;
    const pCost = YG.plusCost(o.plus);

    box.replaceChildren(
      el('div', { class: 'head' }, [
        YG.sprites.portrait(def, 3),
        el('div', {}, [
          el('h3', { text: def.name }),
          el('div', { class: 'chips' }, [gradeBadge(base.grade), el('span', { class: 'badge', text: def.role })]),
        ]),
      ]),
      el('p', { class: 'blurb', text: def.blurb }),
      el('div', { class: 'stat-grid' }, [
        statRow('레벨', `${o.lv}${o.plus ? ` +${o.plus}` : ''}`),
        statRow('체력', fmt(st.hp)),
        statRow('공격력', fmt(st.atk)),
        statRow('사거리', String(def.range)),
        statRow('공격 주기', `${(def.interval / YG.FPS).toFixed(1)}초`),
        statRow('이동', String(Math.round(def.speed * 100))),
        statRow('비용', fmt(def.cost)),
        statRow('재소환', `${(def.cooldown / YG.FPS).toFixed(1)}초`),
      ]),
      abil.length
        ? el('div', { class: 'abil' }, abil.map((a) => el('div', {}, [a.trait ? YG.icon(a.trait, 2) : null, a.text])))
        : el('p', { class: 'blurb', text: '특성 능력 없음. 무특성 적에게 쓰기 좋다.' }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'row' }, [
          el('button', {
            class: 'btn', disabled: maxLv || app.save.xp < lvCost,
            text: maxLv ? '최대 레벨' : `레벨업 · ${fmt(lvCost)}`,
            onclick: () => {
              YG.levelUp(app.save, base.id);
              play('levelup');
              persist();
              renderPurse();
              renderFormation();
            },
          }),
          el('button', {
            class: 'btn', disabled: maxPlus || o.shards < pCost,
            text: maxPlus ? '최대 강화' : `+강화 · ${o.shards}/${pCost}`,
            onclick: () => {
              YG.enhance(app.save, base.id);
              play('levelup', 1.3);
              persist();
              renderFormation();
            },
          }),
        ]),
        evoBlock(base, o),
        el('button', {
          class: `btn ${inDeck ? '' : 'primary'}`,
          text: inDeck ? '출전에서 빼기' : '출전시키기',
          onclick: () => {
            if (!YG.toggleDeck(app.save, base.id)) {
              play('error');
              toast(`출전은 ${YG.slotCount(app.save)}칸까지. 스테이지를 깨면 칸이 늘어난다.`);
            } else play('equip');
            persist();
            renderFormation();
          },
        }),
      ])
    );
  }

  /* 뽑기 */
  const CAPS = ['#efe9dc', '#f2d450', '#6fb4d9', '#e5654b', '#4aa98a', '#c98bd9'];
  const CAP_POS = [[22, 22], [34, 18], [46, 22], [28, 32], [40, 32], [18, 34], [52, 34], [34, 40], [24, 44], [46, 44]];

  function drawMachine(ctx, f, shake) {
    ctx.clearRect(0, 0, 72, 104);
    const jx = shake ? Math.round(Math.sin(f * 1.9) * 1.5) : 0;
    ctx.save();
    ctx.translate(jx, 0);
    ctx.fillStyle = '#141218';
    ctx.fillRect(6, 52, 60, 48);
    ctx.fillStyle = '#b5483c';
    ctx.fillRect(8, 54, 56, 44);
    ctx.fillStyle = '#8f362d';
    ctx.fillRect(8, 90, 56, 8);
    ctx.fillStyle = '#d65f50';
    ctx.fillRect(8, 54, 56, 3);
    ctx.fillStyle = '#141218';
    ctx.fillRect(14, 64, 20, 6);
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(16, 66, 16, 2);
    ctx.fillStyle = '#141218';
    ctx.fillRect(42, 62, 14, 14);
    ctx.fillStyle = '#f2d450';
    ctx.fillRect(44, 64, 10, 10);
    ctx.fillStyle = '#141218';
    ctx.fillRect(48, 64, 2, 10);
    ctx.fillStyle = '#141218';
    ctx.fillRect(16, 82, 40, 14);
    ctx.fillStyle = '#2a2d38';
    ctx.fillRect(18, 84, 36, 10);

    for (let y = -30; y <= 30; y++) {
      const half = Math.round(Math.sqrt(30 * 30 - y * y));
      ctx.fillStyle = '#141218';
      ctx.fillRect(36 - half - 1, 34 + y, half * 2 + 2, 1);
    }
    for (let y = -29; y <= 29; y++) {
      const half = Math.round(Math.sqrt(29 * 29 - y * y));
      ctx.fillStyle = y < -14 ? '#3a566d' : '#2b4156';
      ctx.fillRect(36 - half, 34 + y, half * 2, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(14, 22, 3, 12);
    ctx.fillRect(18, 15, 8, 3);
    CAP_POS.forEach(([x, y], i) => {
      const bounce = shake ? Math.round(Math.sin(f * 0.9 + i) * 3) : Math.round(Math.sin(f / 14 + i) * 0.8);
      const c = CAPS[i % CAPS.length];
      ctx.fillStyle = '#141218';
      ctx.fillRect(x - 5, y - 5 + bounce, 10, 10);
      ctx.fillStyle = c;
      ctx.fillRect(x - 4, y - 4 + bounce, 8, 4);
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(x - 4, y + bounce, 8, 4);
    });
    ctx.restore();
  }

  let machineShake = 0;

  const currentBanner = () => (app.banner === 'limited' ? YG.banners.limited() : YG.banners.normal);

  function timeLeft(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    return d > 0 ? `${d}일 ${h}시간 남음` : `${h}시간 ${mins % 60}분 남음`;
  }

  function renderGachaMeta() {
    const { save } = app;
    const c = YG.GACHA;
    const banner = currentBanner();
    const limited = banner.id === 'limited';

    $$('#bannerTabs button').forEach((b) => b.classList.toggle('on', b.dataset.banner === app.banner));
    const info = $('#bannerInfo');
    if (limited) {
      const feat = YG.unitById(banner.featured);
      info.hidden = false;
      info.replaceChildren(
        YG.sprites.portrait(feat, 2),
        el('div', {}, [
          el('p', { class: 'eyebrow', text: '이번 주 픽업' }),
          el('p', { class: 'banner-name', text: feat.name }),
          el('p', { class: 'eyebrow', text: timeLeft(banner.endsAt - Date.now()) }),
        ])
      );
    } else {
      info.hidden = true;
      info.replaceChildren();
    }

    const rate = YG.gacha.ultraRate(save.pity);
    $('#pityLine').replaceChildren(
      '1등급 안 나온 지 ', el('b', { text: `${save.pity}회` }),
      ' · 지금 1등급 확률 ', el('b', { text: `${rate.toFixed(1)}%` }),
      ...(limited ? [el('br'), '만점 확정까지 ', el('b', { text: `${save.lpity}/${banner.hardPity}` })] : [])
    );
    $('#cost1').textContent = fmt(c.cost1);
    $('#cost11').textContent = fmt(c.cost11);
    $('#pull1').disabled = save.coins < c.cost1;
    $('#pull11').disabled = save.coins < c.cost11;
    $('#pullHint').textContent =
      save.coins < c.cost1 ? '동전이 모자라다. 스테이지를 돌고 오자.' : '11연차는 마지막 1장이 2등급 이상으로 확정.';

    const r = YG.gacha.rates(save.pity, banner);
    const grades = limited ? [0, 1, 2, 3] : [1, 2, 3];
    const names = (grade) => YG.UNITS.filter((u) => u.grade === grade).map((u) => u.name).join(', ');
    $('#rateTable').replaceChildren(
      ...grades.map((grade) =>
        el('div', { class: 'rate-row' }, [
          el('span', {}, [
            `${YG.GRADES[grade].name} · ${YG.GRADES[grade].label}`,
            el('small', {
              text: grade === 0
                ? `${YG.unitById(banner.featured).name} ${Math.round(c.featuredShare * 100)}% · 나머지 ${Math.round((1 - c.featuredShare) * 100)}%`
                : names(grade),
            }),
          ]),
          el('span', { text: `${r[grade].toFixed(2)}%` }),
        ])
      ),
      el('div', { class: 'rate-row' }, [
        el('span', {}, ['천장', el('small', { text: limited ? `만점은 ${banner.hardPity}회 안에 확정. 1등급 천장은 별도.` : '1등급이 안 나오면 5회마다 확률 +0.5%p, 최대 9.5%' })]),
        el('span', { text: limited ? `${save.lpity}/${banner.hardPity}` : `${save.pity}회` }),
      ])
    );
  }

  function enterGacha() {
    renderGachaMeta();
    const ctx = $('#machine').getContext('2d');
    startLoop('gacha', (f) => {
      drawMachine(ctx, f, machineShake > 0);
      if (machineShake > 0) machineShake--;
    }, 24);
    clearInterval(app.timers.countdown);
    app.timers.countdown = setInterval(renderGachaMeta, 30000);
  }

  function leaveGacha() {
    stopLoop('gacha');
    clearInterval(app.timers.countdown);
  }

  function pull(count) {
    const res = YG.gacha.draw(app.save, count, Math.random, currentBanner());
    if (!res) {
      play('error');
      toast('동전이 모자라다.');
      return;
    }
    app.pullCount = count;
    persist();
    renderPurse();
    renderGachaMeta();
    machineShake = reduceMotion() ? 0 : 18;
    play('gachaShake');
    const delay = reduceMotion() ? 0 : 480;
    setTimeout(() => showPullResult(res), delay);
  }

  function showPullResult(res) {
    const tally = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const r of res) tally[r.grade]++;
    $('#pullTitle').textContent = tally[0] ? '만점이다.' : tally[1] ? '1등급이다.' : '결과.';
    $('#pullSummary').textContent = [0, 1, 2, 3]
      .filter((k) => tally[k])
      .map((k) => `${YG.GRADES[k].name} ${tally[k]}`)
      .join(' · ');
    $('#pullGrid').replaceChildren(
      ...res.map((r, i) => {
        const def = YG.unitById(r.id);
        return el('div', { class: `pull-card g${r.grade}`, style: `--i:${i}` }, [
          YG.sprites.portrait(def, 3),
          el('span', { class: 'name', text: def.name }),
          gradeBadge(r.grade),
          r.isNew ? el('span', { class: 'new', text: '새 얼굴' }) : el('small', { text: '조각 +1' }),
        ]);
      })
    );
    res.forEach((r, i) => {
      setTimeout(() => {
        play(`open${r.grade}`);
        if (r.isNew) setTimeout(() => play('isnew'), 90);
      }, i * 80);
    });
    const again = app.pullCount === 11 ? YG.GACHA.cost11 : YG.GACHA.cost1;
    $('#pullAgain').textContent = app.pullCount === 11 ? '11연차 한 번 더' : '한 번 더';
    $('#pullAgain').disabled = app.save.coins < again;
    const dlg = $('#pullResult');
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    requestAnimationFrame(() => (dlg.scrollTop = 0));
  }

  /* 전투 */
  const battle = {
    b: null,
    stage: null,
    paused: false,
    speed: 1,
    acc: 0,
    last: 0,
    raf: 0,
    ended: false,
    endAt: 0,
    quitting: false,
  };

  function fitField() {
    const field = $('#bField');
    const top = $('.b-top').offsetHeight;
    const cons = $('#bConsole').offsetHeight;
    const availW = document.documentElement.clientWidth;
    const availH = g.innerHeight - top - cons - 4;
    let w = Math.min(availW, Math.max(320, (availH * 16) / 9), 1120);
    if (w >= 640) w = Math.floor(w / 320) * 320;
    field.style.width = `${Math.floor(w)}px`;
    $('#bConsole').style.width = `${Math.max(Math.floor(w), Math.min(availW, 560))}px`;
  }

  function buildSlots() {
    const box = $('#slots');
    const n = battle.b.slots.length;
    const cells = Math.max(5, Math.ceil(n / 5) * 5);
    const scale = cells > 5 ? 2 : 3;
    box.dataset.rows = String(cells / 5);
    const nodes = [];
    for (let i = 0; i < cells; i++) {
      const s = battle.b.slots[i];
      if (!s) {
        nodes.push(el('button', { class: 'slot empty', disabled: true, 'aria-label': '빈 칸' }));
        continue;
      }
      nodes.push(
        el('button', {
          class: `slot g${s.def.grade}`, 'data-i': i, 'aria-label': `${s.def.name} 소환`,
          onpointerdown: (e) => {
            e.preventDefault();
            doSummon(i);
          },
          onclick: (e) => e.detail === 0 && doSummon(i),
        }, [
          el('span', { class: 'key', text: SLOT_KEYS[i] }),
          YG.sprites.portrait(s.def, scale),
          el('b', { class: 'c', text: fmt(s.def.cost) }),
          el('span', { class: 'cd' }),
        ])
      );
    }
    box.replaceChildren(...nodes);
  }

  function startBattle(stageId, tip = true) {
    const stage = YG.STAGES.find((s) => s.id === stageId);
    if (!app.save.deck.length) {
      toast('편성부터 하자.');
      show('formation');
      return;
    }
    battle.stage = stage;
    battle.b = new YG.Battle(stage, YG.buildDeck(app.save));
    battle.paused = false;
    battle.speed = 1;
    battle.acc = 0;
    battle.ended = false;
    battle.endAt = 0;
    battle.quitting = false;
    $('#bSpeed').textContent = '×1';
    $('#bPause').textContent = '멈춤';
    $('#bSub').textContent = stage.sub;
    $('#bName').textContent = stage.name;
    $('#hpEnemyName').textContent = '근원';
    show('battle');
    buildSlots();
    fitField();
    g.requestAnimationFrame(fitField);
    battle.last = performance.now();
    cancelAnimationFrame(battle.raf);
    battle.raf = requestAnimationFrame(battleTick);
    YG.audio.battleMusic(stage);
    if (tip && !app.save.seenTip) {
      app.save.seenTip = true;
      persist();
      toast('칸을 눌러 소환. 대포는 충전되면 발사.');
    }
  }

  function doSummon(i) {
    if (battle.paused || !battle.b) return;
    if (!battle.b.summon(i)) {
      const s = battle.b.slots[i];
      if (s && s.cd <= 0 && battle.b.money < s.def.cost) {
        play('error');
        toast('용돈이 모자라다.');
      }
    }
  }

  function doUpgrade() {
    if (battle.paused || !battle.b) return;
    battle.b.upgradeWorker();
  }

  function doCannon() {
    if (battle.paused || !battle.b) return;
    battle.b.fireCannon();
  }

  function battleTick(ts) {
    battle.raf = requestAnimationFrame(battleTick);
    const b = battle.b;
    if (!b) return;
    const dt = Math.min(100, ts - battle.last);
    battle.last = ts;
    if (!battle.paused) {
      battle.acc += dt * battle.speed;
      let n = 0;
      const stepMs = 1000 / YG.FPS;
      while (battle.acc >= stepMs && n < 8) {
        b.step();
        battle.acc -= stepMs;
        n++;
        if (b.result && !battle.ended) {
          battle.ended = true;
          battle.endAt = b.frame + 45;
        }
      }
      if (battle.ended && b.frame >= battle.endAt && !$('#battleEnd').open) finishBattle();
    }
    const events = b.drainEvents();
    if (events.length) {
      YG.audio.battleEvents(events);
      if (events.some((e) => e.t === 'boss')) YG.audio.battleMusic(battle.stage, true);
    }
    YG.render.battle($('#field').getContext('2d'), b, battle.stage.theme);
    updateHud(b);
  }

  function updateHud(b) {
    $('#money').textContent = fmt(b.money);
    $('#moneyMax').textContent = `/ ${fmt(b.worker.max)}`;
    const up = $('#upBtn');
    const maxed = b.worker.up === 0;
    $('#upLv').textContent = maxed ? 'Lv 최대' : `Lv${b.workerLv} → ${b.workerLv + 1}`;
    $('#upCost').textContent = maxed ? '' : fmt(b.worker.up);
    up.disabled = maxed;
    up.classList.toggle('poor', !maxed && b.money < b.worker.up);

    $$('.slot[data-i]').forEach((node) => {
      const s = b.slots[+node.dataset.i];
      node.querySelector('.cd').style.transform = `scaleY(${Math.max(0, s.cd / s.def.cooldown)})`;
      node.classList.toggle('poor', s.cd <= 0 && b.money < s.def.cost);
      node.classList.toggle('ready', b.canSummon(+node.dataset.i));
    });

    const cn = $('#cannonBtn');
    if (b.cannonReady && !cn.classList.contains('ready')) play('cannonReady');
    $('#cannonFill').style.transform = `scaleX(${Math.min(1, b.cannon.charge / b.cannon.max)})`;
    cn.classList.toggle('ready', b.cannonReady);

    $('#hpAlly').style.transform = `scaleX(${b.baseHp.ally / b.baseMax.ally})`;
    $('#hpEnemy').style.transform = `scaleX(${b.baseHp.enemy / b.baseMax.enemy})`;
    $('#hpAllyNum').textContent = fmt(b.baseHp.ally);
    $('#hpEnemyNum').textContent = fmt(b.baseHp.enemy);

    const sec = Math.floor(b.seconds);
    $('#bTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  function finishBattle() {
    const b = battle.b;
    const win = b.result === 'win';
    const box = $('#endReward');
    $('#endTitle').textContent = win ? '승리.' : '패배.';
    $('#endSub').textContent = win ? `${battle.stage.sub} ${battle.stage.name}` : '교실이 무너졌다.';
    const doneBefore = doneMissionIds();
    const summary = el('p', { text: `소환 ${b.stats.summoned} · 처치 ${b.stats.kills} · ${$('#bTime').textContent}` });
    if (win) {
      const wasCleared = !!app.save.cleared[battle.stage.id];
      const slotsBefore = YG.slotCount(app.save);
      const r = YG.applyReward(app.save, battle.stage);
      YG.trackBattle(app.save, b);
      persist();
      const slotsAfter = YG.slotCount(app.save);
      const next = YG.STAGES.find((s) => s.id === battle.stage.id + 1);
      if (next && next.chapter !== battle.stage.chapter) app.chapter = next.chapter;
      box.replaceChildren(...[
        el('p', {}, [r.first ? '첫 클리어 · ' : '반복 · ', '동전 ', el('b', { text: `+${fmt(r.coins)}` })]),
        el('p', {}, ['경험치 ', el('b', { text: `+${fmt(r.xp)}` }), ' · 형광펜 ', el('b', { text: `+${r.pens}` })]),
        summary,
        r.unit
          ? el('p', { class: 'unlock' }, [YG.sprites.portrait(YG.unitById(r.unit), 2), el('span', { text: `새 동료 · ${YG.unitById(r.unit).name}` })])
          : null,
        slotsAfter > slotsBefore ? el('p', { text: `출전 칸 ${slotsAfter}칸으로 늘었다.` }) : null,
        !wasCleared && next ? el('p', { text: `${next.sub} ${next.name} 열림.` }) : null,
      ].filter(Boolean));
    } else {
      YG.trackBattle(app.save, b);
      persist();
      box.replaceChildren(summary, el('p', { text: '편성을 바꾸거나 일꾼을 먼저 올려보자.' }));
    }
    const names = YG.dailyStatus(app.save).missions.filter((m) => m.done && !doneBefore.includes(m.id)).map((m) => m.name);
    if (names.length) box.append(el('p', { class: 'mission-hint', text: `임무 달성: ${names.join(', ')}` }));
    refreshBadge();
    $('#endRetry').textContent = win ? '한 번 더' : '다시';
    play(win ? 'win' : 'lose');
    YG.audio.music([win ? 'victory' : 'defeat'], { loop: false, ms: 300 });
    $('#battleEnd').showModal();
  }

  function leaveBattle(to) {
    cancelAnimationFrame(battle.raf);
    battle.b = null;
    show(to);
  }

  function togglePause(force) {
    if (!battle.b || battle.ended) return;
    battle.paused = force === undefined ? !battle.paused : force;
    $('#bPause').textContent = battle.paused ? '계속' : '멈춤';
    if (battle.paused && !$('#pauseDlg').open) $('#pauseDlg').showModal();
    if (!battle.paused && $('#pauseDlg').open) $('#pauseDlg').close();
    battle.last = performance.now();
  }

  /* 디버그 */
  function debugAction(kind) {
    const s = app.save;
    if (kind === 'coins') s.coins += 10000;
    if (kind === 'xp') s.xp += 1000;
    if (kind === 'pens') s.pens += 20;
    if (kind === 'shards') for (const k of Object.keys(s.owned)) s.owned[k].shards += 10;
    if (kind === 'all') for (const u of YG.UNITS) s.owned[u.id] = s.owned[u.id] || { lv: 1, plus: 0, shards: 0, evo: 0 };
    if (kind === 'pity') {
      s.pity = 0;
      s.lpity = 0;
    }
    if (kind === 'clear') for (const st of YG.STAGES) s.cleared[st.id] = true;
    if (kind === 'missionDone') for (const m of YG.dailyStatus(s).missions) s.daily.progress[m.id] = m.goal;
    if (kind === 'missionReset') {
      const fresh = YG.newSave();
      Object.assign(s, { stats: fresh.stats, daily: fresh.daily, ach: fresh.ach });
    }
    if (kind === 'reset') {
      app.save = YG.newSave();
      app.selected = null;
    }
    persist();
    renderPurse();
    toast('적용했다.');
    const cur = screens[app.screen];
    if (cur && cur.enter) cur.enter();
  }

  function renderSettings() {
    const st = YG.audio.settings;
    for (const kind of ['master', 'sfx', 'bgm']) {
      const input = $(`#vol-${kind}`);
      input.value = Math.round(st[kind] * 100);
      input.nextElementSibling.textContent = `${input.value}`;
    }
    $('#vol-mute').checked = st.muted;
    $('#bgmHint').textContent = `배경음 파일은 ${YG.audio.BGM_DIR} 폴더에 넣으면 된다.`;
  }

  /* 연결 */
  function init() {
    app.save = YG.loadSave();
    app.lastSeen = app.save.lastPlayed;
    const bonus = YG.claimDaily(app.save);
    app.save.lastPlayed = Date.now();
    persist();

    for (const btn of $$('[data-go]')) btn.addEventListener('click', () => show(btn.dataset.go));
    $('#chPrev').addEventListener('click', () => {
      app.chapter = Math.max(YG.CHAPTERS[0].id, app.chapter - 1);
      renderStages();
    });
    $('#chNext').addEventListener('click', () => {
      app.chapter = Math.min(YG.CHAPTERS[YG.CHAPTERS.length - 1].id, app.chapter + 1);
      renderStages();
    });
    $('#chTitle').addEventListener('click', openChapterList);
    $('#chapterClose').addEventListener('click', () => $('#chapterDlg').close());
    for (const btn of $$('#rosterFilter button')) {
      btn.addEventListener('click', () => {
        app.filter = btn.dataset.grade;
        renderFormation();
      });
    }
    for (const tab of $$('#bannerTabs button')) {
      tab.addEventListener('click', () => {
        app.banner = tab.dataset.banner;
        renderGachaMeta();
      });
    }
    $('#pull1').addEventListener('click', () => pull(1));
    $('#pull11').addEventListener('click', () => pull(11));
    $('#pullClose').addEventListener('click', () => $('#pullResult').close());
    $('#pullAgain').addEventListener('click', () => {
      $('#pullResult').close();
      pull(app.pullCount);
    });

    $('#upBtn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      doUpgrade();
    });
    $('#upBtn').addEventListener('click', (e) => e.detail === 0 && doUpgrade());
    $('#cannonBtn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      doCannon();
    });
    $('#cannonBtn').addEventListener('click', (e) => e.detail === 0 && doCannon());
    $('#bPause').addEventListener('click', () => togglePause());
    $('#bMute').addEventListener('click', () => {
      const muted = YG.audio.toggleMute();
      $('#bMute').textContent = muted ? '소리 꺼짐' : '소리';
      renderSettings();
    });
    $('#bSpeed').addEventListener('click', () => {
      battle.speed = battle.speed === 1 ? 2 : 1;
      $('#bSpeed').textContent = `×${battle.speed}`;
    });
    $('#pauseResume').addEventListener('click', () => togglePause(false));
    $('#pauseDlg').addEventListener('close', () => {
      if (!battle.quitting && battle.paused) togglePause(false);
    });
    $('#pauseQuit').addEventListener('click', () => {
      battle.quitting = true;
      $('#pauseDlg').close();
      leaveBattle('stages');
    });
    $('#endExit').addEventListener('click', () => {
      $('#battleEnd').close();
      leaveBattle('stages');
    });
    $('#endRetry').addEventListener('click', () => {
      $('#battleEnd').close();
      startBattle(battle.stage.id, false);
    });
    $('#battleEnd').addEventListener('cancel', (e) => e.preventDefault());

    let taps = 0;
    $('#title').addEventListener('click', () => {
      taps++;
      clearTimeout(init.tapTimer);
      init.tapTimer = setTimeout(() => (taps = 0), 1200);
      if (taps >= 5) {
        taps = 0;
        $('#debugDlg').showModal();
      }
    });
    $('#debugClose').addEventListener('click', () => $('#debugDlg').close());
    for (const b of $$('[data-dbg]')) b.addEventListener('click', () => debugAction(b.dataset.dbg));
    if (/[?&]debug\b/.test(g.location.search)) $('#debugDlg').showModal();

    document.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('dialog[open]') && app.screen !== 'battle') return;
      if (e.key === 'F2' || (e.key === '`' && !e.repeat)) {
        $('#debugDlg').open ? $('#debugDlg').close() : $('#debugDlg').showModal();
        return;
      }
      if (app.screen !== 'battle' || !battle.b) return;
      const slot = SLOT_KEYS.indexOf(e.key);
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (!battle.ended) {
          e.preventDefault();
          togglePause();
        }
      } else if (slot >= 0) doSummon(slot);
      else if (e.key === 'q' || e.key === 'Q') doUpgrade();
      else if (e.key === ' ') {
        e.preventDefault();
        doCannon();
      }
    });
    g.addEventListener('resize', () => {
      if (app.screen === 'battle') fitField();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && app.screen === 'battle' && !battle.ended) togglePause(true);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('button');
      if (!btn || btn.disabled || btn.closest('#slots') || btn.id === 'upBtn' || btn.id === 'cannonBtn') return;
      if (btn.dataset.go === 'home' || btn.id === 'pullClose' || btn.id === 'chapterClose' || btn.id === 'missionClose') play('back');
      else play('click');
    });
    $('#openMissions').addEventListener('click', openMissions);
    $('#missionClose').addEventListener('click', () => $('#missionDlg').close());
    $('#missionDlg').addEventListener('close', closeMissions);
    $('#missionAll').addEventListener('click', claimAll);
    for (const tab of $$('#missionTabs button')) {
      tab.addEventListener('click', () => setMissionTab(tab.dataset.tab, false));
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        setMissionTab(missionUi.tab === 'daily' ? 'ach' : 'daily', true);
      });
    }
    $('#openSettings').addEventListener('click', () => {
      renderSettings();
      $('#settingsDlg').showModal();
    });
    $('#settingsClose').addEventListener('click', () => $('#settingsDlg').close());
    for (const kind of ['master', 'sfx', 'bgm']) {
      const input = $(`#vol-${kind}`);
      input.addEventListener('input', () => {
        YG.audio.set(kind, input.value / 100);
        input.nextElementSibling.textContent = `${input.value}`;
      });
      input.addEventListener('change', () => {
        YG.audio.save();
        if (kind !== 'bgm') play('hit');
      });
    }
    $('#vol-mute').addEventListener('change', (e) => {
      YG.audio.set('muted', e.target.checked);
      YG.audio.save();
      $('#bMute').textContent = e.target.checked ? '소리 꺼짐' : '소리';
    });

    show('home');
    if (bonus) {
      toast('출석 동전 +300.');
      play('coin');
    }
  }

  YG.ui = { init, show, toast, battle };
})(globalThis);
