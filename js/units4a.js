(function (g) {
  const YG = g.YG;

  /* 새 동료 (이 파일 담당 에이전트만 고친다). 형식은 js/units3.js 와 같고, 아래 필드가 더 있다.
     cm: 현실 키(cm), evo: { name, blurb, name2, blurb2, look: [진화 외형, 각성 외형] } (js/evolutions.js 의 EVO 항목과 같은 형식),
     unlockStage: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 */
  const NEW = [
    /* ---- 4등급: 해외 교환학생 다섯, 재단 인턴 ---- */
    {
      id: 'jpex', name: '일본 교환학생', grade: 4, role: '속공', cm: 168,
      hp: 170, atk: 17, range: 14, speed: 0.85, interval: 36, anim: { hit: 7, total: 14 },
      cost: 70, cooldown: 90, kb: 4, abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '야자는 처음인데 도시락 시간은 정확히 안다.',
      look: { hair: '#14121a', style: 'short', top: '#1f2a44', trim: '#e8e4d6', pants: '#1f2a44', prop: 'jpex_fan', hat: 'jpex_hachi' },
      evo: {
        name: '신칸센 통학생', name2: '초특급 노조미',
        blurb: '복도 끝까지 정시에 도착한다. 1초도 안 늦는다.', blurb2: '노조미호가 지나간 자리엔 도시락 냄새만 남는다.',
        look: [
          { gear: ['armband:#d9483b', 'scarf:#efe9dc'] },
          { top: '#161c33', trim: '#f2d450', gear: ['sash:#d9483b', 'epaulette2', 'wings:#f4efe2'] },
        ],
      },
      unlockStage: 255,
    },
    {
      id: 'cnex', name: '중국 교환학생', grade: 4, role: '근접', cm: 172,
      hp: 260, atk: 20, range: 18, speed: 0.42, interval: 56, anim: { hit: 10, total: 20 },
      cost: 90, cooldown: 110, kb: 3, abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '죽간에 적힌 건 시험 범위가 아니라 주문이다.',
      look: { hair: '#14121a', style: 'pony', top: '#b8352c', trim: '#e0b62c', pants: '#1c1a22', prop: 'cnex_slips', wear: ['cnex_frog:#e0b62c'] },
      evo: {
        name: '쿵푸 서생', name2: '무림 수석 서생',
        blurb: '한 대 맞으면 그날 진도가 나간다.', blurb2: '천하제일 수능 만점 서생. 괴담도 필기한다.',
        look: [
          { gear: ['armband:#e0b62c', 'epaulette'] },
          { top: '#7a1f1f', trim: '#f2d450', gear: ['sash:#1c1a22', 'epaulette2', 'halo'] },
        ],
      },
      unlockStage: 275,
    },
    {
      id: 'seaex', name: '동남아 교환학생', grade: 4, role: '원거리', cm: 163,
      hp: 175, atk: 27, range: 56, speed: 0.44, interval: 58, anim: { hit: 10, total: 20 },
      cost: 100, cooldown: 120, kb: 2, ranged: 'ball', abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '야자 시간에 야자를 가져왔다.',
      look: { hair: '#2a1f18', style: 'short', skin: '#d4a373', skinShade: '#b8845a', top: '#3f9a8a', trim: '#c4466a', pants: '#d9c9a0', prop: 'seaex_coconut', hat: 'seaex_nonla' },
      evo: {
        name: '코코넛 투수', name2: '야자 대왕',
        blurb: '한 알에서 한 박스로. 투구폼이 점점 프로다.', blurb2: '야자수 숲이 통째로 날아온다.',
        look: [
          { gear: ['scarf:#e8453c', 'armband:#f2d450'] },
          { top: '#1f7a6a', trim: '#f2d450', gear: ['cape:#1f7a6a', 'epaulette2', 'medal'] },
        ],
      },
      unlockStage: 295,
    },
    {
      id: 'euex', name: '유럽 교환학생', grade: 4, role: '원거리', cm: 178,
      hp: 185, atk: 32, range: 60, speed: 0.42, interval: 64, anim: { hit: 11, total: 22 },
      cost: 105, cooldown: 125, kb: 2, ranged: 'arrow', crit: 0.2, abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '바게트는 간식이자 무기고, 낭만이다.',
      look: { hair: '#b98a4a', style: 'curly', top: '#efe9dc', trim: '#27406e', pants: '#3a4a6a', prop: 'euex_baguette', hat: 'beret', wear: ['euex_breton:#27406e'] },
      evo: {
        name: '바게트 검객', name2: '빵의 기사단장',
        blurb: '갓 구운 바게트를 칼날처럼 휘두른다.', blurb2: '황금빛 바게트가 철제도 가른다. 고소하게.',
        look: [
          { gear: ['scarf:#d9483b', 'medal'] },
          { top: '#f2ece0', trim: '#c9a24a', gear: ['cape:#27406e', 'epaulette2', 'halo'] },
        ],
      },
      unlockStage: 315,
    },
    {
      id: 'amex', name: '미국 교환학생', grade: 4, role: '돌격', cm: 188,
      hp: 245, atk: 31, range: 16, speed: 0.9, interval: 48, anim: { hit: 8, total: 16 },
      cost: 105, cooldown: 115, kb: 5, abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '터치다운! 이라고 외치고 사물함으로 돌격한다.',
      look: { hair: '#6a4a2a', style: 'spiky', top: '#efe9dc', trim: '#2b4a8a', pants: '#3a4a6a', prop: 'amex_football', face: 'amex_gum', wear: ['amex_letterman:#2b4a8a'] },
      evo: {
        name: '쿼터백', name2: '슈퍼볼 MVP',
        blurb: '패스는 없다. 본인이 직접 달린다.', blurb2: '터치다운 세리머니에 복도가 흔들린다.',
        look: [
          { gear: ['armband:#f2d450', 'scarf:#efe9dc'] },
          { top: '#f2ece0', trim: '#f2d450', gear: ['cape:#2b4a8a', 'epaulette2', 'halo'] },
        ],
      },
      unlockStage: 335,
    },
    {
      id: 'intern', name: '재단 인턴', grade: 4, role: '벽', cm: 170,
      hp: 650, atk: 12, range: 15, speed: 0.34, interval: 60, anim: { hit: 10, total: 20 },
      cost: 105, cooldown: 140, kb: 2, abilities: [{ vs: 'ghost', type: 'tough' }],
      blurb: '출입증은 있는데 권한이 없다.',
      look: { hair: '#3a2a1f', style: 'short', top: '#9fb4c9', trim: '#efe9dc', pants: '#3a4350', face: 'glasses', prop: 'intern_clip', wear: ['intern_badge:#3a8fd0'] },
      evo: {
        name: '정규직 전환자', name2: '사이트 부관리자 대행',
        blurb: '정규직 전환 직전. 야근이 곧 방어력이다.', blurb2: '커피 한 잔으로 사흘 밤샘 방벽을 선다.',
        look: [
          { gear: ['armband:#3a8fd0', 'vest:#3a3f4b'] },
          { top: '#2a3a52', trim: '#e0b62c', gear: ['cape:#2a3a52', 'epaulette2', 'medal'] },
        ],
      },
      unlockStage: 360,
    },

    /* ---- 0등급: 기간 한정 뽑기 ---- */
    {
      id: 'hunter', name: '괴담 사냥꾼', grade: 0, role: '전설', limited: true, cm: 186,
      hp: 2700, atk: 190, range: 30, speed: 0.55, interval: 76, anim: { hit: 13, total: 26 },
      cost: 880, cooldown: 650, kb: 2, crit: 0.3,
      abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'tough' }, { vs: 'specimen', type: 'strong' }],
      blurb: '귀신이 무서워하는 건 부적이 아니라 이 사람이다.',
      look: { hair: '#2a2420', style: 'short', top: '#3a2a22', trim: '#c9a24a', pants: '#1f1c1a', prop: 'hunter_blade', hat: 'hunter_hat', wear: ['hunter_coat:#4a3226'], legend: true },
      evo: {
        name: '현상금 사냥꾼', name2: '괴담의 천적',
        blurb: '괴담 한 마리당 수당이 붙는다. 야근수당은 아니다.', blurb2: '괴담들 사이에 수배 전단이 돈다. 그의 얼굴로.',
        look: [
          { gear: ['scarf:#7a2e26', 'epaulette'] },
          { top: '#241a16', trim: '#f2d450', gear: ['cape:#2a1a16', 'epaulette2', 'medal'] },
        ],
      },
    },
    {
      id: 'ghostkid', name: '친절한 유령 학생', grade: 0, role: '전설', limited: true, cm: 152,
      hp: 2300, atk: 150, range: 52, speed: 0.42, interval: 84, anim: { hit: 14, total: 27 },
      cost: 860, cooldown: 640, kb: 2, ranged: 'flash', survive: 0.6, slow: { chance: 0.4, frames: 100 },
      abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'ghost', type: 'tough' }, { vs: 'dark', type: 'massive' }, { vs: 'dark', type: 'strong' }],
      blurb: '같이 야자할래? 이미 출석부에 이름이 있다.',
      look: { hair: '#14121a', style: 'long', skin: '#dfe8f2', skinShade: '#b3c3d6', top: '#f4f6fa', trim: '#9fb4d8', pants: '#e2e7ef', prop: 'ghostkid_wisp', hat: 'ghostkid_tri', face: 'ghostkid_face', wear: ['ghostkid_mist'], legend: true },
      evo: {
        name: '야자 지박령', name2: '졸업 못 한 수호천사',
        blurb: '자리에서 못 일어난다. 그래서 더 열심히 한다.', blurb2: '졸업식 날 하늘로 가려다 야자가 있어서 돌아왔다.',
        look: [
          { gear: ['scarf:#9fb4d8', 'armband:#efe9dc'] },
          { top: '#fff8e8', trim: '#f2d450', gear: ['wings:#dfe8f2', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'clock', name: '시계탑 지기', grade: 0, role: '전설', limited: true, cm: 190,
      hp: 2300, atk: 120, range: 56, speed: 0.4, interval: 92, anim: { hit: 15, total: 28 },
      cost: 920, cooldown: 700, kb: 2, area: true, ranged: 'wave', freeze: { chance: 0.4, frames: 100 },
      abilities: [{ vs: '*', type: 'strong' }, { vs: 'ghost', type: 'massive' }],
      blurb: '종이 울리면 시간이 멈춘다. 지각도 봐주지 않는다.',
      look: { hair: '#d9d3c7', style: 'short', top: '#2a2c3d', trim: '#d6b04a', pants: '#1c1a26', prop: 'clock_watch', face: 'clock_monocle', wear: ['clock_coat:#262a3e'], legend: true },
      evo: {
        name: '시계탑 수석 지기', name2: '멈춘 시간의 주인',
        blurb: '시침이 분침보다 무섭다.', blurb2: '그가 손목을 돌리면 괴담의 오늘은 영원히 4시 44분이다.',
        look: [
          { gear: ['scarf:#d6b04a', 'epaulette', 'medal'] },
          { top: '#14121e', trim: '#f2d450', gear: ['cape:#1c1a2e', 'epaulette2', 'halo'] },
        ],
      },
    },
  ];

  YG.UNITS.push(...NEW);
})(globalThis);
