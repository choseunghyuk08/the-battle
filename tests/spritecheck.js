/* 스프라이트 점검: 모든 그림의 모든 동작을 배율 1 (몬스터는 2도) 로 그려서
   - 칸 가장자리에 닿는 점(잘림) 이 있는지
   - 빈 프레임이 있는지
   - 반복 동작에서 프레임이 모두 같은지(안 움직임)
   를 본다.  node tests/spritecheck.js [종류.이름 ...] */
const { loadAll } = require('./load');

const TG = loadAll();
const only = process.argv.slice(2);
const problems = [];
let count = 0;
for (const [kind, group] of Object.entries(TG.SPR)) {
  for (const [name, def] of Object.entries(group)) {
    const full = `${kind}.${name}`;
    if (only.length && !only.includes(full)) continue;
    if (!def || !def.clips) continue;
    const pals = def.palettes || [def.palette || {}];
    const scales = kind === 'mob' ? [1, 2] : [1];
    for (const S of scales) {
      for (const [clip] of Object.entries(def.clips)) {
        const pi = 0;
        let r;
        try {
          r = TG.clip(def, clip, pals[pi], S, `chk${pi}`);
        } catch (e) {
          problems.push(`${full} ${clip}: 그리다가 에러 ${e.message}`);
          continue;
        }
        const sigs = new Set();
        r.frames.forEach((fr, i) => {
          count++;
          let filled = 0;
          let edge = 0;
          for (let y = 0; y < fr.h; y++) {
            for (let x = 0; x < fr.w; x++) {
              if (!fr.data[(y * fr.w + x) * 4 + 3]) continue;
              filled++;
              if (x === 0 || y === 0 || x === fr.w - 1 || y === fr.h - 1) edge++;
            }
          }
          if (!filled && !(def.allowEmpty || []).includes(clip)) problems.push(`${full}@${S} ${clip}#${i}: 빈 프레임`);
          if (edge && !def.tile) problems.push(`${full}@${S} ${clip}#${i}: 칸 가장자리에 닿음 (${edge}점) - 칸을 키우거나 그림을 줄인다`);
          sigs.add(Buffer.from(fr.data.buffer).toString('base64').slice(0, 4000) + fr.data.length + Buffer.from(fr.data.buffer).toString('base64').length);
          let h = 0;
          for (let k = 0; k < fr.data.length; k += 7) h = (h * 31 + fr.data[k]) | 0;
          sigs.add(`h${h}`);
        });
        const hashes = [...sigs].filter((s) => s.startsWith('h'));
        if (r.n > 1 && hashes.length < 2) problems.push(`${full}@${S} ${clip}: 프레임이 전부 같다 (움직임 없음)`);
      }
    }
  }
}
for (const p of problems) console.log(p);
console.log(`프레임 ${count}장, 문제 ${problems.length}개`);
process.exit(problems.length ? 1 : 0);
