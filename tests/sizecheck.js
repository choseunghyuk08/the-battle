/* 그림 크기 점검. 적과 동료의 가만히 선 그림(idle) 크기를 재서 js/sizes.js 의 현실 크기(cm)와 맞는지 확인한다.
   node tests/sizecheck.js            표가 맞는지 검사한다 (어긋나면 목록을 내고 exit 1)
   node tests/sizecheck.js --table    측정값 전체를 표로 본다
   node tests/sizecheck.js --write    js/sizes.js 의 FIT 표를 새로 계산해서 고쳐 쓴다 (그림을 바꿨을 때) */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'js');

/* 그림은 크기만 필요해서 가짜 canvas 는 가로/세로만 가진다 */
function fakeCanvas() {
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  return { width: 0, height: 0, getContext: () => ctx };
}

function load() {
  /* 가짜 canvas 는 그림을 그리는 동안(box)만 끼운다. 여기서 전역에 남기면 다른 점검이 자기 것을 못 쓴다 */
  const had = globalThis.document;
  if (!had) globalThis.document = { createElement: () => fakeCanvas() };
  try {
    if (!globalThis.YG || !globalThis.YG.ENEMIES) ['data.js', 'units2.js', 'units3.js', 'units4a.js', 'units4b.js', 'units4c.js', 'units4d.js', 'units4e.js', 'units4f.js', 'evolutions.js', 'bestiary.js', 'bestiary2.js', 'bestiary3.js', 'sizes.js'].forEach((f) => require(path.join(root, f)));
    for (const f of ['poses.js', 'sprites.js', 'sprites2.js', 'sprites3.js', 'sprites4.js', 'hd.js', ...require('./hdfiles').map((n) => `${n}.js`)]) require(path.join(root, f));
  } finally {
    if (!had) delete globalThis.document;
  }
  return globalThis.YG;
}

let serial = 0;

/* 가만히 서 있는 그림(idle 전부)의 크기.
   nat: 도트 원본 기준(외곽선 포함), px: 화면에 실제로 보이는 크기(논리 px) */
function box(YG, def) {
  const K = YG.sprites.K;
  let nw = 0;
  let nh = 0;
  let w = 0;
  let h = 0;
  const tag = `size${serial++}`;
  /* 다른 점검(spritecheck)도 가짜 canvas 를 쓰므로, 그림을 그리는 동안만 이쪽 것으로 바꿔 끼운다 */
  const prev = globalThis.document;
  globalThis.document = { createElement: () => fakeCanvas() };
  try {
    for (let n = 0; n < YG.POSE_COUNT.idle; n++) {
      const img = YG.sprites.frame({ ...def, spriteKey: tag }, `idle${n}`);
      nw = Math.max(nw, img.nat.w);
      nh = Math.max(nh, img.nat.h);
      w = Math.max(w, img.width / K);
      h = Math.max(h, img.height / K);
    }
  } finally {
    globalThis.document = prev;
  }
  return { nw, nh, w, h };
}

/* 길쭉하게 누운 그림은 가로, 서 있는 그림은 세로를 현실 크기의 기준 변으로 본다 */
const axisOf = (raw) => (raw.nw >= raw.nh ? 'w' : 'h');
const round2 = (v) => Math.round(v * 100) / 100;
const natOf = (raw, axis) => (axis === 'w' ? raw.nw : raw.nh);

function enemyRows(YG) {
  const S = YG.SIZES;
  return YG.ENEMIES.filter((e) => S.ENEMY_CM[e.id] !== undefined).map((e) => {
    const raw = box(YG, { ...e, fit: 1, scale: 1 });
    const axis = axisOf(raw);
    /* HD 그림은 이미 화면 크기대로 그려서 fit/scale 을 쓰지 않는다 */
    const hd = !!YG.hdFor(e);
    const scale = hd ? 1 : e.scale || 1;
    const want = S.enemyPx(e);
    const fit = hd ? 1 : round2(want / scale / natOf(raw, axis));
    return { e, raw, axis, scale, want, fit, hd };
  });
}

function allyRows(YG) {
  const S = YG.SIZES;
  const rows = [];
  for (const u of YG.UNITS) {
    for (const lvl of [0, 1, 2]) {
      const form = { ...YG.resolveDef({ ...u, fit: 1 }, lvl), fit: 1 };
      const raw = box(YG, form);
      const want = S.allyPx(u, lvl);
      rows.push({ u, lvl, raw, want, fit: round2(want / raw.nh) });
    }
  }
  return rows;
}

/* 표의 fit 으로 실제로 그려 본 크기가 목표와 얼마나 다른지, 순서가 뒤집힌 데는 없는지 */
function check() {
  const YG = load();
  const S = YG.SIZES;
  const problems = [];
  const tol = (want) => Math.max(1.6, want * 0.07);

  const foes = [];
  for (const e of YG.ENEMIES) {
    if (S.ENEMY_CM[e.id] === undefined) {
      problems.push(`${e.id}: 현실 크기(cm) 없음`);
      continue;
    }
    const raw = box(YG, { ...e, fit: 1, scale: 1 });
    const axis = axisOf(raw);
    const got = box(YG, e);
    const px = got[axis];
    const want = S.enemyPx(e);
    const hd = !!YG.hdFor(e);
    if (e.fit === undefined && !hd) problems.push(`${e.id}: fit 없음 (node tests/sizecheck.js --write)`);
    else if (Math.abs(px - want) > (hd ? Math.max(2, want * 0.08) : tol(want))) problems.push(`${e.id}: 화면 크기 ${px.toFixed(1)}px, 현실 ${S.cmText(e.cm)} 이면 ${want.toFixed(1)}px${hd ? ' (HD: 그림을 직접 맞춰야 한다)' : ''}`);
    if (got.w > 170 || got.h > 150) problems.push(`${e.id}: 그림이 너무 큼 ${got.w.toFixed(0)}x${got.h.toFixed(0)}`);
    foes.push({ id: e.id, cm: e.cm, px, boss: !!e.boss });
  }
  /* 현실에서 더 큰 것이 화면에서 더 작으면 안 된다. 1.5px 까지는 반올림 오차로 본다 */
  foes.sort((a, b) => a.cm - b.cm || a.px - b.px);
  for (let i = 0; i < foes.length; i++) {
    for (let j = i + 1; j < foes.length; j++) {
      if (foes[j].cm > foes[i].cm * 1.15 && foes[j].px < foes[i].px - 1.5) {
        problems.push(`크기 순서가 뒤집힘: ${foes[j].id} (${foes[j].cm}cm, ${foes[j].px.toFixed(1)}px) < ${foes[i].id} (${foes[i].cm}cm, ${foes[i].px.toFixed(1)}px)`);
      }
    }
  }

  const byGrade = {};
  for (const u of YG.UNITS) {
    if (u.cm === undefined) {
      problems.push(`${u.id}: 현실 키(cm) 없음`);
      continue;
    }
    const hh = [0, 1, 2].map((lvl) => {
      const d = YG.resolveDef(u, lvl);
      if (d.fit === undefined && !YG.hdFor(d)) problems.push(`${u.id} ${lvl}: fit 없음 (node tests/sizecheck.js --write)`);
      return box(YG, d).h;
    });
    [0, 1, 2].forEach((lvl) => {
      const want = S.allyPx(u, lvl);
      /* HD 동료는 몸짓(몸 흔들림, 휘두르는 소품)에 따라 서 있는 그림의 높이가 조금 달라서 여유를 둔다 */
      const hd = !!YG.hdFor(YG.resolveDef(u, lvl));
      if (Math.abs(hh[lvl] - want) > (hd ? Math.max(2.6, want * 0.1) : tol(want))) problems.push(`${u.id} ${lvl}단계: 높이 ${hh[lvl].toFixed(1)}px, 목표 ${want.toFixed(1)}px`);
    });
    if (!(hh[1] >= hh[0] - 1.6 && hh[2] >= hh[1] - 1.6)) problems.push(`${u.id}: 진화할수록 커져야 하는데 ${hh.map((v) => v.toFixed(1)).join(' → ')}`);
    (byGrade[u.grade] = byGrade[u.grade] || []).push(hh[0]);
  }
  /* 등급이 높을수록 평균이 커야 한다 */
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const order = [4, 3, 2, 1, 0].filter((gr) => byGrade[gr]);
  for (let i = 1; i < order.length; i++) {
    if (mean(byGrade[order[i]]) <= mean(byGrade[order[i - 1]])) problems.push(`등급 ${order[i]} 의 평균 키가 등급 ${order[i - 1]} 보다 작거나 같음`);
  }
  return { problems, foes: foes.length, allies: YG.UNITS.length };
}

function write() {
  const YG = load();
  const enemyFit = {};
  const enemyHt = {};
  for (const r of enemyRows(YG)) {
    enemyFit[r.e.id] = r.fit;
    enemyHt[r.e.id] = Math.round(r.raw.nh * r.fit * r.scale);
  }
  const allyFit = {};
  for (const r of allyRows(YG)) (allyFit[r.u.id] = allyFit[r.u.id] || [])[r.lvl] = r.fit;

  const wrap = (entries, pad) => {
    const lines = [];
    let line = '';
    for (const [k, v] of entries) {
      const item = `${k}: ${v}, `;
      if ((line + item).length > 118) {
        lines.push(pad + line.trimEnd());
        line = '';
      }
      line += item;
    }
    if (line) lines.push(pad + line.trimEnd());
    return lines.join('\n');
  };
  const eText = wrap(Object.entries(enemyFit), '    ');
  const hText = wrap(Object.entries(enemyHt), '    ');
  const aText = wrap(Object.entries(allyFit).map(([k, v]) => [k, `[${v.join(', ')}]`]), '    ');
  const file = path.join(root, 'sizes.js');
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(
    /\/\* FIT:begin[\s\S]*?\/\* FIT:end \*\//,
    `/* FIT:begin (node tests/sizecheck.js --write 로 만든 값. 손으로 고치지 않는다) */\n  const ENEMY_FIT = {\n${eText}\n  };\n  const ENEMY_HT = {\n${hText}\n  };\n  const ALLY_FIT = {\n${aText}\n  };\n  /* FIT:end */`,
  );
  fs.writeFileSync(file, out);
  console.log(`적 ${Object.keys(enemyFit).length}종, 동료 ${Object.keys(allyFit).length}종의 fit 을 썼다`);
}

module.exports = { load, box, check };

if (require.main === module) {
  const mode = process.argv[2] || '';
  if (mode === '--write') {
    write();
  } else if (mode === '--table') {
    const YG = load();
    for (const r of enemyRows(YG)) console.log([r.e.id, r.e.name, r.e.boss ? 'B' : '-', r.hd ? 'HD' : r.scale, `${r.raw.nw.toFixed(0)}x${r.raw.nh.toFixed(0)}`, r.axis, r.e.cm, r.want.toFixed(1), r.fit].join('\t'));
    for (const r of allyRows(YG)) console.log([r.u.id, r.u.name, r.u.grade, r.lvl, `${r.raw.nw}x${r.raw.nh}`, r.u.cm, r.want.toFixed(1), r.fit].join('\t'));
  } else {
    const r = check();
    for (const p of r.problems) console.log(p);
    console.log(`적 ${r.foes}종, 동료 ${r.allies}종, 문제 ${r.problems.length}개`);
    process.exit(r.problems.length ? 1 : 0);
  }
}
