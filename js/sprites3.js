(function (g) {
  const YG = g.YG;
  const { builder, CX, BY } = YG.spriteKit;

  /* 해외편 적 아키타입. sprites2.js 와 같은 방식(자세표 q로 17프레임)이고, YG.archRender 를 감싸서 끼워 넣는다.
     folk(사람꼴), crawler, quad, thing, wisp, head, serpent, rider */

  const hex = (n) => `#${[16, 8, 0].map((s) => ((n >> s) & 255).toString(16).padStart(2, '0')).join('')}`;
  const rgb = (c) => parseInt(c.slice(1), 16);
  const darken = (c, k) => {
    const n = rgb(c);
    return hex([16, 8, 0].reduce((a, s) => a | (Math.round(((n >> s) & 255) * k) << s), 0));
  };
  const lighten = (c, k) => {
    const n = rgb(c);
    return hex([16, 8, 0].reduce((a, s) => a | (Math.round(((n >> s) & 255) * (1 - k) + 255 * k) << s), 0));
  };

  const FLAP_IDLE = [-3, 0, 2, 0];
  const FLAP_WALK = [-6, -2, 2, 5, 2, -2];
  const flapOf = (q) => {
    if (q.kind === 'idle') return FLAP_IDLE[q.i];
    if (q.kind === 'walk') return FLAP_WALK[q.i];
    if (q.wind > 0.3) return -7;
    if (q.atk > 0.3) return 5;
    return q.hurt ? -4 : 0;
  };
  /* 소품 끝은 캔버스 안에 머물게 자른다 */
  const along = (q, hx, hy, len) => [
    Math.min(45, Math.max(2, Math.round(hx + q.dir[0] * len))),
    Math.min(33, Math.max(2, Math.round(hy + q.dir[1] * len))),
  ];
  const wave = (q, k, amp = 1) => Math.round(Math.sin((q.kind === 'idle' ? q.i * 1.6 : q.i * 1.05) + k) * amp);

  /* 볼록 다각형을 한 줄씩 채운다 */
  const poly = (b, pts, c) => {
    const ys = pts.map((q) => q[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
      if (xs.length >= 2) {
        const x0 = Math.round(Math.min(...xs));
        b.r(x0, y, Math.round(Math.max(...xs)) - x0 + 1, 1, c);
      }
    }
  };

  /* 날개: 어깨 (x, y) 에서 뒤쪽 위로 뻗는다 */
  const WINGS = {
    bat(b, x, y, flap, p) {
      const c = p.wingColor || '#3a3050';
      const edge = p.wingEdge || lighten(c, 0.25);
      for (let i = 0; i < 15; i++) {
        const lead = Math.max(1, y - 1 - Math.round(i * 0.55 + (flap * i) / 15));
        const tail = y + 6 - Math.round(i * 0.3 + (flap * i * 0.6) / 15) + (i % 5 === 4 ? 1 : 0);
        b.r(x - i, lead, 1, Math.max(2, tail - lead), i % 5 === 3 ? edge : c);
      }
    },
    moth(b, x, y, flap, p) {
      const c = p.wingColor || '#6b6258';
      const edge = p.wingEdge || '#b0a48e';
      const tip = Math.max(2, y - 13 + Math.round(flap * 0.5));
      poly(b, [[x + 1, y - 2], [x - 13, tip], [x - 12, tip + 6], [x - 6, y + 3], [x + 1, y + 3]], c);
      poly(b, [[x, y + 1], [x - 9, y + 4 - Math.round(flap * 0.3)], [x - 8, y + 10], [x - 1, y + 8]], darken(c, 0.88));
      b.line(x - 13, tip, x - 12, tip + 6, edge, 1);
      b.line(x - 12, tip + 6, x - 6, y + 3, edge, 1);
      b.disc(x - 8, tip + 6, 1, '#e8dcb8');
      b.px(x - 8, tip + 6, '#3a2a2a');
    },
    crow(b, x, y, flap, p) {
      const c = p.wingColor || '#1d1d26';
      const edge = p.wingEdge || '#3a3a4c';
      [[-12, -9], [-14, -5], [-13, -1], [-10, 3]].forEach(([dx, dy], k) => {
        b.line(x, y, x + dx, y + dy + 1 - Math.round((flap * (k + 1)) / 5), k % 2 ? edge : c, 3);
      });
      b.r(x - 4, y - 3, 6, 6, c);
    },
    cape(b, x, y, flap, p, q, floor) {
      const c = p.wingColor || '#14121a';
      const lin = p.wingEdge || '#9a1f2e';
      const sw = Math.round(q.step * 1.5) - Math.round(q.atk * 2);
      const end = floor - 1;
      b.r(x - 2, y - 2, 6, 5, c);
      b.r(x - 5 + sw, y + 2, 7, 7, c);
      b.r(x - 6 + sw * 2, y + 8, 8, Math.max(2, end - (y + 8) - 2), c);
      b.r(x - 6 + sw * 2, end - 1, 8, 2, lin);
      if (q.atk > 0.4 || q.wind > 0.6) {
        for (let i = 0; i < 13; i++) {
          const top = Math.max(1, y - 3 - Math.round(i * 0.7));
          b.r(x - i, top, 1, Math.min(end - top, 14 - Math.round(i * 0.4)), i % 4 === 3 ? lin : c);
        }
      }
    },
  };

  /* 머리카락. 머리 칸은 (ux-6, uy-25) 에서 12x11 */
  function hairBack(b, p, ux, uy, q) {
    const hc = p.hair || '#15161a';
    const hy = uy - 25;
    if (p.style === 'long' || p.style === 'cover') {
      const sw = Math.round(q.step * 1.5);
      b.r(ux - 9 + sw, hy + 2, 4, 15, hc);
      b.r(ux - 8 + sw, hy + 16, 3, 5, hc);
    }
  }

  const HAT_COVERS = new Set(['qing', 'helm', 'tokin', 'tophat', 'dish', 'hood']);

  function hairFront(b, p, ux, uy) {
    if (HAT_COVERS.has(p.hat) && p.hat !== 'dish') return;
    const hc = p.hair || '#15161a';
    const hy = uy - 25;
    const st = p.style || 'short';
    if (st === 'bald') return;
    b.r(ux - 6, hy, 12, 4, hc);
    b.r(ux - 7, hy + 2, 2, 5, hc);
    b.r(ux + 5, hy + 2, 2, 4, hc);
    b.r(ux - 5, hy + 4, 6, 1, hc);
    if (st === 'bob') {
      b.r(ux - 8, hy + 2, 3, 10, hc);
      b.r(ux + 5, hy + 3, 2, 7, hc);
      b.r(ux - 5, hy + 4, 11, 1, hc);
    } else if (st === 'long') {
      b.r(ux + 5, hy + 3, 2, 12, hc);
      b.r(ux - 5, hy + 4, 11, 1, hc);
    } else if (st === 'cover') {
      /* 얼굴을 덮은 머리카락 사이로 눈 하나만 보인다 */
      b.r(ux - 6, hy + 3, 12, 8, hc);
      b.r(ux + 5, hy + 3, 2, 14, hc);
      b.r(ux, hy + 6, 3, 2, p.skin || '#e8e0e4');
      b.r(ux + 1, hy + 6, 2, 2, p.eyes || '#e8e0e4');
      b.px(ux + 2, hy + 7, p.pupil || '#14121a');
    } else if (st === 'wild') {
      b.disc(ux - 3, hy - 1, 3, hc);
      b.disc(ux + 3, hy - 2, 3, hc);
      b.r(ux - 8, hy + 1, 3, 7, hc);
      b.r(ux + 5, hy, 3, 3, hc);
    } else if (st === 'spiky') {
      b.r(ux - 5, hy - 3, 2, 3, hc);
      b.r(ux - 2, hy - 4, 2, 4, hc);
      b.r(ux + 1, hy - 4, 2, 4, hc);
      b.r(ux + 4, hy - 3, 2, 3, hc);
    } else if (st === 'slick') {
      b.r(ux - 6, hy - 1, 12, 4, hc);
      b.r(ux - 7, hy + 2, 2, 6, hc);
      b.px(ux + 1, hy + 4, hc);
      b.px(ux + 2, hy + 5, hc);
    } else if (st === 'topknot') {
      b.r(ux - 2, hy - 4, 4, 4, hc);
    } else if (st === 'bun') {
      b.disc(ux - 1, hy - 2, 2, hc);
    } else if (st === 'mane') {
      b.r(ux - 8, hy + 1, 4, 11, hc);
      b.r(ux - 6, hy - 2, 6, 3, hc);
    }
  }

  function hat(b, p, ux, uy, q) {
    const hy = uy - 25;
    const c = p.hatColor || '#1c1a22';
    switch (p.hat) {
      case 'qing':
        b.r(ux - 6, hy - 3, 12, 4, c);
        b.r(ux - 8, hy + 1, 16, 2, c);
        b.r(ux - 1, hy - 5, 3, 2, '#d9483b');
        b.r(ux - 7, hy + 3, 2, 3, c);
        break;
      case 'dish':
        b.r(ux - 5, hy - 1, 10, 2, p.hair || '#2a3a2a');
        b.r(ux - 4, hy - 2, 8, 1, '#d8d3c0');
        b.r(ux - 3, hy - 1, 6, 1, '#8fd0e8');
        break;
      case 'tokin':
        b.r(ux - 2, hy - 4, 5, 4, c);
        b.r(ux - 1, hy - 3, 3, 1, '#4a4f5b');
        break;
      case 'helm':
        b.r(ux - 7, hy - 2, 14, 6, c);
        b.r(ux - 7, hy + 3, 3, 4, c);
        b.r(ux - 1, hy - 3, 2, 3, p.hatTrim || '#e6c24a');
        b.r(ux - 1, hy - 6, 2, 3, '#d9483b');
        b.r(ux - 7, hy + 1, 14, 1, p.hatTrim || '#e6c24a');
        break;
      case 'hood':
        b.r(ux - 7, hy - 1, 14, 6, c);
        b.r(ux - 8, hy + 3, 3, 12, c);
        b.r(ux + 4, hy + 4, 3, 8, c);
        break;
      case 'tophat':
        b.r(ux - 4, hy - 6, 8, 7, c);
        b.r(ux - 7, hy, 14, 2, c);
        b.r(ux - 4, hy - 1, 8, 1, '#c25a5a');
        break;
      case 'crown':
        b.r(ux - 5, hy - 2, 10, 3, '#f2d450');
        b.r(ux - 5, hy - 4, 2, 2, '#f2d450');
        b.r(ux - 1, hy - 5, 2, 3, '#f2d450');
        b.r(ux + 3, hy - 4, 2, 2, '#f2d450');
        break;
      default:
        break;
    }
    if (p.horns) {
      const hc = p.horns.color || '#e8e2d0';
      const n = p.horns.len || 4;
      b.r(ux - 4, hy - n, 2, n + 1, hc);
      b.r(ux + 2, hy - n, 2, n + 1, hc);
      b.px(ux - 5, hy - n - 1, hc);
      b.px(ux + 4, hy - n - 1, hc);
      if (p.horns.curl) {
        b.r(ux - 6, hy - n - 2, 2, 2, hc);
        b.r(ux + 5, hy - n - 2, 2, 2, hc);
      }
    }
    if (p.antlers) {
      const ac = p.antlers;
      const sh = q.hurt ? 1 : 0;
      for (const d of [-1, 1]) {
        const bx = ux + d * 3;
        b.line(bx, hy + 1, bx + d * 2, hy - 3 + sh, ac, 1);
        b.line(bx + d * 2, hy - 3 + sh, bx + d * 5, hy - 5 + sh, ac, 1);
        b.line(bx + d, hy - 1, bx + d * 6, hy - 2 + sh, ac, 1);
        b.line(bx + d * 2, hy - 3 + sh, bx, hy - 5 + sh, ac, 1);
      }
    }
  }

  /* 얼굴. 눈은 머리 오른쪽 */
  const FACE = {
    normal(b, q, p, ux, uy) {
      const eye = q.atk > 0.5 && p.glow ? p.glow : p.eyes || '#1b1820';
      if (p.sockets && !q.hurt) {
        /* 푹 꺼진 눈구멍에 점 하나 */
        b.r(ux - 2, uy - 20, 3, 3, '#0b0a0e');
        b.r(ux + 2, uy - 20, 3, 3, '#0b0a0e');
        b.px(ux - 1, uy - 19, eye);
        b.px(ux + 3, uy - 19, eye);
      } else if (q.hurt) {
        b.r(ux - 1, uy - 19, 2, 1, eye);
        b.r(ux + 3, uy - 19, 2, 1, eye);
      } else {
        b.r(ux - 1, uy - 19, 2, q.wind > 0.7 ? 1 : 2, eye);
        b.r(ux + 3, uy - 19, 2, q.wind > 0.7 ? 1 : 2, eye);
      }
      if (p.wail) b.r(ux + 1, uy - 17, 3, q.atk > 0.5 ? 4 : 3, p.mouth || '#14121a');
      else if (q.atk > 0.5 || q.hurt) b.r(ux + 1, uy - 16, 3, 2, p.mouth || '#7a2e26');
      else b.px(ux + 2, uy - 16, p.mouth || '#a9604f');
      if (p.fangs && (q.atk > 0.3 || p.fangs === 'always')) {
        b.px(ux + 1, uy - 15, '#f6f3ea');
        b.px(ux + 4, uy - 15, '#f6f3ea');
      }
      if (p.brow) b.r(ux - 1, uy - 21, 6, 1, p.brow);
      if (p.blush) {
        b.r(ux - 5, uy - 17, 2, 1, p.blush);
        b.r(ux + 3, uy - 17, 2, 1, p.blush);
      }
      if (p.tears) {
        const drip = q.i % 3;
        b.r(ux - 1, uy - 17 + drip, 1, 3, p.tears);
        b.r(ux + 3, uy - 17 + ((drip + 1) % 3), 1, 3, p.tears);
      }
    },
    mask(b, q, p, ux, uy) {
      const eye = q.atk > 0.5 && p.glow ? p.glow : p.eyes || '#1b1820';
      if (q.hurt) {
        b.r(ux - 1, uy - 19, 2, 1, eye);
        b.r(ux + 3, uy - 19, 2, 1, eye);
      } else {
        b.r(ux - 1, uy - 19, 2, q.wind > 0.7 ? 1 : 2, eye);
        b.r(ux + 3, uy - 19, 2, q.wind > 0.7 ? 1 : 2, eye);
      }
      if (q.atk > 0.5 && p.slit) {
        /* 마스크를 내리면 입이 귀까지 찢어져 있다 */
        b.r(ux - 5, uy - 17, 12, 4, '#7a1f2a');
        b.r(ux - 5, uy - 16, 12, 1, '#1b0a0e');
        for (let k = 0; k < 5; k++) b.px(ux - 4 + k * 2, uy - 16, '#f6f3ea');
        b.r(ux - 5, uy - 18, 1, 2, '#d9483b');
        b.r(ux + 6, uy - 18, 1, 2, '#d9483b');
        b.px(ux + 3, uy - 15, '#f6f3ea');
      } else {
        b.r(ux - 5, uy - 16, 12, 3, p.maskColor || '#e8f0f2');
        b.r(ux - 5, uy - 16, 12, 1, darken(p.maskColor || '#e8f0f2', 0.84));
        b.r(ux - 6, uy - 15, 1, 1, '#c9d4d8');
        b.r(ux + 6, uy - 15, 1, 1, '#c9d4d8');
      }
    },
    blank(b, q, p, ux, uy) {
      /* 눈코입이 없다. 맞으면 얼굴 가운데가 잠깐 일그러진다 */
      if (q.hurt) b.r(ux - 1, uy - 19, 5, 1, p.shade || '#b8b6b2');
      if (q.atk > 0.5) b.r(ux - 2, uy - 20, 8, 5, p.mouth || '#14121a');
    },
    beak(b, q, p, ux, uy) {
      FACE.normal(b, q, { ...p, fangs: false }, ux, uy);
      const open = q.atk > 0.4 ? 2 : 0;
      b.r(ux + 3, uy - 18, 6, 2, p.beak || '#e8b83a');
      b.r(ux + 3, uy - 16 + open, 5, 2, darken(p.beak || '#e8b83a', 0.82));
      b.px(ux + 8, uy - 17, '#8a6a1a');
    },
    wolf(b, q, p, ux, uy) {
      const c = p.skin;
      const open = q.atk > 0.4;
      b.r(ux + 3, uy - 20, 7, 4, c);
      b.r(ux + 3, uy - 16, 6, open ? 4 : 2, darken(c, 0.88));
      b.r(ux + 9, uy - 20, 2, 2, '#14121a');
      b.r(ux - 5, uy - 28, 3, 4, c);
      b.r(ux + 1, uy - 28, 3, 4, c);
      b.px(ux - 4, uy - 27, '#7a4a4a');
      b.px(ux + 2, uy - 27, '#7a4a4a');
      const eye = q.atk > 0.5 ? '#ff9a5a' : p.eyes || '#f4d24a';
      b.r(ux, uy - 21, 3, q.wind > 0.7 ? 1 : 2, eye);
      b.px(ux + 1, uy - 21, '#14121a');
      if (open) {
        b.r(ux + 3, uy - 16, 6, 3, '#3a1a22');
        for (const k of [3, 5, 7]) b.px(ux + k, uy - 16, '#f6f3ea');
        for (const k of [4, 7]) b.px(ux + k, uy - 13, '#f6f3ea');
      } else {
        b.px(ux + 4, uy - 15, '#f6f3ea');
        b.px(ux + 7, uy - 15, '#f6f3ea');
      }
    },
    horse(b, q, p, ux, uy) {
      const c = p.skin;
      const open = q.atk > 0.4;
      b.r(ux + 1, uy - 22, 9, 6, c);
      b.r(ux + 5, uy - 17, 6, 4 + (open ? 1 : 0), c);
      b.r(ux + 9, uy - 15, 2, 2, '#14121a');
      b.r(ux - 5, uy - 30, 3, 5, c);
      b.r(ux + 1, uy - 30, 3, 5, c);
      b.r(ux - 8, uy - 28, 3, 14, p.mane || '#1f1a18');
      b.r(ux - 5, uy - 27, 8, 2, p.mane || '#1f1a18');
      const eye = q.atk > 0.5 ? '#ff6a4a' : p.eyes || '#f4d24a';
      b.r(ux + 2, uy - 21, 3, q.wind > 0.7 ? 1 : 2, eye);
      if (open) {
        b.r(ux + 5, uy - 14, 6, 3, '#3a1a22');
        for (const k of [5, 7, 9]) b.px(ux + k, uy - 14, '#f6f3ea');
      }
    },
    skull(b, q, p, ux, uy) {
      const bone = p.bone || '#d8d3c0';
      const open = q.atk > 0.4;
      b.r(ux - 5, uy - 26, 11, 8, bone);
      b.r(ux + 3, uy - 21, 8, 5, bone);
      b.r(ux - 4, uy - 19, 9, 4, darken(bone, 0.85));
      b.r(ux - 3, uy - 24, 3, 3, '#14121a');
      b.r(ux + 2, uy - 24, 3, 3, '#14121a');
      const eye = q.atk > 0.5 ? '#bfe8f0' : p.glow || '#7ad0e8';
      b.r(ux - 2, uy - 23, 1, 1, eye);
      b.r(ux + 3, uy - 23, 1, 1, eye);
      b.r(ux + 9, uy - 21, 2, 2, '#14121a');
      b.r(ux + 2, uy - 17 + (open ? 2 : 0), 8, 3, darken(bone, 0.8));
      for (let k = 0; k < 4; k++) b.px(ux + 3 + k * 2, uy - 17 + (open ? 2 : 0), '#14121a');
    },
    moth(b, q, p, ux, uy) {
      const e = q.atk > 0.5 ? '#ff6a6a' : p.glow || '#e5304a';
      b.r(ux - 5, uy - 23, 5, 6, e);
      b.r(ux + 1, uy - 23, 5, 6, e);
      b.px(ux - 4, uy - 22, '#ffd0d0');
      b.px(ux + 2, uy - 22, '#ffd0d0');
      b.line(ux - 3, uy - 24, ux - 6, uy - 27 + (q.hurt ? 2 : 0), p.hair || '#6b6258', 1);
      b.line(ux + 3, uy - 24, ux + 6, uy - 27 + (q.hurt ? 2 : 0), p.hair || '#6b6258', 1);
      b.r(ux, uy - 16, 2, q.atk > 0.5 ? 3 : 1, '#14121a');
    },
    tengu(b, q, p, ux, uy) {
      FACE.normal(b, q, p, ux, uy);
      const nose = p.nose || '#c8352c';
      b.r(ux + 2, uy - 18, 8, 3, nose);
      b.r(ux + 9, uy - 17, 2, 2, darken(nose, 0.8));
      b.r(ux - 1, uy - 21, 6, 1, '#e8e0e4');
    },
  };

  /* 소품: 앞손 (hx, hy) 에서 q.dir 방향으로 */
  const PROP = {
    scissors(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 9);
      const open = q.atk > 0.3 || q.wind > 0.3 ? 4 : 2;
      b.line(hx, hy, ex, ey, '#cfd5dc', 2);
      b.line(hx, hy, ex, Math.min(34, ey + open), '#9aa3ad', 1);
      b.r(hx - 3, hy - 2, 3, 2, '#d9483b');
      b.r(hx - 3, hy + 1, 3, 2, '#d9483b');
      if (q.atk > 0.5) b.spark(ex + 2, ey + 1, '#ffffff');
    },
    club(b, q, hx, hy) {
      const [ex0, ey0] = along(q, hx, hy, 11);
      const ex = Math.min(ex0, 41);
      const ey = Math.min(ey0, 30);
      b.line(hx, hy, ex, ey, '#2a2f38', 2);
      b.r(ex - 3, ey - 3, 7, 7, '#3a3f4b');
      for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, -4], [0, 4]]) b.px(ex + dx, ey + dy, '#aab4c0');
    },
    fan(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 6);
      b.line(hx, hy, ex, ey, '#8a5a34', 1);
      for (let k = -2; k <= 2; k++) b.line(ex, ey, ex + (q.dir[0] > 0 ? 3 : -3) + k, ey - 6 + Math.abs(k), k % 2 ? '#e8e0d0' : '#6fa86a', 2);
    },
    sword(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 15);
      b.line(hx, hy, ex, ey, '#d8dee5', 2);
      b.r(hx - 2, hy - 1, 5, 3, '#c9a24a');
      b.px(ex, ey, '#ffffff');
    },
    candle(b, q, hx, hy) {
      b.r(hx - 1, hy - 6, 3, 6, '#f2ead8');
      b.r(hx - 1, hy - 7, 3, 1, '#c9a24a');
      b.r(hx, hy - 10 - (q.i % 2), 1, 3, '#f2a63a');
      b.px(hx, hy - 9, '#fff2a8');
    },
    lantern(b, q, hx, hy) {
      /* 손에서 늘어뜨린 등롱 */
      b.line(hx, hy, hx + 1, hy + 3, '#5a3a24', 1);
      b.r(hx - 2, hy + 3, 7, 7, '#d9483b');
      b.r(hx - 1, hy + 4, 5, 5, q.i % 2 ? '#ff9a5a' : '#ffb870');
      b.r(hx - 2, hy + 3, 7, 1, '#2a2020');
      b.r(hx - 2, hy + 9, 7, 1, '#2a2020');
      b.spark(hx - 3, hy + 6, '#ffe0a0');
    },
    cucumber(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 6);
      b.line(hx, hy, ex, ey, '#5fa86a', 2);
      b.px(ex, ey, '#3a7a4a');
    },
    staff(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 16);
      b.line(hx, hy + 3, ex, ey, '#8a6a3a', 1);
      b.r(ex - 1, ey - 2, 3, 3, '#c9a24a');
    },
    sickle(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 11);
      b.line(hx, hy, ex, ey, '#6a4a2a', 1);
      b.line(ex, ey, ex + (q.dir[0] > 0 ? 4 : -4), ey + 3, '#cfd5dc', 2);
    },
    pumpkin(b, q, hx, hy) {
      b.disc(hx + 1, hy - 3, 4, '#e8812a');
      b.r(hx - 1, hy - 4, 2, 2, '#2a1a10');
      b.r(hx + 3, hy - 4, 2, 2, '#2a1a10');
      b.r(hx, hy - 1, 4, 1, '#2a1a10');
      b.r(hx + 1, hy - 8, 2, 2, '#5a7a2a');
    },
    wrap(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 9);
      const sw = Math.round(q.step * 2);
      const wy = Math.min(32, ey + 2 + sw);
      b.line(hx, hy, ex - 1, wy, '#e8dcc0', 1);
      b.line(ex - 1, wy, ex - 5, Math.min(33, wy + 3), '#cfc3a6', 1);
    },
    mirror(b, q, hx, hy) {
      b.r(hx - 3, hy - 9, 7, 8, '#8a5a34');
      b.r(hx - 2, hy - 8, 5, 6, q.atk > 0.5 ? '#ffffff' : '#bfe0ee');
      b.px(hx - 1, hy - 7, '#ffffff');
      b.r(hx - 1, hy - 1, 2, 3, '#8a5a34');
    },
  };

  /* 몸통 장식 */
  const DECO = {
    sailor(b, q, p, ux, uy, bulk) {
      b.r(ux - 4 - bulk, uy - 14, 8 + bulk * 2, 3, p.deco1 || '#27345a');
      b.r(ux - 1, uy - 12, 2, 3, '#d9483b');
      b.px(ux - 3, uy - 11, p.deco1 || '#27345a');
    },
    coat(b, q, p, ux, uy) {
      /* 트렌치코트: 세운 깃, 벨트, 단추 */
      const c = p.deco1 || darken(p.top, 0.8);
      b.r(ux - 6, uy - 17, 3, 5, lighten(p.top, 0.15));
      b.r(ux + 3, uy - 17, 3, 5, lighten(p.top, 0.15));
      b.line(ux - 3, uy - 13, ux, uy - 8, c, 1);
      b.line(ux + 3, uy - 13, ux, uy - 8, c, 1);
      b.r(ux - 4, uy - 8, 8, 1, '#6a5a3a');
      b.px(ux, uy - 7, '#e0c070');
    },
    suit(b, q, p, ux, uy) {
      b.r(ux - 1, uy - 14, 3, 7, p.deco1 || '#efe9dc');
      b.r(ux, uy - 13, 1, 6, p.deco2 || '#8a1f2a');
      b.r(ux - 4, uy - 14, 3, 4, darken(p.top, 0.8));
      b.r(ux + 2, uy - 14, 3, 4, darken(p.top, 0.8));
    },
    talisman(b, q, p, ux, uy) {
      b.r(ux - 1, uy - 13, 5, 8, '#e8c94a');
      b.px(ux + 1, uy - 12, '#c8352c');
      b.r(ux, uy - 10, 3, 1, '#c8352c');
      b.px(ux + 1, uy - 8, '#c8352c');
    },
    pom(b, q, p, ux, uy) {
      for (const dy of [-13, -10, -7]) {
        b.disc(ux, uy + dy, 1, '#f0e8d0');
        b.px(ux, uy + dy, '#c9a24a');
      }
    },
    armor(b, q, p, ux, uy) {
      const c = p.deco1 || '#b23b32';
      const gold = '#e6c24a';
      b.r(ux - 6, uy - 15, 12, 3, gold);
      b.r(ux - 5, uy - 12, 10, 6, c);
      for (let k = 0; k < 3; k++) b.r(ux - 4, uy - 11 + k * 2, 8, 1, gold);
      b.r(ux - 1, uy - 7, 3, 2, gold);
    },
    fur(b, q, p, ux, uy) {
      const c = p.deco1 || darken(p.skin, 0.8);
      for (let k = 0; k < 4; k++) b.r(ux - 4 + k * 2, uy - 14 + (k % 2) * 2, 2, 4, c);
    },
    bones(b, q, p, ux, uy) {
      const c = p.deco1 || '#d8d3c0';
      for (const dy of [-13, -11, -9]) b.r(ux - 3, uy + dy, 7, 1, c);
      b.r(ux, uy - 13, 1, 6, c);
    },
    beads(b, q, p, ux, uy) {
      for (let k = 0; k < 5; k++) b.px(ux - 3 + k * 1, uy - 13 + (k === 0 || k === 4 ? 0 : k === 2 ? 3 : 2), p.deco1 || '#e6c24a');
    },
    sash(b, q, p, ux, uy) {
      b.line(ux - 3, uy - 14, ux + 3, uy - 8, p.deco1 || '#d9483b', 2);
    },
    wrap(b, q, p, ux, uy, bulk) {
      const c = p.deco1 || '#8a7a5a';
      for (const dy of [-13, -11, -9, -7]) b.r(ux - 4 - bulk, uy + dy, 8 + bulk * 2, 1, c);
      b.line(ux - 4, uy - 14, ux + 3, uy - 7, c, 1);
    },
    ties(b, q, p, ux, uy) {
      const c = p.deco1 || '#8a6a3a';
      b.r(ux - 5, uy - 8, 10, 1, c);
    },
  };

  /* 아랫도리와 다리 */
  function lower(b, q, p, ux, uy, gy, tall, st) {
    const pants = p.pants || '#2a3046';
    const shoe = p.shoe || '#26232b';
    const cloth = p.cloth || 'pants';
    if (st === 'float' && cloth === 'viscera') {
      /* 마나낭갈: 허리가 끊어져 창자가 늘어진다 */
      const gut = p.gut || '#d9647a';
      b.r(ux - 4, uy - 7, 8, 3, darken(p.robe || p.top, 0.7));
      for (let k = 0; k < 4; k++) {
        const bx = ux - 3 + k * 2;
        b.line(bx, uy - 4, bx + wave(q, k * 1.3, 1) - 1, Math.min(BY - 2, uy + 4 + (k % 2) * 2), k % 2 ? gut : darken(gut, 0.78), 2);
      }
      return;
    }
    if (st === 'float') {
      /* 치맛자락이 점점 가늘어지며 땅 가까이 흩어진다 */
      const c = p.robe || p.top;
      const n = Math.max(3, Math.floor((BY - 2 - (uy - 6)) / 2));
      for (let k = 0; k < n; k++) {
        const w = Math.max(2, Math.round(11 - (k * 9) / (n - 1)));
        const sw = wave(q, k * 0.8, Math.min(2, Math.floor(k / 2)));
        b.r(ux - Math.floor(w / 2) + sw, uy - 6 + k * 2, w, 2, k % 2 ? darken(c, 0.9) : c);
      }
      return;
    }
    if (st === 'hop') {
      b.r(CX - 3, gy - 8 - tall, 6, 6 + tall, pants);
      b.r(CX - 3, gy - 2, 7, 2, shoe);
    } else if (st === 'fly') {
      for (const [lx, [ldx]] of [[CX - 3, q.l], [CX + 1, q.r]]) {
        b.r(lx + ldx, gy - 8 - tall, 2, 8 + tall, pants);
        b.r(lx + ldx, gy - 1, 3, 2, shoe);
      }
      b.r(CX - 3, gy - 9 - tall, 6, 3, pants);
    } else {
      for (const [lx, [ldx, ldy]] of [[CX - 4, q.l], [CX + 1, q.r]]) {
        b.r(lx + ldx, gy - 6 - tall + ldy, 3, 4 + tall, pants);
        b.r(lx + ldx, gy - 2 + ldy, 4, 2, shoe);
      }
      b.r(CX - 4, gy - 8 - tall, 8, 3, pants);
    }
    const sk = p.skirt;
    if (cloth === 'skirt') {
      b.r(ux - 5, uy - 8, 10, 6, sk || pants);
      const sh = darken(sk || pants, 0.7);
      for (const dx of [-3, 0, 3]) b.r(ux + dx, uy - 7, 1, 5, sh);
    } else if (cloth === 'coat') {
      const c = sk || p.top;
      const sway = Math.round(q.step * 1.5);
      b.r(ux - 5, uy - 8, 10, 4, c);
      b.r(ux - 6 + sway, uy - 4, 12, 3, c);
      b.r(ux - 1 + sway, uy - 8, 2, 7, darken(c, 0.72));
      b.r(ux - 6 + sway, uy - 2, 12, 1, darken(c, 0.8));
    } else if (cloth === 'dress' || cloth === 'robe') {
      const c = sk || pants;
      const sway = Math.round(q.step);
      b.r(ux - 5, uy - 8, 10, 4, c);
      b.r(ux - 6 + sway, uy - 4, 12, Math.max(2, gy - 2 - (uy - 4)), c);
      b.r(ux - 6 + sway, gy - 3, 12, 2, darken(c, 0.82));
      if (cloth === 'robe') b.r(ux - 1 + sway, uy - 4, 2, gy - 2 - (uy - 4), darken(c, 0.78));
    } else if (cloth === 'loin') {
      b.r(ux - 4, uy - 8, 8, 3, sk || '#d9a830');
      b.r(ux - 1, uy - 5, 5, 4, sk || '#d9a830');
      for (const dx of [0, 2]) b.r(ux + dx, uy - 8, 1, 3, '#2a1a10');
      b.r(ux, uy - 4, 1, 2, '#2a1a10');
    } else if (cloth === 'tatters') {
      for (let k = 0; k < 4; k++) b.r(ux - 4 + k * 2, uy - 6, 2, 4 + (k % 2) * 2, sk || darken(p.top, 0.8));
    } else if (cloth === 'wrapped') {
      b.r(CX - 4, gy - 8 - tall, 8, 3, sk || '#d8cdb0');
      for (const [lx, [ldx, ldy]] of [[CX - 4, q.l], [CX + 1, q.r]]) {
        for (let k = 0; k < 4 + tall; k += 2) b.r(lx + ldx, gy - 6 - tall + ldy + k, 3, 1, sk || '#d8cdb0');
      }
    }
  }

  /* 사람꼴: 대부분의 해외 괴담이 이걸 쓴다 (귀신, 강시, 오니, 늑대인간 ...) */
  function folk(b, q, p) {
    const st = p.stance || 'walk';
    const tall = p.tall || 0;
    const bulk = p.bulk || 0;
    const skin = p.skin || '#f0c8a0';
    const shade = p.shade || darken(skin, 0.86);
    const top = p.top || '#38507a';
    const trim = p.trim || lighten(top, 0.35);
    const hopH = st === 'hop'
      ? (q.kind === 'walk' ? Math.round((1 - Math.abs(q.step)) * 4) : q.kind === 'idle' ? [0, 0, 1, 0][q.i] : q.atk > 0.5 ? 2 : 0)
      : 0;
    const bobF = st === 'float' ? 5 + q.bob : st === 'fly' ? 6 + q.bob : 0;
    const gy = BY - hopH - bobF;
    const ux = CX + Math.round(q.lunge * 0.6) - (q.hurt ? 0 : 0);
    const uy = gy - tall + q.rise - (st === 'walk' ? q.bob : 0);

    /* 팔 */
    const ak = p.arms || 1;
    let aF = q.armF;
    let aB = q.armB;
    if (p.armsOut) {
      const out = 11 + Math.round(q.atk * 4) - Math.round(q.wind * 3) - (q.hurt ? 3 : 0);
      const lift = q.wind > 0.5 ? -3 : 0;
      aF = [out, -12 + lift + (q.hurt ? 3 : 0)];
      aB = [out - 2, -11 + lift + (q.hurt ? 3 : 0)];
    }
    const hand = ([ax, ay]) => [Math.round(ux + (ax > 0 ? 4 + (ax - 4) * ak : -4 + (ax + 4) * ak)), Math.round(uy - 12 + (ay + 12) * ak)];
    const hF = hand(aF);
    const hB = hand(aB);
    const armColor = p.bareArms ? skin : p.sleeve || top;

    /* 뒤쪽: 날개, 등껍질, 꼬리 */
    if (p.wings) WINGS[p.wings](b, ux - 3, uy - 13, flapOf(q), p, q, gy);
    if (p.shell) {
      b.r(ux - 9, uy - 15, 6, 10, p.shell);
      b.r(ux - 8, uy - 14, 3, 3, lighten(p.shell, 0.25));
      b.r(ux - 9, uy - 10, 6, 1, darken(p.shell, 0.7));
    }
    if (p.tail) {
      const sw = Math.round(q.step) + (q.atk > 0.4 ? 2 : 0);
      b.line(ux - 4, uy - 6, ux - 9 + sw, uy - 3 + (q.bob ? 1 : 0), p.tail, 2);
      b.line(ux - 9 + sw, uy - 3, ux - 12 + sw, uy - 5, p.tail, 2);
    }
    if (p.tentacles) {
      for (let k = 0; k < 4; k++) {
        const ph = wave(q, k * 1.7, 3);
        const dir = k % 2 ? 1 : -1;
        b.line(ux - 3, uy - 12 + k, Math.max(2, ux - 10 - k * 2 + ph), Math.min(33, uy - 14 + k * 4 + dir * ph), p.tentacles, 1);
      }
    }
    if (p.shroud) return shroudFolk(b, q, p, ux, uy, gy, hopH);

    /* 뒤팔 */
    if (!p.noArms) {
      b.line(ux - 4, uy - 12, hB[0], hB[1], armColor, 2);
      b.r(hB[0] - 1, hB[1] - 1, 3, 3, skin);
      if (p.claws) {
        b.px(hB[0] + 2, hB[1], p.claws);
        b.px(hB[0] + 2, hB[1] + 2, p.claws);
      }
    }
    hairBack(b, p, ux, uy, q);
    lower(b, q, p, ux, uy, gy, tall, st);

    /* 몸통 */
    b.r(ux - 4 - bulk, uy - 14, 8 + bulk * 2, 8, top);
    b.r(ux - 3 - bulk, uy - 14, 6 + bulk * 2, 2, trim);
    for (const d of p.deco || []) if (DECO[d]) DECO[d](b, q, p, ux, uy, bulk);
    if (p.belt) {
      b.r(ux - 4 - bulk, uy - 7, 8 + bulk * 2, 1, p.belt);
    }

    /* 머리 */
    b.r(ux - 6, uy - 25, 12, 11, skin);
    b.r(ux - 6, uy - 17, 12, 2, shade);
    if (p.face === 'headless') {
      b.r(ux - 6, uy - 25, 12, 11, null);
    }
    hairFront(b, p, ux, uy);
    const faceFn = FACE[p.face || 'normal'] || FACE.normal;
    faceFn(b, q, p, ux, uy);
    hat(b, p, ux, uy, q);
    if (p.flower) {
      b.disc(ux + 4, uy - 22, 2, p.flower);
      b.px(ux + 4, uy - 22, '#e8c14e');
    }
    if (p.headWrap) {
      for (const dy of [-24, -22, -20, -18, -16]) b.r(ux - 6, uy + dy, 12, 1, p.headWrap);
      b.line(ux - 6, uy - 24, ux + 4, uy - 16, p.headWrap, 1);
      b.r(ux - 9, uy - 19 + wave(q, 1, 1), 4, 1, p.headWrap);
      b.r(ux - 1, uy - 19, 2, q.atk > 0.5 ? 3 : 2, p.eyes || '#e5654b');
      b.r(ux + 3, uy - 19, 2, q.atk > 0.5 ? 3 : 2, p.eyes || '#e5654b');
    }
    if (p.talismanFace) {
      b.r(ux - 1, uy - 26, 5, 9, '#e8c94a');
      b.r(ux, uy - 24, 3, 1, '#c8352c');
      b.px(ux + 1, uy - 22, '#c8352c');
      b.r(ux, uy - 20, 3, 1, '#c8352c');
      b.px(ux + 1, uy - 18, '#c8352c');
    }

    /* 앞팔과 소품 */
    if (!p.noArms) {
      b.line(ux + 4, uy - 12, hF[0], hF[1], armColor, 2);
      b.r(hF[0] - 1, hF[1] - 1, 3, 3, skin);
      if (p.claws) {
        b.px(hF[0] + 2, hF[1], p.claws);
        b.px(hF[0] + 2, hF[1] + 2, p.claws);
        if (q.atk > 0.5) b.px(hF[0] + 3, hF[1] + 1, p.claws);
      }
      if (p.prop && PROP[p.prop]) PROP[p.prop](b, q, hF[0], Math.max(hF[1], 13));
    }
    if (p.extra) p.extra(b, q, ux, uy);
  }

  /* 수의를 입은 시체: 흰 천 기둥 하나가 통통 뛴다 */
  function shroudFolk(b, q, p, ux, uy, gy, hopH) {
    const cloth = p.top || '#e8e4d6';
    const shade = darken(cloth, 0.86);
    const tilt = Math.round(q.atk * 3) - Math.round(q.wind * 2) - (q.hurt ? 2 : 0);
    const top = uy - 26;
    const w = 12;
    for (let y = top; y < gy - 1; y++) {
      const k = (y - top) / (gy - top);
      const x = ux - Math.floor(w / 2) + Math.round(tilt * (1 - k));
      const narrow = y < top + 4 ? 2 : 0;
      b.r(x + narrow, y, w - narrow * 2, 1, (y - top) % 6 < 3 ? cloth : shade);
    }
    const hx = ux - 5 + tilt;
    b.r(hx - 1, top - 1, 4, 3, cloth);
    b.r(hx - 2, top - 3, 3, 3, cloth);
    b.r(hx + 2, top - 2, 3, 2, cloth);
    for (const [y, c] of [[uy - 17, p.rope || '#8a6a3a'], [uy - 7, p.rope || '#8a6a3a'], [gy - 4, p.rope || '#8a6a3a']]) {
      b.r(ux - 5 + Math.round(tilt * (1 - (y - top) / (gy - top))), y, 11, 1, c);
    }
    const fx = ux - 4 + tilt;
    b.r(fx, uy - 24, 8, 7, p.skin || '#8a8f84');
    const eh = q.atk > 0.5 ? 3 : 2;
    b.r(fx + 1, uy - 22, 2, eh, '#14121a');
    b.r(fx + 5, uy - 22, 2, eh, '#14121a');
    if (q.atk > 0.4) {
      b.r(fx + 2, uy - 19, 4, 2, '#14121a');
      b.px(fx + 3, uy - 19, '#f6f3ea');
    }
    b.px(fx + 2, uy - 21, p.glow || '#e5654b');
    b.px(fx + 6, uy - 21, p.glow || '#e5654b');
  }

  /* 테케테케: 상반신만 팔로 기어 온다 */
  function crawler(b, q, p) {
    const skin = p.skin || '#e6dfe4';
    const top = p.top || '#d8d3c6';
    const hc = p.hair || '#15161a';
    const lean = Math.round(q.atk * 3) - Math.round(q.wind * 2) - (q.hurt ? 2 : 0);
    const cx = CX + q.lunge + lean;
    const y0 = BY + q.rise - (q.kind === 'idle' ? q.bob : 0);
    const walk = q.kind === 'walk';
    const rock = walk ? Math.round(q.step * 1.5) : 0;
    const sx = cx + 3;
    const sy = y0 - 11;
    /* 팔: 앞팔은 뻗고 뒷팔은 당긴다 */
    const armTo = (phase) => {
      if (q.atk > 0.2) return [sx + 6 + Math.round(q.atk * 6), y0 - 8 + Math.round(q.atk * 6) - (q.atk > 0.6 ? 0 : 3)];
      if (q.wind > 0.2) return [sx + 2, y0 - 16 - Math.round(q.wind * 4)];
      if (q.hurt) return [sx - 2, y0 - 6];
      const r = walk ? Math.round(q.step * 4 * phase) : phase;
      return [sx + 7 + r, y0 - (walk && r < 0 ? 3 : 0)];
    };
    const [bx, by] = armTo(-1);
    const [fx, fy] = armTo(1);
    b.line(sx - 3, sy + 1, bx - 1, by - 1, top, 2);
    b.r(bx - 1, by - 1, 4, 3, skin);
    /* 몸통과 끊어진 허리 */
    b.r(cx - 7 - rock, y0 - 13, 12, 11, top);
    b.r(cx - 6 - rock, y0 - 13, 10, 2, p.trim || '#e8e4d8');
    b.r(cx - 7 - rock, y0 - 4, 12, 3, p.cut || '#6a1f2a');
    for (let k = 0; k < 4; k++) b.px(cx - 7 - rock + k * 3, y0 - 1 + (k % 2), p.cut || '#6a1f2a');
    b.r(cx - 9 - rock, y0 - 3, 3, 2, p.cut || '#6a1f2a');
    /* 머리와 긴 머리카락 */
    const hx = cx - 2 + (q.wind > 0.5 ? -2 : 0);
    const hy = y0 - 23 + (q.wind > 0.5 ? -2 : 0) + (q.atk > 0.5 ? 2 : 0);
    b.r(hx - 4, hy + 2, 5, 18, hc);
    b.r(hx - 4 + Math.round(wave(q, 1, 1)), hy + 18, 4, 4, hc);
    b.r(hx - 1, hy, 11, 11, skin);
    b.r(hx - 2, hy - 1, 13, 5, hc);
    b.r(hx - 2, hy + 3, 3, 12, hc);
    b.r(hx + 7, hy + 3, 3, 10, hc);
    b.r(hx + 2, hy + 4, 3, 3, hc);
    const eye = q.atk > 0.5 ? '#ff5a4a' : p.eyes || '#e8e0e4';
    b.r(hx + 3, hy + 6, 2, q.wind > 0.7 ? 1 : 2, eye);
    b.r(hx + 7, hy + 6, 2, q.wind > 0.7 ? 1 : 2, eye);
    if (q.atk > 0.4) {
      b.r(hx + 2, hy + 8, 7, 3, '#7a1f2a');
      for (const k of [2, 4, 6]) b.px(hx + k + 1, hy + 8, '#f6f3ea');
    } else {
      b.r(hx + 4, hy + 9, 4, 1, '#7a1f2a');
    }
    b.line(sx + 1, sy + 1, fx, fy, top, 2);
    b.r(fx - 1, fy - 1, 4, 3, skin);
    if (q.atk > 0.5) {
      b.px(fx + 3, fy - 1, '#cfd5dc');
      b.px(fx + 3, fy + 1, '#cfd5dc');
    }
  }

  /* 카라카사: 우산에 눈 하나와 혀, 다리 하나로 깡충깡충 */
  function kasa(b, q, p) {
    const hop = q.kind === 'walk' ? Math.round((1 - Math.abs(q.step)) * 4) : q.kind === 'idle' ? [0, 0, 1, 0][q.i] : q.atk > 0.5 ? 1 : 0;
    const lean = Math.round(q.atk * 3) - Math.round(q.wind * 2) - (q.hurt ? 2 : 0);
    const cx = CX + q.lunge + lean;
    const gy = BY - hop + q.rise;
    const body = p.body || '#b8465a';
    const rib = p.rib || darken(body, 0.65);
    const topY = gy - 28 - (q.wind > 0.5 ? 1 : 0);
    const tilt = Math.round(q.atk * 2) - Math.round(q.wind * 2);
    /* 살대와 손잡이 */
    b.r(cx - 1, gy - 17, 2, 9, p.wood || '#8a6a3a');
    /* 다리 하나와 게타 */
    const kick = q.kind === 'walk' ? Math.round(q.step) : 0;
    b.r(cx - 1 + kick, gy - 9, 3, 7, p.skin || '#9aa3b4');
    b.r(cx - 4 + kick, gy - 2, 9, 2, '#6a4a2a');
    b.r(cx - 3 + kick, gy, 2, 1, '#6a4a2a');
    b.r(cx + 2 + kick, gy, 2, 1, '#6a4a2a');
    /* 우산 갓 */
    for (let r = 0; r < 11; r++) {
      const half = 2 + Math.round(r * 1.1);
      const scallop = r === 10 && r % 1 === 0 ? 0 : 0;
      b.r(cx - half + tilt - (r > 5 ? 0 : 0), topY + 4 + r + scallop, half * 2 + 1, 1, r % 5 === 4 ? rib : body);
    }
    for (const dx of [-8, -4, 0, 4, 8]) b.line(cx + tilt + Math.round(dx * 0.2), topY + 4, cx + tilt + dx, topY + 14, rib, 1);
    for (let k = -3; k <= 3; k++) if (k % 2) b.r(cx + k * 3 + tilt - 1, topY + 15, 3, 1, body);
    b.r(cx + tilt, topY, 1, 5, p.wood || '#8a6a3a');
    /* 외눈 */
    const ex = cx + 2 + tilt;
    const ey = topY + 9;
    const open = q.atk > 0.4;
    b.r(ex - 3, ey - 3, 7, q.hurt ? 2 : open ? 8 : 6, '#f4f4f1');
    b.r(ex - 1 + (open ? 1 : 0), ey - 1, 3, q.hurt ? 1 : open ? 5 : 4, q.atk > 0.5 ? '#e5303a' : '#1b1820');
    /* 혀 */
    const tl = 5 + Math.round(q.atk * 4) + (q.i % 2);
    b.r(cx + 4 + tilt, topY + 15, 3, tl, '#e86a8a');
    b.r(cx + 4 + tilt, topY + 15 + tl - 1, 3, 1, '#c24a6a');
    /* 팔 하나 */
    const ax = cx + 6 + Math.round(q.atk * 6) - Math.round(q.wind * 2);
    const ay = gy - 13 + (q.atk > 0.5 ? 3 : 0) - (q.wind > 0.3 ? 5 : 0);
    b.line(cx + 1, gy - 14, ax, ay, p.skin || '#9aa3b4', 2);
    b.r(ax - 1, ay - 1, 3, 3, p.skin || '#9aa3b4');
  }

  /* 도깨비불 / 인혼: 불꽃에 얼굴 */
  function wisp(b, q, p) {
    const core = p.core || '#eaf8ff';
    const flame = p.flame || '#5fb4e8';
    const edge = p.edge || '#2a6ac0';
    const swell = q.wind > 0.5 ? -1 : q.atk > 0.5 ? 2 : 0;
    const cx = CX + 3 + q.lunge;
    const cy = BY - 13 - q.bob * 2 + q.rise;
    const R = 6 + swell + (q.hurt ? -1 : 0);
    const f = q.i % 3;
    /* 꼬리: 뒤로 길게 끌리는 불덩이 */
    b.disc(cx - 8 + wave(q, 0.4, 1), cy + 3, 4, edge);
    b.disc(cx - 13 + wave(q, 1.2, 1), cy + 5 - f, 3, edge);
    b.disc(cx - 17 + wave(q, 2.1, 2), cy + 7, 2, edge);
    b.px(cx - 20, cy + 8 + (q.i % 2), edge);
    /* 불꽃 끝: 뒤로 휘어지는 하나 */
    b.line(cx + 1, cy - R + 2, cx - 1, cy - R - 4, flame, 4);
    b.line(cx - 1, cy - R - 4, cx - 4 + f, cy - R - 8, flame, 3);
    b.px(cx - 5 + f, cy - R - 9, core);
    b.disc(cx, cy, R, flame);
    b.disc(cx + 1, cy + 1, Math.max(2, R - 3), core);
    /* 얼굴 */
    const eye = q.atk > 0.5 ? '#ff4a3a' : p.eyes || '#14121a';
    b.r(cx - 2, cy - 2, 2, q.wind > 0.7 ? 1 : 3, eye);
    b.r(cx + 3, cy - 2, 2, q.wind > 0.7 ? 1 : 3, eye);
    if (q.atk > 0.4) b.r(cx - 1, cy + 3, 5, 3, eye);
    else b.r(cx, cy + 3, 3, 1, eye);
    if (q.atk > 0.5) {
      b.spark(cx + R + 2, cy - 1, core);
      b.spark(cx + R + 4, cy + 1, flame);
    }
  }

  /* 피 끄라슈: 머리만 날아다니고 창자가 늘어진다 */
  function flyhead(b, q, p) {
    const skin = p.skin || '#e8dcd2';
    const hc = p.hair || '#15161a';
    const gut = p.gut || '#d9647a';
    const cx = CX + q.lunge + (q.atk > 0.5 ? 2 : 0);
    const cy = BY - 21 - q.bob * 2 + q.rise + (q.atk > 0.5 ? 2 : 0);
    const sw = (k, a) => wave(q, k, a);
    /* 머리카락 */
    b.line(cx - 4, cy - 4, cx - 17 + sw(0, 2), cy + 3, hc, 4);
    b.line(cx - 4, cy, cx - 15 + sw(1, 2), cy + 9, hc, 3);
    b.line(cx - 3, cy - 6, cx - 11 + sw(2, 1), cy - 9, hc, 3);
    /* 늘어진 장기 */
    for (let k = 0; k < 4; k++) {
      const bx = cx - 3 + k * 2;
      b.line(bx, cy + 6, bx + sw(k * 1.3, 2) - 2, cy + 14 + (k % 2) * 3, k % 2 ? gut : darken(gut, 0.78), 2);
    }
    b.r(cx - 3, cy + 5, 8, 3, darken(gut, 0.7));
    b.disc(cx, cy, 6, skin);
    b.r(cx - 6, cy - 7, 12, 4, hc);
    b.r(cx - 7, cy - 4, 3, 8, hc);
    const eye = q.atk > 0.5 ? '#ff5a4a' : p.eyes || '#14121a';
    b.r(cx - 1, cy - 2, 2, q.wind > 0.7 ? 1 : 2, eye);
    b.r(cx + 3, cy - 2, 2, q.wind > 0.7 ? 1 : 2, eye);
    if (q.atk > 0.4) {
      b.r(cx, cy + 1, 6, 4, '#5a1520');
      b.px(cx + 1, cy + 1, '#f6f3ea');
      b.px(cx + 4, cy + 1, '#f6f3ea');
      b.px(cx + 2, cy + 4, '#f6f3ea');
    } else {
      b.r(cx + 1, cy + 3, 3, 1, '#7a2e26');
    }
    for (const [dx, dy] of [[-12, 2], [8, -9], [10, 8], [-8, 12]]) {
      if ((q.i + dx) % 3) b.spark(cx + dx, cy + dy, p.glow || '#9ef0c0');
    }
  }

  /* 네발짐승: 여우, 사자, 개, 괴수. 꼬리 수, 갈기, 뿔, 가시를 고른다 */
  function quad(b, q, p) {
    const s = p.size || 1;
    const bw = Math.round(14 * s);
    const bh = Math.round(8 * s);
    const legH = Math.max(4, Math.round(4 * s));
    const cx = CX + (p.tails > 1 ? 5 : 3) + q.lunge;
    const crouch = Math.round(q.wind * 2);
    const top = BY - legH - bh + crouch - Math.round(q.atk * 2) + q.rise - (q.kind === 'walk' ? Math.round(q.bob * 0.6) : q.bob);
    const body = p.body;
    const belly = p.belly || body;
    const legC = p.leg || darken(body, 0.8);
    const ext = Math.round(q.atk * 3);
    const lw = s > 1.2 ? 3 : 2;
    const legX = [-bw / 2 + 1 - ext, -bw / 2 + 4 - ext, bw / 2 - 5 + ext, bw / 2 - 2 + ext].map(Math.round);
    const rumpX = cx - Math.round(bw / 2);

    /* 꼬리 */
    const n = p.tails || 1;
    const tc = p.tailColor || body;
    for (let k = 0; k < n; k++) {
      if (n === 1) {
        const up = q.wind > 0.5 ? 4 : q.hurt ? 5 : q.bob;
        b.line(rumpX, top + 2, rumpX - (p.tail === 'short' ? 3 : 6), top - 3 - up, tc, 2);
        continue;
      }
      /* 여러 꼬리는 엉덩이에서 부채처럼 펼친다 (위쪽 0도, 뒤쪽 110도) */
      const th = ((4 + (k * 106) / (n - 1)) * Math.PI) / 180;
      const len = (k % 2 ? 10 : 13) + Math.round(s * 1) - (q.wind > 0.5 ? 2 : 0);
      const sw = wave(q, k * 0.6, 1) + (q.atk > 0.4 ? 1 : 0);
      const ex = rumpX + 1 - Math.round(Math.sin(th) * len) + sw;
      const ey = top + 3 - Math.round(Math.cos(th) * len);
      b.line(rumpX + 1, top + 3, ex, ey, tc, 2);
      if (p.tailTip) b.px(ex - 1, ey - 1, p.tailTip);
      if (p.tipFire && (q.i + k) % 2) b.spark(ex - 1, ey - 3, p.tipFire);
    }
    legX.forEach((lx, i) => {
      const fwd = i >= 2;
      const lift = (i % 2 === 0 ? q.step > 0.3 : q.step < -0.3) ? 1 : 0;
      const swing = Math.round(q.step * (fwd ? 1 : -1));
      b.r(cx + lx + swing, BY - legH - lift, lw, legH, legC);
      if (p.fire && (q.i + i) % 2) b.spark(cx + lx + swing, BY - legH - lift - 1, p.fire);
    });
    if (p.spikes) {
      for (let k = 0; k < 5; k++) b.r(cx - Math.round(bw / 2) + 2 + k * Math.round(bw / 5), top - 2 - (k % 2), 2, 3 + (k % 2), p.spikes);
    }
    b.r(cx - Math.round(bw / 2), top, bw, bh, body);
    b.r(cx - Math.round(bw / 2) + 2, top + bh - 2, bw - 4, 2, belly);
    if (p.stripes) for (let k = 0; k < 3; k++) b.r(cx - Math.round(bw / 2) + 3 + k * 3, top, 1, 4, p.stripes);
    if (p.cracks) {
      b.line(cx - 3, top + 1, cx, top + 5, p.cracks, 1);
      b.line(cx + 2, top + 2, cx + 4, top + 6, p.cracks, 1);
    }
    if (p.fur) {
      for (let k = 0; k < 4; k++) b.px(cx - Math.round(bw / 2) + 1 + k * 4, top + bh, body);
      for (let k = 0; k < 3; k++) b.px(cx - Math.round(bw / 2) + 3 + k * 4, top + bh + 1, body);
    }

    /* 머리 */
    const hx = cx + Math.round(bw / 2) - 1 + Math.round(q.atk * 3) - Math.round(q.wind * 2);
    const hy = top - 4 - (q.wind > 0.5 ? 2 : 0) + (q.atk > 0.5 ? 3 : 0) - (q.hurt ? 2 : 0);
    if (p.mane) {
      b.disc(hx + 2, hy + 3, 6, p.mane);
      if (p.maneTip) for (const [dx, dy] of [[-4, -4], [0, -6], [5, -4], [-6, 1], [-4, 6]]) b.px(hx + 2 + dx, hy + 3 + dy, p.maneTip);
    }
    if (p.face === 'human') {
      const sk = p.skin || '#e8d4c0';
      const hc = p.hair || '#14121a';
      b.r(hx - 1, hy - 3, 10, 10, sk);
      b.r(hx - 1, hy - 4, 10, 3, hc);
      b.r(hx - 2, hy - 2, 2, 5, hc);
      const eye = q.atk > 0.5 ? '#ff6a4a' : '#14121a';
      b.r(hx + 1, hy, 2, q.wind > 0.7 ? 1 : 2, eye);
      b.r(hx + 5, hy, 2, q.wind > 0.7 ? 1 : 2, eye);
      if (q.atk > 0.3) {
        b.r(hx + 1, hy + 3, 6, 3, '#7a1f2a');
        b.px(hx + 2, hy + 3, '#f6f3ea');
        b.px(hx + 5, hy + 3, '#f6f3ea');
      } else {
        b.r(hx + 2, hy + 4, 4, 1, '#a9604f');
        b.px(hx + 2, hy + 3, '#a9604f');
        b.px(hx + 6, hy + 3, '#a9604f');
      }
      return;
    }
    b.r(hx, hy, 8, 7, body);
    b.r(hx + 5, hy + 3, 5, 4, p.muzzle || belly);
    const ear = p.ear || 'pointy';
    if (ear === 'round') {
      b.disc(hx + 2, hy - 1, 1, body);
      b.disc(hx + 6, hy - 1, 1, body);
    } else if (ear === 'long') {
      b.r(hx + 1, hy - 5, 2, 5, body);
      b.r(hx + 5, hy - 5, 2, 5, body);
      if (p.earIn) {
        b.r(hx + 1, hy - 4, 1, 3, p.earIn);
        b.r(hx + 5, hy - 4, 1, 3, p.earIn);
      }
    } else if (ear !== 'none') {
      b.r(hx + 1, hy - 3, 2, 3, body);
      b.r(hx + 5, hy - 3, 2, 3, body);
    }
    if (p.horn) b.r(hx + 4, hy - 7, 2, 6, p.horn);
    const eye = q.atk > 0.5 ? '#ff8a6a' : p.eye || '#e5654b';
    const eh = q.wind > 0.7 ? 1 : p.bigEye ? 3 : 2;
    if (q.hurt) {
      b.r(hx + 2, hy + 3, 2, 1, eye);
      b.r(hx + 5, hy + 3, 2, 1, eye);
    } else {
      b.r(hx + 2, hy + 2, 2, eh, eye);
      b.r(hx + 5, hy + 2, 2, eh, eye);
    }
    b.px(hx + 9, hy + 3, '#14121a');
    if (q.atk > 0.3) {
      b.r(hx + 5, hy + 5, 5, 4, '#3a2430');
      b.px(hx + 6, hy + 5, '#f6f3ea');
      b.px(hx + 9, hy + 5, '#f6f3ea');
      b.px(hx + 7, hy + 8, '#f6f3ea');
    } else if (p.fang) {
      b.px(hx + 7, hy + 6, '#f6f3ea');
    }
    if (p.tusk && q.atk <= 0.3) b.r(hx + 8, hy + 6, 1, 3, '#f6f3ea');
  }

  /* 물건 괴물: 닭다리 오두막, 툭툭, 주크박스, 가고일, 지구본 */
  const THING = {
    hut(b, q, p) {
      const cx = CX + q.lunge;
      const wood = p.wood || '#8a5a34';
      const plank = darken(wood, 0.72);
      const leg = p.leg || '#d9a830';
      const bob = q.kind === 'walk' ? Math.round(Math.abs(q.step) * 2) : q.bob;
      const baseY = BY - 10 + q.rise - bob + Math.round(q.wind * 2);
      const kick = Math.round(q.atk * 3);
      for (const [hip, ph] of [[-5, 1], [5, -1]]) {
        const swing = q.kind === 'walk' ? Math.round(q.step * 3 * ph) : 0;
        const lifted = q.kind === 'walk' && q.step * ph < -0.3 ? 3 : 0;
        const hx = cx + hip;
        const kx = hx + 2 + (lifted ? 3 : 0);
        const ky = baseY + 5 - lifted;
        const fx = hx + swing + kick * (hip > 0 ? 1 : 0);
        const fy = BY - lifted;
        b.line(hx, baseY + 1, kx, ky, leg, 2);
        b.line(kx, ky, fx, fy - 1, leg, 2);
        b.r(fx - 1, fy - 1, 5, 2, leg);
        b.px(fx + 4, fy, darken(leg, 0.7));
        b.px(fx - 2, fy, darken(leg, 0.7));
      }
      const lean = Math.round(q.atk * 2) - Math.round(q.wind * 2);
      b.r(cx + 5 + lean, baseY - 17, 4, 6, '#5a4a3a');
      b.r(cx + 6 + lean + wave(q, 0, 1), baseY - 20 - (q.i % 2), 3, 2, '#b8b4aa');
      const roof = p.roof || '#5a3a24';
      for (let r = 0; r < 5; r++) {
        const half = Math.round(4 + r * 2.6);
        b.r(cx - half + lean, baseY - 15 + r * 2, half * 2 + 1, 2, r % 2 ? darken(roof, 0.85) : roof);
      }
      b.r(cx - 12 + lean, baseY - 6, 25, 1, darken(roof, 0.7));
      b.r(cx - 11 + lean, baseY - 5, 23, 11, wood);
      for (let k = 0; k < 6; k++) b.r(cx - 8 + lean + k * 4, baseY - 5, 1, 11, plank);
      const eyeC = q.atk > 0.5 ? '#ff7a4a' : p.eye || '#f4d24a';
      b.r(cx - 8 + lean, baseY - 3, 5, 4, '#2a1a10');
      b.r(cx + 3 + lean, baseY - 3, 5, 4, '#2a1a10');
      b.r(cx - 7 + lean, baseY - 2, 3, q.wind > 0.7 ? 1 : 2, eyeC);
      b.r(cx + 4 + lean, baseY - 2, 3, q.wind > 0.7 ? 1 : 2, eyeC);
      const mouth = q.atk > 0.4 ? 5 : 3;
      b.r(cx - 3 + lean, baseY + 6 - mouth, 7, mouth, '#14121a');
      for (const k of [-2, 0, 2]) b.px(cx + k + lean, baseY + 6 - mouth, '#f6f3ea');
      if (q.hurt) b.line(cx - 8 + lean, baseY - 5, cx - 3 + lean, baseY + 5, '#14121a', 1);
      b.r(cx + 12 + lean, baseY - 1, 1, 7, '#cfc3a6');
      b.r(cx + 11 + lean, baseY - 4, 3, 3, '#e8e2d0');
      b.px(cx + 11 + lean, baseY - 3, '#14121a');
      b.px(cx + 13 + lean, baseY - 3, '#14121a');
    },

    tuktuk(b, q, p) {
      const cx = CX + 3 + q.lunge;
      const body = p.body || '#e8b83a';
      const dark = darken(body, 0.7);
      const roof = p.roof || '#3a8a6a';
      const wheelie = Math.round(q.atk * 3) + (q.wind > 0.5 ? -1 : 0);
      const y = BY - 5 + q.rise - q.bob;
      const spin = (q.i + (q.kind === 'walk' ? 1 : 0)) % 2;
      for (const wx of [-9, -3]) {
        b.disc(cx + wx, BY - 3, 3, '#26232b');
        b.px(cx + wx + (spin ? 1 : -1), BY - 3, '#8a8f99');
      }
      b.disc(cx + 10, BY - 3 - wheelie, 3, '#26232b');
      b.px(cx + 10 + (spin ? 1 : -1), BY - 3 - wheelie, '#8a8f99');
      b.r(cx - 12, y - 10, 24, 9, body);
      b.r(cx + 4, y - 7 - wheelie, 9, 6, body);
      b.r(cx - 12, y - 3, 24, 2, dark);
      b.r(cx - 10, y - 8, 4, 4, '#3a2a1a');
      b.r(cx - 4, y - 8, 4, 4, '#3a2a1a');
      b.r(cx - 13, y - 18, 20, 3, roof);
      b.r(cx - 12, y - 15, 2, 6, dark);
      b.r(cx + 4, y - 15, 2, 6, dark);
      b.r(cx - 14, y - 16, 2, 2, roof);
      const glow = q.atk > 0.5 ? '#fff6a8' : '#f4d24a';
      b.r(cx + 10, y - 6 - wheelie, 3, q.wind > 0.7 ? 2 : 3, glow);
      b.r(cx + 6, y - 6 - wheelie, 3, q.wind > 0.7 ? 2 : 3, glow);
      b.r(cx + 6, y - 2 - wheelie, 7, q.atk > 0.4 ? 3 : 2, '#14121a');
      for (const k of [7, 9, 11]) b.px(cx + k, y - 2 - wheelie, '#f6f3ea');
      if (q.i % 2) b.disc(cx - 16, y - 3, 1, '#9a9a9a');
      else b.disc(cx - 17, y - 5, 2, '#b8b4aa');
      b.r(cx - 14, y - 4, 3, 2, '#5a5a62');
      if (q.hurt) b.line(cx - 6, y - 17, cx + 2, y - 4, '#14121a', 1);
    },

    jukebox(b, q, p) {
      const cx = CX + q.lunge;
      const body = p.body || '#c0392b';
      const dark = darken(body, 0.6);
      const chrome = '#d6dade';
      const hop = -q.bob + q.rise;
      const w = 18;
      const x = cx - 9;
      const y = BY - 28 + hop;
      b.r(x + 2, BY - 3, 4, 3, dark);
      b.r(x + w - 6, BY - 3 + (q.step > 0.3 ? -1 : 0), 4, 3, dark);
      for (let r = 0; r < 7; r++) {
        const inset = Math.round(7 - Math.sqrt(49 - (7 - r) * (7 - r)));
        b.r(x + inset, y + r, w - inset * 2, 1, r === 0 ? chrome : body);
      }
      b.r(x, y + 7, w, 18, body);
      b.r(x + 1, y + 7, 1, 18, chrome);
      b.r(x + w - 2, y + 7, 1, 18, chrome);
      b.r(x + 3, y + 3, w - 6, 3, '#14121a');
      const hues = ['#f2d450', '#e5654b', '#6fd0e8', '#6fcf8f'];
      for (let k = 0; k < 4; k++) b.r(x + 4 + k * 3, y + 4, 2, 1, hues[(k + q.i) % 4]);
      b.r(x + 3, y + 9, w - 6, 9, '#1b1a2a');
      const eye = q.atk > 0.5 ? '#ff6a4a' : '#f2d450';
      b.disc(x + 6, y + 13, 2, eye);
      b.disc(x + w - 7, y + 13, 2, eye);
      b.px(x + 6, y + 13, '#14121a');
      b.px(x + w - 7, y + 13, '#14121a');
      b.r(x + 6, y + 16, w - 12, q.atk > 0.4 ? 3 : 1, '#e5654b');
      b.r(x + 3, y + 20, w - 6, 3, '#14121a');
      for (let k = 0; k < 4; k++) b.r(x + 4 + k * 3, y + 21, 2, 1, dark);
      b.r(x + 7, y + 24, 4, 1, chrome);
      if (q.atk > 0.3) {
        for (let k = 0; k < 3; k++) b.r(x + w + 1 + Math.round(q.atk * 3) + k * 3, y + 12 - k * 2, 1, 4 + k * 2, '#b79bf0');
      }
      if (q.hurt) b.line(x + 4, y + 8, x + 12, y + 20, '#14121a', 1);
    },

    gargoyle(b, q, p) {
      const cx = CX + q.lunge;
      const st = p.body || '#7a8088';
      const dk = darken(st, 0.7);
      const lt = lighten(st, 0.2);
      const flare = q.atk > 0.4 || q.wind > 0.5;
      const hop = q.kind === 'walk' ? Math.round((1 - Math.abs(q.step)) * 2) : q.bob;
      const y = BY - 6 + q.rise - hop - Math.round(q.atk * 2);
      const wy = y - 13;
      if (flare) {
        for (let i = 0; i < 13; i++) b.r(cx - 3 - i, wy - 3 - Math.round(i * 0.7), 1, 14 - Math.round(i * 0.5), i % 4 === 3 ? lt : dk);
      } else {
        b.r(cx - 10, wy - 2, 8, 12, dk);
        b.r(cx - 12, wy + 2, 3, 8, dk);
        b.r(cx - 8, wy - 4, 2, 3, dk);
      }
      b.line(cx - 8, y - 2, cx - 14, y - 6 + (q.bob ? 1 : 0), st, 2);
      const sw = Math.round(q.step);
      b.r(cx - 6 + sw, y - 1, 4, 7, st);
      b.r(cx + 2 - sw, y - 1, 4, 7, st);
      b.r(cx - 7 + sw, y + 5, 6, 2, dk);
      b.r(cx + 2 - sw, y + 5, 6, 2, dk);
      b.r(cx - 7, y - 13, 15, 14, st);
      b.r(cx - 5, y - 11, 11, 4, lt);
      b.r(cx - 6, y - 5, 13, 1, dk);
      if (p.cracks) b.line(cx - 3, y - 10, cx + 1, y - 3, p.cracks, 1);
      const ax = cx + 7 + Math.round(q.atk * 9) - Math.round(q.wind * 3);
      const ay = y - 6 + (q.atk > 0.5 ? 2 : 0) - (q.wind > 0.4 ? 6 : 0);
      b.line(cx + 5, y - 9, ax, ay, st, 3);
      b.r(ax - 1, ay - 1, 4, 3, dk);
      if (q.atk > 0.4) {
        b.px(ax + 3, ay - 1, '#e8e2d0');
        b.px(ax + 3, ay + 1, '#e8e2d0');
      }
      const hx = cx + 1 + Math.round(q.atk * 3) - (q.hurt ? 2 : 0);
      const hy = y - 22 + (q.atk > 0.5 ? 2 : 0);
      b.r(hx - 5, hy, 12, 10, st);
      b.r(hx - 4, hy + 6, 10, 4, lt);
      b.r(hx - 6, hy - 4, 3, 5, dk);
      b.r(hx + 4, hy - 4, 3, 5, dk);
      b.px(hx - 6, hy - 5, dk);
      b.px(hx + 6, hy - 5, dk);
      const eye = q.atk > 0.5 ? '#ffd24a' : p.eye || '#e5654b';
      b.r(hx - 2, hy + 3, 3, q.wind > 0.7 ? 1 : 2, eye);
      b.r(hx + 3, hy + 3, 3, q.wind > 0.7 ? 1 : 2, eye);
      b.r(hx - 3, hy + 2, 4, 1, dk);
      b.r(hx + 2, hy + 2, 4, 1, dk);
      b.r(hx - 2, hy + 7, 8, q.atk > 0.4 ? 3 : 1, '#2a1a22');
      b.px(hx - 1, hy + 7, '#f6f3ea');
      b.px(hx + 4, hy + 7, '#f6f3ea');
    },

    globe(b, q, p) {
      const cx = CX + q.lunge;
      const cy = BY - 17 - q.bob + q.rise - Math.round(q.atk) + Math.round(q.wind * 2);
      const R = 10;
      const sea = p.sea || '#2f6fc0';
      const land = p.land || '#5faa5a';
      const brass = p.brass || '#c9a24a';
      const spin = q.i * 2;
      b.r(cx - 7, BY - 4, 15, 4, '#5a4a3a');
      b.r(cx - 4, BY - 8, 9, 4, brass);
      b.line(cx - 8, cy + 2, cx - 4, BY - 8, brass, 2);
      b.line(cx + 8, cy + 2, cx + 4, BY - 8, brass, 2);
      b.disc(cx, cy, R, sea);
      const blobs = [[-8, -5, 6, 4], [-4, 1, 4, 6], [5, -6, 5, 3], [3, 3, 6, 4], [-10, 5, 3, 2], [9, 0, 3, 5]];
      for (const [bx, by, bw, bh] of blobs) {
        const ox = ((bx + spin + 40) % 28) - 14;
        for (let yy = 0; yy < bh; yy++) {
          const ry = by + yy;
          const half = Math.floor(Math.sqrt(Math.max(0, R * R - ry * ry)));
          const x0 = Math.max(-half, ox);
          const x1 = Math.min(half, ox + bw);
          if (x1 > x0) b.r(cx + x0, cy + ry, x1 - x0, 1, land);
        }
      }
      b.r(cx - 3, cy - R, 7, 2, '#e8f0f4');
      const eye = q.atk > 0.5 ? '#ff4a3a' : p.eye || '#f4d24a';
      b.r(cx - 5, cy - 2, 4, q.wind > 0.7 ? 1 : 3, '#14121a');
      b.r(cx + 2, cy - 2, 4, q.wind > 0.7 ? 1 : 3, '#14121a');
      b.r(cx - 4, cy - 1, 2, q.wind > 0.7 ? 1 : 2, eye);
      b.r(cx + 3, cy - 1, 2, q.wind > 0.7 ? 1 : 2, eye);
      b.r(cx - 5, cy - 4, 5, 1, '#14121a');
      b.r(cx + 2, cy - 4, 5, 1, '#14121a');
      b.r(cx - 4, cy + 4, 9, q.atk > 0.4 ? 5 : 2, '#2a1018');
      for (const k of [-3, 0, 3]) b.px(cx + k, cy + 4, '#f6f3ea');
      for (let a = -70; a <= 70; a += 6) {
        const r = (a * Math.PI) / 180;
        const rx = Math.round(Math.sin(r) * (R + 2));
        const ry = Math.round(Math.cos(r) * (R + 2));
        b.px(cx + rx, cy - ry + 1, brass);
        b.px(cx + rx, cy + ry + 1, brass);
      }
      b.r(cx - R - 2, cy - 1, 3, 3, brass);
      b.r(cx + R, cy - 1, 3, 3, brass);
      b.r(cx - 5, cy - R - 3, 11, 3, '#f2d450');
      b.r(cx - 5, cy - R - 5, 2, 2, '#f2d450');
      b.r(cx - 1, cy - R - 5, 3, 3, '#f2d450');
      b.r(cx + 4, cy - R - 5, 2, 2, '#f2d450');
      b.px(cx, cy - R - 2, '#d9483b');
      if (q.atk > 0.5) b.r(cx + R + 3, cy - 1, 5 + Math.round(q.atk * 4), 2, '#ff6a4a');
      if (q.hurt) b.line(cx - 4, cy - 8, cx + 3, cy + 6, '#14121a', 1);
    },
  };

  const thing = (b, q, p) => THING[p.kind](b, q, p);

  const ellipse = (b, cx, cy, rx, ry, c, band, phase = 0) => {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
      b.r(cx - half, cy + y, half * 2 + 1, 1, c);
      if (band) for (let x = -half; x <= half; x++) if ((x + y * 2 + phase + 60) % 7 === 0) b.r(cx + x, cy + y, 2, 1, band);
    }
  };

  /* 나가: 똬리를 튼 몸 위로 목이 솟고, 부채꼴로 머리가 여럿 펼쳐진다 */
  function serpent(b, q, p) {
    const cx = CX + q.lunge;
    const body = p.body || '#3a8a6a';
    const belly = p.belly || '#e8d890';
    const band = p.band || '#c9a24a';
    const n = p.heads || 5;
    const rise = q.rise - (q.kind === 'idle' ? q.bob : 0);
    const reach = Math.round(q.atk * 5) - Math.round(q.wind * 4) - (q.hurt ? 3 : 0);
    const slither = q.kind === 'walk' ? q.i : 0;
    /* 똬리 두 겹 */
    ellipse(b, cx - 3, BY - 5, 13, 4, body, band, slither);
    ellipse(b, cx - 3, BY - 3, 11, 2, belly);
    ellipse(b, cx - 5, BY - 11, 9, 3, darken(body, 0.88), band, slither + 3);
    /* 목 */
    const nx = cx + 1;
    const hx = cx + 4;
    const hy = BY - 21 + rise;
    b.line(nx, BY - 12, hx, hy + 4, body, 5);
    for (let k = 0; k < 3; k++) b.r(nx + 1 + (k > 1 ? 1 : 0), BY - 14 - k * 3, 3, 1, belly);
    /* 머리 부채: 가운데가 가장 크고 앞으로 가장 많이 뻗는다 */
    const mid = (n - 1) / 2;
    const heads = [];
    for (let k = 0; k < n; k++) {
      const u = (k - mid) / Math.max(1, mid);
      const a = -Math.PI / 2 + u * 1.3;
      const len = (Math.abs(u) < 0.2 ? 12 : 10 + (k % 2) * 3) + Math.round(reach * (1 - Math.abs(u) * 0.5));
      heads.push({ k, u, ex: Math.min(36, Math.round(hx + Math.cos(a) * len + reach * 0.4)), ey: Math.round(hy + 3 + Math.sin(a) * len * 0.9) });
    }
    heads.sort((x, y) => Math.abs(y.u) - Math.abs(x.u));
    b.disc(hx, hy + 3, 6, darken(body, 0.82));
    b.disc(hx, hy + 3, 4, body);
    b.r(hx - 2, hy + 2, 5, 1, band);
    for (const h of heads) {
      const c = h.k % 2 ? body : darken(body, 0.92);
      b.line(hx, hy + 3, h.ex, h.ey + 1, c, 3);
      b.r(h.ex - 1, h.ey - 1, 6, 4, c);
      b.r(h.ex + 3, h.ey + 1, 3, 2, belly);
      b.px(h.ex + 3, h.ey, q.atk > 0.5 ? '#ff6a4a' : p.eye || '#f4d24a');
      if (Math.abs(h.u) < 0.5 && q.atk > 0.3) {
        b.r(h.ex + 5, h.ey + 2, 3, 2, '#7a1f2a');
        b.px(h.ex + 5, h.ey + 4, '#f6f3ea');
        b.px(h.ex + 7, h.ey + 4, '#f6f3ea');
      } else if ((q.i + h.k) % 3 === 0) {
        b.r(h.ex + 6, h.ey + 1, 2, 1, '#d9483b');
      }
    }
  }

  /* 목 없는 기수: 불꽃 갈기의 말 위에 머리 없는 기사 */
  function rider(b, q, p) {
    const cx = CX + 3 + q.lunge;
    const horse = p.horse || '#1c1a24';
    const maneC = p.mane || '#ff8a2a';
    const coat = p.coat || '#2a2434';
    const rear = Math.round(q.wind * 4);
    const gallop = q.kind === 'walk' ? q.step : 0;
    const bob = q.kind === 'walk' ? Math.round(Math.abs(q.step)) : q.bob;
    const y = BY - 16 + q.rise - bob - Math.round(rear * 0.5);
    /* 말다리 */
    [[-9, -1], [-5, 1], [3, 1], [7, -1]].forEach(([lx, ph], i) => {
      const front = i >= 2;
      const sw = Math.round(gallop * 3 * ph);
      const up = front && rear ? rear + 1 : gallop * ph < -0.3 ? 2 : 0;
      const fx = cx + lx + sw + (front && rear ? 2 : 0) + (q.atk > 0.4 && front ? 1 : 0);
      b.line(cx + lx, y + 7, fx, BY - up - 2, horse, 3);
      b.r(fx - 1, BY - up - 2, 4, 2, '#3a3440');
    });
    /* 말 몸통, 목, 머리 */
    b.r(cx - 10, y, 19, 9, horse);
    b.r(cx - 9, y + 7, 17, 2, lighten(horse, 0.14));
    b.line(cx + 7, y + 1, cx + 11, y - 6 - rear, horse, 5);
    const hx = cx + 9;
    const hy = Math.max(4, y - 11 - rear);
    b.r(hx, hy, 7, 5, horse);
    b.r(hx + 4, hy + 2, 5, 4, horse);
    b.r(hx + 1, hy - 3, 2, 3, horse);
    b.r(hx + 4, hy - 3, 2, 3, horse);
    b.r(hx + 2, hy + 1, 3, q.wind > 0.7 ? 1 : 2, q.atk > 0.5 ? '#ff6a4a' : '#ffb04a');
    b.px(hx + 8, hy + 4, '#14121a');
    /* 갈기와 꼬리의 불꽃 */
    for (let k = 0; k < 4; k++) {
      const fl = (q.i + k) % 3;
      b.r(cx + 5 - k * 2, y - 4 - k - rear + (k > 1 ? 1 : 0) - fl, 2, 3 + fl, k % 2 ? maneC : '#ffd24a');
    }
    const t1 = cx - 10;
    const tw = wave(q, 1, 2);
    b.line(t1, y + 2, t1 - 6 + tw, y + 7 + wave(q, 2, 1), maneC, 3);
    b.line(t1 - 6 + tw, y + 7, t1 - 8, y + 4 + wave(q, 3, 2), '#ffd24a', 2);
    /* 안장과 기수 */
    b.r(cx - 4, y - 2, 9, 3, '#5a3a24');
    const ty = Math.max(7, y - 11 - Math.round(rear * 0.4));
    const lean = Math.round(q.atk * 2) - Math.round(q.wind * 2);
    for (let k = 0; k < 4; k++) {
      const sw2 = wave(q, k * 0.8, 1) - Math.round(q.atk * 2);
      b.r(cx - 12 + k * 2 + sw2, ty + 2 + k * 3, 8, 3, k > 1 ? p.capeLine || '#9a1f2e' : coat);
    }
    b.r(cx - 4 + lean, ty, 9, 12, coat);
    b.r(cx - 3 + lean, ty, 7, 2, '#d8d3c0');
    b.r(cx + lean, ty + 2, 2, 7, '#e8c14e');
    b.r(cx - 4 + lean, ty + 9, 9, 2, '#14121a');
    /* 목 잘린 자리의 불씨 */
    b.r(cx - 2 + lean, ty - 2, 5, 3, '#3a2a30');
    b.r(cx - 1 + lean, ty - 3 - (q.i % 2), 3, 2, maneC);
    b.px(cx + lean, ty - 4 - (q.i % 2), '#ffd24a');
    /* 칼 든 팔 */
    const ax = cx + 6 + lean + Math.round(q.atk * 9) - Math.round(q.wind * 2);
    const ay = Math.max(6, ty + 4 - Math.round(q.wind * 5) + Math.round(q.atk * 7));
    b.line(cx + 4 + lean, ty + 3, ax, ay, coat, 3);
    b.r(ax - 1, ay - 1, 3, 3, '#d8d3c0');
    const [ex, ey] = along(q, ax, ay, 12);
    b.line(ax, ay, ex, ey, '#d8dee5', 2);
    b.r(ax - 2, ay, 5, 2, '#c9a24a');
    /* 호박등을 든 팔 */
    const px = cx - 7 + lean;
    const py = ty + 5;
    b.line(cx - 4 + lean, ty + 3, px, py, coat, 3);
    b.disc(px - 1, py + 3, 3, '#e8812a');
    b.r(px - 3, py + 2, 2, 2, '#ffe08a');
    b.r(px + 1, py + 2, 2, 2, '#ffe08a');
    b.r(px - 2, py + 4, 4, 1, '#ffe08a');
    b.r(px - 1, py - 1, 2, 2, '#5a7a2a');
  }

  const ARCH = { folk, crawler, kasa, wisp, flyhead, quad, thing, serpent, rider };

  /* 투사체: render.js 의 PROJ 에 없으면 여기서 찾는다 */
  const ball = (ctx, x, y, edge, mid, core) => {
    ctx.fillStyle = '#141218';
    ctx.fillRect(x - 2, y - 2, 7, 7);
    ctx.fillStyle = edge;
    ctx.fillRect(x - 1, y - 1, 5, 5);
    ctx.fillStyle = mid;
    ctx.fillRect(x, y, 3, 3);
    ctx.fillStyle = core;
    ctx.fillRect(x + 1, y + 1, 1, 1);
  };
  YG.PROJ_EXTRA = {
    ghostfire(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 5);
      const px = Math.round(x);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#1a8a6a';
      for (let k = 1; k < 4; k++) ctx.fillRect(Math.round(px - f.dir * k * 4), yy + (k % 2), 3, 3);
      ctx.globalAlpha = 1;
      ball(ctx, px, yy, '#4ae0a0', '#b8ffe0', '#ffffff');
    },
    fire(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 6);
      const px = Math.round(x);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#e8812a';
      for (let k = 1; k < 4; k++) ctx.fillRect(Math.round(px - f.dir * k * 4), yy + (k % 2), 3, 3);
      ctx.globalAlpha = 1;
      ball(ctx, px, yy, '#e8812a', '#ffd24a', '#fff6c8');
    },
    silk(ctx, f, x, y, p) {
      for (let k = 0; k < 8; k++) {
        const sx = Math.round(x - f.dir * k * 3);
        const sy = Math.round(y + Math.sin(p * 9 + k * 0.9) * 3);
        ctx.fillStyle = '#141218';
        ctx.fillRect(sx - 1, sy - 1, 4, 4);
        ctx.fillStyle = k % 2 ? '#d9483b' : '#f06a5a';
        ctx.fillRect(sx, sy, 3, 2);
      }
    },
    gust(ctx, f, x, y, p) {
      ctx.globalAlpha = 0.9 - p * 0.4;
      for (let k = 0; k < 3; k++) {
        const gx = Math.round(x - f.dir * k * 7);
        const gy = Math.round(y - 4 + k * 4);
        ctx.fillStyle = '#e8f0f4';
        ctx.fillRect(gx, gy, 6, 1);
        ctx.fillRect(gx + f.dir * 5, gy + 1, 2, 1);
        ctx.fillRect(gx + f.dir * 6, gy + 2, 2, 1);
      }
      ctx.fillStyle = '#6fa86a';
      ctx.fillRect(Math.round(x), Math.round(y) - 1, 2, 3);
      ctx.globalAlpha = 1;
    },
    venom(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 10);
      const px = Math.round(x);
      ctx.fillStyle = '#141218';
      ctx.fillRect(px - 1, yy - 1, 6, 6);
      ctx.fillStyle = '#7ad04a';
      ctx.fillRect(px, yy, 4, 4);
      ctx.fillStyle = '#c8f08a';
      ctx.fillRect(px + 1, yy + 1, 1, 1);
      if (p > 0.8) {
        ctx.fillStyle = '#7ad04a';
        for (let k = -3; k <= 3; k += 3) ctx.fillRect(px + k, Math.round(y) + 4, 2, 2);
      }
    },
    bats(ctx, f, x, y, p) {
      for (let k = 0; k < 3; k++) {
        const bx = Math.round(x - f.dir * k * 6);
        const by = Math.round(y - 3 + k * 3 + Math.sin(p * 12 + k) * 2);
        const up = Math.floor(p * 14 + k) % 2;
        ctx.fillStyle = '#141218';
        ctx.fillRect(bx - 3, by - 2 + up, 8, 4);
        ctx.fillStyle = '#4a3a5a';
        ctx.fillRect(bx - 2, by - 1 + up, 2, 2);
        ctx.fillRect(bx + 2, by - 1 + up, 2, 2);
        ctx.fillStyle = '#6a4a7a';
        ctx.fillRect(bx, by, 2, 2);
        ctx.fillStyle = '#e5304a';
        ctx.fillRect(bx, by, 1, 1);
      }
    },
  };

  const baseRender = YG.archRender;
  YG.ARCH3 = ARCH;
  YG.archRender = (look, q) => {
    const draw = ARCH[look.arch];
    if (!draw) return baseRender(look, q);
    const b = builder();
    draw(b, q, look);
    return b.flush(look.outline);
  };

  YG.sprites3 = { WINGS, FACE, PROP, DECO, along, darken, lighten, flapOf };
})(globalThis);
