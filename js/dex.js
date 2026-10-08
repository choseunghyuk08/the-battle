(function (g) {
  const YG = (g.YG = g.YG || {});
  const { VIEW, FPS } = YG;
  const GY = VIEW.groundY;

  const DEFAULT_REGION = '국내';
  const FALLBACK_PLACE = 'corridor:ash';
  const INTROS = ['rise', 'slide', 'fade', 'drop', 'peek'];
  /* render.js 안에 있는 기본 배경. 나머지 배경은 YG.scenery 에 있다. */
  const CORE_SCENES = ['corridor', 'lab', 'basement', 'bathroom', 'cafeteria', 'music', 'roof'];

  const baseIdOf = (id) => String(id).split(':')[0];
  const isText = (s) => typeof s === 'string' && s.trim().length > 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - (1 - t) * (1 - t);
  const hash = (n) => {
    let x = Math.imul(n + 1, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    return (Math.imul(x, 0x85ebca6b) >>> 0) / 4294967296;
  };

  const placeOk = (place) => {
    if (!isText(place)) return false;
    const [scene, pal] = place.split(':');
    const sceneOk = CORE_SCENES.includes(scene) || !!(YG.scenery && YG.scenery[scene]);
    return sceneOk && (!pal || !!(YG.PALETTES && YG.PALETTES[pal]));
  };

  const hasBatchim = (s) => {
    const c = s.charCodeAt(s.length - 1) - 0xac00;
    return c >= 0 && c <= 11171 && c % 28 !== 0;
  };

  /* 이야기가 없는 적도 도감이 깨지지 않게 흔한 문장으로 채운다 */
  function loreFor(def) {
    const raw = (YG.LORE && YG.LORE[baseIdOf(def.id)]) || null;
    const name = def.name || def.id;
    const beats = raw && Array.isArray(raw.beats) && raw.beats.length === 3 && raw.beats.every(isText)
      ? raw.beats.slice()
      : ['불 꺼진 학교. 학생 하나가 혼자 남았다.', `${name}${hasBatchim(name) ? '이' : '가'} 어둠 속에서 모습을 드러낸다.`, '학생이 정신을 차리기 전에 공격이 들어온다.'];
    return {
      place: raw && placeOk(raw.place) ? raw.place : FALLBACK_PLACE,
      intro: raw && INTROS.includes(raw.intro) ? raw.intro : def.boss ? 'rise' : 'slide',
      beats,
      desc: raw && isText(raw.desc) ? raw.desc : `${name}. 아직 알려진 이야기가 없다. 만나 본 사람만 안다.`,
      custom: !!raw,
    };
  }

  /* 도감 순서: 잡몹이 먼저, 보스가 뒤. 같은 무리 안에서는 정의된 순서 그대로. */
  function entries() {
    return YG.ENEMIES.map((def, i) => ({ def, i }))
      .filter(({ def }) => def && def.id)
      .sort((a, b) => (a.def.boss ? 1 : 0) - (b.def.boss ? 1 : 0) || a.i - b.i)
      .map(({ def }) => ({
        id: def.id,
        def,
        lore: loreFor(def),
        region: def.region || DEFAULT_REGION,
        boss: !!def.boss,
        trait: def.trait || 'none',
      }));
  }

  /* 도감에 나올 수 있는 색 변종 키. 보스는 변종 보스로만 나온다. */
  const variantKeys = (entry) =>
    entry.boss ? (YG.BOSS_VARIANTS || []).filter(Boolean) : Object.keys(YG.VARIANTS || {});

  const flagged = (save) => {
    const s = (save && save.seen) || {};
    return Object.keys(s).filter((k) => s[k]);
  };

  /* 세이브에 만난 적 id 를 적는다. 이번에 새로 적힌 id(기본/변종 모두)를 돌려준다. */
  YG.markSeen = (save, ids) => {
    if (!save.seen || typeof save.seen !== 'object') save.seen = {};
    const fresh = [];
    for (const id of ids || []) {
      if (typeof id !== 'string' || !id || save.seen[id]) continue;
      save.seen[id] = true;
      fresh.push(id);
    }
    return fresh;
  };

  const isSeen = (save, baseId) => flagged(save).some((k) => k === baseId || k.startsWith(`${baseId}:`));

  const variantsSeen = (save, baseId) => {
    const s = (save && save.seen) || {};
    const keys = Object.keys(YG.VARIANTS || {}).filter((v) => s[`${baseId}:${v}`]);
    return keys;
  };

  function counts(save) {
    const bases = new Set(flagged(save).map(baseIdOf));
    const list = entries();
    const part = (rows) => ({ seen: rows.filter((e) => bases.has(e.id)).length, total: rows.length });
    const ids = new Set(list.map((e) => e.id));
    const variants = flagged(save).filter((k) => k.includes(':') && ids.has(baseIdOf(k))).length;
    return { ...part(list), mobs: part(list.filter((e) => !e.boss)), bosses: part(list.filter((e) => e.boss)), variants };
  }

  /* 디버그용: 전부 만난 것으로 */
  function unlockAll(save) {
    const ids = [];
    for (const e of entries()) ids.push(e.id, ...variantKeys(e).map((v) => `${e.id}:${v}`));
    return YG.markSeen(save, ids);
  }

  /* 처음 나오는 스테이지. 못 만난 적의 단서로 보여 준다. */
  let firstCache = null;
  let firstCacheLen = -1;
  function firstStage(baseId) {
    if (!firstCache || firstCacheLen !== YG.STAGES.length) {
      firstCache = {};
      firstCacheLen = YG.STAGES.length;
      for (const st of YG.STAGES) {
        const ids = st.waves.map((w) => w.id);
        for (const b of st.bosses || (st.boss ? [st.boss] : [])) ids.push(b.id);
        for (const id of ids) if (!firstCache[baseIdOf(id)]) firstCache[baseIdOf(id)] = st;
      }
    }
    return firstCache[baseId] || null;
  }

  /* 상세 창의 기본 정보 (배율 ×1) */
  const speedWord = (v) => (v < 0.25 ? '매우 느림' : v < 0.36 ? '느림' : v < 0.5 ? '보통' : v < 0.7 ? '빠름' : '매우 빠름');

  function statRows(def) {
    return [
      { key: 'hp', label: '체력', value: String(def.hp) },
      { key: 'atk', label: '공격력', value: String(def.atk) },
      { key: 'interval', label: '공격 주기', value: `${(def.interval / FPS).toFixed(1)}초` },
      { key: 'range', label: '사거리', value: String(def.range) },
      { key: 'speed', label: '이동 속도', value: `${speedWord(def.speed)} (${def.speed})` },
      { key: 'kb', label: '넉백', value: `${def.kb}회` },
      { key: 'trait', label: '특성', value: (YG.TRAITS[def.trait] || YG.TRAITS.none).name, trait: def.trait || 'none' },
      { key: 'drop', label: '처치 시 용돈', value: String(def.drop) },
    ];
  }

  const tags = (def) => [def.area ? '범위 공격' : null, def.ranged ? '원거리' : null, def.float ? '공중' : null].filter(Boolean);

  /* 연출 대본. 프레임 번호만 넣으면 그 순간의 배우/효과가 나오는 순수 함수라서 그리기와 따로 검사할 수 있다.
     1막: 학생이 걸어 들어온다 / 2막: 적이 등장한다 / 3막: 다가와서 공격한다 / 이어서 공격 모션 반복 */
  const SX = 86; /* 학생이 서 있는 자리 */
  const SX_ARRIVE = 92;
  const XIN = 236; /* 등장을 마친 적의 자리 */
  const LOOP_X = 196;
  const XF = 14; /* 연출에서 반복으로 넘어가는 교차 프레임 */

  function script(entry) {
    const def = entry.def;
    const lore = entry.lore;
    const scale = def.scale || 1;
    const boss = !!def.boss;
    const speed = clamp(def.speed || 0.4, 0.15, 0.9);
    const range = def.range || 14;
    const atk = def.anim || { hit: 10, total: 20 };
    const student = YG.unitById('basic');
    const wp = clamp(Math.round(0.5 / speed), 2, 5); /* 걷기 자세 하나가 머무는 프레임 */
    const flight = def.ranged ? 12 : 0;

    const dist = clamp(Math.round(range + (scale - 1) * 8), 18, 64);
    const xAtk = SX + dist;
    const WALK0 = 4;
    const ARRIVE = 87;
    const T2 = 100;
    const T3 = 200;
    const startle = T2 + 14;
    const approach = 34 + Math.round((0.9 - speed) * 40);
    const swing = T3 + approach + 6;
    const hitF = swing + atk.hit;
    const impactF = hitF + flight;
    const END = Math.max(swing + atk.total, impactF) + 24;
    const FALL = 26;
    const peekX = VIEW.w + 2 * scale;
    const slideLen = 50 + Math.round((0.9 - speed) * 60);

    const idle = (f, seed = 0) => `idle${(Math.floor(f / 7) + seed) % 4}`;
    const walk = (n) => `walk${Math.floor(n / wp) % 6}`;
    const atkKey = (t) => YG.frameKey({ state: 'atk', t, def });

    function studentAt(f) {
      let x = SX_ARRIVE;
      let key = idle(f);
      let yOff = 0;
      let mode = 'base';
      if (f < ARRIVE) {
        x = lerp(-16, SX_ARRIVE, clamp((f - WALK0) / (ARRIVE - WALK0), 0, 1));
        if (f >= WALK0) key = `walk${Math.floor((f - WALK0) / 2.4) % 6}`;
      }
      const s = f - startle;
      if (s >= 0) {
        x -= (SX_ARRIVE - SX) * ease(clamp(s / 10, 0, 1));
        if (s < 22) yOff = -Math.round(6 * Math.abs(Math.sin((Math.PI * s) / 11)));
      }
      const h = f - impactF;
      if (h >= 0) {
        x -= 12 * ease(clamp(h / 10, 0, 1));
        if (h < 14) key = 'hurt0';
        if (h < 4) mode = 'flash';
      }
      return { id: 'student', def: student, x, z: 3, dir: 1, key, mode, alpha: 1, yOff, sx: 1, sy: 1, clipY: null, shadow: 1 };
    }

    function enemyAt(f) {
      if (f < T2) return null;
      const a = { id: 'enemy', def, x: XIN, z: 3, dir: -1, key: idle(f, 1), mode: 'base', alpha: 1, yOff: 0, sx: 1, sy: 1, clipY: null, shadow: 1 };
      if (f >= T3) {
        const n = f - T3;
        const t = f - swing;
        if (n < approach) {
          a.x = lerp(XIN, xAtk, n / approach);
          a.key = walk(n);
        } else {
          a.x = xAtk;
          if (t >= 0 && t < atk.total) a.key = atkKey(t);
        }
        return a;
      }
      const u = f - T2;
      if (lore.intro === 'slide') {
        if (u < slideLen) {
          a.x = lerp(VIEW.w + 60, XIN, u / slideLen);
          a.key = walk(u);
        }
      } else if (lore.intro === 'rise') {
        const p = ease(clamp(u / 56, 0, 1));
        a.yOff = (1 - p) * (36 * scale + 6);
        a.shadow = p;
        if (p < 1) a.clipY = GY + a.z;
      } else if (lore.intro === 'fade') {
        a.alpha = clamp(u / 56, 0, 1);
        if (u < 34 && hash(u + 7) < 0.3) a.alpha *= 0.3;
        a.shadow = a.alpha;
        a.yOff = Math.round(Math.sin(u / 5) * 2);
      } else if (lore.intro === 'drop') {
        if (u < FALL) {
          a.yOff = -Math.round(210 * (1 - (u / FALL) ** 2));
          a.shadow = u / FALL;
        } else if (u - FALL < 8) {
          a.sy = 0.84 + 0.16 * ((u - FALL) / 8);
          a.sx = 1 + (1 - a.sy) * 0.6;
        }
      } else if (lore.intro === 'peek') {
        if (u < 36) {
          a.x = peekX;
        } else {
          const q = clamp((u - 36) / 56, 0, 1);
          a.x = lerp(peekX, XIN, ease(q));
          if (q < 1) a.key = walk(u - 36);
        }
      }
      return a;
    }

    function fxAt(f) {
      const fx = [];
      const gy = GY + 3;
      const u = f - T2;
      if (f >= startle && f < startle + 26) fx.push({ kind: 'bang', x: studentAt(f).x, y: gy - 44 });
      if (lore.intro === 'rise' && u >= 0 && u < 70) {
        for (let k = 0; k < 10; k++) {
          const s = T2 + k * 5;
          if (f >= s && f < s + 18) fx.push({ kind: 'puff', x: XIN + (hash(k) - 0.5) * 16 * scale, y: gy, p: (f - s) / 18, seed: k, size: scale });
        }
      }
      if (lore.intro === 'drop' && u >= FALL && u < FALL + 20) {
        for (let k = 0; k < 8; k++) fx.push({ kind: 'puff', x: XIN + (k - 3.5) * 5 * scale, y: gy, p: (u - FALL) / 20, seed: k, size: scale });
      }
      if (f >= hitF && f < hitF + flight) {
        fx.push({ kind: 'proj', sub: def.ranged, x0: xAtk - 8, x1: SX + 4, y: gy - 16, p: (f - hitF) / flight, dir: -1 });
      }
      if (def.area && f >= hitF && f < hitF + 10) fx.push({ kind: 'ring', x: xAtk, y: gy, r: dist + 10, p: (f - hitF) / 10 });
      if (f >= impactF && f < impactF + 7) {
        fx.push({ kind: 'slash', x: SX, y: gy - 14, dir: -1, p: (f - impactF) / 7 });
        fx.push({ kind: 'spark', x: SX + 2, y: gy - 12, p: (f - impactF) / 6 });
      }
      return fx;
    }

    function shakeAt(f) {
      if (!boss) return [0, 0];
      let amp = 0;
      const u = f - T2;
      if (lore.intro === 'drop' && u >= FALL && u < FALL + 12) amp = 4 * (1 - (u - FALL) / 12);
      else if (lore.intro === 'rise' && u >= 0 && u < 50) amp = 1.5;
      else if (f >= impactF && f < impactF + 10) amp = 3 * (1 - (f - impactF) / 10);
      if (!amp) return [0, 0];
      return [Math.round(amp * (f % 2 ? 1 : -1)), Math.round(amp * 0.5 * ((f >> 1) % 2 ? 1 : -1))];
    }

    function state(f) {
      const actors = [studentAt(f), enemyAt(f)].filter(Boolean);
      return { f, actors, fx: fxAt(f), shake: shakeAt(f), fade: f < 20 ? 1 - f / 20 : 0 };
    }

    /* 공격 모션 반복. 전투와 같은 주기로 휘두르고, 사거리를 바닥에 표시한다. */
    const period = Math.max(def.interval || 60, atk.total + 16);
    const loopP = (g0) => (((g0 - XF) % period) + period) % period;
    function loop(g0) {
      const p = loopP(g0);
      const gy = GY + 3;
      const a = { id: 'enemy', def, x: LOOP_X, z: 3, dir: -1, key: p < atk.total ? atkKey(p) : idle(g0, 1), mode: 'base', alpha: 1, yOff: 0, sx: 1, sy: 1, clipY: null, shadow: 1 };
      const fx = [{ kind: 'range', x: LOOP_X, y: gy + 2, w: range }];
      const reach = LOOP_X - Math.min(range, 40);
      if (def.ranged && p >= atk.hit && p < atk.hit + flight) {
        fx.push({ kind: 'proj', sub: def.ranged, x0: LOOP_X - 8, x1: LOOP_X - range, y: gy - 16, p: (p - atk.hit) / flight, dir: -1 });
      }
      const land = atk.hit + flight;
      if (p >= land && p < land + 7) {
        if (!def.ranged) fx.push({ kind: 'slash', x: reach, y: gy - 14, dir: -1, p: (p - land) / 7 });
        fx.push({ kind: 'spark', x: def.ranged ? LOOP_X - range : reach, y: gy - 12, p: (p - land) / 6 });
      }
      if (def.area && p >= atk.hit && p < atk.hit + 10) fx.push({ kind: 'ring', x: LOOP_X, y: gy, r: range + 10, p: (p - atk.hit) / 10 });
      return { f: g0, actors: [a], fx, shake: [0, 0], fade: 0 };
    }

    /* 그 프레임에 나는 소리 */
    function sfxAt(f) {
      const out = [];
      if (boss && f === T2 + 2) out.push(['boss', 1]);
      if (f === hitF && f < END) out.push([def.ranged ? 'atkRanged' : 'atkMelee', 0.8]);
      if (f === impactF && f < END) out.push([boss ? 'hitBig' : 'hit', 1]);
      if (f >= END && loopP(f - END) === atk.hit) out.push([def.ranged ? 'atkRanged' : 'atkMelee', 0.8]);
      return out;
    }

    /* 자막: 막마다 한 줄씩 타자 치듯 나온다 */
    const starts = [4, T2 + 4, T3 + 4];
    function captionAt(f) {
      const beat = f >= starts[2] ? 2 : f >= starts[1] ? 1 : 0;
      const n = clamp(Math.floor((f - starts[beat]) / 1.5), 0, lore.beats[beat].length);
      return { beat, text: lore.beats[beat].slice(0, n) };
    }

    const phaseAt = (f) => (f < T2 ? 0 : f < T3 ? 1 : f < END ? 2 : 'loop');

    return {
      T2, T3, END, XF, period, hit: atk.hit,
      /* 한 번 재생하는 길이(프레임). 반복은 여기서부터 이어진다. */
      total: END + XF,
      state, loop, sfxAt, captionAt, phaseAt,
      /* 움직임을 줄이는 설정일 때 보여 줄 정지 장면: 공격이 맞는 순간 */
      still: () => loop(XF + atk.hit + flight + 2),
    };
  }

  /* 그리기 */
  const BG = { frame: 0, baseFlash: { ally: 0, enemy: 0 }, units: [], fx: [] };

  function drawBackdrop(ctx, theme, frame) {
    ctx.imageSmoothingEnabled = false;
    BG.frame = frame;
    YG.render.battle(ctx, BG, theme);
    /* 전투 화면의 양쪽 근원(아군/적 본진)은 지우고, 안쪽 한 줄을 바깥으로 늘여 메운다 */
    const c = ctx.canvas;
    ctx.drawImage(c, 31, 0, 1, GY, 0, 0, 31, GY);
    ctx.drawImage(c, 282, 0, 1, GY, 283, 0, VIEW.w - 283, GY);
  }

  function drawEdges(ctx) {
    ctx.fillStyle = '#05070a';
    [0.5, 0.32, 0.18, 0.08].forEach((a, i) => {
      ctx.globalAlpha = a;
      ctx.fillRect(i * 8, 0, 8, VIEW.h);
      ctx.fillRect(VIEW.w - i * 8 - 8, 0, 8, VIEW.h);
      ctx.fillRect(0, i * 5, VIEW.w, 5);
    });
    ctx.globalAlpha = 1;
  }

  function drawActor(ctx, a) {
    const S = YG.sprites;
    const scale = a.def.scale || 1;
    const img = S.frame(a.def, a.key, a.mode);
    const gy = GY + a.z;
    const x = Math.round(a.x);
    const sw = Math.round(14 * scale * (a.def.float ? 0.7 : 1));
    ctx.globalAlpha = 0.35 * a.alpha * a.shadow;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(x - Math.floor(sw / 2), gy - 1, sw, 2);
    ctx.globalAlpha = a.alpha;
    ctx.save();
    if (a.clipY != null) {
      ctx.beginPath();
      ctx.rect(0, 0, VIEW.w, a.clipY);
      ctx.clip();
    }
    ctx.translate(x, gy + a.yOff);
    if (a.dir < 0) ctx.scale(-1, 1);
    ctx.scale(a.sx, a.sy);
    ctx.drawImage(img, -S.CX * scale, -S.BY * scale, S.CW * scale, S.CH * scale);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* 적이 쓰는 투사체 모양. 전투 화면의 것을 줄여 옮겼고, 처음 보는 종류는 작은 구슬로 그린다. */
  const PROJ = {
    laser(ctx, f, x, y, p) {
      const len = Math.abs(f.x1 - f.x0);
      ctx.globalAlpha = 0.9 * (1 - p * 0.5);
      ctx.fillStyle = '#e6564a';
      ctx.fillRect(Math.round(f.x1), Math.round(y - 1), Math.round(len), 2);
      ctx.fillStyle = '#ffd9d2';
      ctx.fillRect(Math.round(f.x1), Math.round(y), Math.round(len), 1);
      ctx.globalAlpha = 1;
    },
    book(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 10);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 6, 5);
      ctx.fillStyle = Math.floor(p * 8) % 2 ? '#b5483c' : '#efe9dc';
      ctx.fillRect(Math.round(x), yy, 4, 3);
    },
    chalk(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 6);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 6, 3);
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(Math.round(x), yy, 4, 1);
    },
    note(ctx, f, x, y, p) {
      const yy = Math.round(y - 4 + Math.sin(p * 9) * 3);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 7, 5, 11);
      ctx.fillStyle = '#b79bf0';
      ctx.fillRect(Math.round(x) + 2, yy - 6, 1, 8);
      ctx.fillRect(Math.round(x), yy + 1, 3, 3);
    },
  };

  const FX = {
    bang(ctx, f) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      ctx.fillStyle = '#14121a';
      ctx.fillRect(x - 2, y - 1, 5, 10);
      ctx.fillRect(x - 2, y + 10, 5, 4);
      ctx.fillStyle = '#f2d450';
      ctx.fillRect(x - 1, y, 3, 8);
      ctx.fillRect(x - 1, y + 11, 3, 2);
    },
    puff(ctx, f) {
      const r = (2 + (f.seed % 3)) * Math.min(f.size, 1.6);
      const dx = (hash(f.seed + 5) - 0.5) * 14 * f.p * f.size;
      ctx.globalAlpha = 0.55 * (1 - f.p);
      ctx.fillStyle = '#8a8f98';
      ctx.fillRect(Math.round(f.x + dx), Math.round(f.y - 2 - f.p * 12 * f.size), Math.round(r), Math.round(r));
      ctx.globalAlpha = 1;
    },
    spark(ctx, f) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      const r = 3 - Math.floor(f.p * 3);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(x - r, y, r * 2 + 1, 1);
      ctx.fillRect(x, y - r, 1, r * 2 + 1);
    },
    slash(ctx, f) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      const len = 3 + Math.round(f.p * 8);
      ctx.globalAlpha = 1 - f.p * 0.7;
      ctx.fillStyle = '#ff9a86';
      for (let k = 0; k < len; k++) {
        const sx = f.dir > 0 ? x - 6 + k : x + 5 - k;
        ctx.fillRect(sx, y - 6 + k, 2, 1);
        ctx.fillRect(sx + (f.dir > 0 ? 4 : -4), y - 6 + k, 1, 1);
      }
      ctx.globalAlpha = 1;
    },
    ring(ctx, f) {
      const w = Math.round(f.r * (0.3 + 0.7 * f.p));
      ctx.globalAlpha = 0.5 * (1 - f.p);
      ctx.fillStyle = '#ff9a86';
      ctx.fillRect(Math.round(f.x - w), Math.round(f.y - 1), w, 3);
      ctx.globalAlpha = 1;
    },
    proj(ctx, f) {
      const x = f.x0 + (f.x1 - f.x0) * f.p;
      if (PROJ[f.sub]) {
        PROJ[f.sub](ctx, f, x, f.y, f.p);
        return;
      }
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, Math.round(f.y) - 1, 6, 6);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(Math.round(x), Math.round(f.y), 4, 4);
    },
    range(ctx, f) {
      /* 사거리 표시: 바닥에 점선과 끝 눈금 */
      const x1 = Math.round(f.x - f.w);
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#efe9dc';
      for (let x = x1; x < f.x; x += 4) ctx.fillRect(x, f.y, 2, 1);
      ctx.fillRect(x1, f.y - 2, 1, 5);
      ctx.fillRect(Math.round(f.x), f.y - 2, 1, 5);
      ctx.globalAlpha = 1;
    },
  };

  function drawState(ctx, st, theme) {
    drawBackdrop(ctx, theme, st.f);
    for (const a of [...st.actors].sort((p, q) => p.z - q.z)) drawActor(ctx, a);
    for (const f of st.fx) FX[f.kind](ctx, f);
    drawEdges(ctx);
  }

  /* 장면 한두 겹을 흔들림과 암전을 얹어 화면에 올린다 */
  function present(ctx, layers, shake, fade) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    for (const [img, alpha] of layers) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, shake[0], shake[1]);
    }
    if (fade > 0) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
    ctx.globalAlpha = 1;
  }

  /* 처음 그릴 때 한꺼번에 생기는 끊김을 막으려고 쓸 프레임을 미리 그려 둔다 */
  function warm(entry) {
    for (const def of [YG.unitById('basic'), entry.def]) {
      for (const key of YG.FRAME_KEYS) YG.sprites.frame(def, key);
    }
    YG.sprites.frame(YG.unitById('basic'), 'hurt0', 'flash');
  }

  const prefersReduced = () => !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* canvas 에 연출을 틀고 { stop, replay } 를 돌려준다.
     opts: onCaption(text, beat) 자막 / onPhase(0|1|2|'loop') / onEnd() 연출이 끝나 반복에 들어갈 때 / sfx(name, pitch) / reduced */
  function play(canvas, entry, opts = {}) {
    const reduced = opts.reduced == null ? prefersReduced() : opts.reduced;
    const sfx = opts.sfx || (() => {});
    const sc = script(entry);
    const theme = entry.lore.place;
    canvas.width = VIEW.w;
    canvas.height = VIEW.h;
    const ctx = canvas.getContext('2d');
    const mk = () => Object.assign(document.createElement('canvas'), { width: VIEW.w, height: VIEW.h });
    const A = mk();
    const B = mk();
    const actx = A.getContext('2d');
    const bctx = B.getContext('2d');
    warm(entry);

    const STEP = 1000 / FPS;
    let f = 0;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let dead = false;
    let lastText = null;
    let lastPhase = null;

    function notify() {
      const phase = sc.phaseAt(f);
      if (phase !== lastPhase) {
        lastPhase = phase;
        if (opts.onPhase) opts.onPhase(phase);
        if (phase === 'loop' && opts.onEnd) opts.onEnd();
      }
      if (f < sc.END && opts.onCaption) {
        const cap = sc.captionAt(f);
        if (cap.text !== lastText) {
          lastText = cap.text;
          opts.onCaption(cap.text, cap.beat);
        }
      }
    }

    function draw() {
      if (f < sc.END) {
        const st = sc.state(f);
        drawState(actx, st, theme);
        present(ctx, [[A, 1]], st.shake, st.fade);
      } else {
        const gI = f - sc.END;
        drawState(bctx, sc.loop(gI), theme);
        if (gI < XF) {
          drawState(actx, sc.state(sc.END - 1), theme);
          present(ctx, [[A, 1], [B, gI / XF]], [0, 0], 0);
        } else {
          present(ctx, [[B, 1]], [0, 0], 0);
        }
      }
    }

    function tick(ts) {
      raf = g.requestAnimationFrame(tick);
      acc += Math.min(100, ts - (last || ts));
      last = ts;
      let n = 0;
      while (acc >= STEP && n < 4) {
        acc -= STEP;
        n++;
        f++;
        for (const [name, pitch] of sc.sfxAt(f)) sfx(name, pitch);
      }
      if (n) {
        notify();
        draw();
      }
    }

    function showStill() {
      drawState(bctx, sc.still(), theme);
      present(ctx, [[B, 1]], [0, 0], 0);
      if (opts.onPhase) opts.onPhase('loop');
      if (opts.onCaption) opts.onCaption(entry.lore.beats.join('\n'), -1);
    }

    function start() {
      f = 0;
      acc = 0;
      last = 0;
      lastText = null;
      lastPhase = null;
      if (reduced) {
        showStill();
        return;
      }
      notify();
      draw();
      g.cancelAnimationFrame(raf);
      raf = g.requestAnimationFrame(tick);
    }

    start();
    return {
      stop() {
        dead = true;
        g.cancelAnimationFrame(raf);
        raf = 0;
      },
      replay() {
        if (!dead) start();
      },
      get frame() {
        return f;
      },
    };
  }

  YG.dex = {
    CORE_SCENES, INTROS, DEFAULT_REGION, FALLBACK_PLACE,
    entries, isSeen, variantsSeen, variantKeys, counts, unlockAll, firstStage, statRows, tags,
    placeOk, script, play,
  };
})(globalThis);
