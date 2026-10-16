(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 이야기 데이터. 대본은 docs/story.md 와 같다. 글을 고칠 때는 docs/tone.md 와
     .claude/skills/game-text-ko 규칙을 지키고, check_text.py 로 점검한다.
     줄은 [누가, 대사]. 누가 = narr(해설) | tip(힌트) | kid | grandpa | lord(군주) | lordv(군주의 목소리) | 동료 id */
  TG.STORY_WHO = {
    narr: { name: '', icon: null },
    tip: { name: '힌트', icon: null },
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
    {
      id: 'ch1',
      title: '1장 들판',
      at: 1,
      lines: [['narr', '연필 한 자루가 전 재산이다.'], ['tip', '[만들기]를 눌러 물건을 받아요.'], ['tip', '같은 물건 둘을 끌어서 겹쳐 봐요.']],
    },
    { id: 'ch2', title: '2장 숲', at: 7, lines: [['narr', '숲에 들어서니 새소리가 없다. 떨어지던 나뭇잎 하나가 허공에 매달려 있다.'], ['kid', '…조용하다.']] },
    { id: 'ch3', title: '3장 동굴', at: 12, lines: [['narr', '저 아래서 쇠 두드리는 소리가 난다. 박자가 일정하다. 누가 계속 파고 있다.']] },
    { id: 'ch4', title: '4장 화산', at: 17, lines: [['narr', '용암은 흐르는데 소리가 없다. 터지다 만 거품 하나가 그대로 굳어 있다.']] },
    { id: 'ch5', title: '5장 빙하', at: 23, lines: [['narr', '얼음 속에 창이 박혀 있다. 던진 사람의 손 모양까지 그대로.']] },
    { id: 'ch6', title: '6장 우주', at: 28, lines: [['narr', '발밑이 끝나고 별이 시작된다. 멀리 탑 꼭대기에 푸른 불 하나.'], ['kid', '…저기네.']] },
    { id: 'ch7', title: '7장 사막', at: 33, lines: [['narr', '모래 언덕이 흘러내리다 말고 비스듬히 서 있다. 발자국이 하나 더 있다. 꼬마 것이 아니다.']] },
    { id: 'ch8', title: '8장 늪', at: 39, lines: [['narr', '늪 거품이 올라오다 만 채 떠 있다. 개구리 한 마리가 뛰는 모양 그대로 굳었다.']] },
    { id: 'ch9', title: '9장 바다 속', at: 44, lines: [['narr', '물이 어느 쪽으로도 흐르지 않는다. 물고기 떼가 방향을 틀다 멈췄다.'], ['kid', '…숨은 되네.']] },
    { id: 'ch10', title: '10장 하늘섬', at: 49, lines: [['narr', '구름이 발밑에 있다. 번개가 치다 만 자리에 빛줄기 하나가 가만히 걸려 있다.']] },
    { id: 'ch11', title: '11장 고철 공장', at: 55, lines: [['narr', '톱니가 맞물린 채 서 있다. 증기 한 줄기가 허공에서 하얗게 식었다.'], ['kid', '…누가 끄고 갔나.']] },
    { id: 'ch12', title: '12장 심연', at: 60, lines: [['narr', '소리가 없는 게 아니라 먹히는 곳이다. 던진 것이 멀리 가기도 전에 사라진다.'], ['kid', '…그래도 던져야지.']] },
    { id: 'act2', title: '2막 접힌 길 (페이즈 2)', at: 65, lines: [['narr', '탑 앞에 다 온 줄 알았는데 들판이다. 길이 접혀 있었다.'], ['kid', '저 슬라임, 아까 걔잖아. 좀 크다?']] },
    { id: 'act3', title: '3막 목소리 (페이즈 3)', at: 129, lines: [['lordv', '…왜 계속 던지지.'], ['kid', '몰라요. 그냥 손이 가요.']] },
    { id: 'act4', title: '4막 탑 아래 (페이즈 4)', at: 257, lines: [['lordv', '지치지도 않나. 쉬어도 되는데.'], ['kid', '쉬는 중인데요. 던지면서.']] },
    {
      id: 'finale',
      title: '끝: 고요의 군주',
      at: 513,
      lines: [
        ['narr', '탑 꼭대기에 회색 망토가 서 있다. 돌아보지는 않는다.'],
        ['lord', '…왔나.'],
        ['lord', '처음 던진 손이 있었지. 던지다 지쳐서 잠깐 쉬었네.'],
        ['lord', '그랬더니 세상이 같이 쉬더군.'],
        ['kid', '…그럼 같이 던져요. 쉬엄쉬엄.'],
        ['narr', '마지막 한 번을 던지자 허공에 박혀 있던 것들이 떨어졌다.'],
        ['narr', '돌멩이, 화살, 팽이까지.'],
        ['lord', '…시끄럽군.'],
        ['lord', '오랜만이야, 이런 소리.'],
        ['narr', '탑 아래서 누가 소리를 지른다. 팽이 구르는 소리가 뒤따른다.'],
        ['kid', '…배고픈데.'],
      ],
    },
    {
      id: 'true_end',
      title: '진엔딩: 뭐든지',
      lines: [['narr', '손에 쥔 건 이름 없는 물건이었다. 처음 던진 손이 마지막으로 던졌다던 바로 그것.'], ['lordv', '…그걸 어디서 났나.'], ['kid', '던지다 보니 생겼어요.']],
    },
    { id: 'pet_monkey', title: '동료 합류: 원숭이', lines: [['monkey', '바나나 있어? 없으면 외상으로 따라갈게.'], ['kid', '…외상은 안 되는데.'], ['monkey', '우끼! 그럼 일단 가고 생각하자!']] },
    { id: 'pet_hippo', title: '동료 합류: 하마', lines: [['hippo', '잠깐만요, 무릎이 까졌어요.'], ['hippo', '던지는 건 못 해요. 대신 안 아프게는 해 드릴게요.']] },
    { id: 'pet_bear', title: '동료 합류: 곰', lines: [['bear', '그 몸으로 가겠다고.'], ['bear', '…뒤에 서. 앞은 내가 선다.']] },
    { id: 'pet_dragon', title: '동료 합류: 아기 용', lines: [['narr', '알이 흔들리더니 금이 갔다. 나온 놈이 제일 먼저 본 건 꼬마 얼굴이었다.'], ['dragon', '꾸우!']] },
    { id: 'pet_pig', title: '동료 합류: 돼지', lines: [['pig', '이 길에 떨어진 동전은 다 제 몫입니다만.'], ['pig', '같이 가는 편이 더 줍겠군요. 계산이 섰습니다.']] },
    { id: 'pet_mole', title: '동료 합류: 두더지', lines: [['mole', '밑에서 두드린 게 나야. 소리 들었지?'], ['mole', '탑까지 길은 뚫어 줄게. 철광석은 덤이야.']] },
    { id: 'boss_1', title: '문지기 1', lines: [['narr', '풀이 바람에 눕는다. 이 들판에 바람이 분 건 몇 해 만이다.']] },
    { id: 'boss_2', title: '문지기 2', lines: [['narr', '새 한 마리가 운다. 딱 한 번.']] },
    { id: 'boss_3', title: '문지기 3', lines: [['narr', '동굴 안쪽에서 누가 웃는다. 웃다가 기침한다.']] },
    { id: 'boss_4', title: '문지기 4', lines: [['narr', '용암이 보글보글 소리를 내며 흐른다.']] },
    { id: 'boss_5', title: '문지기 5', lines: [['narr', '얼음이 녹아 물방울이 떨어진다. 박혀 있던 창도 땅에 툭.']] },
    { id: 'boss_6', title: '문지기 6', lines: [['narr', '별 하나가 깜빡였다. 깜빡이지 않은 지 오래된 별이다.']] },
    { id: 'boss_7', title: '문지기 7', lines: [['narr', '아까 던진 소리가 되돌아온다. 메아리다.']] },
    { id: 'boss_8', title: '문지기 8', lines: [['narr', '멈춰 있던 구름이 한 뼘 움직인다.']] },
    { id: 'boss_9', title: '문지기 9', lines: [['narr', '먼 마을에서 빨래 터는 소리가 난다.']] },
    { id: 'boss_10', title: '문지기 10', lines: [['narr', '어디선가 누가 물건을 던졌다. 우리가 아닌 누군가가.']] },
    { id: 'boss_11', title: '문지기 11', lines: [['narr', '탑 꼭대기의 푸른 불이 한 번 흔들린다.']] },
    { id: 'boss_12', title: '문지기 12', lines: [['narr', '탑에서 이쪽을 내려다보는 기분이 든다.']] },
    { id: 'mine1', title: '광산', lines: [['narr', '곡괭이 소리가 아래서 올라온다. 철광석 냄새도.']] },
    { id: 'chase1', title: '추격전', lines: [['narr', '거북이 제트를 달고 도망친다. 그게 된다는 건 처음 알았다.']] },
    { id: 'relic1', title: '유물', lines: [['narr', '상자에서 손때 묻은 물건이 나온다. 먼저 던지던 사람들이 남긴 것.']] },
  ];
  TG.STORY_BY = Object.fromEntries(TG.STORY.map((b) => [b.id, b]));

  /* 프롤로그 만화: 위에서 아래로 내려 읽는 8컷. scene 은 js/comic.js 의 장면 이름 */
  TG.COMIC = [
    { scene: 'hand', h: 96, caps: [['narr', '세상에서 제일 처음 한 일이 던지기였다고 한다.'], ['narr', '별을 던지니 하늘이 되고, 산을 던지니 땅이 됐다.'], ['narr', "마지막 한 번은 이름이 없어서, 다들 그냥 '뭐든지'라고 부른다."]] },
    { scene: 'play', h: 84, caps: [['narr', '여기선 뭐든 던져서 해결했다. 빨래도, 소식도, 불씨도.'], ['narr', '던진 건 꼭 더 크게 돌아왔으니까.']] },
    { scene: 'silence', h: 110, caps: [['narr', '보리를 베던 날, 누가 던진 돌멩이가 허공에 그대로 박혔다.'], ['narr', '화살도, 공도, 아이들 팽이까지.']] },
    { scene: 'monsters', h: 84, caps: [['narr', '몇 해 지나자 창고마다 활이 먼지를 먹었다.'], ['narr', '그리고 들판 끝에서 그것들이 올라온다.']] },
    { scene: 'gift', h: 96, caps: [['grandpa', '이거 받아라.'], ['grandpa', '…내가 쓰던 거야. 손에 쥐면 아직 날아가더라고.']] },
    { scene: 'throw', h: 96, caps: [['kid', '…날아가네.']] },
    { scene: 'leave', h: 84, caps: [['grandpa', '저 탑 쪽이다. …다 저기서 멈췄으니까.'], ['kid', '다녀올게요.']] },
    { scene: 'title', h: 110, title: '뭐든 던져', caps: [] },
  ];
})(globalThis);
