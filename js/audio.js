(function (g) {
  const YG = g.YG;

  const KEY = 'yaja-gwadam-audio-v1';
  const DEFAULTS = { master: 0.8, sfx: 0.9, bgm: 0.7, muted: false };
  const BGM_DIR = 'assets/bgm/';
  const BGM_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];

  const settings = { ...DEFAULTS };
  try {
    const raw = g.localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch {
    /* 저장소를 못 쓰면 기본값으로 간다 */
  }

  const listeners = [];
  let ctx = null;
  let bus = null;
  let noiseBuf = null;
  let unlocked = false;

  const sfxLevel = () => (settings.muted ? 0 : settings.master * settings.sfx);
  const bgmLevel = () => (settings.muted ? 0 : settings.master * settings.bgm);

  function ensureContext() {
    if (ctx) return ctx;
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 8;
    bus = ctx.createGain();
    bus.connect(comp);
    comp.connect(ctx.destination);
    bus.gain.value = sfxLevel();
    return ctx;
  }

  function tone({ f = 440, to = 0, dur = 0.1, type = 'square', vol = 0.2, at = 0, attack = 0.004 }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise({ dur = 0.1, vol = 0.2, at = 0, filter = 'lowpass', f = 1000, to = 0, q = 1 }) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = filter;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl);
    fl.connect(env);
    env.connect(bus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.03);
  }

  const notes = (list, o) => list.forEach((f, i) => tone({ ...o, f, at: (o.at || 0) + i * o.step }));

  const SFX = {
    click: (p) => tone({ f: 900 * p, to: 700 * p, dur: 0.045, vol: 0.13 }),
    back: (p) => tone({ f: 620 * p, to: 430 * p, dur: 0.06, vol: 0.13 }),
    equip: (p) => notes([520 * p, 780 * p], { dur: 0.07, vol: 0.15, type: 'triangle', step: 0.04 }),
    error: (p) => tone({ f: 180 * p, to: 120 * p, dur: 0.16, vol: 0.18, type: 'sawtooth' }),
    coin: () => notes([1320, 1760], { dur: 0.12, vol: 0.14, step: 0.06 }),
    summon: (p) => {
      tone({ f: 260 * p, to: 720 * p, dur: 0.1, vol: 0.2, type: 'triangle' });
      noise({ dur: 0.05, vol: 0.07, filter: 'highpass', f: 3000 });
    },
    upgrade: (p) => notes([523 * p, 659 * p, 784 * p, 1046 * p], { dur: 0.09, vol: 0.16, step: 0.055 }),
    cannonReady: () => {
      tone({ f: 1568, dur: 0.5, vol: 0.14, type: 'sine' });
      tone({ f: 2093, dur: 0.4, vol: 0.09, type: 'sine', at: 0.05 });
    },
    cannon: () => {
      noise({ dur: 0.6, vol: 0.45, f: 1400, to: 60 });
      tone({ f: 120, to: 35, dur: 0.55, vol: 0.45, type: 'sine' });
      tone({ f: 500, to: 60, dur: 0.3, vol: 0.2, type: 'sawtooth' });
    },
    atkMelee: (p) => noise({ dur: 0.05, vol: 0.06, filter: 'bandpass', f: 1800 * p, q: 1.2 }),
    atkRanged: (p) => tone({ f: 1000 * p, to: 420 * p, dur: 0.07, vol: 0.1 }),
    hit: (p) => {
      noise({ dur: 0.06, vol: 0.2, filter: 'bandpass', f: 700 * p, q: 0.9 });
      tone({ f: 200 * p, to: 90 * p, dur: 0.07, vol: 0.18 });
    },
    hitBig: (p) => {
      noise({ dur: 0.09, vol: 0.28, filter: 'bandpass', f: 900 * p });
      tone({ f: 160 * p, to: 60 * p, dur: 0.12, vol: 0.26, type: 'sawtooth' });
      tone({ f: 1400 * p, to: 300 * p, dur: 0.06, vol: 0.12 });
    },
    kill: (p) => {
      tone({ f: 520 * p, to: 110 * p, dur: 0.16, vol: 0.18, type: 'triangle' });
      noise({ dur: 0.08, vol: 0.1, f: 2000 });
    },
    base: () => {
      noise({ dur: 0.25, vol: 0.38, f: 600, to: 80 });
      tone({ f: 90, to: 40, dur: 0.25, vol: 0.38, type: 'sine' });
    },
    boss: () => {
      for (let i = 0; i < 4; i++) tone({ f: i % 2 ? 420 : 620, dur: 0.2, vol: 0.18, type: 'sawtooth', at: i * 0.22 });
      noise({ dur: 0.8, vol: 0.12, f: 300 });
    },
    freeze: () => {
      tone({ f: 2400, to: 1600, dur: 0.3, vol: 0.11, type: 'sine' });
      tone({ f: 3000, to: 2000, dur: 0.22, vol: 0.07, type: 'sine', at: 0.03 });
    },
    slow: () => tone({ f: 420, to: 200, dur: 0.25, vol: 0.13, type: 'sine' }),
    win: () => {
      notes([523, 659, 784, 1046], { dur: 0.16, vol: 0.18, step: 0.12 });
      notes([1046, 1318, 1568], { dur: 0.7, vol: 0.1, type: 'triangle', step: 0, at: 0.5 });
    },
    lose: () => notes([392, 330, 262, 196], { dur: 0.26, vol: 0.18, type: 'triangle', step: 0.2 }),
    gachaShake: () => {
      for (let i = 0; i < 7; i++) noise({ dur: 0.04, vol: 0.16, filter: 'bandpass', f: 1200 + (i % 3) * 400, at: i * 0.055 });
    },
    open3: () => tone({ f: 784, dur: 0.18, vol: 0.16 }),
    open2: () => notes([784, 1047], { dur: 0.16, vol: 0.17, step: 0.1 }),
    open1: () => notes([659, 784, 988, 1318, 1568], { dur: 0.14, vol: 0.19, step: 0.07 }),
    open0: () => {
      notes([523, 659, 784, 1047, 1319, 1568, 2093], { dur: 0.2, vol: 0.19, step: 0.08 });
      notes([523, 784, 1047], { dur: 1, vol: 0.13, type: 'triangle', step: 0, at: 0.6 });
    },
    isnew: () => tone({ f: 1568, to: 2093, dur: 0.12, vol: 0.13, type: 'sine' }),
    levelup: () => {
      tone({ f: 523, to: 1046, dur: 0.18, vol: 0.18, type: 'triangle' });
      tone({ f: 1568, dur: 0.25, vol: 0.13, type: 'sine', at: 0.15 });
    },
    evolve: () => {
      notes([392, 494, 587, 740, 880, 1175], { dur: 0.16, vol: 0.18, step: 0.07 });
      notes([587, 740, 880], { dur: 0.7, vol: 0.1, type: 'triangle', step: 0, at: 0.45 });
    },
    awaken: () => {
      notes([330, 392, 494, 587, 740, 988, 1319, 1568], { dur: 0.18, vol: 0.18, step: 0.07 });
      notes([494, 740, 988, 1319], { dur: 1.1, vol: 0.11, type: 'triangle', step: 0, at: 0.6 });
      noise({ dur: 0.5, vol: 0.1, filter: 'highpass', f: 4000, at: 0.5 });
    },
  };

  const MIN_GAP = { hit: 30, hitBig: 40, atkMelee: 45, atkRanged: 45, kill: 45, summon: 30, base: 90, click: 30 };
  const LOW_PRIORITY = new Set(['hit', 'atkMelee', 'atkRanged']);
  const lastAt = {};
  let live = 0;

  function sfx(name, pitch = 1) {
    if (sfxLevel() <= 0 || !SFX[name]) return;
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const nowMs = performance.now();
    if (nowMs - (lastAt[name] || 0) < (MIN_GAP[name] || 20)) return;
    if (live > 14 && LOW_PRIORITY.has(name)) return;
    lastAt[name] = nowMs;
    live++;
    setTimeout(() => (live = Math.max(0, live - 1)), 220);
    SFX[name](pitch * (1 + (Math.random() - 0.5) * 0.1));
  }

  /* 배경음: assets/bgm/ 폴더의 파일을 이름으로 찾는다 */
  const found = {};
  const pending = {};
  let current = { key: '', el: null };
  let wanted = '';
  const fades = new Map();

  function probe(name) {
    if (name in found) return Promise.resolve(found[name]);
    if (pending[name]) return pending[name];
    pending[name] = new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (i >= BGM_EXTS.length) {
          found[name] = null;
          resolve(null);
          return;
        }
        const audio = new Audio();
        audio.preload = 'auto';
        const finish = (ok) => {
          clearTimeout(timer);
          audio.removeEventListener('canplay', onOk);
          audio.removeEventListener('error', onErr);
          if (ok) {
            found[name] = audio;
            resolve(audio);
          } else {
            next();
          }
        };
        const onOk = () => finish(true);
        const onErr = () => finish(false);
        const timer = setTimeout(() => finish(false), 6000);
        audio.addEventListener('canplay', onOk, { once: true });
        audio.addEventListener('error', onErr, { once: true });
        audio.src = `${BGM_DIR}${name}.${BGM_EXTS[i++]}`;
        audio.load();
      };
      next();
    });
    return pending[name];
  }

  function fade(el, to, ms, done) {
    clearInterval(fades.get(el));
    const from = el.volume;
    const steps = Math.max(1, Math.round(ms / 40));
    let k = 0;
    const id = setInterval(() => {
      k++;
      el.volume = Math.min(1, Math.max(0, from + ((to - from) * k) / steps));
      if (k >= steps) {
        clearInterval(id);
        fades.delete(el);
        if (done) done();
      }
    }, 40);
    fades.set(el, id);
  }

  function startElement(el) {
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  }

  function music(names, { loop = true, ms = 900 } = {}) {
    const key = names.join('|');
    wanted = key;
    if (current.key === key) return;
    (async () => {
      let el = null;
      for (const n of names) {
        el = await probe(n);
        if (wanted !== key) return;
        if (el) break;
      }
      if (wanted !== key) return;
      const prev = current.el;
      if (prev && prev !== el) fade(prev, 0, ms, () => prev.pause());
      current = { key, el };
      if (!el) return;
      el.loop = loop;
      if (prev !== el) el.currentTime = 0;
      if (el.paused) el.volume = 0;
      if (unlocked) startElement(el);
      fade(el, bgmLevel(), ms);
    })();
  }

  function stopMusic(ms = 500) {
    wanted = '';
    const prev = current.el;
    current = { key: '', el: null };
    if (prev) fade(prev, 0, ms, () => prev.pause());
  }

  const pad = (n) => String(n).padStart(2, '0');

  function battleMusic(stage, boss = false) {
    const ch = pad(stage.chapter);
    const isBoss = boss || !!(stage.bosses || stage.boss);
    music(isBoss
      ? [`boss-ch${ch}`, 'boss', `battle-ch${ch}`, 'battle']
      : [`battle-ch${ch}`, 'battle']);
  }

  function applyVolumes() {
    if (bus) bus.gain.value = sfxLevel();
    if (current.el && !fades.has(current.el)) current.el.volume = bgmLevel();
    for (const fn of listeners) fn(settings);
  }

  function persist() {
    try {
      g.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* 저장 실패는 무시 */
    }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
    if (current.el) {
      startElement(current.el);
      fade(current.el, bgmLevel(), 600);
    }
  }

  function battleEvents(list) {
    for (const e of list) {
      const ally = e.side === 'ally';
      switch (e.t) {
        case 'summon': sfx('summon'); break;
        case 'upgrade': sfx('upgrade'); break;
        case 'cannon': sfx('cannon'); break;
        case 'atk': sfx(e.ranged ? 'atkRanged' : 'atkMelee', ally ? 1 : 0.8); break;
        case 'hit': sfx(e.big ? 'hitBig' : 'hit', ally ? 0.78 : 1); break;
        case 'kill': sfx('kill', e.boss ? 0.5 : ally ? 0.8 : 1); break;
        case 'base': sfx('base'); break;
        case 'boss': sfx('boss'); break;
        case 'freeze': sfx('freeze'); break;
        case 'slow': sfx('slow'); break;
        default: break;
      }
    }
  }

  YG.audio = {
    settings,
    sfx,
    music,
    stopMusic,
    battleMusic,
    battleEvents,
    unlock,
    onChange: (fn) => listeners.push(fn),
    set(kind, value) {
      settings[kind] = value;
      applyVolumes();
    },
    save: persist,
    toggleMute() {
      settings.muted = !settings.muted;
      applyVolumes();
      persist();
      return settings.muted;
    },
    pause() {
      if (current.el) current.el.pause();
    },
    resume() {
      if (current.el && unlocked && !settings.muted) startElement(current.el);
    },
    BGM_DIR,
    status: () => ({ key: current.key, playing: !!(current.el && !current.el.paused), volume: current.el ? Number(current.el.volume.toFixed(2)) : 0 }),
  };

  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    document.addEventListener(type, unlock, { once: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? YG.audio.pause() : YG.audio.resume()));
})(globalThis);
