const { playBest, progressTier } = require('./sim.js');
const YG = globalThis.YG;
const seeds = Number(process.env.SEEDS || 4);
const fails = [];
let total = 0;
const times = [];
for (let id = 8; id <= YG.STAGES.length; id++) {
  const t = progressTier(id);
  const r = playBest(t, seeds);
  total++;
  times.push(r.sec);
  if (r.wins < seeds) fails.push(`${YG.STAGES[id - 1].sub}(${r.wins}/${seeds})`);
}
times.sort((a, b) => a - b);
console.log(`스테이지 ${total}개 중 일부/전체 패배 ${fails.length}개`);
console.log(fails.join(' '));
console.log(`평균 클리어 시간: 중앙값 ${Math.round(times[total >> 1])}s, 최소 ${Math.round(times[0])}s, 최대 ${Math.round(times[total - 1])}s`);
