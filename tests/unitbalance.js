/* 유닛 밸런스 표. 같은 등급 안에서 유닛이 얼마나 비슷한 값어치를 하는지 본다.
   유닛 한 종류만 계속 내보내고, 특성별로 적이 끊임없이 오는 길에서 120초 동안 버틴다.
   S = 초당 준 피해(특성 비중으로 가중), E = 쓴 용돈당 준 피해. 등급 중앙값을 100으로 맞춰서 보여준다.
   node tests/unitbalance.js [--csv] */
const { seeded } = require('./sim.js');
const { traitWeights } = require('./power.js');
const YG = globalThis.YG;

const T_SEC = 120;
const SEEDS = 3;
const ENEMY = { ghost: 'ghost', specimen: 'mannequin', dark: 'shadow', metal: 'tray', none: 'dust' };
/* 등급마다 만나는 적의 세기와 일꾼 레벨. 같은 등급끼리만 비교하므로 대략만 맞으면 된다. */
const TIER = {
  4: { mult: 1.4, worker: 2, gap: 4 },
  3: { mult: 2.6, worker: 4, gap: 3.4 },
  2: { mult: 4.2, worker: 5, gap: 3 },
  1: { mult: 6.5, worker: 6, gap: 2.6 },
  0: { mult: 8, worker: 7, gap: 2.4 },
};

function arena(def, trait, seed) {
  const tier = TIER[def.grade];
  const stage = {
    startMoney: 0,
    allyBaseHp: 1e9,
    enemyBaseHp: 1e9,
    waves: [{ id: ENEMY[trait], start: 1, interval: tier.gap, count: 999, mult: tier.mult }],
  };
  const b = new YG.Battle(stage, [{ def, lv: 1, plus: 0 }], seeded(seed));
  b.workerLv = tier.worker;
  let dealt = 0;
  let taken = 0;
  let allyDeaths = 0;
  const apply = b.applyDamage.bind(b);
  b.applyDamage = (v, dmg, opts) => {
    if (v.dying) return;
    const real = Math.min(dmg, Math.max(0, v.hp));
    if (v.side === 'enemy') dealt += real;
    else taken += real;
    apply(v, dmg, opts);
    if (v.side === 'ally' && v.dying) allyDeaths++;
  };
  let spent = 0;
  for (let f = 0; f < T_SEC * YG.FPS; f++) {
    if (f % 3 === 0 && b.canSummon(0)) {
      b.summon(0);
      spent += def.cost;
    }
    b.step();
  }
  return { dealt, taken, spent, allyDeaths };
}

function evaluate(def, weights) {
  let S = 0;
  let E = 0;
  let K = 0;
  for (const [trait, w] of Object.entries(weights)) {
    let dealt = 0;
    let taken = 0;
    let spent = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = arena(def, trait, seed);
      dealt += r.dealt;
      taken += r.taken;
      spent += r.spent;
    }
    S += (w * dealt) / SEEDS / T_SEC;
    E += w * (dealt / Math.max(1, spent));
    K += w * (taken / Math.max(1, spent));
  }
  return { S, E, K };
}

const family = (u) => (u.area ? '광역' : u.ranged ? '원거리' : u.role === '벽' || u.role === '탱커' ? '탱커' : '근접');

function run() {
  const weights = traitWeights();
  const rows = YG.UNITS.map((u) => ({ u, fam: family(u), ...evaluate(u, weights) }));
  const med = (arr) => [...arr].sort((a, b) => a - b)[arr.length >> 1];
  const out = [];
  for (const g of [4, 3, 2, 1, 0]) {
    for (const fam of ['근접', '원거리', '광역', '탱커']) {
      const grp = rows.filter((r) => r.u.grade === g && r.fam === fam);
      if (!grp.length) continue;
      const mE = med(grp.map((r) => r.E));
      const mK = med(grp.map((r) => r.K));
      for (const r of grp) {
        const e = r.E / mE;
        const k = r.K / mK;
        out.push({ g, fam, id: r.u.id, role: r.u.role, cost: r.u.cost, S: r.S, E: Math.round(e * 100), K: Math.round(k * 100), V: Math.round(Math.sqrt(e * k) * 100), raw: r });
      }
    }
  }
  return { out, weights, rows };
}

if (require.main === module) {
  const { out, weights, rows } = run();
  console.log('특성 비중', Object.entries(weights).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' '));
  if (process.argv.includes('--csv')) {
    for (const r of out) console.log([r.g, r.id, r.E, r.K, r.V].join(','));
  } else {
    let key = '';
    for (const r of out) {
      if (`${r.g}${r.fam}` !== key) {
        key = `${r.g}${r.fam}`;
        console.log(`\n[${YG.GRADES[r.g].name} ${r.fam}]  유닛        역할   비용   딜/용돈  피격/용돈  종합`);
      }
      const flag = r.V < 75 || r.V > 135 ? '  <-' : '';
      console.log(`  ${r.id.padEnd(11)}${r.role.padEnd(5)}${String(r.cost).padStart(5)}  ${String(r.E).padStart(7)}  ${String(r.K).padStart(8)}  ${String(r.V).padStart(5)}${flag}`);
    }
    console.log('\n등급별 중앙값 (용돈당 딜 / 용돈당 피격 / 비용)');
    for (const g of [4, 3, 2, 1, 0]) {
      const grp = rows.filter((r) => r.u.grade === g);
      const m = (k) => med(grp.map((r) => r[k]));
      console.log(`  ${YG.GRADES[g].name}  E ${m('E').toFixed(1)}  K ${m('K').toFixed(1)}  비용 ${med(grp.map((r) => r.u.cost))}`);
    }
  }
}

module.exports = { run, evaluate };
