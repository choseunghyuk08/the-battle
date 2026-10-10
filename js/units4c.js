(function (g) {
  const YG = g.YG;

  /* 새 동료 (이 파일 담당 에이전트만 고친다). 형식은 js/units3.js 와 같고, 아래 필드가 더 있다.
     cm: 현실 키(cm), evo: { name, blurb, name2, blurb2, look: [진화 외형, 각성 외형] } (js/evolutions.js 의 EVO 항목과 같은 형식),
     unlockStage: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 */
  const NEW = [
    /* ---- 3등급 (동아리와 학교 사람들) ---- */
    {
      id: 'scout', name: '스카우트부', grade: 3, role: '제어', cm: 165,
      hp: 300, atk: 44, range: 70, speed: 0.42, interval: 66, anim: { hit: 12, total: 24 },
      cost: 220, cooldown: 170, kb: 3, ranged: 'hook', slow: { chance: 0.4, frames: 90 },
      abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '준비물은 밧줄과 랜턴. 귀신도 일단 묶고 본다.',
      look: { hair: '#4a3626', style: 'short', top: '#8a8a4a', trim: '#d9483b', pants: '#5a5a3a', prop: 'scout_hook', hat: 'scout_hat', wear: ['scout_kerchief:#d9483b', 'scout_lantern'] },
      evo: {
        name: '스카우트 대장', name2: '캠프파이어 마스터',
        blurb: '매듭 급수가 올랐다. 이제 귀신이 먼저 손을 내민다.',
        blurb2: '캠프파이어 한 번에 복도 전체가 대낮이다.',
        look: [
          { gear: ['medal', 'epaulette'] },
          { top: '#5a6a3a', trim: '#f2d450', gear: ['cape:#7a2e3a', 'epaulette2', 'medal', 'sash:#d9483b'] },
        ],
      },
    },
    {
      id: 'drone', name: '드론부', grade: 3, role: '원거리', cm: 170,
      hp: 270, atk: 46, range: 78, speed: 0.4, interval: 60, anim: { hit: 11, total: 22 },
      cost: 235, cooldown: 180, kb: 3, ranged: 'bolt',
      abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '배터리 20퍼센트. 귀신보다 그게 더 무섭다.',
      look: { hair: '#8a5a3a', style: 'short', top: '#3a4a6a', trim: '#6fd0e8', pants: '#2a2d38', prop: 'drone_ctrl', hat: 'drone_fpv' },
      evo: {
        name: '드론 파일럿', name2: '군집 비행 사령관',
        blurb: '보조 배터리를 샀다. 이제 귀신 쪽이 먼저 지친다.',
        blurb2: '드론이 떼로 뜨니 복도가 활주로다.',
        look: [
          { gear: ['vest:#2f3a4a', 'epaulette'] },
          { top: '#14202a', trim: '#6fd0e8', gear: ['cape:#14202a', 'epaulette2', 'plate:#3a4a6a'] },
        ],
      },
    },
    {
      id: 'caretaker', name: '숙직 경비 아저씨', grade: 3, role: '근접', cm: 172,
      hp: 540, atk: 60, range: 20, speed: 0.4, interval: 68, anim: { hit: 12, total: 24 },
      cost: 230, cooldown: 180, kb: 3,
      abilities: [{ vs: 'ghost', type: 'strong' }, { vs: 'ghost', type: 'tough' }],
      blurb: '귀신을 봐도 "학생, 아직 안 갔어?" 한다.',
      look: { hair: '#8d8d88', style: 'short', top: '#3a4a5a', trim: '#e0b62c', pants: '#2f3a4a', prop: 'caretaker_light', hat: 'caretaker_cap', face: 'mustache', wear: ['caretaker_jumper:#3a4a5a', 'caretaker_keys'] },
      evo: {
        name: '경비 반장', name2: '전설의 숙직 대장',
        blurb: '열쇠 꾸러미가 한 줌 더 묵직해졌다.',
        blurb2: '이 학교 모든 문의 열쇠를 쥐고 있다. 모든 문의.',
        look: [
          { gear: ['armband:#e0b62c', 'epaulette'] },
          { top: '#232a3d', trim: '#e0b62c', gear: ['cape:#232a3d', 'epaulette2', 'medal'] },
        ],
      },
    },
    {
      id: 'store', name: '매점 아주머니', grade: 3, role: '광역', cm: 160,
      hp: 280, atk: 40, range: 40, speed: 0.4, interval: 70, anim: { hit: 12, total: 24 },
      cost: 240, cooldown: 190, kb: 3, area: true, loot: 1.5,
      abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '"학생, 외상은 안 돼." 귀신한테도 안 된다.',
      look: { hair: '#5a3a30', style: 'store_perm', top: '#c25a8a', trim: '#efe9dc', pants: '#3a3f4b', prop: 'store_tongs', wear: ['store_apron:#2f6f6a'] },
      evo: {
        name: '매점 사장님', name2: '매점의 큰손',
        blurb: '호떡 한 판에 거스름돈이 철철 넘친다.',
        blurb2: '가격표가 곧 법이다. 괴담도 줄을 선다.',
        look: [
          { gear: ['scarf:#f2d450', 'medal'] },
          { top: '#7a2e5a', trim: '#f2d450', gear: ['cape:#7a2e5a', 'epaulette2', 'laurel:#f2d450'] },
        ],
      },
    },
    {
      id: 'weather', name: '기상부', grade: 3, role: '광역', cm: 168,
      hp: 310, atk: 34, range: 60, speed: 0.4, interval: 78, anim: { hit: 14, total: 26 },
      cost: 240, cooldown: 190, kb: 3, area: true, ranged: 'water', slow: { chance: 0.3, frames: 80 },
      abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '내일 날씨: 복도에 갑자기 소나기.',
      look: { hair: '#5a3b2b', style: 'bob', top: '#4a90c0', trim: '#efe9dc', pants: '#3a4a6a', prop: 'weather_umbrella', hat: 'weather_anemo' },
      evo: {
        name: '기상 예보관', name2: '날씨의 지배자',
        blurb: '예보 적중률이 올랐다. 틀리면 직접 비를 내린다.',
        blurb2: '우산 한 번 펴면 소나기, 두 번 펴면 태풍이다.',
        look: [
          { gear: ['scarf:#efe9dc', 'epaulette'] },
          { top: '#1f3a7a', trim: '#9ed8e8', gear: ['cape:#1f3a7a', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'hockey', name: '아이스하키부', grade: 3, role: '근접', cm: 182,
      hp: 680, atk: 62, range: 24, speed: 0.38, interval: 74, anim: { hit: 14, total: 26 },
      cost: 235, cooldown: 185, kb: 4,
      abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '퍽이 없으면 괴담을 쳐서 날린다.',
      look: { hair: '#2a2323', style: 'short', top: '#2f5f8a', trim: '#efe9dc', pants: '#1f2a44', prop: 'hockey_stick', hat: 'hockey_helmet', wear: ['hockey_jersey', 'hockey_pads'] },
      evo: {
        name: '아이스하키 주장', name2: '링크의 제왕',
        blurb: '보디체킹 한 번에 괴담이 보드 밖으로 날아간다.',
        blurb2: '얼음은 없어도 복도는 링크다. 미끄러지는 건 괴담 쪽이다.',
        look: [
          { gear: ['armband:#efe9dc', 'stripe:#efe9dc'] },
          { top: '#1f3a7a', trim: '#f2d450', gear: ['stripe:#f2d450', 'cape:#14202a', 'epaulette2', 'medal'] },
        ],
      },
    },
    {
      id: 'skate', name: '스케이트보드부', grade: 3, role: '돌격', cm: 172,
      hp: 440, atk: 44, range: 22, speed: 0.7, interval: 50, anim: { hit: 9, total: 18 },
      cost: 220, cooldown: 160, kb: 3,
      abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '복도에서 타면 혼난다. 그래서 야자 때 탄다.',
      look: { hair: '#3a2a1f', style: 'short', top: '#d9483b', trim: '#efe9dc', pants: '#3a4a5a', prop: 'skate_board', hat: 'skate_helmet' },
      evo: {
        name: '스트리트 크루', name2: '스트리트 레전드',
        blurb: '데크에 스티커가 늘수록 기술도 는다.',
        blurb2: '킥플립 한 번에 괴담이 한 바퀴 돈다.',
        look: [
          { gear: ['scarf:#f2d450', 'epaulette'] },
          { top: '#14121a', trim: '#f2d450', gear: ['wings:#d9483b', 'epaulette2', 'scarf:#f2d450'] },
        ],
      },
    },
  ];

  YG.UNITS.push(...NEW);
})(globalThis);
