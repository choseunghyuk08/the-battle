(function (g) {
  const TG = g.TG;
  const { TAU } = TG.anim;

  /* 특수능력 아이콘 (담당 Y). docs/art_guide.md 의 v0.6 "특수능력 아이콘" 절 참고
     TG.SPR.ui['ab_<id>'] 10종과 TG.SPR.ui.ability (하단 탭), 모두 16 x 16, 동작 'icon' 1장.
     js/spr_relics.js 와 같은 화풍: 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다,
     그림은 2..14 안, 빛은 왼쪽 위.
     계열 색: 물리 = 주황/갈색 (knock, pierce, execute), 원소 = 파랑/보라/빨강 (stun, bleed, freeze, chain, blast),
     이득 = 초록/금/분홍 (vamp, lucky, ability). */

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_relics.js 의 것을 복사)                                  */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;

  function ring(b, cx, cy, r, t, color, opts = NS, sy = 1) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 48;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro * sy]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri * sy]);
    b.poly(pts, color, opts);
  }

  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : core === color ? color : k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    b.px(x, y, core);
  }

  function sparkle(b, x, y, s, color) {
    twinkle(b, x, y, s, color, color);
    b.px(x, y, '#ffffff');
  }


  /* 별 다각형 (꼭짓점 n 개) */
  const starPts = (cx, cy, ro, ri, n = 5, rot = -90) => {
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = rad(rot + (k * 180) / n);
      const r = k % 2 ? ri : ro;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  };

  /* p -> q 사이를 지그재그로 잇는 점들 (n 마디, 진폭 amp) */
  const zigzag = (p, q, n, amp) => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const pts = [p];
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const s = k % 2 ? amp : -amp;
      pts.push([p[0] + dx * t + nx * s, p[1] + dy * t + ny * s]);
    }
    pts.push(q);
    return pts;
  };

  /* ------------------------------------------------------------------ */
  /* 아이콘                                                              */
  /* ------------------------------------------------------------------ */
  const UI = TG.SPR.ui;
  const icon = (key, label, draw) => {
    UI[key] = { id: `ui.${key}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  const GOLD = '#ffcf40';
  const GOLD2 = '#d8921f';
  const GOLD3 = '#ffe58a';
  const STEEL = '#c9d3e0';
  const STEEL2 = '#7d8aa0';
  const WOOD = '#b0703a';
  const WOOD3 = '#e0a868';
  const RED = '#ec3450';
  const INK = '#2a2030';
  const W = '#ffffff';

  /* 넉백: 앞으로 내지른 주먹 (손가락 마디 넷, 엄지), 위로 퍼지는 충격선과 먼지 */
  icon('ab_knock', '넉백', (b) => {
    const SK = '#f0a458';
    const SK2 = '#c46a30';
    const SK3 = '#ffd4a0';
    const YL = '#ffe45a';
    /* 충격선 (주먹 위로 방사) */
    P(b, () => {
      b.line(8, 2.6, 8, 3.8, 1.3, YL, NS);
      b.line(3.6, 3.2, 4.8, 4.4, 1.3, YL, NS);
      b.line(12.4, 3.2, 11.2, 4.4, 1.3, YL, NS);
    });
    /* 먼지 */
    P(b, () => {
      b.disc(3.2, 13, 1.1, '#e6dcc8', NS);
      b.disc(12, 13, 1.1, '#e6dcc8', NS);
      b.px(3, 12, W);
    });
    /* 주먹: 손가락 넷 (사이 줄은 어둡게), 손등, 엄지 */
    P(b, () => {
      b.rrect(2, 8, 11, 6, 2, SK, NS);
      [[2, 6], [5, 5], [8, 5], [11, 6]].forEach(([x, y]) => {
        b.rrect(x, y, 2, 7, 1, SK, NS);
        b.rect(x, y + 1, 1, 3, SK3, NS);
      });
      for (const x of [4, 7, 10]) b.rect(x, 7, 1, 3, SK2, NS);
      b.rect(2, 13, 11, 1, SK2, NS);
    });
    P(b, () => {
      b.rrect(2.6, 9.6, 6.6, 2.6, 1.3, '#f8bc7a', NS);
      b.rect(3.4, 9.6, 4.6, 0.8, SK3, NS);
      b.rect(3, 11.4, 6, 0.8, SK2, NS);
    });
  });

  /* 기절: 빙글빙글 도는 소용돌이 눈, 둘레를 도는 노란 별 셋 */
  icon('ab_stun', '기절', (b) => {
    const cx = 7.8;
    const cy = 8.4;
    /* 눈알 + 소용돌이 */
    P(b, () => {
      b.disc(cx, cy, 4.7, '#e8e0ff', { hi: 0.3, lo: -0.18 });
      let px0 = cx;
      let py0 = cy;
      for (let a = 0.4; a <= TAU * 1.75; a += 0.25) {
        const r = 0.4 + a * 0.38;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        b.line(px0, py0, x, y, 1.05, '#5a3aa8', NS);
        px0 = x;
        py0 = y;
      }
      b.px(cx - 3, cy - 2, W);
      b.px(cx - 2, cy - 3, W);
    });
    /* 둘레를 도는 별 셋 */
    for (const [x, y, r] of [[4.2, 4.4, 2.5], [11.8, 5, 2.6], [11.4, 11.8, 2.3]]) {
      P(b, () => {
        b.poly([[x, y - r], [x + r * 0.38, y - r * 0.38], [x + r, y], [x + r * 0.38, y + r * 0.38], [x, y + r], [x - r * 0.38, y + r * 0.38], [x - r, y], [x - r * 0.38, y - r * 0.38]], '#ffd83a', NS);
        b.px(x - 0.5, y - 0.5, W);
      });
    }
  });

  /* 관통: 겹친 두 철판을 화살이 뚫고 지나감 (구멍 둘레가 깨짐) */
  icon('ab_pierce', '관통', (b) => {
    const PL = '#7e8cac';
    /* 판 둘 + 뚫린 구멍 */
    for (const x of [4.4, 8.8]) {
      P(b, () => {
        b.rect(x, 2.4, 2.4, 11.2, PL, { hi: 0.3, lo: -0.3 });
        b.rect(x, 2.4, 1, 11.2, '#b4c2dc', NS);
        b.px(x + 1.5, 4, '#5a6888');
        b.px(x + 1.5, 11.6, '#5a6888');
        b.rect(x, 6, 2.4, 4, INK, NS);
      });
    }
    /* 구멍에서 튀는 쇳조각 */
    b.px(7.2, 5, '#d8e2f4');
    b.px(7.4, 11.4, '#d8e2f4');
    b.px(11.8, 4.6, '#d8e2f4');
    b.px(12, 11.8, '#d8e2f4');
    /* 화살대 */
    P(b, () => {
      b.line(3.6, 8, 11.8, 8, 1.9, '#f6dc9a', NS);
      b.rect(3.8, 7, 7.8, 1, '#fff6d8', NS);
    });
    /* 깃 */
    P(b, () => {
      b.poly([[2.2, 4.8], [4.4, 7.2], [4.4, 8], [3, 8], [2.4, 6.4]], '#ec4a48', NS);
      b.poly([[2.2, 11.2], [4.4, 8.8], [4.4, 8], [3, 8], [2.4, 9.6]], '#d03a3a', NS);
      b.px(2.6, 5.6, '#ff9a8a');
    });
    /* 촉 */
    P(b, () => {
      b.poly([[11, 4.6], [14.8, 8], [11, 11.4], [12.4, 8]], '#e6eefa', NS);
      b.poly([[11.6, 5.4], [14.4, 8], [12.8, 7.6]], '#ffffff', NS);
      b.poly([[11.6, 10.6], [14.4, 8], [12.8, 8.4]], '#8494b4', NS);
    });
  });

  /* 출혈: 큰 붉은 핏방울, 아래 바닥에 갈라진 금 */
  icon('ab_bleed', '출혈', (b) => {
    const DK = '#b49a86';
    /* 갈라진 금 (맨 뒤) */
    P(b, () => {
      b.line(3, 13.2, 5.8, 12.8, 0.9, DK, NS);
      b.line(5.8, 12.8, 7, 14.2, 0.9, DK, NS);
      b.line(9, 14.2, 10.2, 12.8, 0.9, DK, NS);
      b.line(10.2, 12.8, 13.2, 13.4, 0.9, DK, NS);
    });
    P(b, () => {
      b.disc(8, 8.4, 4.4, RED, { hi: 0.4, lo: -0.3 });
      b.poly([[8, 1.6], [4.2, 7.6], [11.8, 7.6]], RED, { hi: 0.4, lo: -0.3 });
      b.rect(6.6, 4, 1.6, 2, '#ff5a70', NS);
      b.rect(10, 9, 1.4, 2.6, '#a01832', NS);
      b.rect(9, 11, 2, 0.8, '#a01832', NS);
      b.px(6, 8, W);
      b.px(6, 9, '#ffc0c8');
      b.px(7, 7, '#ff9aa8');
      b.px(7, 3.6, '#ffb0bc');
    });
    /* 작은 방울 */
    P(b, () => {
      b.disc(13, 5.8, 1.3, RED, NS);
      b.poly([[13, 3.2], [11.9, 5.4], [14.1, 5.4]], RED, NS);
      b.px(12.6, 5.6, '#ffc0c8');
    });
  });

  /* 빙결: 눈꽃 결정 (여섯 갈래, 갈래마다 곁가지) */
  icon('ab_freeze', '빙결', (b) => {
    const C = '#bfeaff';
    const C2 = '#5ab4f0';
    const cx = 8;
    const cy = 8;
    P(b, () => {
      for (let k = 0; k < 3; k++) {
        const a = rad(90 + k * 60);
        const dx = Math.cos(a) * 5.4;
        const dy = Math.sin(a) * 5.4;
        b.line(cx - dx, cy - dy, cx + dx, cy + dy, 1.5, C, { hi: 0.35, lo: -0.2 });
      }
      for (let k = 0; k < 6; k++) {
        const a0 = 90 + k * 60;
        const bx = cx + Math.cos(rad(a0)) * 3.5;
        const by = cy + Math.sin(rad(a0)) * 3.5;
        for (const s of [-1, 1]) {
          const a = rad(a0 + s * 55);
          b.line(bx, by, bx + Math.cos(a) * 2.1, by + Math.sin(a) * 2.1, 1.1, C, NS);
        }
      }
      b.disc(cx, cy, 1.9, '#eaf9ff', NS);
      b.px(7, 7, W);
      b.px(8, 8, C2);
    });
    sparkle(b, 13.4, 2.8, 2, '#5ab4f0');
    b.px(2.6, 13.2, '#bfeaff');
  });

  /* 연쇄: 파란 구슬 셋이 지그재그 번개로 이어짐 */
  icon('ab_chain', '연쇄', (b) => {
    const A = [12, 4.4];
    const B = [4, 8];
    const C = [12, 11.6];
    for (const [p, q] of [[A, B], [B, C]]) {
      P(b, () => {
        const pts = zigzag(p, q, 3, 1.8);
        for (let k = 1; k < pts.length; k++) b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1.8, '#ffd83a', { hi: 0.5, lo: -0.1 });
      });
    }
    for (const [x, y] of [A, B, C]) {
      P(b, () => {
        b.disc(x, y, 2.2, '#4a7cf0', SH);
        b.disc(x + 0.3, y + 0.4, 1.1, '#b4d0ff', NS);
        b.px(x - 1, y - 1, W);
      });
    }
  });

  /* 폭발: 터지는 불꽃 구름 (빨강 -> 주황 -> 노랑 -> 흰 심) */
  icon('ab_blast', '폭발', (b) => {
    const cx = 8;
    const cy = 8;
    P(b, () => {
      b.poly(starPts(cx, cy, 6.6, 3.8, 8, -70), '#e8402a', { hi: 0.3, lo: -0.3 });
      b.poly(starPts(cx, cy, 5, 2.8, 8, -50), '#ff8a2a', { hi: 0.3, lo: -0.2 });
      b.poly(starPts(cx, cy, 3.2, 1.9, 8, -70), '#ffd840', { hi: 0.3, lo: -0.2 });
      b.disc(cx - 0.2, cy, 1.2, '#fff8d0', NS);
      b.px(cx - 0.6, cy - 0.6, W);
    });
    /* 튀는 불똥 */
    b.px(2.4, 3.4, '#ffd840');
    b.px(13.8, 2.6, '#ff8a2a');
    b.px(14, 13.4, '#ffd840');
  });

  /* 흡혈: 송곳니 둘 (잇몸에서 아래로), 피가 떨어져 하트로 */
  icon('ab_vamp', '흡혈', (b) => {
    /* 잇몸 + 송곳니 */
    P(b, () => {
      b.rrect(2.6, 2, 10.8, 2.6, 1, '#c83c6a', SH);
      b.poly([[3.8, 4], [7.2, 4], [5.5, 6.8]], '#fff8ec', { hi: 0.2, lo: -0.18 });
      b.poly([[8.8, 4], [12.2, 4], [10.5, 6.8]], '#fff8ec', { hi: 0.2, lo: -0.18 });
      b.px(4.8, 4.8, W);
      b.px(9.8, 4.8, W);
    });
    /* 하트 (송곳니에서 떨어진 피) */
    P(b, () => {
      b.disc(6.2, 10.4, 2.4, RED, { hi: 0.4, lo: -0.3 });
      b.disc(9.8, 10.4, 2.4, RED, { hi: 0.4, lo: -0.3 });
      b.poly([[3.9, 11.2], [12.1, 11.2], [8, 14.4]], RED, { hi: 0.4, lo: -0.3 });
      b.px(5.2, 9.4, W);
      b.px(5, 10.4, '#ffc0c8');
    });
    b.px(5.5, 7.8, RED);
    b.px(10.5, 7.8, RED);
  });

  /* 행운: 큰 네잎클로버, 비스듬히 걸친 금화 */
  icon('ab_lucky', '행운', (b) => {
    const L = '#3cc058';
    const cx = 6.8;
    const cy = 6.6;
    /* 줄기 */
    P(b, () => {
      b.line(cx, cy + 1, 4.2, 13.6, 1.3, '#23803c', NS);
      b.px(5, 12, '#58d070');
    });
    /* 잎 넷 */
    P(b, () => {
      for (const [dx, dy] of [[0, -2.3], [0, 2.3], [-2.3, 0], [2.3, 0]]) b.disc(cx + dx, cy + dy, 2.5, L, { hi: 0.4, lo: -0.3 });
      b.disc(cx, cy, 1.6, L, NS);
      /* 잎맥 */
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        b.px(cx + dx * 1.4, cy + dy * 1.4, '#a8f4a8');
      }
      b.px(cx - 2, cy - 2.6, W);
      b.px(cx - 3.4, cy - 1, '#c8ffc8');
    });
    /* 금화 */
    P(b, () => {
      b.disc(11, 11, 3, GOLD, { hi: 0.45, lo: -0.3 });
      ring(b, 11, 11, 2, 0.7, GOLD2);
      b.rect(10.6, 10, 1, 2, GOLD2, NS);
      b.px(9.2, 9.2, W);
      b.px(8.8, 10.2, GOLD3);
    });
    sparkle(b, 12.8, 3, 2, '#ffb428');
  });

  /* 처형: 해골과 도끼날 */
  icon('ab_execute', '처형', (b) => {
    const BONE = '#f2ead6';
    const BONE2 = '#b8aa88';
    /* 도끼 자루 (해골 뒤로 대각선) */
    P(b, () => {
      b.line(3.2, 13, 11.2, 4.6, 1.8, WOOD, { hi: 0.3, lo: -0.3 });
      b.px(3.8, 12, WOOD3);
    });
    /* 도끼날 (오른쪽 위) */
    P(b, () => {
      b.poly([[8.6, 2.4], [13.4, 2.2], [13.8, 5.4], [13, 9.2], [10.8, 7.6], [9.4, 5]], STEEL, { hi: 0.4, lo: -0.3 });
      b.poly([[12, 3], [13.2, 2.8], [13.4, 5.4], [12.8, 8], [12, 6]], '#f4f8ff', NS);
      b.px(9.6, 3.4, W);
      b.px(10.2, 4.2, W);
      b.px(12.8, 7, '#ec3450');
      b.px(13.2, 6, '#ec3450');
    });
    /* 해골 */
    P(b, () => {
      b.ell(7, 9.2, 4.8, 4, BONE, SH);
      b.rect(4.6, 11.4, 4.8, 2.8, BONE, NS);
      b.rect(4.6, 13.6, 4.8, 0.6, BONE2, NS);
      /* 눈구멍 */
      b.rect(4.2, 8.2, 2.2, 2.2, INK, NS);
      b.rect(7.8, 8.2, 2.2, 2.2, INK, NS);
      b.px(4.6, 8.6, '#c8284a');
      b.px(8.2, 8.6, '#c8284a');
      /* 코와 이빨 */
      b.px(6.6, 10.8, INK);
      b.px(7.6, 10.8, INK);
      b.px(5.4, 12.6, INK);
      b.px(7, 12.6, INK);
      b.px(8.6, 12.6, INK);
      b.px(5, 6.4, W);
      b.px(6.2, 5.9, W);
    });
  });

  /* 특수능력 탭: 별이 박힌 룬 방패 */
  icon('ability', '특수능력', (b) => {
    const shield = (k) => [[2.8 + k, 2.8 + k], [13.2 - k, 2.8 + k], [13.2 - k, 8], [8, 14 - k * 1.3], [2.8 + k, 8]];
    P(b, () => {
      b.poly(shield(0), STEEL, SH);
      b.poly(shield(1.1), '#5a46c8', { hi: 0.3, lo: -0.3 });
      b.poly([[4.2, 4.2], [8, 4.2], [4.2, 8]], '#7a66e0', NS);
      b.px(3.6, 3.6, W);
      b.px(12.4, 3.6, STEEL2);
    });
    P(b, () => {
      b.poly(starPts(8, 7.6, 3.6, 1.6, 5, -90), GOLD, { hi: 0.45, lo: -0.3 });
      b.px(7, 6.4, GOLD3);
      b.px(8, 5.4, W);
    });
    sparkle(b, 13, 2.6, 2, '#8a6af0');
  });
})(globalThis);
