(function (g) {
  const TG = g.TG;
  /* v1.1 그림: 사파이어 아이콘. 루비(js/spr_ui2.js)와 같은 보석 모양에 파란색 */
  const NS = { shade: false };
  const P = (b, fn) => b.part(fn, true);
  TG.SPR.ui.sapphire = {
    id: 'ui.sapphire',
    name: '사파이어',
    w: 16,
    h: 16,
    ax: 8,
    ay: 8,
    outline: null,
    clips: { icon: 1 },
    draw(b) {
      P(b, () => {
        b.poly([[3.6, 6], [5.6, 3.2], [10.4, 3.2], [12.4, 6], [8, 13.2]], '#2f6fe0', { hi: 0.3, lo: -0.3 });
      });
      /* 면: 왼쪽 위가 밝고 오른쪽 아래가 어둡다 */
      b.poly([[3.6, 6], [5.6, 3.2], [7, 6]], '#8fc4ff', NS);
      b.poly([[5.6, 3.2], [10.4, 3.2], [9, 6], [7, 6]], '#c8e4ff', NS);
      b.poly([[10.4, 3.2], [12.4, 6], [9, 6]], '#4f8ff0', NS);
      b.poly([[3.6, 6], [7, 6], [8, 13.2]], '#3f80ec', NS);
      b.poly([[7, 6], [9, 6], [8, 13.2]], '#2a62d0', NS);
      b.poly([[9, 6], [12.4, 6], [8, 13.2]], '#1d4aa8', NS);
      b.px(6, 4.4, '#ffffff');
      b.px(7, 4.4, '#ffffff');
      b.px(5, 6.4, '#bfe0ff');
      b.px(4.6, 5.4, '#ffffff');
    },
  };
})(globalThis);
