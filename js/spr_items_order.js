(function (g) {
  const TG = g.TG;
  /* 던질 것 71~90 그림 순서 바꾸기: 그림은 처음에 71~80 (지나온 땅의 무기), 81~90 (돌아온 소리) 로 그렸다.
     쉬워 보이는 쪽이 앞에 오도록 71~79 에 소리 9종, 80~89 에 땅의 무기 10종을 놓고 90 은 그대로 둔다. */
  const IT = TG.SPR.item;
  const old = {};
  for (let t = 71; t <= 89; t++) old[t] = IT[`t${t}`];
  const order = {};
  for (let k = 0; k < 9; k++) order[71 + k] = 81 + k; /* 새 단계 <- 그린 단계 */
  for (let k = 0; k < 10; k++) order[80 + k] = 71 + k;
  for (const [nw, od] of Object.entries(order)) {
    if (old[od]) IT[`t${nw}`] = { ...old[od], id: `item.t${nw}`, tier: Number(nw) };
  }
})(globalThis);
