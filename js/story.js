(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 이야기 데이터. 대본과 같은 내용이다 (docs/story.md). 대사를 고치려면 이 파일만 바꾼다.
     줄은 [누가, 대사]. 누가 = narr(해설) | kid | grandpa | lord(군주) | lordv(군주의 목소리) | 동료 id */
  TG.STORY_WHO = {
    narr: { name: '', icon: null },
    kid: { name: '꼬마', icon: 'kid' },
    grandpa: { name: '할아버지', icon: 'grandpa' },
    lord: { name: '고요의 군주', icon: 'lord' },
    lordv: { name: '???', icon: 'lord' },
    monkey: { name: '바나나 원숭이', icon: 'monkey' },
    hippo: { name: '간호 하마', icon: 'hippo' },
    bear: { name: '곰 방패병', icon: 'bear' },
    dragon: { name: '아기 용', icon: 'dragon' },
    pig: { name: '황금 돼지', icon: 'pig' },
    mole: { name: '두더지 광부', icon: 'mole' },
  };

  /* 장면 목록. at = 그 스테이지에 처음 닿았을 때, 나머지는 core.js 가 정한 계기로 나온다 */
  TG.STORY = [
    { id: 'ch1', title: '1장 들판', at: 1, lines: [['narr', '모험은 슬라임 한 마리에서 시작된다.'], ['kid', '같은 걸 겹치면 더 세지는 것 같아. 끌어다 합쳐 보자.']] },
    { id: 'ch2', title: '2장 숲', at: 11, lines: [['narr', '나무 사이로 고요가 짙다. 바람도, 새소리도 멈춰 있다.'], ['kid', '조용해… 너무 조용해.']] },
    { id: 'ch3', title: '3장 동굴', at: 21, lines: [['narr', '수정이 희미하게 울린다. 누군가 이 아래에서 계속 두드리고 있다.']] },
    { id: 'ch4', title: '4장 화산', at: 31, lines: [['narr', '용암은 흐르는데 소리가 없다. 고요는 불도 멈추게 했다.']] },
    { id: 'ch5', title: '5장 빙하', at: 41, lines: [['narr', '고요가 가장 먼저 닿은 땅. 얼음 속에 얼어붙은 물건들이 빛난다.']] },
    { id: 'ch6', title: '6장 우주', at: 51, lines: [['narr', '땅이 끝나고 별이 시작된다. 멀리 침묵의 탑이 보인다.'], ['kid', '저기까지만 가면 돼.']] },
    { id: 'act2', title: '2막 메아리', at: 61, lines: [['narr', '탑에 닿았다고 생각한 순간, 길은 다시 들판으로 이어졌다.'], ['narr', '고요가 길을 접어 놓았다.'], ['kid', '처음부터 다시… 아니, 이번엔 내가 더 세.']] },
    { id: 'act3', title: '3막 목소리', at: 121, lines: [['lordv', '…왜 계속 던지지?'], ['kid', '멈추면 모두 멈추니까.']] },
    { id: 'act4', title: '4막 탑 아래', at: 181, lines: [['lordv', '던지는 건 지치는 일이다. 쉬어도 된다.'], ['kid', '쉬는 건 좋아. 하지만 멈추는 건 싫어.']] },
    {
      id: 'finale',
      title: '끝: 고요의 군주',
      at: 240,
      lines: [
        ['narr', '침묵의 탑 꼭대기. 회색 망토가 천천히 돌아본다.'],
        ['lord', '나는 처음 던진 손의 마지막 숨이다.'],
        ['lord', '너무 오래 던져서, 그저 쉬고 싶었다.'],
        ['kid', '그럼 같이 던지자.'],
        ['narr', '꼬마는 마지막 한 번을 던졌다. 고요가 걷히고, 허공에 멈췄던 것들이 일제히 떨어졌다.'],
        ['lord', '…고맙다. 이제는 네가 던져라.'],
        ['narr', '고요는 걷혔다. 하지만 세상은 넓고, 던질 것은 아직 많다.'],
        ['kid', '다음은 뭘 던지지?'],
      ],
    },
    {
      id: 'true_end',
      title: '진엔딩: 뭐든지',
      lines: [['narr', "'뭐든지'가 손에 쥐어졌다. 이름 없는 손이 처음 던졌던 바로 그것이다."], ['lordv', '…처음과 같구나.'], ['kid', '그럼 끝이 아니라, 처음이야.']],
    },
    { id: 'pet_monkey', title: '동료: 바나나 원숭이', lines: [['monkey', '우끼! 던지는 사람이다! 바나나 하나만 줘, 같이 가 줄게.'], ['kid', '…바나나는 없는데.'], ['monkey', '그럼 나중에 줘!']] },
    { id: 'pet_hippo', title: '동료: 간호 하마', lines: [['hippo', '다치셨네요. 간호는 제가 맡을게요.'], ['hippo', '던지는 건 못 해도, 낫게 하는 건 자신 있어요.']] },
    { id: 'pet_bear', title: '동료: 곰 방패병', lines: [['bear', '그 몸으로 탑까지 가겠다고? 앞은 내가 막는다.'], ['bear', '뒤는 네가 책임져라.']] },
    { id: 'pet_dragon', title: '동료: 아기 용', lines: [['narr', '용의 알이 흔들리더니 아기 용이 고개를 내밀었다.'], ['narr', '처음 본 꼬마를 어미로 아는 모양이다.'], ['dragon', '꾸우!']] },
    { id: 'pet_pig', title: '동료: 황금 돼지', lines: [['pig', '이 길의 동전은 전부 제 몫입니다만.'], ['pig', '같이 가면 더 많이 모일 것 같군요. 동행하겠습니다.']] },
    { id: 'pet_mole', title: '동료: 두더지 광부', lines: [['mole', '땅 밑에서 두드리는 소리 들었지? 그게 나야.'], ['mole', '탑까지 길을 파 줄게. 철광석은 덤이야.']] },
    { id: 'boss_1', title: '문지기 1', lines: [['narr', '첫 번째 문지기가 쓰러졌다. 들판에 바람이 한 줄기 불었다.']] },
    { id: 'boss_2', title: '문지기 2', lines: [['narr', '두 번째 문지기. 숲에서 새소리가 한 번 들렸다.']] },
    { id: 'boss_3', title: '문지기 3', lines: [['narr', '세 번째 문지기. 동굴 깊은 곳의 두드리는 소리가 멈추고, 누군가 웃었다.']] },
    { id: 'boss_4', title: '문지기 4', lines: [['narr', '네 번째 문지기. 용암이 소리 내어 흐르기 시작했다.']] },
    { id: 'boss_5', title: '문지기 5', lines: [['narr', '다섯 번째 문지기. 얼음 속 물건들이 녹아 제 주인을 찾아갔다.']] },
    { id: 'boss_6', title: '문지기 6', lines: [['narr', '여섯 번째 문지기. 오래 꺼져 있던 별 하나가 반짝였다.']] },
    { id: 'boss_7', title: '문지기 7', lines: [['narr', '일곱 번째 문지기. 메아리가 처음으로 되돌아왔다.']] },
    { id: 'boss_8', title: '문지기 8', lines: [['narr', '여덟 번째 문지기. 고요가 한 걸음 물러났다.']] },
    { id: 'boss_9', title: '문지기 9', lines: [['narr', '아홉 번째 문지기. 멈춰 있던 구름이 다시 흘렀다.']] },
    { id: 'boss_10', title: '문지기 10', lines: [['narr', '열 번째 문지기. 어디선가 누군가 물건을 던지는 소리가 났다.']] },
    { id: 'boss_11', title: '문지기 11', lines: [['narr', '열한 번째 문지기. 탑의 불빛이 한 번 흔들렸다.']] },
    { id: 'boss_12', title: '문지기 12', lines: [['narr', '열두 번째 문지기. 고요가 이쪽을 보고 있다.']] },
    { id: 'mine1', title: '광산', lines: [['narr', '곡괭이 소리가 메아리친다. 이 아래에 철광석이 잠들어 있다.']] },
    { id: 'chase1', title: '추격전', lines: [['narr', '폭주 거북이 질주한다. 고요가 가장 빨리 퍼지는 길이다.']] },
    { id: 'relic1', title: '유물', lines: [['narr', '낡은 상자에서 오래된 물건이 빛난다. 먼저 던지던 이들의 흔적이다.']] },
  ];
  TG.STORY_BY = Object.fromEntries(TG.STORY.map((b) => [b.id, b]));

  /* 프롤로그 만화: 위에서 아래로 내려 읽는 8컷. scene 은 js/comic.js 의 장면 이름 */
  TG.COMIC = [
    { scene: 'hand', h: 96, caps: [['narr', "아주 먼 옛날, 세상은 '던짐'에서 태어났다."], ['narr', '이름 없는 손이 별을 던져 밤하늘이 되었고, 산을 던져 땅이 되었다.'], ['narr', "마지막으로 던진 것의 이름은 '뭐든지'."]] },
    { scene: 'play', h: 84, caps: [['narr', '사람들은 던지며 살았다. 빨래도, 불씨도, 소식도.'], ['narr', '던진 것은 언제나 더 크게 돌아왔기 때문이다.']] },
    { scene: 'silence', h: 110, caps: [['narr', '그러던 어느 날, 고요가 내려앉았다.'], ['narr', '던진 것들이 허공에 멈췄다. 사람들은 던지는 법을 잊었다.']] },
    { scene: 'monsters', h: 84, caps: [['narr', '고요의 틈으로 몬스터가 기어 나왔다.'], ['narr', '던지지 못하는 사람들은 맞설 수 없었다.']] },
    { scene: 'gift', h: 96, caps: [['grandpa', '얘야, 이 연필을 가져가렴.'], ['grandpa', '던질 줄 아는 사람이 이제 너 하나 남았구나.']] },
    { scene: 'throw', h: 96, caps: [['kid', '…던지면, 되는 건가?'], ['narr', '연필은 빛을 내며 날았다. 던진 것은 더 크게 돌아온다.']] },
    { scene: 'leave', h: 84, caps: [['grandpa', '침묵의 탑에 닿으면 고요의 끝을 보게 될 게다.'], ['kid', '다녀올게요.']] },
    { scene: 'title', h: 110, title: '뭐든 던져', caps: [] },
  ];
})(globalThis);
