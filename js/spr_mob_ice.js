(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* 빙하 몬스터 (담당 E): 펭귄 병사, 눈사람, 얼음 정령. docs/art_guide.md 참고.
     모두 왼쪽(주인공 쪽)을 본다. 기준점(ax, ay)은 발밑(나는 몬스터는 그림자) 가운데.
     외곽선은 부품마다 b.part(..., true) 로 직접 두르고(def.outline = null), 입김, 눈보라, 그림자 같은 효과는 외곽선 없이 반투명으로 그린다. */

  const RAD = Math.PI / 180;
  const NS = { shade: false };
  const wave = (t) => Math.sin(t * TAU);
  /* 화면 각도(도): 0 = 오른쪽, 90 = 아래, 180 = 왼쪽(앞), 270 = 위 */
  const at = (x, y, deg, len) => [x + Math.cos(deg * RAD) * len, y + Math.sin(deg * RAD) * len];
  const rotPt = (x, y, deg) => {
    const c = Math.cos(deg * RAD);
    const s = Math.sin(deg * RAD);
    return [x * c - y * s, x * s + y * c];
  };

  /* 변환을 b 에 걸면서 같은 행렬을 따로 들고 있어서, 그림 속 점이 칸의 어디인지 알 수 있다 (떨어져 나가는 부품의 출발점 등) */
  const mmul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const NOB = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {} };
  function dual(b) {
    let m = [1, 0, 0, 1, 0, 0];
    const st = [];
    return {
      save() {
        st.push(m);
        b.save();
      },
      restore() {
        m = st.pop() || m;
        b.restore();
      },
      translate(x, y) {
        m = mmul(m, [1, 0, 0, 1, x, y]);
        b.translate(x, y);
      },
      rotate(deg) {
        const a = deg * RAD;
        m = mmul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
        b.rotate(deg);
      },
      scale(sx, sy = sx) {
        m = mmul(m, [sx, 0, 0, sy, 0, 0]);
        b.scale(sx, sy);
      },
      pt(x, y) {
        return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
      },
    };
  }

  /* 한 점 (배율 1 에서는 회전해도 꼭 한 픽셀, 배율 2 에서는 2x2 로 같이 커진다) */
  const dot = (b, x, y, c, a) => {
    if (b.S < 2) b.px(x, y, c, a === undefined ? 1 : a);
    else b.rect(x - 0.5, y - 0.5, 1, 1, c, a === undefined ? NS : { shade: false, alpha: a });
  };
  /* 눈. flip 은 감은 눈 모양( > < ) 방향 */
  function eye(b, x, y, kind, ink, flip) {
    const f = flip ? -1 : 1;
    switch (kind) {
      case 'blink':
        dot(b, x - 0.5, y + 0.5, ink);
        dot(b, x + 0.5, y + 0.5, ink);
        break;
      case 'shut':
        dot(b, x - 0.5 * f, y - 0.6, ink);
        dot(b, x + 0.5 * f, y + 0.3, ink);
        dot(b, x - 0.5 * f, y + 1.1, ink);
        break;
      case 'x':
        dot(b, x - 0.8, y - 0.8, ink);
        dot(b, x + 0.8, y - 0.8, ink);
        dot(b, x, y, ink);
        dot(b, x - 0.8, y + 0.8, ink);
        dot(b, x + 0.8, y + 0.8, ink);
        break;
      case 'happy':
        dot(b, x - 0.8, y + 0.4, ink);
        dot(b, x, y - 0.4, ink);
        dot(b, x + 0.8, y + 0.4, ink);
        break;
      default:
        dot(b, x, y - 0.5, ink);
        dot(b, x, y + 0.5, ink);
        if (b.S >= 2) b.px(x - 0.25, y - 0.75, '#ffffff');
        if (kind === 'angry') b.line(x - 1.3, y - 1.4, x + 1.0, y - 2.3, 0.8, ink, NS);
    }
  }
  /* 작은 반짝임 (+ 모양) */
  function twinkle(b, x, y, c, big, a) {
    dot(b, x, y, c, a);
    if (big) {
      dot(b, x - 1, y, c, a);
      dot(b, x + 1, y, c, a);
      dot(b, x, y - 1, c, a);
      dot(b, x, y + 1, c, a);
    }
  }

  /* ======================= 펭귄 병사 ======================= */
  const PG = 33; // 땅 (칸 안 y)
  const PX = 36; // 발밑 x
  const PC = 9.6; // 발밑에서 몸 가운데까지

  function penguinPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = { dx: 0, lift: 0, rot: 0, piv: 0, neck: 0, sx: 1, sy: 1, k: 1, footF: 0, footB: 0, flipF: 78, flipB: 58, plume: 0, helmY: 0, helmRot: 0, eyes: 'open', beak: 'shut', slide: 0, ghost: 0, die: 0, puff: 0, spray: 0 };
    switch (clip) {
      case 'idle': {
        const s = wave(ph);
        return {
          ...P,
          rot: 1.8 * s,
          sx: 1 - 0.025 * s,
          sy: 1 + 0.035 * s,
          flipF: 78 + 8 * s,
          flipB: 58 - 8 * s,
          plume: -7 * Math.cos(ph * TAU),
          helmRot: -1.2 * Math.cos(ph * TAU),
          neck: -2.5 * Math.cos(ph * TAU),
          footF: ph >= 0.5 ? Math.sin((ph - 0.5) * 2 * Math.PI) * 1.3 : 0,
          eyes: i === Math.floor(n * 0.6) ? 'blink' : 'open',
        };
      }
      case 'walk': {
        /* 뒤뚱: 몸이 좌우로 기울 때마다 반대쪽 발이 들리고, 지느러미는 균형을 잡느라 벌어진다 */
        const r = wave(ph);
        const a = Math.abs(r);
        return {
          ...P,
          rot: -3 + 9 * r,
          lift: 0.9 * a,
          sx: 1 + 0.05 * (1 - a),
          sy: 1 - 0.06 * (1 - a),
          footF: Math.max(0, r) * 2.4,
          footB: Math.max(0, -r) * 2.4,
          flipF: 74 + 30 * r,
          flipB: 50 + 26 * r,
          plume: -16 * Math.cos(ph * TAU),
          helmRot: -3 * Math.cos(ph * TAU),
          neck: 3 + 9 * (wave(ph - 0.1) - wave(ph)),
        };
      }
      case 'attack': {
        /* 뒤로 웅크렸다가(예비) 앞으로 몸을 던져 배로 미끄러지며 들이받는다. 맞히는 순간 pr 0.56 */
        const T = (keys) => track(keys, pr, ease.io);
        return {
          ...P,
          piv: 6,
          rot: T([[0, 0], [0.22, 16], [0.4, -50], [0.52, -86], [0.78, -88], [0.9, -32], [1, 0]]),
          dx: T([[0, 0], [0.22, 2], [0.42, -4], [0.56, -11], [0.78, -12.5], [0.9, -5], [1, 0]]),
          lift: track([[0, 0], [0.22, 0], [0.33, 2.4], [0.45, 1.4], [0.56, 0], [0.84, 0], [0.92, 1.4], [1, 0]], pr),
          sx: T([[0, 1], [0.22, 1.12], [0.38, 0.9], [0.56, 1.07], [0.78, 1], [1, 1]]),
          sy: T([[0, 1], [0.22, 0.85], [0.38, 1.12], [0.56, 0.9], [0.78, 1], [1, 1]]),
          flipF: T([[0, 78], [0.22, 8], [0.4, 60], [0.56, 96], [0.78, 96], [0.9, 20], [1, 78]]),
          flipB: T([[0, 58], [0.22, -14], [0.4, 40], [0.56, 86], [0.78, 86], [0.9, 0], [1, 58]]),
          plume: T([[0, 0], [0.22, -30], [0.4, 34], [0.56, 22], [0.78, -6], [0.9, 30], [1, 0]]),
          helmRot: T([[0, 0], [0.22, -6], [0.4, 6], [0.56, 4], [0.9, 6], [1, 0]]),
          neck: T([[0, 0], [0.22, -8], [0.4, 30], [0.52, 58], [0.78, 64], [0.9, 24], [1, 0]]),
          footF: track([[0, 0], [0.22, 0], [0.36, 1.5], [0.5, 0], [1, 0]], pr),
          eyes: pr > 0.08 && pr < 0.93 ? 'angry' : 'open',
          beak: pr > 0.3 && pr < 0.84 ? 'open' : 'shut',
          slide: pr > 0.5 && pr < 0.84 ? 1 : 0,
          spray: pr > 0.5 && pr < 0.84 ? (pr - 0.5) / 0.34 : 0,
          ghost: pr > 0.4 && pr < 0.62 ? 1 : 0,
        };
      }
      case 'hurt':
        return {
          ...P,
          rot: track([[0, 16], [0.25, 22], [0.62, -5], [1, 0]], pr),
          dx: track([[0, 3], [0.3, 3.6], [1, 0]], pr, ease.out),
          sx: track([[0, 1.14], [0.3, 0.93], [0.65, 1.04], [1, 1]], pr),
          sy: track([[0, 0.86], [0.3, 1.08], [0.65, 0.97], [1, 1]], pr),
          helmY: track([[0, -2.4], [0.3, -3], [0.62, 0.4], [1, 0]], pr),
          helmRot: track([[0, -14], [0.3, 12], [0.7, -4], [1, 0]], pr),
          neck: track([[0, 10], [0.25, 18], [0.6, -6], [1, 0]], pr),
          flipF: track([[0, -40], [0.35, -20], [1, 78]], pr, ease.io),
          flipB: track([[0, -70], [0.35, -45], [1, 58]], pr, ease.io),
          plume: track([[0, 40], [0.35, -24], [0.7, 10], [1, 0]], pr),
          footF: track([[0, 2], [0.5, 0.6], [1, 0]], pr),
          eyes: pr < 0.8 ? 'shut' : 'open',
          beak: pr < 0.6 ? 'open' : 'shut',
        };
      case 'die': {
        /* 뒤로 벌러덩 넘어지고 투구가 튕겨 나가 굴렀다가, 눈 연기로 사라진다 */
        const fall = track([[0, 18], [0.15, 26], [0.42, 96], [0.5, 86], [0.58, 92], [1, 92]], pr);
        return {
          ...P,
          piv: 6,
          rot: fall,
          dx: track([[0, 2], [0.42, 4.5], [1, 4.5]], pr),
          sx: track([[0, 1], [0.42, 1], [0.47, 1.1], [0.56, 0.96], [0.62, 1]], pr),
          sy: track([[0, 1], [0.42, 1], [0.47, 0.9], [0.56, 1.04], [0.62, 1]], pr),
          flipF: track([[0, -30], [0.42, -95], [0.5, -40], [0.6, -70], [1, -60]], pr),
          flipB: track([[0, -60], [0.42, -110], [0.5, -70], [1, -80]], pr),
          footF: track([[0, 0], [0.42, 1.8], [0.5, 0], [0.6, 1.2], [0.7, 0], [1, 0]], pr),
          footB: track([[0, 0], [0.42, 1], [0.5, 1.6], [0.6, 0], [1, 0]], pr),
          eyes: pr < 0.25 ? 'shut' : 'x',
          neck: track([[0, 10], [0.42, 22], [0.5, -6], [0.6, 6], [1, 4]], pr),
          beak: 'open',
          die: pr,
          k: track([[0, 1], [0.62, 1], [0.9, 0.3], [1, 0]], pr),
          puff: clamp((pr - 0.6) / 0.4),
        };
      }
      default:
        return P;
    }
  }

  /* 펭귄 몸 좌표계: 몸 가운데가 (0, 0), 발밑이 (0, PC). 기울기는 piv(발밑에서의 높이) 둘레로 돈다 */
  function penguinFrame(d, p) {
    d.translate(PX + p.dx, PG - p.lift);
    d.translate(0, -p.piv);
    d.rotate(p.rot);
    d.translate(0, p.piv);
    d.scale(p.sx, p.sy);
    d.translate(0, -PC);
    d.scale(p.k);
  }
  /* 머리 좌표계: 목 (몸 위쪽) 에서 p.neck 만큼 돈다. 머리 가운데는 (0, -2.8) */
  function penguinHead(d, p) {
    d.translate(-0.6, -3.2);
    d.rotate(p.neck);
  }

  function penguinHelmet(b, pal, plume) {
    const tone = b.tone;
    b.part(() => {
      /* 깃털 장식: 투구보다 한 박자 늦게 흔들린다 */
      const [ax, ay] = at(0.6, -3.4, -78 + plume * 0.6, 2.6);
      const [bx, by] = at(ax, ay, -24 + plume, 3.4);
      b.line(0.6, -3.2, ax, ay, 2.2, pal.plume, NS, 1.9);
      b.line(ax, ay, bx, by, 1.9, pal.plume, NS, 0.8);
      b.line(ax + 0.2, ay - 0.4, bx, by - 0.3, 0.7, tone(pal.plume, 0.35), NS, 0.4);
      /* 둥근 투구 */
      const pts = [];
      for (let a = 0; a <= 12; a++) {
        const t = Math.PI + (a / 12) * Math.PI;
        pts.push([Math.cos(t) * 4.7, Math.sin(t) * 3.7 - 0.2]);
      }
      b.poly(pts, pal.helm, { hi: 0.38, lo: -0.3 });
      b.ell(-1.8, -2.5, 1.5, 0.8, tone(pal.helm, 0.55), NS);
      b.rect(-4.5, -1.7, 9.0, 1.0, pal.trim, NS);
      b.rrect(-5.6, -0.8, 10.8, 1.7, 0.8, tone(pal.helm, -0.18), NS);
      b.rect(-5.2, -0.8, 10.0, 0.5, tone(pal.helm, 0.2), NS);
      dot(b, -2.4, -1.2, tone(pal.trim, 0.5));
      dot(b, 2.0, -1.2, tone(pal.trim, -0.3));
    }, true);
  }

  function drawPenguin(b, clip, i, n, pal) {
    const p = penguinPose(clip, i, n);
    const tone = b.tone;
    const d = dual(b);

    /* 미끄러질 때 몸 뒤로 남는 잔상과 속도선 */
    if (p.ghost || p.slide) {
      const q = dual(NOB);
      penguinFrame(q, p);
      const [cx, cy] = q.pt(0, 0);
      if (p.ghost) {
        b.ell(cx + 4, cy + 0.5, 6.5, 4.6, '#cfe9ff', { shade: false, alpha: 0.32 });
        b.ell(cx + 8, cy + 1, 5.5, 3.6, '#cfe9ff', { shade: false, alpha: 0.18 });
      }
      if (p.slide) {
        for (let k = 0; k < 3; k++) {
          const y = PG - 1.6 - k * 3.2;
          const x0 = cx + 6 + k * 1.5 + p.spray * 3;
          b.line(x0, y, x0 + 6 - k, y, 0.9, '#e6f6ff', { shade: false, alpha: 0.75 - k * 0.15 });
        }
        b.rect(cx - 2, PG - 0.6, 14, 0.6, '#bfe4ff', { shade: false, alpha: 0.6 });
      }
    }

    d.save();
    penguinFrame(d, p);
    if (p.k > 0.05) {
    /* 뒷지느러미 */
    b.part(() => {
      const [ex, ey] = at(2.6, -2.8, p.flipB, 5.2);
      b.line(2.6, -2.8, ex, ey, 2.6, tone(pal.body, -0.3), NS, 1.2);
    }, true);
    /* 발 (발가락이 앞쪽) */
    b.part(() => {
      b.ell(0.8, 8.5 - p.footB, 2.4, 1.15, tone(pal.feet, -0.22), NS);
    }, true);
    b.part(() => {
      b.ell(-2.8, 8.7 - p.footF, 2.6, 1.2, pal.feet, NS);
      b.rect(-5.0, 8.6 - p.footF, 4.4, 0.6, tone(pal.feet, 0.3), NS);
    }, true);
    /* 몸과 머리 (머리는 목 둘레로 따로 돌아서, 배로 미끄러질 때도 앞을 본다) */
    b.part(() => {
      b.ell(0, 1.2, 6, 7.0, pal.body, { hi: 0.3, lo: -0.35 });
      b.ell(3.6, -1.2, 1.4, 2.6, tone(pal.body, 0.14), NS);
      /* 흰 배 */
      b.ell(-1.8, 3.0, 4.0, 5.2, pal.belly, { hi: 0.2, lo: -0.16 });
      b.ell(1.0, 4.4, 1.3, 2.8, tone(pal.belly, -0.12), NS);
      b.ell(-3.4, 1.4, 0.9, 1.4, '#ffffff', NS);
      d.save();
      penguinHead(d, p);
      b.ell(0, -2.8, 4.5, 4.4, pal.body, { hi: 0.3, lo: -0.3 });
      b.ell(-2.0, 0.2, 2.2, 1.7, pal.belly, NS);
      dot(b, -1.2, -0.9, pal.blush);
      /* 부리 (얇은 다각형은 한 줄로 뭉개지므로 두께 있는 선으로) */
      const open = p.beak === 'open' ? 1 : 0;
      const by = -2.0;
      if (open) b.line(-4.2, by + 0.8, -6.8, by + 1.4, 1.6, '#8a2a35', NS, 1.0);
      b.line(-4.2, by + 1.0 + open * 0.4, -6.4 + open * 0.4, by + 1.2 + open * 1.1, 1.6, tone(pal.beak, -0.25), NS, 1.0);
      b.line(-4.0, by, -8.4, by + 0.4 - open * 0.6, 2.4, pal.beak, NS, 1.0);
      b.line(-4.6, by - 0.5, -7.4, by - 0.1 - open * 0.5, 0.6, tone(pal.beak, 0.4), NS);
      /* 눈 둘레 흰 테 */
      b.ell(-2.2, -3.9, 1.7, 1.6, '#ffffff', NS);
      eye(b, -2.6, -3.9, p.eyes === 'open' && pal.fierce ? 'angry' : p.eyes, pal.ink);
      d.restore();
    }, true);
    /* 투구 (튕겨 나가기 전) */
    if (!p.die) {
      d.save();
      penguinHead(d, p);
      d.translate(0.4, -6.7 + p.helmY);
      d.rotate(p.helmRot);
      penguinHelmet(b, pal, p.plume);
      d.restore();
    }
    /* 앞지느러미 */
    b.part(() => {
      const [ex, ey] = at(1.3, -0.8, p.flipF, 5.2);
      b.line(1.3, -0.8, ex, ey, 2.8, tone(pal.body, 0.1), NS, 1.3);
      const [mx, my] = at(1.3, -0.8, p.flipF, 2.6);
      b.line(1.0, -1.0, mx - 0.4, my, 0.7, tone(pal.body, 0.38), NS);
    }, true);
    }
    d.restore();

    /* 쓰러질 때: 투구가 튕겨 나가 한 바퀴 돌고 땅에 떨어져 흔들린다 */
    if (p.die) {
      const p0 = penguinPose('die', 0, n);
      const q = dual(NOB);
      penguinFrame(q, p0);
      penguinHead(q, p0);
      q.translate(0.4, -6.7);
      const [hx0, hy0] = q.pt(0, 0);
      const t = p.die;
      const land = 0.46;
      const hx1 = PX + p.dx - 11;
      const hy1 = PG - 0.9;
      let hx;
      let hy;
      let hr;
      if (t < land) {
        const u = t / land;
        hx = lerp(hx0, hx1, u);
        hy = lerp(hy0, hy1, u * u) - 8 * Math.sin(Math.PI * u) * (1 - u * 0.3);
        hr = lerp(p0.rot, 360, ease.out(u));
      } else {
        const u = (t - land) / (1 - land);
        hx = hx1 + 1.2 * ease.out(Math.min(1, u * 2));
        hy = hy1;
        hr = 22 * Math.exp(-4 * u) * Math.cos(u * 14);
      }
      const hk = track([[0, 1], [0.66, 1], [0.9, 0.35], [1, 0]], t);
      if (hk > 0.05) {
      b.save();
      b.translate(hx, hy);
      b.scale(hk);
      b.rotate(hr);
      penguinHelmet(b, pal, -8 * Math.cos(t * 9));
      b.restore();
      }
      /* 눈 연기 */
      if (p.puff > 0) {
        const q2 = dual(NOB);
        penguinFrame(q2, { ...p, k: 1 });
        const [cx, cy] = q2.pt(0, 0);
        const u = p.puff;
        /* 연기는 퍼지면서 위로 떠오르고 작아진다 */
        for (let k = 0; k < 6; k++) {
          const a = 160 + k * 44;
          const dist = 2.5 + 5 * ease.out(u);
          const [x, y0] = at(cx, cy, a, dist);
          const y = Math.min(y0, PG - 2) - 4 * u * u;
          const r = 1.6 + 2.2 * Math.sin(Math.PI * Math.min(1, 0.3 + u * 0.9));
          b.disc(x, y, r, k % 2 ? '#ffffff' : '#e4f1fb', { shade: false, alpha: 0.95 - 0.5 * u });
        }
        for (let k = 0; k < 2; k++) {
          const [x, y] = at(hx, hy - 2.5, 220 + k * 90, 1.5 + 3 * u);
          b.disc(x, y - 3 * u * u, 1.4 + 1.2 * Math.sin(Math.PI * Math.min(1, 0.3 + u)), '#ffffff', { shade: false, alpha: 0.9 - 0.5 * u });
        }
      }
    }

    /* 들이받을 때 앞쪽으로 튀는 얼음 가루 */
    if (p.spray) {
      const q = dual(NOB);
      penguinFrame(q, p);
      penguinHead(q, p);
      const [fx] = q.pt(-7, -2);
      for (let k = 0; k < 5; k++) {
        const u = clamp(p.spray * 1.2 - k * 0.12);
        if (u <= 0) continue;
        const x = fx - 1 - u * (4 + k * 1.3);
        const y = PG - 1 - Math.sin(u * Math.PI) * (3 + (k % 3) * 1.6);
        twinkle(b, x, y, k % 2 ? '#ffffff' : '#bfe6ff', k === 1, 1);
      }
    }
  }

  /* ======================= 눈사람 ======================= */
  const SG = 34;
  const SX = 22;
  const RB = 5.6; // 아랫몸
  const RM = 4.4; // 가운데몸
  const RH = 4.1; // 머리

  function snowPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = { dx: 0, roll: 0, bsx: 1, bsy: 1, mx: 0, my: 0, tilt: 0, htilt: 0, armF: 200, armB: -18, lenF: 6.6, eyes: 'open', mouth: 'smile', scarf: 0, samp: 1, melt: 0, bits: 0, kick: -1, die: 0 };
    const rollOf = (dx) => (dx / RB) / RAD;
    switch (clip) {
      case 'idle': {
        const s = wave(ph);
        return {
          ...P,
          roll: 5 * s,
          dx: 5 * RAD * RB * s,
          tilt: 2 * wave(ph - 0.08),
          htilt: 3.5 * wave(ph - 0.22),
          my: -0.3 * (1 + Math.cos(ph * TAU)) * 0.5,
          armF: 210 + 7 * wave(ph - 0.15),
          armB: -28 - 7 * wave(ph - 0.15),
          scarf: ph,
          samp: 0.6,
          eyes: i === Math.floor(n * 0.6) ? 'blink' : 'open',
        };
      }
      case 'walk': {
        /* 아랫몸을 굴려서 간다 (눈 덩어리 무늬 3개라 1/3 바퀴마다 같은 모양). 윗몸은 한 박자 늦게 앞뒤로 흔들린다 */
        const r = wave(ph);
        return {
          ...P,
          roll: -ph * 120,
          tilt: -5 + 3 * wave(ph - 0.15),
          htilt: 5 * wave(ph - 0.32),
          my: -0.7 * (0.5 - 0.5 * Math.cos(ph * TAU)),
          bsy: 1 - 0.03 * (0.5 + 0.5 * Math.cos(ph * TAU)),
          bsx: 1 + 0.03 * (0.5 + 0.5 * Math.cos(ph * TAU)),
          armF: 206 + 14 * r,
          armB: -22 + 14 * r,
          scarf: ph,
          samp: 1.5,
          kick: ph,
        };
      }
      case 'attack': {
        /* 윗몸을 뒤로 젖히며 나뭇가지 팔을 치켜들었다가(예비) 앞으로 크게 후려친다. 맞히는 순간 pr 0.56 */
        const T = (keys) => track(keys, pr, ease.io);
        const dx = T([[0, 0], [0.22, 1.6], [0.4, 2], [0.56, -2.4], [0.7, -2.8], [0.85, -1], [1, 0]]);
        return {
          ...P,
          dx,
          roll: rollOf(dx),
          tilt: T([[0, 0], [0.22, 12], [0.4, 15], [0.56, -16], [0.7, -19], [0.85, -6], [1, 0]]),
          htilt: T([[0, 0], [0.22, 4], [0.4, 13], [0.56, -3], [0.7, -15], [0.85, -6], [1, 0]]),
          armF: T([[0, 205], [0.22, 118], [0.4, 72], [0.56, 186], [0.7, 224], [0.85, 212], [1, 205]]),
          armB: T([[0, -18], [0.22, 14], [0.4, 24], [0.56, -44], [0.7, -52], [0.85, -30], [1, -18]]),
          lenF: T([[0, 6.6], [0.4, 7], [0.56, 8.4], [0.7, 8.2], [0.85, 7.2], [1, 6.6]]),
          my: T([[0, 0], [0.22, 0.8], [0.4, 0.5], [0.56, -0.7], [0.7, -0.3], [1, 0]]),
          bsx: T([[0, 1], [0.22, 1.06], [0.4, 1.04], [0.56, 0.96], [0.7, 0.98], [1, 1]]),
          bsy: T([[0, 1], [0.22, 0.94], [0.4, 0.96], [0.56, 1.04], [0.7, 1.02], [1, 1]]),
          eyes: pr > 0.1 && pr < 0.9 ? 'angry' : 'open',
          mouth: pr > 0.3 && pr < 0.82 ? 'grr' : 'smile',
          scarf: pr,
          samp: 2,
        };
      }
      case 'hurt': {
        const dx = track([[0, 3], [0.35, 3.5], [1, 0]], pr, ease.out);
        return {
          ...P,
          dx,
          roll: rollOf(dx),
          tilt: track([[0, 14], [0.3, 18], [0.7, -4], [1, 0]], pr),
          htilt: track([[0, 10], [0.3, 24], [0.7, -8], [1, 0]], pr),
          armF: track([[0, 250], [0.35, 266], [1, 200]], pr, ease.io),
          armB: track([[0, -66], [0.35, -80], [1, -18]], pr, ease.io),
          bsx: track([[0, 1.1], [0.4, 0.96], [1, 1]], pr),
          bsy: track([[0, 0.9], [0.4, 1.04], [1, 1]], pr),
          eyes: pr < 0.8 ? 'shut' : 'open',
          mouth: 'o',
          bits: pr,
          scarf: pr,
          samp: 2.2,
        };
      }
      case 'die': {
        /* 윗몸이 뒤로 넘어가 떨어지고, 팔은 빠져서 땅에 떨어지고, 전부 녹아 웅덩이가 된다 */
        return {
          ...P,
          dx: track([[0, 2], [0.3, 2.5], [1, 2.5]], pr),
          roll: rollOf(2.5) * clamp(pr * 3),
          tilt: track([[0, 14], [0.18, 24], [0.46, 90], [0.55, 80], [0.64, 90], [1, 90]], pr),
          mx: track([[0, 1], [0.18, 1.5], [0.46, 5], [1, 5]], pr),
          my: track([[0, 0], [0.18, -1.4], [0.3, -1.6], [0.46, 5.6], [0.55, 4.6], [0.64, 5.6], [1, 5.6]], pr),
          htilt: track([[0, 12], [0.25, 30], [0.46, 8], [0.55, 26], [0.64, 16], [1, 16]], pr),
          eyes: pr < 0.2 ? 'shut' : 'x',
          mouth: 'o',
          die: pr,
          melt: track([[0, 0], [0.6, 0], [1, 0.8]], pr, ease.io),
          scarf: pr,
          samp: 1.4,
        };
      }
      default:
        return P;
    }
  }

  /* 윗몸 좌표계: (0, 0) 이 가운데몸 아래쪽(아랫몸과 닿는 곳), 가운데몸 가운데는 (0, -RM + 0.3) */
  function snowUpper(d, p) {
    d.translate(SX + p.dx + p.mx, SG + p.my - (2 * RB - 1.4));
    d.rotate(p.tilt);
  }
  const ARM_F = [-3.2, -3.8];
  const ARM_B = [3.2, -4.0];

  /* 나뭇가지 팔: 가운데 잔가지 하나, 끝에 손가락 가지 둘 */
  function stick(b, x, y, ang, len, col, up) {
    const [ex, ey] = at(x, y, ang, len);
    b.line(x, y, ex, ey, 1.4, col, NS, 1.0);
    const [mx, my] = at(x, y, ang, len * 0.55);
    const [tx, ty] = at(mx, my, ang + 42 * up, len * 0.32);
    b.line(mx, my, tx, ty, 1.0, col, NS, 0.8);
    const [f1x, f1y] = at(ex, ey, ang + 38 * up, 1.7);
    const [f2x, f2y] = at(ex, ey, ang - 30 * up, 1.5);
    b.line(ex, ey, f1x, f1y, 0.9, col, NS);
    b.line(ex, ey, f2x, f2y, 0.9, col, NS);
  }

  /* 머리 좌표계: (0, 0) 이 목, 머리 가운데는 (0, HC) */
  const HC = -RH - 0.6;
  function snowHead(b, pal, p) {
    const tone = b.tone;
    const top = HC - RH;
    b.part(() => {
      b.ell(0, HC, RH, RH - 0.1, pal.snow, { hi: 0.5, lo: -0.12 });
      b.ell(1.5, HC + 1.0, 2.0, 2.3, tone(pal.snow, -0.07), NS);
      b.ell(-1.0, HC - 2.4, 1.3, 0.7, '#ffffff', NS);
      /* 모자 */
      if (pal.hat === 'top') {
        b.rect(-2.4, top - 3.8, 5.2, 4.4, pal.hatCol, { hi: 0.2 });
        b.rect(-2.4, top - 0.7, 5.2, 1.0, pal.band, NS);
        b.rrect(-4.0, top + 0.2, 8.4, 1.3, 0.5, tone(pal.hatCol, 0.12), NS);
        dot(b, -1.6, top - 3.0, tone(pal.hatCol, 0.4));
      } else if (pal.hat === 'bucket') {
        b.poly([[-3.4, top + 1.4], [-2.4, top - 2.4], [2.8, top - 2.4], [3.8, top + 1.4]], pal.hatCol, { hi: 0.3 });
        b.rect(-3.6, top + 0.6, 7.6, 0.9, tone(pal.hatCol, -0.2), NS);
        b.line(-2.0, top - 1.6, -2.6, top + 0.4, 0.6, tone(pal.hatCol, 0.4), NS);
      }
      /* 얼굴: 숯 눈과 입, 당근 코 */
      const ec = p.eyes === 'open' || p.eyes === 'angry' ? pal.eye : pal.coal;
      eye(b, -1.9, HC - 1.5, p.eyes, ec, true);
      eye(b, 0.9, HC - 1.5, p.eyes, ec, false);
      dot(b, 1.7, HC + 1.0, pal.blush);
      const my = HC + 2.3;
      if (p.mouth === 'o') {
        b.ell(-1.0, my + 0.3, 0.8, 0.9, pal.coal, NS);
      } else if (p.mouth === 'grr') {
        for (let k = 0; k < 4; k++) dot(b, -2.4 + k * 1.0, my + (k % 2) * 0.7, pal.coal);
      } else {
        dot(b, -2.3, my - 0.2, pal.coal);
        dot(b, -1.3, my + 0.5, pal.coal);
        dot(b, -0.3, my + 0.5, pal.coal);
        dot(b, 0.7, my - 0.2, pal.coal);
      }
      /* 당근은 얇으면 한 줄로 뭉개지므로 끝이 가는 선으로 */
      b.line(-2.6, HC + 0.5, -8.2, HC + 1.0, 1.9, pal.carrot, NS, 0.7);
      b.line(-3.0, HC + 0.1, -6.2, HC + 0.5, 0.6, tone(pal.carrot, 0.4), NS);
      dot(b, -4.2, HC + 1.1, tone(pal.carrot, -0.35));
      dot(b, -5.8, HC + 1.1, tone(pal.carrot, -0.35));
    }, true);
  }

  function drawSnowman(b, clip, i, n, pal) {
    const p = snowPose(clip, i, n);
    const tone = b.tone;
    const X = SX + p.dx;
    const d = dual(b);

    /* 녹은 웅덩이 */
    if (p.melt > 0) {
      b.ell(X + 5, SG - 0.2, 6 + 10 * p.melt, 0.8 + 1.0 * p.melt, mixc(pal.snow, '#6fbcef', 0.55), { shade: false, alpha: 0.55 + 0.35 * p.melt });
      b.ell(X + 1, SG - 0.6, 2 + 4 * p.melt, 0.4, '#ffffff', { shade: false, alpha: 0.5 * p.melt });
    }
    /* 굴러갈 때 뒤로 튀는 눈 */
    if (p.kick >= 0) {
      for (let k = 0; k < 3; k++) {
        const t = (p.kick + k / 3) % 1;
        const x = X + RB - 1 + t * 7;
        const y = SG - 1.2 - Math.sin(t * Math.PI) * 3.6 - t;
        const r = 1.3 * (1 - t) + 0.5;
        b.part(() => b.disc(x, y, r, pal.snow, NS), t < 0.55 ? tone(pal.snow, -0.35) : undefined);
      }
    }

    d.save();
    if (p.melt > 0) {
      d.translate(X + 5, SG);
      d.scale(1 + 0.3 * p.melt, 1 - p.melt);
      d.translate(-(X + 5), -SG);
    }

    /* 뒷팔 */
    if (!p.die) {
      d.save();
      snowUpper(d, p);
      b.part(() => stick(b, ARM_B[0], ARM_B[1], p.armB, 6.2, tone(pal.stick, -0.22), -1), true);
      d.restore();
    }

    /* 아랫몸: 굴러가는 무늬 */
    d.save();
    d.translate(X, SG);
    d.scale(p.bsx, p.bsy);
    b.part(() => {
      b.ell(0, -RB, RB, RB, pal.snow, { hi: 0.5, lo: -0.14 });
      b.ell(1.8, -RB + 1.6, 3.6, 3.8, tone(pal.snow, -0.07), NS);
      b.ell(-2.6, -RB - 2.6, 1.6, 1.0, '#ffffff', NS);
      for (let k = 0; k < 3; k++) {
        const [mx, my] = at(0, -RB, p.roll + k * 120 + 30, 3.5);
        b.disc(mx, my, 1.15, mixc(pal.snow, '#7f9bb8', 0.42), NS);
        dot(b, mx - 0.4, my - 0.5, '#ffffff');
      }
      b.rect(-RB + 0.8, -0.9, 2 * RB - 1.6, 0.9, tone(pal.snow, -0.2), NS);
    }, true);
    d.restore();

    /* 윗몸 (가운데몸, 목도리, 머리, 앞팔) */
    d.save();
    snowUpper(d, p);
    const mcy = -RM + 0.3;
    b.part(() => {
      b.ell(0, mcy, RM, RM, pal.snow, { hi: 0.5, lo: -0.14 });
      b.ell(1.4, mcy + 1.2, 2.6, 2.8, tone(pal.snow, -0.07), NS);
      b.ell(-1.6, mcy - 2.0, 1.2, 0.8, '#ffffff', NS);
      dot(b, -2.5, mcy - 0.6, pal.coal);
      dot(b, -2.8, mcy + 1.6, pal.coal);
    }, true);
    /* 앞팔 (후려치는 팔) */
    const frontArm = () => {
      /* 휘두를 때 잔상 */
      if (clip === 'attack' && i > 0) {
        const pp = snowPose(clip, i - 1, n);
        const span = pp.armF - p.armF;
        if (Math.abs(span) > 50) {
          for (let k = 0; k <= 6; k++) {
            const a = p.armF + (span * k) / 6;
            const [x, y] = at(ARM_F[0], ARM_F[1], a, p.lenF - 0.6);
            b.disc(x, y, 1.5 - k * 0.12, '#eef8ff', { shade: false, alpha: 0.55 - k * 0.06 });
          }
        }
      }
      b.part(() => stick(b, ARM_F[0], ARM_F[1], p.armF, p.lenF, pal.stick, 1), true);
    };
    /* 팔을 치켜든 동안은 머리 뒤에 그려서 얼굴을 가리지 않는다 */
    const armUp = p.armF > 232 && p.armF < 330;
    if (!p.die && armUp) frontArm();
    /* 목도리 꼬리 (뒤로 펄럭) */
    const nk = mcy - RM + 0.6;
    b.part(() => {
      const fl = Math.sin(p.scarf * TAU) * 12 * p.samp;
      const [ax, ay] = at(2.4, nk + 0.6, 62 - fl * 0.5, 2.6);
      const [bx, by] = at(ax, ay, 40 - fl, 2.6);
      b.line(2.4, nk + 0.6, ax, ay, 2.0, tone(pal.scarf, -0.15), NS, 1.8);
      b.line(ax, ay, bx, by, 1.8, tone(pal.scarf, -0.15), NS, 1.6);
      dot(b, ax, ay, tone(pal.scarf, 0.45));
      const [cx, cy] = at(bx, by, 40 - fl * 1.4, 1.0);
      dot(b, cx, cy, tone(pal.scarf, -0.35));
    }, true);
    /* 머리 */
    d.save();
    d.translate(0, nk);
    d.rotate(p.htilt);
    snowHead(b, pal, p);
    d.restore();
    /* 목도리 */
    b.part(() => {
      b.rrect(-RM + 0.2, nk - 0.8, 2 * RM - 0.4, 1.9, 0.9, pal.scarf, NS);
      b.rect(-RM + 0.8, nk - 0.8, 2 * RM - 1.6, 0.5, tone(pal.scarf, 0.3), NS);
      dot(b, -1.8, nk + 0.6, tone(pal.scarf, -0.3));
      dot(b, 0.6, nk + 0.6, tone(pal.scarf, -0.3));
      dot(b, 3.0, nk + 0.6, tone(pal.scarf, -0.3));
    }, true);

    if (!p.die && !armUp) frontArm();
    d.restore();
    d.restore();

    /* 맞을 때 떨어져 나가는 눈 덩이 */
    if (p.bits > 0) {
      for (let k = 0; k < 4; k++) {
        const u = clamp(p.bits * 1.3 - k * 0.08);
        const x = X + 2 + u * (5 + k * 1.6);
        const y = SG - 18 + k * 3 - Math.sin(u * Math.PI) * 3 + u * u * 6;
        b.part(() => b.disc(x, y, 1.1 * (1 - u * 0.6), pal.snow, NS), u < 0.7 ? true : undefined);
      }
    }

    /* 쓰러질 때: 팔이 빠져서 땅으로 떨어진다 */
    if (p.die) {
      const p0 = snowPose('die', 0, n);
      const q = dual(NOB);
      snowUpper(q, p0);
      const t = clamp(p.die / 0.5);
      const fallStick = (base, ang0, len, col, up, endX, endAng, hop) => {
        const [bx0, by0] = q.pt(base[0], base[1]);
        const u = ease.in(t);
        const ex = lerp(bx0, endX, t);
        const ey = lerp(by0, SG - 0.8, u) - hop * Math.sin(Math.PI * t);
        const a = lerp(ang0 + p0.tilt, endAng, ease.out(t));
        b.part(() => stick(b, ex, ey, a, len, col, up), true);
      };
      fallStick(ARM_B, p0.armB, 6.2, tone(pal.stick, -0.22), -1, X + 3, -8, 2);
      fallStick(ARM_F, p0.armF, 6.6, pal.stick, 1, X - 5, 186, 4);
    }
  }
  const mixc = (a, c, t) => TG.anim.mix(a, c, t);

  /* ======================= 얼음 정령 ======================= */
  const WG = 33;
  const WX = 35;
  const WH = 14; // 몸 가운데 높이 (땅 위)
  const WR = 5.4;

  function wispPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = { dx: 0, bob: 0, rot: 0, sx: 1, sy: 1, R: 10, orb: 0, tw: 0, tamp: 1, crest: 1.5, eyes: 'open', mouth: 'smile', L: 0, bfade: 1, bt: 0, crack: 0, shatter: 0, trail: -1, chips: 0, tw2: -1 };
    switch (clip) {
      case 'idle': {
        const s = wave(ph);
        return {
          ...P,
          bob: 1.3 * s,
          rot: 2.5 * wave(ph - 0.25),
          sx: 1 + 0.03 * wave(ph + 0.25),
          sy: 1 - 0.03 * wave(ph + 0.25),
          crest: 1.5 + 1.4 * wave(ph - 0.2),
          orb: ph * 120,
          tw: ph,
          tamp: 1,
          tw2: ph,
          eyes: i === Math.floor(n * 0.6) ? 'blink' : 'open',
        };
      }
      case 'walk': {
        /* 앞으로 기울어 날아간다. 꼬리가 물결치고 얼음 조각이 빙글빙글 */
        const s = wave(ph);
        return {
          ...P,
          bob: 1.6 * s,
          rot: -10 + 3 * wave(ph - 0.2),
          sx: 1.05 - 0.03 * s,
          sy: 0.97 + 0.03 * s,
          crest: 3.2 + 1.2 * wave(ph * 2 - 0.25),
          orb: ph * 240,
          tw: ph * 2,
          tamp: 1.7,
          trail: ph,
        };
      }
      case 'attack': {
        /* 숨을 크게 들이마시고(뒤로 젖히며 볼이 부풂) 차가운 입김을 길게 내뿜는다. 맞히는 순간 pr 0.56 */
        const T = (keys) => track(keys, pr, ease.io);
        return {
          ...P,
          rot: T([[0, 0], [0.22, 12], [0.36, 15], [0.5, -12], [0.62, -14], [0.78, -8], [0.9, -2], [1, 0]]),
          dx: T([[0, 0], [0.22, 2], [0.36, 2.6], [0.5, -1.4], [0.62, -2], [0.78, -1], [1, 0]]),
          sx: T([[0, 1], [0.22, 1.12], [0.36, 1.16], [0.5, 0.9], [0.62, 0.92], [0.78, 0.98], [1, 1]]),
          sy: T([[0, 1], [0.22, 1.1], [0.36, 1.14], [0.5, 0.96], [0.62, 0.95], [0.78, 0.98], [1, 1]]),
          bob: T([[0, 0], [0.36, 1.2], [0.56, -0.6], [1, 0]]),
          R: T([[0, 10], [0.22, 7.6], [0.36, 7], [0.5, 11.5], [0.62, 12], [0.78, 11], [0.9, 10.3], [1, 10]]),
          orb: pr * 240,
          crest: T([[0, 1.5], [0.22, -1], [0.36, -1.6], [0.5, 4], [0.62, 4.2], [0.78, 2.6], [1, 1.5]]),
          tw: pr,
          tamp: 1.4,
          eyes: pr > 0.08 && pr < 0.42 ? 'shut' : pr >= 0.42 && pr < 0.86 ? 'angry' : 'open',
          mouth: pr > 0.08 && pr < 0.42 ? 'puff' : pr >= 0.42 && pr < 0.86 ? 'O' : 'smile',
          L: track([[0, 0], [0.4, 0], [0.5, 12], [0.58, 22], [0.8, 23], [1, 24]], pr),
          bfade: track([[0, 1], [0.7, 1], [1, 0]], pr),
          bt: pr,
        };
      }
      case 'hurt':
        return {
          ...P,
          dx: track([[0, 4], [0.35, 4.5], [1, 0]], pr, ease.out),
          rot: track([[0, 22], [0.3, 16], [0.7, -6], [1, 0]], pr),
          sx: track([[0, 1.16], [0.35, 0.92], [0.7, 1.04], [1, 1]], pr),
          sy: track([[0, 0.86], [0.35, 1.08], [0.7, 0.97], [1, 1]], pr),
          bob: track([[0, 1], [0.4, 1.5], [1, 0]], pr),
          R: track([[0, 13], [0.4, 12.4], [1, 10]], pr, ease.io),
          orb: 40 * pr,
          crest: track([[0, -3], [0.35, 4.5], [0.7, 0.5], [1, 1.5]], pr),
          tw: pr * 0.6,
          tamp: 2,
          eyes: pr < 0.8 ? 'shut' : 'open',
          mouth: 'o',
          chips: pr,
        };
      case 'die':
        /* 금이 가다가 와장창 깨져서 조각이 흩어지고 반짝이며 사라진다 */
        return {
          ...P,
          dx: track([[0, 3], [0.3, 4]], pr),
          rot: track([[0, 22], [0.3, 30]], pr),
          bob: track([[0, 0.5], [0.34, -1.5], [1, -1.5]], pr),
          sx: track([[0, 1.14], [0.12, 0.94], [0.24, 1.06], [0.34, 1.1]], pr),
          sy: track([[0, 0.88], [0.12, 1.06], [0.24, 0.96], [0.34, 0.92]], pr),
          R: track([[0, 12.4], [0.34, 10.5]], pr),
          orb: 30 + 20 * pr,
          crest: -2,
          tw: pr * 0.5,
          tamp: 1.2,
          eyes: pr < 0.12 ? 'shut' : 'x',
          mouth: 'o',
          crack: clamp((pr + 0.1) / 0.36),
          shatter: clamp((pr - 0.4) / 0.6),
        };
      default:
        return P;
    }
  }

  function wispShard(b, x, y, size, ang, col, outlined) {
    const pts = [[0, -2.4], [1.2, 0], [0, 2.4], [-1.2, 0]].map(([px, py]) => {
      const [rx, ry] = rotPt(px * size, py * size, ang);
      return [x + rx, y + ry];
    });
    const half = [pts[0], pts[2], pts[3]];
    b.part(() => {
      b.poly(pts, col, NS);
      b.poly(half, b.tone(col, 0.5), NS);
      dot(b, x + (pts[0][0] - x) * 0.4, y + (pts[0][1] - y) * 0.4, '#ffffff');
    }, outlined ? true : undefined);
  }

  function drawWisp(b, clip, i, n, pal) {
    const p = wispPose(clip, i, n);
    const tone = b.tone;
    const cx = WX + p.dx;
    const cy = WG - WH - p.bob;
    const sh = p.shatter;

    /* 땅 그림자 (모든 프레임) */
    const shs = (1 - 0.65 * sh) * (1 - 0.04 * p.bob);
    b.ell(WX + p.dx * 0.8, WG - 0.4, 5.4 * shs, 1.3 * shs + 0.2, '#0b1830', { shade: false, alpha: 0.35 });

    /* 날아갈 때 뒤에 남는 서리 반짝이 */
    if (p.trail >= 0) {
      for (let k = 0; k < 4; k++) {
        const t = (p.trail + k / 4) % 1;
        const x = cx + 8 + t * 12;
        const y = cy + 2 + Math.sin((t + k * 0.37) * TAU) * 1.6 - t * 1.5;
        twinkle(b, x, y, k % 2 ? pal.shard : '#ffffff', t < 0.35, 1 - t * 0.8);
      }
    }

    /* 얼음 조각 위치 */
    const shards = [];
    for (let k = 0; k < 3; k++) {
      const th = (p.orb + k * 120) * RAD;
      let x = cx + Math.cos(th) * p.R;
      let y = cy + Math.sin(th) * p.R * 0.3 + 1.6 - Math.cos(th) * 1.4;
      let depth = Math.sin(th);
      let size = 1.05 + 0.25 * depth;
      /* 기울기는 궤도 위치로 정한다 (조각끼리 자리를 바꿔도 반복이 매끄럽게) */
      let ang = 22 * Math.sin(3 * th);
      if (sh > 0) {
        /* 깨지면 조각이 땅으로 떨어져 튀고 녹는다 */
        const u = sh;
        const fallT = clamp(u / 0.45);
        x += (k - 1) * 5 * ease.out(u);
        y = lerp(y, WG - 1.6, ease.in(fallT)) - (u > 0.45 ? Math.sin(((u - 0.45) / 0.55) * Math.PI) * 2.4 : 0);
        ang += u * 400 * (k % 2 ? 1 : -1);
        size *= 1 - 0.8 * clamp((u - 0.55) / 0.45);
        depth = 1;
      }
      shards.push({ x, y, depth, size, ang });
    }
    const drawShards = (front) => {
      for (const s of shards) {
        if (front !== s.depth >= 0) continue;
        const sc = TG.anim.mix(pal.shard, pal.deep, 0.3);
        wispShard(b, s.x, s.y, s.size, s.ang, s.depth >= 0 ? sc : tone(sc, -0.2), s.size > 0.45);
      }
    };
    drawShards(false);

    const d = dual(b);
    let mouth = [cx - 3, cy + 1.8];
    if (sh <= 0) {
      d.save();
      d.translate(cx, cy);
      d.rotate(p.rot);
      d.scale(p.sx, p.sy);
      b.part(() => {
        /* 머리 위 얼음 뿔 (몸보다 늦게 흔들린다) */
        const H = [3.2, 4.6, 3.4];
        for (let k = 0; k < 3; k++) {
          const bx = -2.6 + 2.5 * k;
          const by = -WR + 1.4 + (k === 1 ? -0.5 : 0);
          const tip = [bx + p.crest * (0.5 + 0.25 * k), by - H[k]];
          b.poly([[bx - 1.5, by + 1.6], tip, [bx + 1.5, by + 1.6]], pal.shard, NS);
          b.poly([[bx - 1.5, by + 1.6], tip, [bx, by + 1.6]], tone(pal.shard, 0.4), NS);
        }
        /* 흐르는 꼬리 */
        const sp = [];
        for (let k = 0; k <= 6; k++) {
          const x = 1.4 + k * 1.8;
          const y = 0.8 + 0.75 * k - 0.21 * k * k + p.tamp * Math.sin((p.tw - k * 0.13) * TAU) * (k / 6) * 1.5;
          sp.push([x, y, 8.6 * (1 - k / 6.4) + 0.6]);
        }
        for (let k = 0; k < 6; k++) b.line(sp[k][0], sp[k][1] + 0.7, sp[k + 1][0], sp[k + 1][1] + 0.7, sp[k][2], pal.deep, NS, sp[k + 1][2]);
        for (let k = 0; k < 6; k++) b.line(sp[k][0], sp[k][1], sp[k + 1][0], sp[k + 1][1], sp[k][2] * 0.86, pal.body, NS, sp[k + 1][2] * 0.86);
        for (let k = 1; k < 4; k++) b.line(sp[k][0], sp[k][1] - sp[k][2] * 0.2, sp[k + 1][0], sp[k + 1][1] - sp[k + 1][2] * 0.2, 0.8, tone(pal.body, 0.4), NS);
        /* 몸 */
        b.ell(0, 0, WR, WR + 0.3, pal.body, { hi: 0.4, lo: -0.22 });
        b.ell(-0.5, 0.3, 3.6, 3.7, TG.anim.mix(pal.body, pal.core, 0.4), NS);
        b.ell(-2.8, -3.1, 1.5, 0.9, pal.core, NS);
        dot(b, -3.6, -3.3, '#ffffff');
        /* 금 */
        if (p.crack > 0) {
          const crack = [[0.6, -WR], [-0.4, -2.6], [1.0, -0.8], [-0.2, 1.4], [1.4, 3.4], [0.6, WR]];
          const m = p.crack * (crack.length - 1);
          for (let k = 0; k < crack.length - 1 && k < m; k++) {
            const f = Math.min(1, m - k);
            const [x0, y0] = crack[k];
            const [x1, y1] = crack[k + 1];
            b.line(x0, y0, lerp(x0, x1, f), lerp(y0, y1, f), 0.7, pal.deep, NS);
          }
          if (p.crack > 0.5) b.line(1.0, -0.8, 3.6, -2.0, 0.6, pal.deep, NS);
        }
        /* 얼굴 */
        const ek = p.eyes === 'open' && pal.fierce ? 'angry' : p.eyes;
        eye(b, -3.2, -0.7, ek, pal.ink, true);
        eye(b, -0.2, -0.7, ek, pal.ink, false);
        dot(b, -4.2, 1.1, pal.blush);
        dot(b, 0.8, 1.1, pal.blush);
        if (p.mouth === 'puff') {
          b.ell(-4.0, 1.4, 1.4, 1.2, tone(pal.body, 0.3), NS);
          dot(b, -1.8, 1.8, pal.ink);
          dot(b, -1.0, 1.8, pal.ink);
        } else if (p.mouth === 'O') {
          b.ell(-2.0, 2.0, 1.4, 1.5, pal.ink, NS);
          b.ell(-2.0, 2.4, 0.8, 0.7, pal.deep, NS);
        } else if (p.mouth === 'o') {
          b.ell(-1.7, 1.9, 0.8, 0.9, pal.ink, NS);
        } else {
          dot(b, -2.4, 1.5, pal.ink);
          dot(b, -1.6, 2.1, pal.ink);
          dot(b, -0.8, 1.5, pal.ink);
        }
      }, true);
      mouth = d.pt(-2.6, 2.0);
      d.restore();
    } else {
      /* 깨진 몸 조각 */
      const u = sh;
      for (let k = 0; k < 6; k++) {
        const a0 = k * 60 + 15;
        const mid = a0 + 30;
        const dist = 10 * ease.out(u) + 1;
        const gx = cx + Math.cos(mid * RAD) * dist;
        const gy = Math.min(cy + Math.sin(mid * RAD) * dist * 0.8 + 12 * u * u, WG - 1.6);
        const sc = 1 - 0.85 * u;
        const spin = (k % 2 ? 1 : -1) * 260 * u;
        b.save();
        b.translate(gx, gy);
        b.rotate(spin);
        b.scale(sc);
        const r = WR + 0.2;
        const pts = [[-Math.cos(mid * RAD) * 2, -Math.sin(mid * RAD) * 2]];
        for (let s = 0; s <= 3; s++) {
          const a = (a0 + s * 20) * RAD;
          pts.push([Math.cos(a) * r - Math.cos(mid * RAD) * 2, Math.sin(a) * r - Math.sin(mid * RAD) * 2]);
        }
        b.part(() => {
          b.poly(pts, k % 2 ? pal.body : tone(pal.body, 0.15), NS);
          b.poly([pts[0], pts[1], pts[2]], tone(pal.body, 0.4), NS);
        }, sc > 0.4 ? true : undefined);
        b.restore();
      }
      /* 반짝이 */
      for (let k = 0; k < 6; k++) {
        const a = k * 60 + 40;
        const [x, y] = at(cx, cy, a, 3 + 12 * ease.out(u));
        const tw = Math.max(0, Math.sin((u * 2.2 + k * 0.17) * Math.PI));
        if (tw > 0.1) twinkle(b, x, Math.min(y + 4 * u * u, WG - 2), k % 2 ? '#ffffff' : pal.shard, tw > 0.6, 0.4 + 0.6 * tw);
      }
      /* 깨지는 순간의 하얀 번쩍임 (조각이 겹친 모습을 덮는다) */
      if (u < 0.25) {
        const f = u / 0.25;
        b.disc(cx, cy, 4.5 + 6 * f, pal.core, { shade: false, alpha: 0.85 * (1 - f) });
        b.disc(cx, cy, 2.5 + 3 * f, '#ffffff', { shade: false, alpha: 0.95 * (1 - f) });
      }
    }

    drawShards(true);

    /* 차가운 입김 */
    if (p.L > 0) {
      const [mx, my] = mouth;
      const drift = Math.max(0, p.bt - 0.6) * 10;
      for (let k = 0; k < 12; k++) {
        const u = (k + 0.5) / 12;
        const dist = u * p.L;
        if (dist < 0.5) continue;
        const x = mx - dist - drift * u;
        const y = my + u * 2.2 + 1.6 * Math.sin(k * 2.1 + p.bt * 9) * u;
        const r = 0.9 + 2.3 * u + (1 - p.bfade) * 1.4;
        b.disc(x, y, r, TG.anim.mix(pal.breath, '#ffffff', 0.6 - 0.6 * u), { shade: false, alpha: (0.95 - 0.35 * u) * p.bfade });
      }
      for (let k = 0; k < 5; k++) {
        const u = ((k * 0.23 + p.bt * 1.6) % 1) * 0.9 + 0.1;
        const dist = u * p.L;
        if (dist < 2) continue;
        const x = mx - dist - drift * u;
        const y = my + u * 2.2 + (k % 2 ? -1 : 1) * (1 + 2.2 * u);
        twinkle(b, x, y, '#ffffff', k % 2 === 0, p.bfade);
      }
    }

    /* 가만히 있을 때 몸 둘레 반짝임 */
    if (p.tw2 >= 0) {
      const pts = [[-7, -7], [6, -9], [9, 3]];
      pts.forEach(([x, y], k) => {
        const tw = Math.sin((p.tw2 + k / 3) * TAU);
        if (tw > 0.2) twinkle(b, cx + x, cy + y, '#ffffff', tw > 0.75, 0.5 + 0.5 * tw);
      });
    }

    /* 맞을 때 튀는 얼음 부스러기 */
    if (p.chips > 0) {
      for (let k = 0; k < 4; k++) {
        const u = clamp(p.chips * 1.2 - k * 0.07);
        const [x, y] = at(cx - 2, cy, 200 + k * 28, 3 + u * 9);
        twinkle(b, x + u * 6, y + u * u * 6, k % 2 ? '#ffffff' : pal.shard, u < 0.5, 1 - u * 0.7);
      }
    }
  }

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.penguin = {
    id: 'mob.penguin',
    name: '펭귄 병사',
    w: 66,
    h: 38,
    ax: PX,
    ay: PG,
    outline: null,
    clips: { idle: 8, walk: 12, attack: 10, hurt: 5, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { body: '#2d3652', belly: '#eef4f8', beak: '#f5a83a', feet: '#f08c2e', helm: '#a3b3c4', trim: '#d9b45a', plume: '#d9473f', ink: '#14101a', blush: '#f4a3ad' },
      { body: '#3e4656', belly: '#f6efe2', beak: '#e8713c', feet: '#ec7f97', helm: '#5f86b8', trim: '#e6edf5', plume: '#f3d34c', ink: '#14101a', blush: '#f4a3ad' },
      { body: '#201b30', belly: '#dfe7f3', beak: '#f4c43c', feet: '#f2a13a', helm: '#e3b64e', trim: '#fff2b8', plume: '#8a4ae0', ink: '#14101a', blush: '#f08aa0', fierce: true },
    ],
    draw: drawPenguin,
    pose: penguinPose,
  };
  TG.SPR.mob.snowman = {
    id: 'mob.snowman',
    name: '눈사람',
    w: 54,
    h: 40,
    ax: SX,
    ay: SG,
    outline: null,
    clips: { idle: 8, walk: 12, attack: 10, hurt: 5, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { snow: '#f1f6fb', coal: '#2b2733', eye: '#2b2733', carrot: '#f28b2e', stick: '#7b5434', scarf: '#d94a3f', blush: '#f6b8c0', hat: null },
      { snow: '#e3f0fa', coal: '#2b2733', eye: '#2b2733', carrot: '#f28b2e', stick: '#6a4a30', scarf: '#3faa6c', blush: '#f6b8c0', hat: 'bucket', hatCol: '#6d8fae' },
      { snow: '#d8e3ef', coal: '#2a2536', eye: '#e8443c', carrot: '#ea6a24', stick: '#4f3a2c', scarf: '#7c45d8', blush: '#c8a8e8', hat: 'top', hatCol: '#2a2536', band: '#d0473f' },
    ],
    draw: drawSnowman,
    pose: snowPose,
  };
  TG.SPR.mob.wisp = {
    id: 'mob.wisp',
    name: '얼음 정령',
    w: 62,
    h: 40,
    ax: WX,
    ay: WG,
    outline: null,
    clips: { idle: 8, walk: 12, attack: 10, hurt: 5, die: 10 },
    hit: 0.56,
    flying: true,
    palettes: [
      { body: '#8ad6fb', core: '#effcff', deep: '#3b86d0', shard: '#c6efff', breath: '#d4f4ff', ink: '#123358', blush: '#ffc2dc' },
      { body: '#86eec4', core: '#f0fff8', deep: '#2a9d82', shard: '#c4ffe6', breath: '#d6fff0', ink: '#0f3a34', blush: '#ffd0e0' },
      { body: '#b3a4ff', core: '#fbf8ff', deep: '#6146d4', shard: '#e3dcff', breath: '#ece6ff', ink: '#24164e', blush: '#ffc8f0', fierce: true },
    ],
    draw: drawWisp,
    pose: wispPose,
  };
})(globalThis);
