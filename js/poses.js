(function (g) {
  const YG = g.YG;

  const STEP = [1, 0.5, -0.5, -1, -0.5, 0.5];
  const WALK_BOB = [0, 1, 1, 0, 1, 1];
  const IDLE_BOB = [0, 0, 1, 1];

  const ATK = [
    { wind: 0.4, atk: 0, lunge: -1, rise: 0, armF: [3, -12], armB: [-6, -8], dir: [0.15, -1], l: [-1, 0], r: [1, 0] },
    { wind: 1, atk: 0, lunge: -3, rise: -1, armF: [1, -21], armB: [-7, -9], dir: [-0.95, -0.45], l: [-2, 0], r: [2, 0] },
    { wind: 0.5, atk: 0.5, lunge: 1, rise: 0, armF: [6, -17], armB: [-7, -10], dir: [0.75, -0.7], l: [1, 0], r: [-1, 0] },
    { wind: 0, atk: 1, lunge: 4, rise: 0, armF: [11, -9], armB: [-7, -10], dir: [1, 0.55], l: [3, 0], r: [-2, 0] },
    { wind: 0, atk: 0.7, lunge: 3, rise: 0, armF: [10, -5], armB: [-6, -9], dir: [0.85, 0.85], l: [3, 0], r: [-2, 0] },
    { wind: 0.15, atk: 0.2, lunge: 1, rise: 0, armF: [7, -6], armB: [-6, -7], dir: [0.45, 0.2], l: [1, 0], r: [0, 0] },
  ];

  YG.POSES = {};
  YG.FRAME_KEYS = [];

  function add(key, p) {
    YG.POSES[key] = { key, kind: key.replace(/\d+$/, ''), i: Number(key.match(/\d+$/)[0]), step: 0, bob: 0, lunge: 0, rise: 0, wind: 0, atk: 0, hurt: false, ...p };
    YG.FRAME_KEYS.push(key);
  }

  IDLE_BOB.forEach((bob, i) => {
    add(`idle${i}`, {
      bob,
      armF: [5, i === 1 ? -5 : i === 3 ? -7 : -6],
      armB: [-5, i === 2 ? -5 : -6],
      dir: [0.35, -1],
      l: [0, 0],
      r: [0, 0],
    });
  });

  STEP.forEach((step, i) => {
    const sway = Math.round(2 * step);
    const liftL = i === 4 || i === 5 ? 1 : 0;
    const liftR = i === 1 || i === 2 ? 1 : 0;
    add(`walk${i}`, {
      step,
      bob: WALK_BOB[i],
      armF: [5 - sway, -6 - (Math.abs(step) < 0.6 ? 1 : 0)],
      armB: [-5 + sway, -6 - (Math.abs(step) < 0.6 ? 1 : 0)],
      dir: [0.5 - step * 0.3, -1],
      l: [sway, -liftL],
      r: [-sway, -liftR],
    });
  });

  ATK.forEach((a, i) => add(`atk${i}`, a));

  add('hurt0', {
    hurt: true, lunge: -3, armF: [2, -9], armB: [-8, -7], dir: [0.2, -0.9], l: [-1, 0], r: [1, 0],
  });

  /* 어떤 프레임을 그릴지 정하는 규칙. 전투 화면과 시작 화면이 같이 쓴다. */
  YG.frameKey = (u) => {
    if (u.state === 'kb') return 'hurt0';
    if (u.state === 'atk') {
      const { hit, total } = u.def.anim;
      const t = u.t;
      if (t < hit * 0.35) return 'atk0';
      if (t < hit * 0.75) return 'atk1';
      if (t < hit) return 'atk2';
      if (t < hit + 3) return 'atk3';
      if (t < hit + (total - hit) * 0.5) return 'atk4';
      return 'atk5';
    }
    if (u.flash >= 3) return 'hurt0';
    if (u.moving) return `walk${Math.floor(u.walk / 1.7) % 6}`;
    return `idle${(Math.floor(u.age / 7) + (u.id || 0)) % 4}`;
  };
})(globalThis);
