/* 적 스프라이트 프레임(YG.FRAME_KEYS 전부)을 모두 그려 보고 예외가 나거나 거의 빈 그림이 있는지 찾는다.
   그림은 내용에 맞춰 크기가 정해지므로 칸 밖으로 잘리는 일은 없다. 크기 자체는 tests/sizecheck.js 가 본다.
   브라우저 없이 돌 수 있게 canvas 를 흉내 낸다. node tests/spritecheck.js [id,id,...] */
const path = require('path');
const root = path.join(__dirname, '..', 'js');

function fakeCanvas() {
  const c = { width: 0, height: 0, rects: 0, area: 0 };
  const ctx = new Proxy({ fillRect(x, y, w, h) { c.rects++; c.area += w * h; } }, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  c.getContext = () => ctx;
  return c;
}

function load() {
  if (!globalThis.document) globalThis.document = { createElement: fakeCanvas };
  if (!globalThis.YG || !globalThis.YG.ENEMIES) ['data.js', 'units2.js', 'units3.js', 'evolutions.js', 'bestiary.js', 'bestiary2.js', 'bestiary3.js', 'sizes.js'].forEach((f) => require(path.join(root, f)));
  for (const f of ['poses.js', 'sprites.js', 'sprites2.js', 'sprites3.js', 'sprites4.js', 'hd.js', ...require('./hdfiles').map((n) => `${n}.js`)]) require(path.join(root, f));
  return globalThis.YG;
}

/* 문제가 있는 프레임 목록을 돌려준다: { id, frame, why } */
function checkSprites(ids) {
  const YG = load();
  const K = YG.sprites.K;
  const defs = ids ? ids.map((i) => YG.enemyById(i)) : YG.ENEMIES.filter((e) => e.region);
  const problems = [];
  /* 다른 점검이 가짜 canvas 를 안 끼워 놨을 수 있어서 그리는 동안만 끼운다 */
  const prev = globalThis.document;
  globalThis.document = { createElement: fakeCanvas };
  try {
    for (const def of defs) {
      for (const key of YG.FRAME_KEYS) {
        let img;
        try {
          img = YG.sprites.frame({ ...def, spriteKey: `check:${def.id}` }, key);
        } catch (e) {
          problems.push({ id: def.id, frame: key, why: `예외 ${e.message}` });
          continue;
        }
        if (img.rects < 6) problems.push({ id: def.id, frame: key, why: `거의 비어 있음 (${img.rects}칸)` });
        if (!(img.width > 0 && img.height > 0)) problems.push({ id: def.id, frame: key, why: '크기가 0' });
        if (!(Number.isFinite(img.ax) && Number.isFinite(img.ay))) problems.push({ id: def.id, frame: key, why: '기준점이 숫자가 아님' });
        if (img.width / K > 220 || img.height / K > 200) problems.push({ id: def.id, frame: key, why: `너무 큼 ${img.width / K}x${img.height / K}` });
      }
    }
  } finally {
    globalThis.document = prev;
  }
  return { count: defs.length, frames: YG.FRAME_KEYS.length, problems };
}

module.exports = { checkSprites };

if (require.main === module) {
  const ids = process.argv[2] ? process.argv[2].split(',') : null;
  const r = checkSprites(ids);
  const byId = {};
  for (const p of r.problems) (byId[p.id] = byId[p.id] || []).push(`${p.frame}:${p.why}`);
  for (const [id, list] of Object.entries(byId)) console.log(`${id}  ${list.slice(0, 6).join(' | ')}${list.length > 6 ? ` ... (${list.length})` : ''}`);
  console.log(`적 ${r.count}종 x ${r.frames}프레임, 문제 프레임 ${r.problems.length}개`);
}
