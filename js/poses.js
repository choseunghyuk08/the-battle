(function (g) {
  const YG = g.YG;

  /* 한 동작을 몇 장으로 나눠 그리는지. 자세 값은 전부 연속값(소수)이라 장수를 늘리면 그만큼 부드러워진다.
     idle: 숨쉬기 한 바퀴, walk: 두 걸음(왼발·오른발) 한 바퀴, atk: 준비 → 휘두름 → 맞는 순간 → 되돌아옴, hurt: 맞고 휘청 */
  const IDLE_N = 12;
  const WALK_N = 16;
  /* 공격은 준비(WIND) + 맞는 순간(HIT) + 되돌아옴(BACK) 세 토막이다 */
  const WIND_N = 14;
  const HIT_N = 4;
  const BACK_N = 6;
  const ATK_N = WIND_N + HIT_N + BACK_N;
  const HURT_N = 4;
  /* 옛 방식(4/6장)에 맞춰 놓은 그리기 코드가 쓰는 거친 번호. 날개짓 같은 건 아직 이 번호로 고른다 */
  const OLD_IDLE = 4;
  const OLD_WALK = 6;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /* 공격의 기준 자세. K0..K5 는 처음 그린 여섯 장이고, REST 는 가만히 선 자세다 */
  const REST = { wind: 0, atk: 0, lunge: 0, rise: 0, bob: 0, armF: [5, -6], armB: [-5, -6], dir: [0.35, -1], l: [0, 0], r: [0, 0] };
  const KEYS = [
    { wind: 0.4, atk: 0, lunge: -1, rise: 0, armF: [3, -12], armB: [-6, -8], dir: [0.15, -1], l: [-1, 0], r: [1, 0] },
    { wind: 1, atk: 0, lunge: -3, rise: -1, armF: [1, -21], armB: [-7, -9], dir: [-0.95, -0.45], l: [-2, 0], r: [2, 0] },
    { wind: 0.5, atk: 0.5, lunge: 1, rise: 0, armF: [6, -17], armB: [-7, -10], dir: [0.75, -0.7], l: [1, 0], r: [-1, 0] },
    { wind: 0, atk: 1, lunge: 4, rise: 0, armF: [11, -9], armB: [-7, -10], dir: [1, 0.55], l: [3, 0], r: [-2, 0] },
    { wind: 0, atk: 0.7, lunge: 3, rise: 0, armF: [10, -5], armB: [-6, -9], dir: [0.85, 0.85], l: [3, 0], r: [-2, 0] },
    { wind: 0.15, atk: 0.2, lunge: 1, rise: 0, armF: [7, -6], armB: [-6, -7], dir: [0.45, 0.2], l: [1, 0], r: [0, 0] },
  ];
  /* 기준 자세 줄: 0 = 가만히, 1..6 = K0..K5, 7 = 다시 가만히 */
  const LINE = [REST, ...KEYS, REST];

  /* 줄 위의 위치(0~7, 소수 가능)에서 자세를 뽑는다. 각 값을 이웃한 기준 자세 사이에서 이어 준다 */
  function along(pos) {
    const p = clamp(pos, 0, LINE.length - 1);
    const i = Math.min(LINE.length - 2, Math.floor(p));
    const t = p - i;
    const a = LINE[i];
    const b = LINE[i + 1];
    const out = {};
    for (const k of ['wind', 'atk', 'lunge', 'rise', 'bob']) out[k] = lerp(a[k] || 0, b[k] || 0, t);
    for (const k of ['armF', 'armB', 'dir', 'l', 'r']) out[k] = lerp2(a[k], b[k], t);
    return out;
  }

  /* 공격 24장이 줄 위 어디에 해당하는지.
     준비: 뒤로 당겼다가(줄 2 = 가장 크게 당김) 잠깐 버티고 휘두르는 쪽(줄 3)으로 간다.
     맞는 순간: 줄 3.45 → 4.55 (4 = 팔이 가장 뻗은 자세). 되돌아옴: 줄 4.8 → 7 (가만히 선 자세). */
  const path = (pts, u) => {
    for (let i = 1; i < pts.length; i++) {
      if (u <= pts[i][0]) {
        const t = (u - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return lerp(pts[i - 1][1], pts[i][1], t);
      }
    }
    return pts[pts.length - 1][1];
  };
  const WIND_PATH = [[0, 0.2], [0.22, 1.2], [0.5, 2.0], [0.64, 2.0], [0.84, 2.6], [1, 3.05]];
  const ATK_POS = [];
  for (let k = 0; k < WIND_N; k++) ATK_POS.push(path(WIND_PATH, (k + 0.5) / WIND_N));
  [3.45, 4.0, 4.3, 4.55].forEach((v) => ATK_POS.push(v));
  for (let k = 0; k < BACK_N; k++) ATK_POS.push(lerp(4.8, 7, ((k + 1) / BACK_N) ** 0.8));

  YG.POSES = {};
  YG.FRAME_KEYS = [];

  function add(key, p) {
    const m = key.match(/^([a-z]+)(\d+)$/);
    YG.POSES[key] = {
      key, kind: m[1], i: Number(m[2]), n: Number(m[2]), step: 0, bob: 0, lunge: 0, rise: 0, wind: 0, atk: 0, hurt: false, ...p,
    };
    YG.FRAME_KEYS.push(key);
  }

  /* 서 있기: 숨 쉬면서 어깨와 팔이 살짝 오르내린다 */
  for (let n = 0; n < IDLE_N; n++) {
    const ph = n / IDLE_N;
    add(`idle${n}`, {
      i: Math.floor((n * OLD_IDLE) / IDLE_N),
      bob: 0.5 - 0.5 * Math.cos(TAU * ph),
      armF: [5, -6 + Math.sin(TAU * ph)],
      armB: [-5, -6 + Math.max(0, Math.cos(TAU * (ph - 0.5)))],
      dir: [0.35, -1],
      l: [0, 0],
      r: [0, 0],
    });
  }

  /* 걷기: step 은 앞뒤로 벌어진 정도(-1..1). 발 하나가 땅을 떠나 있는 동안 반대쪽 발이 몸을 받친다 */
  for (let n = 0; n < WALK_N; n++) {
    const ph = n / WALK_N;
    const step = Math.cos(TAU * ph);
    const sway = 2 * step;
    const liftL = Math.max(0, -Math.sin(TAU * ph)) * 1.4;
    const liftR = Math.max(0, Math.sin(TAU * ph)) * 1.4;
    const lowArm = clamp(1 - Math.abs(step), 0, 1);
    add(`walk${n}`, {
      i: Math.floor((n * OLD_WALK) / WALK_N),
      step,
      bob: clamp(1.6 * (1 - Math.abs(step)), 0, 1),
      armF: [5 - sway, -6 - lowArm],
      armB: [-5 + sway, -6 - lowArm],
      dir: [0.5 - step * 0.3, -1],
      l: [sway, -liftL],
      r: [-sway, -liftR],
    });
  }

  for (let n = 0; n < ATK_N; n++) add(`atk${n}`, { ...along(ATK_POS[n]) });

  /* 맞기: 0 = 맞은 순간 젖혀짐, 1 = 가장 크게 휘청, 2 = 버티는 중, 3 = 자세를 되찾는 중 */
  const HURT = [
    { hurt: true, lunge: -3, armF: [2, -9], armB: [-8, -7], dir: [0.2, -0.9], l: [-1, 0], r: [1, 0] },
    { hurt: true, lunge: -4, rise: -1, armF: [0, -11], armB: [-9, -9], dir: [0.05, -0.95], l: [-2, 0], r: [2, 0] },
    { hurt: true, lunge: -3.5, rise: -0.5, armF: [1, -10], armB: [-8.5, -8], dir: [0.12, -0.92], l: [-1.5, 0], r: [1.5, 0] },
    { hurt: false, lunge: -2, armF: [3, -8], armB: [-7, -7], dir: [0.25, -0.95], l: [-1, 0], r: [1, 0] },
  ];
  HURT.forEach((h, n) => add(`hurt${n}`, h));

  YG.POSE_COUNT = { idle: IDLE_N, walk: WALK_N, atk: ATK_N, hurt: HURT_N };
  /* 공격이 맞는 순간의 그림 (도감 대표 그림 등에 쓴다) */
  YG.IMPACT_KEY = `atk${WIND_N + 1}`;

  /* 가만히 서 있는 그림: 나이(프레임)로 고르고 유닛마다 박자를 달리한다 */
  YG.idleKey = (age, seed = 0) => `idle${(Math.floor(age / 2.33) + seed * 5) % IDLE_N}`;
  /* 걷는 그림: 걸은 거리(px)로 고른다. 두 걸음이 약 10px */
  YG.walkKey = (walk) => `walk${Math.floor(walk / 0.64) % WALK_N}`;
  /* 공격: t 는 공격 시작 후 지난 프레임, hit 는 맞는 프레임, total 은 전체 길이 */
  YG.atkIndex = (t, hit, total) => {
    if (t < hit) return Math.min(WIND_N - 1, Math.floor((t / hit) * WIND_N));
    if (t < hit + HIT_N) return WIND_N + Math.floor(t - hit);
    const span = total - hit - HIT_N;
    if (span <= 0) return WIND_N + HIT_N;
    return Math.min(ATK_N - 1, WIND_N + HIT_N + Math.floor(((t - hit - HIT_N) / span) * BACK_N));
  };
  /* 넉백 중: 맞은 지 몇 프레임이 지났는지로 고른다 */
  YG.hurtKey = (t) => (t < 3 ? 'hurt0' : t < 7 ? 'hurt1' : t < 12 ? 'hurt2' : 'hurt3');

  /* 어떤 프레임을 그릴지 정하는 규칙. 전투 화면과 시작 화면이 같이 쓴다. */
  YG.frameKey = (u) => {
    if (u.state === 'kb') return YG.hurtKey(u.t || 0);
    if (u.state === 'atk') {
      const { hit, total } = u.def.anim;
      return `atk${YG.atkIndex(u.t, hit, total)}`;
    }
    if (u.flash >= 3) return 'hurt0';
    if (u.moving) return YG.walkKey(u.walk);
    return YG.idleKey(u.age, u.id || 0);
  };
})(globalThis);
