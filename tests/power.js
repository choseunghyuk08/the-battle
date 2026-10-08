/* 능력치만으로 계산하는 유닛 값어치. 같은 등급 안에서 서로 비슷한지 보는 용도다.
   node tests/power.js */
require('./sim.js');
const YG = globalThis.YG;

/* 실제 스테이지에서 특성별 적이 얼마나 나오는지 */
function traitWeights() {
  const w = { ghost: 0, specimen: 0, dark: 0, metal: 0, none: 0 };
  for (const st of YG.STAGES) {
    for (const wave of st.waves) w[YG.enemyById(wave.id).trait] += wave.count;
  }
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w)) w[k] /= sum;
  return w;
}

function power(u, w = traitWeights()) {
  let om = 0;
  let taken = 0;
  for (const [t, wt] of Object.entries(w)) {
    let deal = 1;
    let take = 1;
    for (const a of u.abilities || []) {
      if (a.vs !== t && a.vs !== '*') continue;
      if (a.type === 'massive') deal = Math.max(deal, 3);
      else if (a.type === 'strong') deal = Math.max(deal, 1.5);
      else if (a.type === 'tough') take = Math.min(take, 0.25);
      if (a.type === 'strong') take = Math.min(take, 0.5);
    }
    if (t === 'metal' && deal === 1) deal = 0.02;
    om += wt * deal;
    taken += wt * take;
  }
  const dps = (u.atk / u.interval) * 30 * (1 + (u.crit || 0));
  const af = u.area ? 1.8 : 1;
  const rf = 1 + Math.max(0, u.range - 18) / 80;
  const cf = 1 + (u.freeze ? (u.freeze.chance * u.freeze.frames) / 90 : 0) + (u.slow ? (u.slow.chance * u.slow.frames) / 240 : 0);
  const sf = 1 + (u.survive || 0) * 0.5;
  const lf = 1 + ((u.loot || 1) - 1) * 0.25;
  const ehp = (u.hp / taken) * rf * sf;
  const dmg = dps * om * af * cf * lf;
  return { ep: Math.sqrt(ehp * dmg), ehp, dmg, om, taken };
}

if (require.main === module) {
  const w = traitWeights();
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  for (const g of [4, 3, 2, 1, 0]) {
    const grp = YG.UNITS.filter((u) => u.grade === g).map((u) => ({ u, ...power(u, w) }));
    const m = med(grp.map((r) => r.ep / r.u.cost));
    console.log(`\n[${YG.GRADES[g].name}] 비용당 값어치 (중앙값 ${m.toFixed(2)} = 100)`);
    for (const r of grp.sort((a, b) => b.ep / b.u.cost - a.ep / a.u.cost)) {
      const v = Math.round(((r.ep / r.u.cost) / m) * 100);
      console.log(`  ${r.u.id.padEnd(11)}${r.u.role.padEnd(5)}비용 ${String(r.u.cost).padStart(4)}  EP ${String(Math.round(r.ep)).padStart(5)}  ${String(v).padStart(4)}${v < 75 || v > 130 ? '  <-' : ''}`);
    }
  }
}
module.exports = { power, traitWeights };
