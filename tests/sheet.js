/* 스프라이트 확인 그림. 동작마다 한 줄, 프레임을 옆으로 늘어놓는다. 땅(기준선)은 가는 선으로 표시한다.
   node tests/sheet.js <종류>.<이름>[@배율] [확대=6] [색묶음 번호=0] [동작,동작...]
   예) node tests/sheet.js hero.main 6
       node tests/sheet.js mob.slime@2 4 1 walk,attack
   결과: tests/out/<종류>.<이름>.png */
const path = require('path');
const fs = require('fs');
const { writePng } = require('./png');
const { loadAll } = require('./load');

const TG = loadAll();
const [spec, zoomArg, palArg, clipsArg] = process.argv.slice(2);
if (!spec) {
  console.log('사용법: node tests/sheet.js <종류>.<이름>[@배율] [확대] [색묶음] [동작,...]');
  console.log('있는 것:', Object.entries(TG.SPR).map(([k, v]) => Object.keys(v).map((n) => `${k}.${n}`).join(' ')).join(' '));
  process.exit(1);
}
const [name, sArg] = spec.split('@');
const [kind, id] = name.split('.');
const def = TG.SPR[kind] && TG.SPR[kind][id];
if (!def) throw new Error(`없음: ${name}`);
const S = Number(sArg || 1);
const Z = Number(zoomArg || 6);
const pals = def.palettes || [def.palette || {}];
const pi = Number(palArg || 0);
const pal = pals[pi] || pals[0];
const clips = clipsArg ? clipsArg.split(',') : Object.keys(def.clips);

const rows = clips.map((c) => TG.clip(def, c, pal, S, `p${pi}`));
const gap = 2;
const cw = Math.max(...rows.map((r) => r.w)) + gap;
const ch = Math.max(...rows.map((r) => r.h)) + gap;
const cols = Math.max(...rows.map((r) => r.n));
const W = cols * cw * Z;
const H = rows.length * ch * Z;
const out = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < out.length; i += 4) {
  const x = (i / 4) % W;
  const y = Math.floor(i / 4 / W);
  const cell = (Math.floor(x / Z / 4) + Math.floor(y / Z / 4)) % 2;
  out[i] = cell ? 58 : 50;
  out[i + 1] = cell ? 62 : 54;
  out[i + 2] = cell ? 74 : 66;
  out[i + 3] = 255;
}
rows.forEach((r, ri) => {
  r.frames.forEach((fr, fi) => {
    const ox = fi * cw;
    const oy = ri * ch;
    /* 기준선 */
    for (let x = 0; x < cw - gap; x++) {
      for (let zy = 0; zy < 1; zy++) {
        for (let zx = 0; zx < Z; zx++) {
          const X = (ox + x) * Z + zx;
          const Y = (oy + Math.round(r.ay)) * Z + zy;
          const i = (Y * W + X) * 4;
          out[i] = 120;
          out[i + 1] = 200;
          out[i + 2] = 120;
        }
      }
    }
    for (let y = 0; y < fr.h; y++) {
      for (let x = 0; x < fr.w; x++) {
        const si = (y * fr.w + x) * 4;
        if (!fr.data[si + 3]) continue;
        for (let zy = 0; zy < Z; zy++) {
          for (let zx = 0; zx < Z; zx++) {
            const i = (((oy + y) * Z + zy) * W + (ox + x) * Z + zx) * 4;
            out[i] = fr.data[si];
            out[i + 1] = fr.data[si + 1];
            out[i + 2] = fr.data[si + 2];
            out[i + 3] = 255;
          }
        }
      }
    }
  });
});
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
const file = path.join(__dirname, 'out', `${name}${S !== 1 ? `@${S}` : ''}.png`);
writePng(file, W, H, out);
console.log(`${file} (${W}x${H}) 줄: ${clips.map((c, i) => `${i + 1}=${c}(${rows[i].n})`).join(' ')}`);
