const { playBest, progressTier } = require('./sim.js');
const YG = globalThis.YG;

const arg = process.argv[2] || '8,12,20,30,50,80,120,160,200,240';
const ids = arg === 'all' ? Array.from({ length: 240 }, (_, i) => i + 8) : arg.split(',').map(Number);
const quiet = process.argv.includes('--csv');
const seeds = Number(process.env.SEEDS || 4);
const original = YG.difficulty;

function trial(id, S) {
  YG.difficulty = () => S;
  YG.STAGES[id - 1] = YG.regenStage(id);
  const t = progressTier(id);
  return playBest(t, seeds);
}

for (const id of ids) {
  let lo = 0.5;
  let hi = 600;
  for (let i = 0; i < 9; i++) {
    const mid = Math.sqrt(lo * hi);
    if (trial(id, mid).wins >= Math.ceil(seeds * 0.75)) lo = mid;
    else hi = mid;
  }
  if (quiet) {
    console.log(`${id},${lo.toFixed(3)}`);
    continue;
  }
  const r = trial(id, lo * 0.8);
  console.log(`stage ${id} (g=${id - 1}) Lv${progressTier(id).lv}: S_max=${lo.toFixed(2)}  at 0.8x -> wins ${r.wins}/${seeds} ${r.sec}s minAlly ${r.minAlly}% front ${r.front}`);
}
YG.difficulty = original;
