/* 동료 HD 부품이 어디에 쓰이는지, 아직 안 그려진 부품이 뭔지 본다.
   node tests/uses.js hat tophat       그 부품을 쓰는 동료와 단계 (0 기본, 1 진화, 2 각성)
   node tests/uses.js --missing        쓰이는데 아직 등록 안 된 부품 목록 */
const { load } = require('./sizecheck');

const YG = load();
const kinds = { hair: (l) => [l.style], hat: (l) => [l.hat], face: (l) => [l.face], prop: (l) => [l.prop], wear: (l) => [...(l.wear || []), ...(l.gear || [])].map((x) => x.split(':')[0]) };
const regOf = { hair: YG.HDU.hair, hat: YG.HDU.hat, face: YG.HDU.face, prop: YG.HDU.prop, wear: YG.HDU.wear };

function forms() {
  const out = [];
  for (const u of YG.UNITS) for (const lvl of [0, 1, 2]) out.push({ u, lvl, look: YG.resolveDef(u, lvl).look });
  return out;
}

if (process.argv[2] === '--missing') {
  for (const [kind, pick] of Object.entries(kinds)) {
    const used = new Set();
    for (const f of forms()) for (const n of pick(f.look)) if (n) used.add(n);
    /* prop 'bag' 은 뼈대가 직접 그린다. 머리 'bald'/'afro' 는 모양 이름이다 */
    const miss = [...used].filter((n) => !regOf[kind][n] && !(kind === 'prop' && n === 'bag'));
    console.log(`${kind}: 쓰는 것 ${used.size}종, 아직 없는 것 ${miss.length}종${miss.length ? ` -> ${miss.join(', ')}` : ''}`);
  }
} else {
  const [kind, name] = process.argv.slice(2);
  if (!kinds[kind] || !name) {
    console.log('사용법: node tests/uses.js <hair|hat|face|prop|wear> <이름>  또는  --missing');
    process.exit(1);
  }
  const hits = {};
  for (const f of forms()) if (kinds[kind](f.look).includes(name)) (hits[f.u.id] = hits[f.u.id] || []).push(f.lvl);
  for (const [id, lv] of Object.entries(hits)) console.log(`${id} (${lv.join(',')})  ${YG.unitById(id).name}`);
  console.log(`${Object.keys(hits).length}명`);
}
