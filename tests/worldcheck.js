const { playBot, progressTier } = require('./sim.js');
const YG = globalThis.YG;
const picks = [8, 10, 13, 20, 25, 30, 40, 50, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 247, 248, 252, 260, 275, 290, 305, 320, 335, 347];
console.log('stage  chapter-stage  Lv deck  승/6  시간  우리성최저  적최전선');
for (const id of picks) {
  const t = progressTier(id);
  const runs = [];
  for (let seed = 1; seed <= 6; seed++) runs.push(playBot(t, seed));
  const w = runs.filter((r) => r.result === 'win').length;
  const avg = (k) => Math.round(runs.reduce((a, r) => a + r[k], 0) / runs.length);
  const st = YG.STAGES[id - 1];
  console.log(
    `${String(id).padStart(3)}  ${st.sub.padEnd(5)} D=${YG.difficulty(id - 1).toFixed(1).padStart(5)}  Lv${String(t.lv).padStart(2)}  ${w}/6  ${String(avg('sec')).padStart(3)}s  ${String(avg('minAlly')).padStart(3)}%  ${avg('minEnemyX')}  ${runs.some((r) => r.result === 'timeout') ? '(교착)' : ''}`
  );
}
