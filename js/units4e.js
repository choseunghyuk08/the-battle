(function (g) {
  const YG = g.YG;

  /* 새 동료 (이 파일 담당 에이전트만 고친다). 형식은 js/units3.js 와 같고, 아래 필드가 더 있다.
     cm: 현실 키(cm), evo: { name, blurb, name2, blurb2, look: [진화 외형, 각성 외형] } (js/evolutions.js 의 EVO 항목과 같은 형식),
     unlockStage: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 */
  const NEW = [
    /* ---- 2등급 (동아리, 괴담 대응반) ---- */
    {
      id: 'parkour', name: '파쿠르부', grade: 2, role: '돌격', cm: 176,
      hp: 580, atk: 62, range: 19, speed: 0.88, interval: 44, anim: { hit: 8, total: 16 },
      cost: 400, cooldown: 280, kb: 4, abilities: [{ vs: 'ghost', type: 'strong' }, { vs: 'metal', type: 'strong' }],
      blurb: '귀신이 쫓아오면 벽을 타고 올라가 버린다.',
      look: { hair: '#2a2323', style: 'short', top: '#4a4f5c', trim: '#e0762c', pants: '#2a2d38', prop: 'parkour_glove', hat: 'parkour_hood', face: 'parkour_buff', wear: ['parkour_rope'] },
      evo: {
        name: '파쿠르 에이스', name2: '프리러너',
        blurb: '사물함 세 개를 밟고 귀신 머리 위에 착지한다.', blurb2: '중력은 야자 시간에 쉬는 모양이다.',
        look: [
          { gear: ['armband:#e0762c'] },
          { top: '#1c1a22', trim: '#6fd0e8', pants: '#14121a', gear: ['scarf:#6fd0e8', 'epaulette2', 'wings:#6fd0e8'] },
        ],
      },
    },
    {
      id: 'circus', name: '서커스부', grade: 2, role: '광역', cm: 168,
      hp: 520, atk: 46, range: 54, speed: 0.4, interval: 82, anim: { hit: 14, total: 26 },
      cost: 410, cooldown: 290, kb: 3, area: true, ranged: 'ball', slow: { chance: 0.3, frames: 80 }, abilities: [{ vs: 'ghost', type: 'massive' }],
      blurb: '핀이 돌아가면 귀신 눈도 같이 돈다.',
      look: { hair: '#e8553b', style: 'twin', top: '#7a3fa0', trim: '#f2d450', pants: '#2f8f83', prop: 'circus_pins', hat: 'circus_hat', face: 'circus_nose', wear: ['circus_ruff'] },
      evo: {
        name: '서커스 단장', name2: '대서커스 마술단장',
        blurb: '핀에 불이 붙었다. 소방훈련반이 달려온다.', blurb2: '박수가 나오면 괴담이 앙코르를 외친다.',
        look: [
          { gear: ['sash:#d9483b'] },
          { top: '#2a1a4a', trim: '#f2d450', gear: ['cape:#7a2e3a', 'epaulette2', 'medal'] },
        ],
      },
    },
    {
      id: 'opera', name: '성악부', grade: 2, role: '제어', cm: 165,
      hp: 470, atk: 40, range: 60, speed: 0.4, interval: 88, anim: { hit: 15, total: 28 },
      cost: 430, cooldown: 300, kb: 3, area: true, ranged: 'note', freeze: { chance: 0.25, frames: 60 }, abilities: [{ vs: 'specimen', type: 'massive' }],
      blurb: '고음 한 번에 창문과 괴담이 같이 금 간다.',
      look: { hair: '#5a2f26', style: 'long', top: '#7a1f3a', trim: '#f2d450', pants: '#2a1a2a', prop: 'opera_score', hat: 'opera_tiara', wear: ['opera_gown'] },
      evo: {
        name: '프리마돈나', name2: '전설의 디바',
        blurb: '이번엔 샹들리에가 먼저 떨어진다.', blurb2: '마지막 고음에서 괴담이 박수를 치며 사라진다.',
        look: [
          { gear: ['scarf:#efe9dc'] },
          { top: '#3a1a5a', trim: '#f2d450', hat: 'crown', gear: ['cape:#7a1f3a', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'knight', name: '중세사 동아리 기사', grade: 2, role: '탱커', cm: 185,
      hp: 1300, atk: 66, range: 18, speed: 0.3, interval: 96, anim: { hit: 16, total: 30 },
      cost: 430, cooldown: 310, kb: 2, abilities: [{ vs: 'metal', type: 'strong' }, { vs: 'ghost', type: 'tough' }],
      blurb: '야자 시간에도 갑옷은 벗지 않는다.',
      look: { hair: '#5a3b2b', style: 'short', top: '#6b7280', trim: '#c9a24a', pants: '#4a4f5a', prop: 'knight_sword', hat: 'knight_helm', wear: ['knight_shield', 'cape:#b23b32'] },
      evo: {
        name: '근위 기사', name2: '성기사단장',
        blurb: '방패에 교훈이 새겨졌다. 학교 교훈이다.', blurb2: '망토가 펄럭이면 복도가 성이 된다.',
        look: [
          { gear: ['epaulette'] },
          { top: '#c9d1d9', trim: '#f2d450', gear: ['epaulette2', 'halo', 'medal'] },
        ],
      },
    },
    {
      id: 'survival', name: '서바이벌게임부', grade: 2, role: '저격', cm: 172,
      hp: 420, atk: 92, range: 92, speed: 0.38, interval: 96, anim: { hit: 16, total: 30 },
      cost: 440, cooldown: 320, kb: 3, ranged: 'pellet', crit: 0.2, abilities: [{ vs: 'dark', type: 'massive' }],
      blurb: '얼굴에 칠한 건 위장이고 눈빛은 진심이다.',
      look: { hair: '#3a2a1f', style: 'short', top: '#5a6b3a', trim: '#3f4a2a', pants: '#4a5a35', prop: 'survival_gun', hat: 'survival_boonie', face: 'survival_paint', wear: ['survival_rig'] },
      evo: {
        name: '서바이벌 에이스', name2: '그림자 저격수',
        blurb: '복도 구석의 풀 덤불이 사실은 사람이다.', blurb2: '쏜 사람은 아무도 못 봤다. 맞은 쪽은 안다.',
        look: [
          { gear: ['scarf:#3f4a2a'] },
          { top: '#2a3a24', trim: '#e0b62c', gear: ['cape:#2a3a24', 'epaulette2', 'plate:#6b7280'] },
        ],
      },
    },
    {
      id: 'welder', name: '용접부', grade: 2, role: '근접', cm: 175,
      hp: 800, atk: 82, range: 20, speed: 0.36, interval: 88, anim: { hit: 15, total: 28 },
      cost: 420, cooldown: 300, kb: 2, abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'dark', type: 'strong' }],
      blurb: '용접 불꽃 앞에서는 철제 괴담도 녹는다.',
      look: { hair: '#2a2323', style: 'short', top: '#5a6270', trim: '#e0b62c', pants: '#3a3f4b', prop: 'welder_torch', hat: 'welder_mask', wear: ['apron:#7a4a24'] },
      evo: {
        name: '용접 기능사', name2: '철의 장인',
        blurb: '불꽃이 하얗게 달궈졌다. 철제가 먼저 사과한다.', blurb2: '무엇이든 이어 붙인다. 괴담의 발도 바닥에.',
        look: [
          { gear: ['scarf:#e0b62c'] },
          { top: '#2f3a4a', trim: '#e08a2e', gear: ['plate:#9aa3ad', 'epaulette2', 'cape:#4a3a28'] },
        ],
      },
    },
  ];

  YG.UNITS.push(...NEW);
})(globalThis);
