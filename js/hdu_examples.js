(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품 예시. 머리 모양 1, 모자 1, 얼굴 장식 1, 소품 1, 복장 2.
     기존 sprites.js 의 같은 이름 함수가 하던 일을 그대로 하되 더 곱게 그렸다. 새 부품을 만들 때 이걸 본뜬다.
     L 의 좌표는 기존 도트 좌표(몸 기준, 머리 꼭대기 -25)이고 소수로 써도 된다. 자세한 규칙은 docs/hdu_guide.md */
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const GOLD = '#f2d450';

  /* 짧은 머리: 윗머리, 귀 앞 옆머리, 앞머리 가닥, 윤기 */
  HDU.hair.short = {
    front(L, look, q) {
      const c = look.hair;
      const sw = (q.step || 0) * 0.25;
      L.ell(0, -23.2, 6.7, 2.7, c);
      L.r(-6.7, -23.4, 13.4, 2.3, c);
      /* 옆머리 */
      L.poly([[-6.8, -23], [-5.1, -22], [-5.4, -17.6], [-6.6, -17.2]], c);
      L.poly([[5.2, -22], [6.8, -22.6], [6.3, -18.2], [5.4, -18.6]], c);
      /* 앞머리 가닥 */
      const bangs = [[-5, 1.4], [-2.8, 1.9], [-0.4, 1.2], [1.8, 1.8], [4, 1.1]];
      for (const [x, d] of bangs) L.poly([[x - 1.3, -21.4], [x + 1.3, -21.4], [x + 0.2 + sw, -21.4 + d]], c);
      /* 그늘, 윤기 */
      L.r(-5.6, -21.6, 11, 0.5, tone(c, -0.3));
      L.r(5.2, -21.4, 1.2, 3, tone(c, -0.25));
      L.line(-4.2, -24.6, 1.6, -25.5, tone(c, 0.3), 0.7);
      L.line(-5.4, -23.2, -3.4, -24.4, tone(c, 0.22), 0.6);
      L.px(2.4, -25, tone(c, 0.4));
    },
  };

  /* 야구모자: 둥근 챙 모자 */
  HDU.hat.cap = (L, look) => {
    const c = look.trim;
    L.ell(-0.4, -23.6, 6.6, 3, c);
    L.r(-6.7, -23.6, 13, 2.6, c);
    L.ell(-1.8, -25, 3.4, 1.2, tone(c, 0.2));
    /* 챙 */
    L.poly([[3, -21.4], [10.6, -21], [10.2, -19.8], [3.4, -20]], tone(c, -0.12));
    L.poly([[3, -21.4], [10.6, -21], [10.4, -21.5], [4, -22]], tone(c, 0.18));
    /* 띠와 단추 */
    L.r(-6.7, -21.2, 9.6, 0.6, tone(c, -0.3));
    L.px(-0.4, -26.6, tone(c, -0.2));
    /* 뒤로 삐져나온 머리 */
    L.r(-7.4, -20.4, 1.6, 3.4, look.hair);
  };

  /* 안경 */
  HDU.face.glasses = (L) => {
    const frame = '#2a2630';
    for (const x of [-2.4, 1.6]) {
      L.r(x, -20, 3.8, 3.4, '#bfe3f2');
      L.r(x, -20, 3.8, 0.5, frame);
      L.r(x, -17, 3.8, 0.5, frame);
      L.r(x, -20, 0.5, 3.4, frame);
      L.r(x + 3.3, -20, 0.5, 3.4, frame);
    }
    L.r(1.4, -18.7, 0.8, 0.5, frame);
    L.line(-2.4, -18.7, -6, -18.5, frame, 0.4);
    L.line(2.6, -19.6, 3.4, -20, '#ffffff', 0.3);
  };

  /* 야구방망이: 손에서 방향대로 뻗는다 */
  HDU.prop.bat = (L) => {
    const [hx, hy] = L.handF;
    const [ex, ey] = L.along(13);
    const U = L.U;
    const wood = '#c9904f';
    L.h.line(hx, hy, ex, ey, tone(wood, -0.3), Math.round(2.4 * U));
    L.h.line(hx, hy, ex, ey, wood, Math.round(1.7 * U));
    L.h.line(hx - 1, hy - 1, ex - 1, ey - 1, tone(wood, 0.3), Math.max(1, Math.round(0.5 * U)));
    /* 손잡이 테이프, 굵은 끝 */
    const [tx, ty] = L.along(2.2);
    L.h.line(hx, hy, tx, ty, '#2a2630', Math.round(1.8 * U));
    L.h.ell(ex, ey, Math.round(1.7 * U), Math.round(1.7 * U), tone(wood, 0.12));
    L.h.px(ex - 2, ey - 2, tone(wood, 0.45));
  };

  /* 망토: 걸을수록 뒤로 펄럭인다 */
  HDU.wear.cape = {
    layer: 'back',
    draw(L, look, q, color) {
      const c = color || '#7a2e3a';
      const sw = q.step * 1.5 - q.atk * 2;
      L.poly([[-4, -14], [-6.5, -13.5], [-8.5 + sw, -3], [-9.5 + sw * 2, 2], [-3, 1], [-2.5, -6]], c);
      L.poly([[-4, -14], [-6.5, -13.5], [-7.5 + sw, -6], [-3.4, -8]], tone(c, 0.14));
      L.poly([[-3, 1], [-9.5 + sw * 2, 2], [-9.8 + sw * 2, 0.8], [-3, 0.2]], GOLD);
      L.line(-5, -11, -8 + sw, -1, tone(c, -0.3), 0.4);
    },
  };

  /* 넥타이 */
  HDU.wear.tie = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#d9483b';
      L.poly([[-0.8, -12.4], [0.8, -12.4], [0.5, -11], [-0.5, -11]], tone(c, -0.2));
      L.poly([[-0.9, -11], [0.9, -11], [1.2, -7.4], [0, -6.4], [-1.2, -7.4]], c);
      L.line(0, -11, 0, -7, tone(c, 0.2), 0.3);
    },
  };
})(globalThis);
