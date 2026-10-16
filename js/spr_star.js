(function (g) {
  const TG = g.TG;
  /* 메아리 별 (151~170단계 = 메아리 ★1 ~ ★20): 150단계 메아리 그림 위에 별과 아우라를 얹는다.
     별이 늘수록 도는 별 알갱이가 늘고, 빛 고리가 겹치고, 색이 노랑 -> 분홍 -> 보라 -> 파랑 -> 초록 -> 흰색으로 옮겨 간다. */
  const NS = { shade: false };
  const TAU = Math.PI * 2;
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const rgb = (a) => `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const mix = (a, b, k) => rgb(hex(a).map((v, i) => v + (hex(b)[i] - v) * k));

  function aura(b, s, clip, i, n) {
    const col = TG.TIER_COLORS[149 + s] || '#ffffff';
    const ph = clip === 'shine' ? i / n : 0.25;
    const soft = mix(col, '#ffffff', 0.35);
    /* 바깥 빛 고리: 별이 늘수록 겹이 늘고 굵어진다 */
    const rings = Math.min(4, 1 + Math.floor(s / 5));
    for (let k = 0; k < rings; k++) {
      const r = 7.2 - k * 1 + Math.sin((ph + k / rings) * TAU) * 0.5;
      b.disc(10, 10, r, col, { ...NS, alpha: 0.1 + 0.03 * s / 4 });
    }
    /* 도는 별 알갱이: 별 하나마다 한 알 (최대 10) */
    const dots = Math.min(10, s);
    for (let k = 0; k < dots; k++) {
      const a = (k / dots + ph * (k % 2 ? -1 : 1)) * TAU;
      const r = 7 + (k % 3 === 0 ? 0.4 : -0.4);
      const x = 10 + Math.cos(a) * r;
      const y = 10 + Math.sin(a) * r;
      b.px(x, y, k % 2 ? soft : '#ffffff');
      if (k % 3 === 0) {
        b.px(x + 1, y, soft, 0.6);
        b.px(x - 1, y, soft, 0.6);
        b.px(x, y + 1, soft, 0.6);
        b.px(x, y - 1, soft, 0.6);
      }
    }
    /* 위쪽의 별 표시: 별 다섯 개마다 한 줄 (모서리에 닿지 않게 3점 아래부터) */
    const rowsN = Math.ceil(s / 5);
    for (let r = 0; r < rowsN; r++) {
      const cnt = Math.min(5, s - r * 5);
      for (let k = 0; k < cnt; k++) b.px(10 - (cnt - 1) + k * 2, 3 + r * 2, k % 2 ? '#ffffff' : soft);
    }
  }

  const fallback = (b) => {
    b.poly([[10, 2], [17, 10], [10, 18], [3, 10]], '#ffe9a0');
    b.px(8, 7, '#ffffff');
  };

  for (let s = 1; s <= 20; s++) {
    const tier = 150 + s;
    TG.SPR.item[`t${tier}`] = {
      id: `item.t${tier}`,
      tier,
      w: 20,
      h: 20,
      ax: 10,
      ay: 10,
      outline: null,
      clips: { icon: 1, shine: 6 },
      draw(b, clip, i, n, pal, ctx) {
        const base = TG.SPR.item.t150;
        if (base) base.draw(b, clip, i, n, pal, ctx);
        else fallback(b);
        aura(b, s, clip, i, n);
      },
    };
  }
})(globalThis);
