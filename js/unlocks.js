(function (g) {
  const YG = g.YG;

  /* 유닛 정의의 unlockStage(스테이지 번호)에 그 동료를 첫 클리어 보상으로 건다. 스테이지를 새로 만들 때도 같은 보상이 붙게 한다 */
  const byStage = {};
  for (const u of YG.UNITS) {
    if (!u.unlockStage) continue;
    const st = YG.STAGES[u.unlockStage - 1];
    if (!st) throw new Error(`${u.id}: unlockStage ${u.unlockStage} 스테이지가 없다`);
    if (st.unlock || byStage[u.unlockStage]) throw new Error(`${u.id}: ${u.unlockStage}번 스테이지는 이미 동료 보상이 있다`);
    st.unlock = u.id;
    byStage[u.unlockStage] = u.id;
  }

  const prev = YG.regenStage;
  YG.regenStage = (id) => {
    const st = prev(id);
    if (byStage[id]) st.unlock = byStage[id];
    return st;
  };
})(globalThis);
