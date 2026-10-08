const { playBest, progressTier } = require('./sim.js');
const YG = globalThis.YG;
const seeds = Number(process.env.SEEDS || 4);
/* node tests/allcheck.js            8번부터 끝까지
   FROM=248 node tests/allcheck.js   해외편만 (FROM, TO 로 범위, PART=i/n 으로 나눠 돌리기) */
const from = Number(process.env.FROM || 8);
const to = Number(process.env.TO || YG.STAGES.length);
let ids = Array.from({ length: to - from + 1 }, (_, i) => from + i);
if (process.env.PART) {
  const [i, n] = process.env.PART.split('/').map(Number);
  ids = ids.filter((_, k) => k % n === i);
}
const fails = [];
let total = 0;
const times = [];
for (const id of ids) {
  const t = progressTier(id);
  const r = playBest(t, seeds);
  total++;
  times.push(r.sec);
  if (r.wins < seeds) fails.push(`${YG.STAGES[id - 1].sub}#${id}(${r.wins}/${seeds})`);
}
times.sort((a, b) => a - b);
console.log(`스테이지 ${total}개 중 일부/전체 패배 ${fails.length}개`);
console.log(fails.join(' '));
console.log(`평균 클리어 시간: 중앙값 ${Math.round(times[total >> 1])}s, 최소 ${Math.round(times[0])}s, 최대 ${Math.round(times[total - 1])}s`);
