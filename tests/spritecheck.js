/* 적 스프라이트 17프레임을 전부 그려 보고 캔버스(48x36) 밖으로 잘려 나가는 그림을 찾는다.
   브라우저 없이 돌 수 있게 canvas 를 흉내 낸다. node tests/spritecheck.js [id,id,...] */
const path = require('path');
const root = path.join(__dirname, '..', 'js');

/* builder.flush 는 외곽선을 먼저 모두 그리고 색을 나중에 칠한다. 외곽선 단계는 밖으로 나가도 안 보이므로 무시한다. */
function fakeCanvas(w, h) {
  const grid = new Uint8Array(w * h);
  const c = { width: w, height: h, grid, oob: 0 };
  let outline = null;
  let filling = false;
  const ctx = {
    fillStyle: '#000',
    fillRect(x, y, rw, rh) {
      if (outline === null) outline = ctx.fillStyle;
      if (!filling && ctx.fillStyle !== outline) filling = true;
      if (!filling) return;
      for (let yy = y; yy < y + rh; yy++) {
        for (let xx = x; xx < x + rw; xx++) {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) c.oob++;
          else grid[yy * w + xx] = 1;
        }
      }
    },
    drawImage() {},
  };
  c.getContext = () => ctx;
  return c;
}

function load() {
  if (!globalThis.document) globalThis.document = { createElement: () => fakeCanvas(48, 36) };
  if (!globalThis.YG || !globalThis.YG.ENEMIES) ['data.js', 'units2.js', 'evolutions.js', 'bestiary.js', 'bestiary2.js'].forEach((f) => require(path.join(root, f)));
  for (const f of ['poses.js', 'sprites.js', 'sprites2.js', 'sprites3.js']) require(path.join(root, f));
  return globalThis.YG;
}

/* 문제가 있는 프레임 목록을 돌려준다: { id, frame, why } */
function checkSprites(ids) {
  const YG = load();
  const defs = ids ? ids.map((i) => YG.enemyById(i)) : YG.ENEMIES.filter((e) => e.region);
  const problems = [];
  for (const def of defs) {
    for (const key of YG.FRAME_KEYS) {
      let img;
      try {
        img = YG.sprites.frame({ ...def, spriteKey: `check:${def.id}` }, key);
      } catch (e) {
        problems.push({ id: def.id, frame: key, why: `예외 ${e.message}` });
        continue;
      }
      const filled = img.grid.reduce((a, v) => a + v, 0);
      if (filled < 60) problems.push({ id: def.id, frame: key, why: `거의 비어 있음 (${filled}px)` });
      if (img.oob > 0) problems.push({ id: def.id, frame: key, why: `캔버스 밖 ${img.oob}px` });
    }
  }
  return { count: defs.length, problems };
}

module.exports = { checkSprites };

if (require.main === module) {
  const ids = process.argv[2] ? process.argv[2].split(',') : null;
  const r = checkSprites(ids);
  const byId = {};
  for (const p of r.problems) (byId[p.id] = byId[p.id] || []).push(`${p.frame}:${p.why}`);
  for (const [id, list] of Object.entries(byId)) console.log(`${id}  ${list.slice(0, 6).join(' | ')}${list.length > 6 ? ` ... (${list.length})` : ''}`);
  console.log(`적 ${r.count}종, 문제 프레임 ${r.problems.length}개`);
}
