(function (g) {
  const YG = (g.YG = g.YG || {});

  YG.FPS = 30;
  YG.VIEW = { w: 320, h: 180, groundY: 150, allyBaseX: 34, enemyBaseX: 286 };

  YG.TRAITS = {
    ghost: { name: '귀신' },
    specimen: { name: '표본' },
    dark: { name: '어둠' },
    metal: { name: '철제' },
    none: { name: '무특성' },
    '*': { name: '모든 적' },
  };

  YG.GRADES = {
    4: { name: '4등급', label: '일반' },
    3: { name: '3등급', label: '레어' },
    2: { name: '2등급', label: '슈퍼레어' },
    1: { name: '1등급', label: '울트라' },
    0: { name: '만점', label: '전설' },
  };

  YG.UNITS = [
    {
      id: 'basic', name: '일반 학생', grade: 4, role: '기본',
      hp: 260, atk: 22, range: 14, speed: 0.46, interval: 48, anim: { hit: 8, total: 16 },
      cost: 50, cooldown: 75, kb: 3, abilities: [],
      blurb: '야자 도중 끌려 나온 평범한 학생.',
      evo: { name: '반장', blurb: '야자 출석부를 든 순간 눈빛이 달라졌다.' },
      look: { hair: '#2a2323', style: 'short', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: null },
    },
    {
      id: 'bag', name: '책가방 방패', grade: 4, role: '벽',
      hp: 1000, atk: 9, range: 14, speed: 0.34, interval: 60, anim: { hit: 10, total: 20 },
      cost: 120, cooldown: 150, kb: 2, abilities: [],
      blurb: '교과서 12권이 든 가방은 생각보다 단단하다.',
      evo: { name: '대형 백팩', blurb: '문제집까지 넣었더니 철벽이 됐다.' },
      look: { hair: '#5a3b2b', style: 'long', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: 'bag' },
    },
    {
      id: 'runner', name: '육상부', grade: 4, role: '돌격',
      hp: 170, atk: 26, range: 14, speed: 1.0, interval: 42, anim: { hit: 7, total: 14 },
      cost: 90, cooldown: 105, kb: 4, abilities: [],
      blurb: '복도에서 뛰지 말라는 말은 들은 적 없다.',
      evo: { name: '육상 에이스', blurb: '전국대회 기록이 복도에서 나왔다.' },
      look: { hair: '#3a2a1f', style: 'short', top: '#2f8f83', trim: '#f3efe3', pants: '#26384a', prop: 'band' },
    },
    {
      id: 'reader', name: '도서부', grade: 4, role: '원거리',
      hp: 150, atk: 20, range: 60, speed: 0.45, interval: 60, anim: { hit: 10, total: 20 },
      cost: 100, cooldown: 120, kb: 2, ranged: 'book', abilities: [],
      blurb: '반납 기한이 지난 책은 던져도 된다.',
      evo: { name: '도서부장', blurb: '백과사전을 투척하기 시작했다.' },
      look: { hair: '#3b2f3f', style: 'long', top: '#5f7f5c', trim: '#efe9dc', pants: '#2b3042', prop: 'book', face: 'glasses' },
    },
    {
      id: 'bat', name: '야구부', grade: 3, role: '근접',
      hp: 440, atk: 62, range: 17, speed: 0.5, interval: 58, anim: { hit: 11, total: 22 },
      cost: 190, cooldown: 150, kb: 3, abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '표본이라면 일단 한 방 쳐본다.',
      evo: { name: '4번 타자', blurb: '장외 홈런이 과학실 창문을 넘어갔다.' },
      look: { hair: '#222222', style: 'short', top: '#d9d4c7', trim: '#2b3a5c', pants: '#c4bfb0', prop: 'bat', hat: 'cap' },
    },
    {
      id: 'cook', name: '급식 조리사', grade: 3, role: '원거리',
      hp: 280, atk: 38, range: 72, speed: 0.4, interval: 66, anim: { hit: 12, total: 24 },
      cost: 210, cooldown: 165, kb: 3, ranged: 'salt', abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '소금은 급식실에 얼마든지 있다.',
      evo: { name: '영양사', blurb: '소금에 이어 팥까지 뿌린다.' },
      look: { hair: '#4a3626', style: 'short', top: '#ece7da', trim: '#c9bfa6', pants: '#3a3d4a', prop: 'salt', hat: 'chef' },
    },
    {
      id: 'tech', name: '기술부', grade: 3, role: '근접',
      hp: 520, atk: 72, range: 17, speed: 0.42, interval: 72, anim: { hit: 14, total: 26 },
      cost: 230, cooldown: 180, kb: 3, abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '사물함 나사 푸는 데는 일가견이 있다.',
      evo: { name: '기술부장', blurb: '전동 드라이버를 들었다.' },
      look: { hair: '#2e2620', style: 'short', top: '#6b7a8a', trim: '#e0b62c', pants: '#3c4350', prop: 'wrench', hat: 'hardhat' },
    },
    {
      id: 'radio', name: '방송부', grade: 3, role: '광역',
      hp: 300, atk: 30, range: 64, speed: 0.42, interval: 70, anim: { hit: 12, total: 24 },
      cost: 240, cooldown: 190, kb: 3, area: true, ranged: 'wave',
      abilities: [{ vs: 'dark', type: 'strong' }],
      slow: { chance: 0.4, frames: 90 },
      blurb: '점심시간 방송 볼륨을 최대로 올린다.',
      evo: { name: '방송부장', blurb: '교내 스피커 전체를 장악했다.' },
      look: { hair: '#1f2230', style: 'short', top: '#7a4f9a', trim: '#efe9dc', pants: '#2b2438', prop: 'mic', hat: 'headphones' },
    },
    {
      id: 'patrol', name: '야간 순찰조', grade: 2, role: '광역',
      hp: 560, atk: 58, range: 58, speed: 0.44, interval: 78, anim: { hit: 14, total: 26 },
      cost: 380, cooldown: 270, kb: 3, area: true, ranged: 'beam',
      abilities: [{ vs: 'dark', type: 'massive' }],
      blurb: '손전등 하나로 복도 끝까지 훑는다.',
      evo: { name: '순찰대장', blurb: '손전등이 서치라이트가 됐다.' },
      look: { hair: '#1f1f26', style: 'short', top: '#2c3f63', trim: '#d6d86f', pants: '#232b40', prop: 'light', hat: 'cap2' },
    },
    {
      id: 'lab', name: '과학부', grade: 2, role: '광역',
      hp: 480, atk: 52, range: 56, speed: 0.4, interval: 80, anim: { hit: 13, total: 26 },
      cost: 400, cooldown: 280, kb: 3, area: true, ranged: 'beaker',
      abilities: [{ vs: 'specimen', type: 'massive' }],
      blurb: '표본은 약품 앞에서 힘을 못 쓴다.',
      evo: { name: '과학부장', blurb: '비커가 플라스크로 커졌다.' },
      look: { hair: '#2a2220', style: 'short', top: '#efe9dc', trim: '#bcb7a9', pants: '#3b4350', prop: 'beaker', hat: 'goggles' },
    },
    {
      id: 'robot', name: '로봇부', grade: 2, role: '근접',
      hp: 900, atk: 85, range: 20, speed: 0.36, interval: 90, anim: { hit: 16, total: 30 },
      cost: 420, cooldown: 300, kb: 2,
      abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'metal', type: 'tough' }],
      blurb: '자석 팔 앞에서 철제는 무력하다.',
      evo: { name: '로봇 박사', blurb: '팔이 두 개 더 달렸다.' },
      look: { hair: '#222226', style: 'short', top: '#3d4a57', trim: '#e08a2e', pants: '#2a2f38', prop: 'magnet', hat: 'antenna' },
    },
    {
      id: 'pe', name: '체육 선생님', grade: 1, role: '제어',
      hp: 1500, atk: 118, range: 24, speed: 0.5, interval: 84, anim: { hit: 15, total: 28 },
      cost: 620, cooldown: 480, kb: 2, freeze: { chance: 0.35, frames: 75 },
      abilities: [
        { vs: 'ghost', type: 'massive' },
        { vs: 'ghost', type: 'tough' },
        { vs: 'dark', type: 'strong' },
      ],
      blurb: '호각 소리에 괴담도 얼어붙는다.',
      evo: { name: '체육부장', blurb: '호각이 금빛으로 변했다.' },
      look: { hair: '#8d8d88', style: 'short', top: '#b23b32', trim: '#f1ede0', pants: '#2a2a33', prop: 'whistle' },
    },
    {
      id: 'top', name: '전교 1등', grade: 0, role: '전설', limited: true,
      hp: 1300, atk: 140, range: 70, speed: 0.46, interval: 90, anim: { hit: 14, total: 28 },
      cost: 800, cooldown: 600, kb: 3, area: true, ranged: 'exam',
      abilities: [{ vs: '*', type: 'strong' }, { vs: 'ghost', type: 'massive' }],
      freeze: { chance: 0.2, frames: 60 },
      blurb: '모의고사 만점지가 어떤 괴담에게도 통한다.',
      evo: { name: '수석 입학', blurb: '시험지가 날아다니며 적을 베어낸다.' },
      look: { hair: '#17181c', style: 'short', top: '#232a3d', trim: '#d6c06a', pants: '#2a3046', prop: 'paper', face: 'glasses', legend: true },
    },
    {
      id: 'warden', name: '학생주임', grade: 0, role: '전설', limited: true,
      hp: 2600, atk: 160, range: 26, speed: 0.42, interval: 96, anim: { hit: 18, total: 32 },
      cost: 900, cooldown: 660, kb: 2,
      abilities: [
        { vs: 'dark', type: 'massive' },
        { vs: 'dark', type: 'tough' },
        { vs: 'specimen', type: 'strong' },
        { vs: 'metal', type: 'strong' },
      ],
      slow: { chance: 0.5, frames: 120 },
      blurb: '이 학교에서 제일 무서운 건 괴담이 아니다.',
      evo: { name: '생활지도부장', blurb: '복장 단속 한 번에 전장이 정리된다.' },
      look: { hair: '#3a3a3a', style: 'short', top: '#2f4a3a', trim: '#efe9dc', pants: '#1f2a24', prop: 'stick', face: 'sunglasses', legend: true },
    },
    {
      id: 'cleaner', name: '청소부', grade: 4, role: '벽',
      hp: 520, atk: 12, range: 16, speed: 0.32, interval: 58, anim: { hit: 10, total: 20 },
      cost: 90, cooldown: 130, kb: 2, abilities: [],
      blurb: '걸레질은 괴담도 피해 간다.',
      evo: { name: '청소반장', blurb: '대걸레가 자루째 단단해졌다.' },
      look: { hair: '#4a3626', style: 'bun', top: '#4a7a6a', trim: '#efe9dc', pants: '#2e3a3a', prop: 'mop', hat: 'kerchief' },
    },
    {
      id: 'basket', name: '농구부', grade: 4, role: '원거리',
      hp: 170, atk: 24, range: 54, speed: 0.45, interval: 62, anim: { hit: 11, total: 22 },
      cost: 110, cooldown: 130, kb: 3, abilities: [], ranged: 'ball',
      blurb: '복도에서 공을 던지면 안 되지만 지금은 괜찮다.',
      evo: { name: '농구부 주장', blurb: '3점 슛이 복도 끝까지 간다.' },
      look: { hair: '#222222', style: 'short', top: '#d9663b', trim: '#efe9dc', pants: '#2a2a33', prop: 'basketball', hat: 'sweatband' },
    },
    {
      id: 'pingpong', name: '탁구부', grade: 4, role: '속공',
      hp: 140, atk: 12, range: 14, speed: 0.75, interval: 26, anim: { hit: 5, total: 12 },
      cost: 70, cooldown: 90, kb: 4, abilities: [],
      blurb: '손목 스냅 하나는 전국급이다.',
      evo: { name: '탁구 국가대표', blurb: '스매시 소리가 총소리 같다.' },
      look: { hair: '#3a2a1f', style: 'short', top: '#4a7bd0', trim: '#efe9dc', pants: '#26384a', prop: 'paddle' },
    },
    {
      id: 'calli', name: '서예부', grade: 4, role: '근접',
      hp: 300, atk: 34, range: 20, speed: 0.42, interval: 66, anim: { hit: 12, total: 24 },
      cost: 80, cooldown: 100, kb: 3, abilities: [],
      blurb: '먹 한 방울이면 충분하다.',
      evo: { name: '서예 명인', blurb: '한 획에 괴담이 갈라진다.' },
      look: { hair: '#14121a', style: 'long', top: '#e8e2d0', trim: '#8a7a5a', pants: '#4a3a28', prop: 'brush' },
    },
    {
      id: 'kendo', name: '검도부', grade: 3, role: '근접',
      hp: 400, atk: 58, range: 22, speed: 0.55, interval: 54, anim: { hit: 10, total: 20 },
      cost: 200, cooldown: 150, kb: 3, abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '면을 노리면 귀신도 움찔한다.',
      evo: { name: '검도 4단', blurb: '죽도에 기합이 실린다.' },
      look: { hair: '#14121a', style: 'short', top: '#2b3a5c', trim: '#efe9dc', pants: '#1f2a44', prop: 'shinai', hat: 'tenugui' },
    },
    {
      id: 'volley', name: '배구부', grade: 3, role: '원거리',
      hp: 300, atk: 44, range: 66, speed: 0.42, interval: 70, anim: { hit: 12, total: 24 },
      cost: 220, cooldown: 170, kb: 3, abilities: [{ vs: 'metal', type: 'strong' }], ranged: 'ball',
      blurb: '스파이크는 철판도 접는다.',
      evo: { name: '배구 에이스', blurb: '서브가 사물함에 구멍을 낸다.' },
      look: { hair: '#6a4a2a', style: 'short', top: '#e0b62c', trim: '#2b3a5c', pants: '#2b3a5c', prop: 'volleyball', hat: 'sweatband' },
    },
    {
      id: 'art', name: '미술부', grade: 3, role: '광역',
      hp: 360, atk: 40, range: 26, speed: 0.45, interval: 62, anim: { hit: 12, total: 24 },
      cost: 200, cooldown: 150, kb: 3, abilities: [{ vs: 'dark', type: 'strong' }], area: true,
      blurb: '물감이 튀면 그림자도 물든다.',
      evo: { name: '미술부장', blurb: '팔레트가 방패가 됐다.' },
      look: { hair: '#2a1f2e', style: 'short', top: '#c98bd9', trim: '#efe9dc', pants: '#3a3048', prop: 'palette', hat: 'beret' },
    },
    {
      id: 'drum', name: '풍물패', grade: 3, role: '광역',
      hp: 520, atk: 28, range: 30, speed: 0.38, interval: 84, anim: { hit: 16, total: 30 },
      cost: 240, cooldown: 200, kb: 2, abilities: [{ vs: 'specimen', type: 'strong' }], area: true, ranged: 'wave', slow: { chance: 0.5, frames: 90 },
      blurb: '꽹과리 소리에 표본이 흩어진다.',
      evo: { name: '상쇠', blurb: '장단에 맞춰 전장이 흔들린다.' },
      look: { hair: '#14121a', style: 'short', top: '#efe9dc', trim: '#d9483b', pants: '#3a5a8a', prop: 'drum', hat: 'sangmo' },
    },
    {
      id: 'coder', name: '컴퓨터부', grade: 3, role: '원거리',
      hp: 240, atk: 46, range: 76, speed: 0.38, interval: 72, anim: { hit: 12, total: 24 },
      cost: 250, cooldown: 190, kb: 3, abilities: [{ vs: 'dark', type: 'strong' }], ranged: 'laser',
      blurb: '코드 한 줄이면 어둠도 꺼진다.',
      evo: { name: '해커', blurb: '방화벽으로 그림자를 막는다.' },
      look: { hair: '#2a2a3a', style: 'short', top: '#3a3f4b', trim: '#6fd0e8', pants: '#2a2d38', prop: 'laptop', face: 'glasses' },
    },
    {
      id: 'nurse', name: '보건부', grade: 3, role: '탱커',
      hp: 620, atk: 36, range: 17, speed: 0.42, interval: 66, anim: { hit: 12, total: 24 },
      cost: 210, cooldown: 170, kb: 3, abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '체온계로 귀신의 열을 잰다.',
      evo: { name: '보건부장', blurb: '붕대가 방어구가 됐다.' },
      look: { hair: '#6a4a2a', style: 'bun', top: '#f6f3ea', trim: '#d9483b', pants: '#bcd6e0', prop: 'thermo', hat: 'nurse' },
    },
    {
      id: 'fire', name: '소방훈련반', grade: 2, role: '광역',
      hp: 640, atk: 46, range: 50, speed: 0.4, interval: 80, anim: { hit: 14, total: 26 },
      cost: 400, cooldown: 280, kb: 3, abilities: [{ vs: 'ghost', type: 'massive' }], area: true, ranged: 'foam', slow: { chance: 0.45, frames: 100 },
      blurb: '소화기는 불만 끄는 게 아니다.',
      evo: { name: '소방 교관', blurb: '호스가 괴담을 쓸어낸다.' },
      look: { hair: '#3a2a1f', style: 'short', top: '#d9483b', trim: '#f2d450', pants: '#2a2a33', prop: 'extinguisher', hat: 'firehat' },
    },
    {
      id: 'archer', name: '양궁부', grade: 2, role: '저격',
      hp: 380, atk: 120, range: 96, speed: 0.38, interval: 96, anim: { hit: 16, total: 30 },
      cost: 440, cooldown: 320, kb: 3, abilities: [{ vs: 'specimen', type: 'massive' }], ranged: 'arrow',
      blurb: '표본의 급소는 한 군데다.',
      evo: { name: '국가대표 궁사', blurb: '화살이 표본을 정확히 꿰뚫는다.' },
      look: { hair: '#14121a', style: 'long', top: '#4a7a5a', trim: '#efe9dc', pants: '#2e3a30', prop: 'bow' },
    },
    {
      id: 'choir', name: '합창단', grade: 2, role: '광역',
      hp: 520, atk: 40, range: 62, speed: 0.42, interval: 84, anim: { hit: 14, total: 28 },
      cost: 420, cooldown: 300, kb: 3, abilities: [{ vs: 'metal', type: 'massive' }], area: true, ranged: 'wave', slow: { chance: 0.6, frames: 120 },
      blurb: '화음이 철제를 공명시킨다.',
      evo: { name: '합창 지휘자', blurb: '지휘봉 한 번에 전장이 울린다.' },
      look: { hair: '#6a4a2a', style: 'long', top: '#8a5fd0', trim: '#efe9dc', pants: '#3a2f5a', prop: 'sheet' },
    },
    {
      id: 'electric', name: '전기부', grade: 2, role: '광역',
      hp: 480, atk: 70, range: 56, speed: 0.4, interval: 84, anim: { hit: 14, total: 26 },
      cost: 430, cooldown: 300, kb: 3, abilities: [{ vs: 'dark', type: 'massive' }], area: true, ranged: 'bolt',
      blurb: '고압 전류는 그림자에도 통한다.',
      evo: { name: '전기 기사', blurb: '번개가 연쇄로 튄다.' },
      look: { hair: '#2a2a3a', style: 'short', top: '#e0b62c', trim: '#14121a', pants: '#3a3f4b', prop: 'zapper', hat: 'goggles' },
    },
    {
      id: 'taekwon', name: '태권도부', grade: 2, role: '속공',
      hp: 820, atk: 70, range: 18, speed: 0.62, interval: 44, anim: { hit: 8, total: 16 },
      cost: 380, cooldown: 260, kb: 3, abilities: [{ vs: 'ghost', type: 'massive' }],
      blurb: '발차기 한 번에 귀신이 날아간다.',
      evo: { name: '태권도 사범', blurb: '품새에 기합이 더해졌다.' },
      look: { hair: '#14121a', style: 'short', top: '#efe9dc', trim: '#14121a', pants: '#efe9dc', prop: 'band' },
    },
    {
      id: 'sciT', name: '과학 선생님', grade: 1, role: '광역',
      hp: 1300, atk: 100, range: 60, speed: 0.42, interval: 90, anim: { hit: 15, total: 28 },
      cost: 640, cooldown: 500, kb: 2, abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'metal', type: 'massive' }], area: true, ranged: 'beaker', slow: { chance: 0.5, frames: 110 },
      blurb: '실험은 안전이 제일이라고 했다. 이번만 빼고.',
      evo: { name: '화학 박사', blurb: '플라스크가 폭발물처럼 커졌다.' },
      look: { hair: '#8d8d88', style: 'bald', top: '#efe9dc', trim: '#bcb7a9', pants: '#3b4350', prop: 'flask', hat: 'goggles' },
    },
    {
      id: 'nurseT', name: '보건 선생님', grade: 1, role: '제어',
      hp: 1900, atk: 90, range: 24, speed: 0.44, interval: 84, anim: { hit: 14, total: 28 },
      cost: 660, cooldown: 520, kb: 2, abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'ghost', type: 'tough' }, { vs: 'specimen', type: 'strong' }], freeze: { chance: 0.4, frames: 80 },
      blurb: '주사 한 방이면 조용해진다.',
      evo: { name: '보건 수석', blurb: '주사기가 무기급이 됐다.' },
      look: { hair: '#d9d3c7', style: 'bun', top: '#e8f0f4', trim: '#d9483b', pants: '#a8c4d0', prop: 'syringe', hat: 'nurse' },
    },
    {
      id: 'senior', name: '3학년 선배', grade: 1, role: '돌격',
      hp: 2100, atk: 130, range: 20, speed: 0.5, interval: 80, anim: { hit: 14, total: 26 },
      cost: 700, cooldown: 540, kb: 2, abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'dark', type: 'tough' }, { vs: 'specimen', type: 'strong' }],
      blurb: '후배들은 그가 지나가면 길을 비킨다.',
      evo: { name: '전설의 3학년', blurb: '교복 소매가 피로 물든 적이 없다.' },
      look: { hair: '#d6b04a', style: 'short', top: '#14121a', trim: '#d9483b', pants: '#2a2a33', prop: 'chain', face: 'sunglasses' },
    },
    {
      id: 'vice', name: '교감 선생님', grade: 1, role: '광역',
      hp: 1700, atk: 110, range: 62, speed: 0.42, interval: 92, anim: { hit: 15, total: 28 },
      cost: 680, cooldown: 520, kb: 2, abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'ghost', type: 'strong' }], area: true, ranged: 'wave', slow: { chance: 0.5, frames: 120 },
      blurb: '자로 재면 복장도 괴담도 불량이다.',
      evo: { name: '교감 (엄격 모드)', blurb: '자 끝에서 충격파가 나간다.' },
      look: { hair: '#8d8d88', style: 'bald', top: '#4a4a52', trim: '#e0b62c', pants: '#2a2a33', prop: 'ruler', face: 'glasses' },
    },
    {
      id: 'headmaster', name: '교장 선생님', grade: 0, role: '전설',
      hp: 3400, atk: 130, range: 56, speed: 0.38, interval: 100, anim: { hit: 17, total: 32 },
      cost: 950, cooldown: 720, kb: 2, abilities: [{ vs: '*', type: 'strong' }, { vs: '*', type: 'tough' }], limited: true, area: true, ranged: 'wave', freeze: { chance: 0.15, frames: 60 },
      blurb: '훈화 말씀 한 번에 전장이 조용해진다.',
      evo: { name: '명예 교장', blurb: '훈화가 끝나지 않는다.' },
      look: { hair: '#d9d3c7', style: 'bald', top: '#2b2b36', trim: '#f2d450', pants: '#1f1f26', prop: 'scroll', face: 'glasses', legend: true },
    },
    {
      id: 'alumni', name: '전설의 졸업생', grade: 0, role: '전설',
      hp: 2200, atk: 175, range: 28, speed: 0.55, interval: 78, anim: { hit: 13, total: 26 },
      cost: 880, cooldown: 620, kb: 2, abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'dark', type: 'massive' }, { vs: 'metal', type: 'strong' }, { vs: 'specimen', type: 'strong' }], limited: true, freeze: { chance: 0.3, frames: 70 },
      blurb: '전교 1등에서 전설이 된 사람.',
      evo: { name: '졸업생 대표', blurb: '졸업 가운이 전장을 휘감는다.' },
      look: { hair: '#2a2323', style: 'short', top: '#232a3d', trim: '#f2d450', pants: '#2a3046', prop: 'trophy', hat: 'gradcap', legend: true },
    },
  ];

  YG.ENEMIES = [
    {
      id: 'dust', name: '먼지 괴물', trait: 'none',
      hp: 170, atk: 14, range: 13, speed: 0.4, interval: 60, anim: { hit: 10, total: 20 },
      kb: 3, drop: 14, look: 'dust',
    },
    {
      id: 'ghost', name: '화장실 귀신', trait: 'ghost', float: true,
      hp: 320, atk: 24, range: 15, speed: 0.5, interval: 62, anim: { hit: 10, total: 20 },
      kb: 3, drop: 22, look: 'ghost',
    },
    {
      id: 'mannequin', name: '인체모형', trait: 'specimen',
      hp: 560, atk: 34, range: 15, speed: 0.34, interval: 72, anim: { hit: 12, total: 24 },
      kb: 2, drop: 32, look: 'mannequin',
    },
    {
      id: 'shadow', name: '복도 그림자', trait: 'dark',
      hp: 430, atk: 28, range: 15, speed: 0.75, interval: 48, anim: { hit: 8, total: 16 },
      kb: 4, drop: 30, look: 'shadow',
    },
    {
      id: 'locker', name: '움직이는 사물함', trait: 'metal',
      hp: 1500, atk: 44, range: 15, speed: 0.24, interval: 90, anim: { hit: 16, total: 30 },
      kb: 2, drop: 90, look: 'locker',
    },
    {
      id: 'portrait', name: '음악실 초상화', trait: 'ghost', float: true, ranged: 'note',
      hp: 420, atk: 22, range: 58, speed: 0.3, interval: 70, anim: { hit: 12, total: 24 },
      kb: 3, drop: 40, look: 'portrait',
    },
    {
      id: 'tray', name: '급식 쟁반 로봇', trait: 'metal',
      hp: 520, atk: 26, range: 14, speed: 0.55, interval: 55, anim: { hit: 9, total: 18 },
      kb: 3, drop: 50, look: 'tray',
    },
    {
      id: 'skeleton', name: '해골 표본', trait: 'specimen',
      hp: 1300, atk: 55, range: 16, speed: 0.22, interval: 100, anim: { hit: 18, total: 34 },
      kb: 2, drop: 55, look: 'skeleton',
    },
    {
      id: 'mirror', name: '4시 44분 거울', trait: 'ghost',
      hp: 1100, atk: 38, range: 16, speed: 0.22, interval: 80, anim: { hit: 14, total: 26 },
      kb: 2, drop: 60, look: 'mirror',
    },
    {
      id: 'principal', name: '교장 그림자', trait: 'dark', boss: true, scale: 2, heavy: true,
      hp: 5500, atk: 95, range: 30, area: true, speed: 0.2, interval: 105, anim: { hit: 20, total: 38 },
      kb: 6, drop: 400, look: 'principal',
    },
    {
      id: 'megamirror', name: '거대 거울', trait: 'ghost', boss: true, scale: 2, heavy: true,
      hp: 9000, atk: 120, range: 36, area: true, speed: 0.18, interval: 110, anim: { hit: 22, total: 40 },
      kb: 6, drop: 600, look: 'megamirror',
    },
  ];

  YG.CHAPTERS = [
    { id: 1, name: '1장 본관', blurb: '야자가 시작되면 학교가 달라진다.' },
    { id: 2, name: '2장 별관', blurb: '쓰지 않는 교실에서 소리가 난다.' },
  ];

  YG.STAGES = [
    {
      id: 1, chapter: 1, name: '복도', sub: '1-1', theme: 'corridor',
      blurb: '불 꺼진 복도. 발소리가 하나 더 있다.',
      startMoney: 150, allyBaseHp: 2500, enemyBaseHp: 3000,
      waves: [
        { id: 'dust', start: 2, interval: 5, count: 14, mult: 1.3 },
        { id: 'ghost', start: 12, interval: 10, count: 7, mult: 1.4 },
      ],
      reward: { first: { coins: 600, xp: 400, pens: 3 }, repeat: { coins: 90, xp: 150, pens: 2 } },
    },
    {
      id: 2, chapter: 1, name: '과학실', sub: '1-2', theme: 'lab',
      unlock: 'cleaner',
      blurb: '표본 상자의 뚜껑이 열려 있다.',
      startMoney: 200, allyBaseHp: 3000, enemyBaseHp: 5625,
      waves: [
        { id: 'dust', start: 2, interval: 5, count: 16, mult: 1.62 },
        { id: 'mannequin', start: 8, interval: 9, count: 10, mult: 1.5 },
        { id: 'ghost', start: 20, interval: 12, count: 7, mult: 1.62 },
      ],
      reward: { first: { coins: 900, xp: 500, pens: 3 }, repeat: { coins: 110, xp: 180, pens: 2 } },
    },
    {
      id: 3, chapter: 1, name: '보일러실', sub: '1-3', theme: 'basement',
      blurb: '새벽 4시 44분. 보일러가 숨을 쉰다.',
      startMoney: 250, allyBaseHp: 3500, enemyBaseHp: 5000,
      waves: [
        { id: 'shadow', start: 3, interval: 8, count: 12, mult: 1.0 },
        { id: 'dust', start: 8, interval: 8, count: 10, mult: 1.4 },
        { id: 'locker', start: 20, interval: 28, count: 3, mult: 1.0 },
      ],
      boss: { id: 'principal', atHp: 0.5, mult: 1 },
      reward: { first: { coins: 1500, xp: 700, pens: 6 }, repeat: { coins: 160, xp: 250, pens: 3 } },
    },
    {
      id: 4, chapter: 2, name: '화장실', sub: '2-1', theme: 'bathroom',
      unlock: 'basket',
      blurb: '세 번째 칸 문이 안쪽에서 잠겨 있다.',
      startMoney: 300, allyBaseHp: 4500, enemyBaseHp: 7700,
      waves: [
        { id: 'ghost', start: 2, interval: 6, count: 14, mult: 1.96 },
        { id: 'dust', start: 4, interval: 5, count: 17, mult: 1.96 },
        { id: 'portrait', start: 20, interval: 12, count: 6, mult: 1.82 },
      ],
      reward: { first: { coins: 1800, xp: 900, pens: 4 }, repeat: { coins: 200, xp: 300, pens: 2 } },
    },
    {
      id: 5, chapter: 2, name: '급식실', sub: '2-2', theme: 'cafeteria',
      blurb: '배식대 위의 쟁반이 줄지어 움직인다.',
      startMoney: 300, allyBaseHp: 4500, enemyBaseHp: 8750,
      waves: [
        { id: 'tray', start: 3, interval: 10, count: 9, mult: 1.25 },
        { id: 'dust', start: 5, interval: 6, count: 16, mult: 1.88 },
        { id: 'shadow', start: 14, interval: 9, count: 9, mult: 1.62 },
      ],
      reward: { first: { coins: 2000, xp: 1000, pens: 4 }, repeat: { coins: 220, xp: 340, pens: 2 } },
    },
    {
      id: 6, chapter: 2, name: '음악실', sub: '2-3', theme: 'music',
      unlock: 'pingpong',
      blurb: '아무도 없는데 피아노가 계속 친다.',
      startMoney: 350, allyBaseHp: 5000, enemyBaseHp: 11900,
      waves: [
        { id: 'portrait', start: 3, interval: 9, count: 12, mult: 1.96 },
        { id: 'skeleton', start: 10, interval: 12, count: 8, mult: 1.54 },
        { id: 'mannequin', start: 16, interval: 10, count: 8, mult: 2.1 },
        { id: 'ghost', start: 22, interval: 10, count: 8, mult: 2.1 },
      ],
      reward: { first: { coins: 2200, xp: 1200, pens: 5 }, repeat: { coins: 250, xp: 400, pens: 3 } },
    },
    {
      id: 7, chapter: 2, name: '옥상', sub: '2-4', theme: 'roof',
      blurb: '새벽 4시 44분. 거울 속에서 손이 나온다.',
      startMoney: 400, allyBaseHp: 5500, enemyBaseHp: 9500,
      waves: [
        { id: 'shadow', start: 3, interval: 8, count: 12, mult: 1.4 },
        { id: 'tray', start: 8, interval: 14, count: 6, mult: 1.0 },
        { id: 'mirror', start: 15, interval: 20, count: 5, mult: 1.1 },
        { id: 'ghost', start: 20, interval: 9, count: 10, mult: 1.7 },
      ],
      boss: { id: 'megamirror', atHp: 0.55, mult: 1 },
      reward: { first: { coins: 3000, xp: 1600, pens: 8 }, repeat: { coins: 300, xp: 500, pens: 4 } },
    },
  ];

  YG.WORKER = [
    { max: 500, income: 8, up: 60 },
    { max: 800, income: 12, up: 120 },
    { max: 1200, income: 18, up: 200 },
    { max: 1700, income: 26, up: 320 },
    { max: 2300, income: 36, up: 480 },
    { max: 3000, income: 50, up: 700 },
    { max: 4000, income: 70, up: 1000 },
    { max: 5500, income: 100, up: 1500 },
    { max: 7500, income: 140, up: 2200 },
    { max: 10000, income: 200, up: 3200 },
    { max: 14000, income: 280, up: 4500 },
    { max: 20000, income: 400, up: 0 },
  ];

  YG.CANNON = { chargeFrames: 30 * 36, dmg: 240, kb: 5.5, metalPct: 0.2 };

  YG.GACHA = {
    cost1: 30,
    cost11: 300,
    rates: { 3: 65, 2: 30, 1: 5 },
    pityEvery: 5,
    pityStep: 0.5,
    pityMax: 9.5,
    legendRate: 1,
    legendHardPity: 100,
    featuredShare: 0.7,
  };

  YG.EVO = {
    4: { pens: 3, xp: 200, lv: 5 },
    3: { pens: 6, xp: 400, lv: 6 },
    2: { pens: 10, xp: 700, lv: 7 },
    1: { pens: 14, xp: 1000, lv: 8 },
    0: { pens: 20, xp: 1500, lv: 8 },
  };

  YG.EVO2 = {
    4: { pens: 8, xp: 2000, lv: 30 },
    3: { pens: 16, xp: 4000, lv: 32 },
    2: { pens: 26, xp: 7000, lv: 34 },
    1: { pens: 36, xp: 10000, lv: 36 },
    0: { pens: 50, xp: 15000, lv: 38 },
  };

  YG.PROG = { maxLv: 50, maxPlus: 5, baseSlots: 5, maxDeck: 10 };

  YG.unitById = (id) => YG.UNITS.find((u) => u.id === id);
  YG.enemyById = (id) => YG.ENEMIES.find((u) => u.id === id);

  const evoCache = {};
  YG.resolveDef = (def, evolved) => {
    const lvl = evolved ? Number(evolved) : 0;
    if (!lvl) return def;
    const key = `${def.id}:${lvl}`;
    if (evoCache[key]) return evoCache[key];
    const e = def.evo;
    const abilities =
      e.abilities || (def.abilities || []).map((a) => (a.type === 'strong' ? { ...a, type: 'massive' } : a));
    const second = lvl >= 2;
    evoCache[key] = {
      ...def,
      name: second ? e.name2 || `각성 ${e.name}` : e.name,
      blurb: (second && e.blurb2) || e.blurb || def.blurb,
      hp: Math.round(def.hp * (second ? 2.4 : 1.6)),
      atk: Math.round(def.atk * (second ? 2.1 : 1.5)),
      cooldown: Math.round(def.cooldown * (second ? 0.8 : 0.9)),
      abilities,
      look: { ...def.look, ...((e.look || [])[0] || {}), ...(second ? (e.look || [])[1] || {} : {}), evo: lvl },
      spriteKey: `${def.id}:e${lvl}`,
      evolved: lvl,
    };
    return evoCache[key];
  };

  YG.abilityText = (def) => {
    const out = [];
    const byTrait = {};
    for (const a of def.abilities || []) (byTrait[a.vs] = byTrait[a.vs] || []).push(a.type);
    for (const [vs, types] of Object.entries(byTrait)) {
      const t = YG.TRAITS[vs].name;
      const parts = [];
      if (types.includes('massive')) parts.push(`${t}에게 초데미지`);
      else if (types.includes('strong')) parts.push(`${t}에 강하다`);
      if (types.includes('tough')) parts.push(`${t}에게 맷집 좋다`);
      out.push({ trait: vs, text: parts.join(' · ') });
    }
    if (def.area) out.push({ trait: null, text: '범위 공격' });
    if (def.freeze) out.push({ trait: null, text: `${Math.round(def.freeze.chance * 100)}% 확률로 정지` });
    if (def.slow) out.push({ trait: null, text: `${Math.round(def.slow.chance * 100)}% 확률로 둔화` });
    if (def.crit) out.push({ trait: null, text: `${Math.round(def.crit * 100)}% 확률로 치명타 (2배)` });
    if (def.survive) out.push({ trait: null, text: `${Math.round(def.survive * 100)}% 확률로 한 번 버틴다` });
    if (def.loot) out.push({ trait: null, text: `처치 용돈 ×${def.loot}` });
    return out;
  };

  YG.stageTraits = (stage) => {
    const ids = stage.waves.map((w) => w.id);
    if (stage.boss) ids.push(stage.boss.id);
    return [...new Set(ids.map((id) => YG.enemyById(id).trait))];
  };
})(globalThis);
