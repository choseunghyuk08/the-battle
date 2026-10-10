(function (g) {
  const YG = g.YG;

  /* 새 동료 (이 파일 담당 에이전트만 고친다). 형식은 js/units3.js 와 같고, 아래 필드가 더 있다.
     cm: 현실 키(cm), evo: { name, blurb, name2, blurb2, look: [진화 외형, 각성 외형] } (js/evolutions.js 의 EVO 항목과 같은 형식),
     unlockStage: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 */
  const NEW = [
    /* ---- 2등급 (담당 D): 학교 밖에서 온 전문가와 동아리 ---- */
    {
      id: 'exorcist', name: '퇴마 동아리', grade: 2, role: '제어', cm: 172, fit: 0.98,
      hp: 540, atk: 67, range: 56, speed: 0.4, interval: 86, anim: { hit: 15, total: 28 },
      cost: 430, cooldown: 310, kb: 3, ranged: 'card', freeze: { chance: 0.35, frames: 70 },
      abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'ghost', type: 'tough' }],
      blurb: '부적이 떨어져서 포스트잇을 붙여 봤다. 먹혔다.',
      look: { hair: '#14121a', style: 'short', top: '#e8e4d6', trim: '#2b3a5c', pants: '#2b3a5c', prop: 'exorcist_bell', hat: 'exorcist_gat', wear: ['exorcist_dopo'] },
      evo: {
        name: '퇴마 부장', name2: '구마 도사',
        blurb: '방울을 흔들면 창밖의 귀신이 먼저 도망간다.', blurb2: '부적을 이제 복사기로 뽑는다. 효과는 똑같다.',
        look: [
          { gear: ['armband:#d9483b', 'epaulette'] },
          { top: '#f4efe0', trim: '#d9483b', gear: ['cape:#2b3a5c', 'epaulette2', 'medal', 'halo'] },
        ],
      },
    },
    {
      id: 'monk', name: '절 앞 스님', grade: 2, role: '탱커', cm: 175, fit: 0.98,
      hp: 1180, atk: 58, range: 18, speed: 0.3, interval: 96, anim: { hit: 17, total: 32 },
      cost: 430, cooldown: 310, kb: 2, survive: 0.3,
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'dark', type: 'tough' }],
      blurb: '나무아미타불. 그림자는 줄을 서세요.',
      look: { hair: '#4a463e', style: 'monk_shaved', top: '#8d8f8a', trim: '#d98a2b', pants: '#6f716c', prop: 'monk_staff', wear: ['monk_robe', 'monk_beads'] },
      evo: {
        name: '주지 스님', name2: '대선사',
        blurb: '염주 알이 하나 늘 때마다 맷집도 하나 늘었다.', blurb2: '화두 하나에 귀신이 깨달음을 얻고 하교한다.',
        look: [
          { gear: ['scarf:#d98a2b', 'epaulette'] },
          { top: '#e6e0d0', trim: '#c9a24a', gear: ['cape:#8a2f22', 'epaulette2', 'medal', 'halo'] },
        ],
      },
    },
    {
      id: 'priest', name: '성당 신부님', grade: 2, role: '광역', cm: 180, fit: 0.96,
      hp: 600, atk: 52, range: 56, speed: 0.4, interval: 84, anim: { hit: 14, total: 26 },
      cost: 420, cooldown: 300, kb: 3, area: true, ranged: 'wave',
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'strong' }],
      blurb: '성수는 그냥 수돗물이 아니다. 축복받은 수돗물이다.',
      look: { hair: '#5a4a3a', style: 'short', top: '#1c1a22', trim: '#efe9dc', pants: '#14121a', prop: 'priest_censer', face: 'glasses', wear: ['priest_cassock'] },
      evo: {
        name: '주임 신부', name2: '추기경',
        blurb: '향로를 크게 흔들자 복도에 향 냄새가 가득 찼다.', blurb2: '미사 한 번에 학교가 정화된다. 종도 같이 운다.',
        look: [
          { gear: ['scarf:#7a2e8a', 'epaulette'] },
          { top: '#8a1f2a', trim: '#f2d450', gear: ['cape:#8a1f2a', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'forensic', name: '과학수사부', grade: 2, role: '원거리', cm: 168, fit: 0.97,
      hp: 460, atk: 84, range: 76, speed: 0.4, interval: 82, anim: { hit: 14, total: 26 },
      cost: 430, cooldown: 300, kb: 3, ranged: 'flash', loot: 1.3,
      abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'specimen', type: 'tough' }],
      blurb: '지문이 없는 귀신도 발자국은 남긴다.',
      look: { hair: '#2a2220', style: 'short', top: '#e8eef2', trim: '#4a9ad0', pants: '#dfe6ea', prop: 'forensic_brush', hat: 'forensic_cap', face: 'forensic_mask', wear: ['forensic_gloves'] },
      evo: {
        name: '과학수사 팀장', name2: '법과학 박사',
        blurb: '증거 봉투가 서랍 한 칸을 가득 채웠다.', blurb2: '범인은 이 안에 있다. 대개 표본이다.',
        look: [
          { gear: ['armband:#4a9ad0', 'medal'] },
          { top: '#2a3a5a', trim: '#6fd0e8', gear: ['coat:#e8eef2', 'epaulette2', 'medal', 'halo'] },
        ],
      },
    },
    {
      id: 'hacker', name: '정보보안부', grade: 2, role: '제어', cm: 172, fit: 0.96,
      hp: 520, atk: 70, range: 60, speed: 0.4, interval: 84, anim: { hit: 14, total: 26 },
      cost: 440, cooldown: 320, kb: 3, ranged: 'bolt', freeze: { chance: 0.3, frames: 75 },
      abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'metal', type: 'tough' }],
      blurb: '귀신 방화벽은 3초. 학교 와이파이는 30분.',
      look: { hair: '#2a2a3a', style: 'short', top: '#2b2f3a', trim: '#6fd0e8', pants: '#1f2430', prop: 'hacker_laptop', hat: 'hacker_hood', face: 'hacker_visor', wear: ['hacker_hoodie'] },
      evo: {
        name: '화이트 해커', name2: '철벽 관제사',
        blurb: '노트북 스티커가 한 장 늘 때마다 방화벽이 한 겹 늘었다.', blurb2: '관제 화면의 붉은 점이 전부 사라졌다. 괴담도 같이.',
        look: [
          { gear: ['armband:#6fd0e8', 'scarf:#6fd0e8'] },
          { top: '#14121a', trim: '#6fd0e8', gear: ['cape:#14121a', 'epaulette2:#6fd0e8', 'wings:#6fd0e8', 'halo'] },
        ],
      },
    },
    {
      id: 'kungfu', name: '쿵푸부', grade: 2, role: '속공', cm: 170, fit: 0.96,
      hp: 470, atk: 46, range: 22, speed: 0.85, interval: 36, anim: { hit: 7, total: 14 },
      cost: 400, cooldown: 280, kb: 3, crit: 0.3,
      abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'ghost', type: 'strong' }],
      blurb: '아뵤! 소리가 나면 사물함이 먼저 찌그러진다.',
      look: { hair: '#14121a', style: 'short', top: '#1c1a22', trim: '#d9483b', pants: '#1c1a22', prop: 'kungfu_nunchaku', hat: 'kungfu_band', wear: ['kungfu_gi'] },
      evo: {
        name: '쿵푸 사범', name2: '무림 고수',
        blurb: '쌍절곤이 눈에 안 보인다. 본인 머리에도 안 맞는다.', blurb2: '한 번 휘두르면 바람 소리, 두 번 휘두르면 비명 소리.',
        look: [
          { gear: ['sash:#d9483b', 'epaulette'] },
          { top: '#14121a', trim: '#f2d450', gear: ['sash:#f2d450', 'cape:#d9483b', 'epaulette2', 'halo'] },
        ],
      },
    },
  ];

  YG.UNITS.push(...NEW);
})(globalThis);
