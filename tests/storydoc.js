/* docs/story.md 의 대본 표를 js/story.js 에서 뽑아 다시 쓴다.  node tests/storydoc.js */
const fs = require('fs');
const path = require('path');
const TG = require('./load.js').loadAll();

const who = (k) => TG.STORY_WHO[k].name || '해설';
const line = ([k, t]) => `${who(k)}: ${t}`;
const rows = (list) => list.map((b) => `| ${b.title} | ${b.at ? `스테이지 ${b.at}` : ''} | ${b.lines.map(line).join(' / ')} |`).join('\n');
const pick = (ids) => ids.map((id) => TG.STORY_BY[id]);
const ids = (re) => TG.STORY.filter((b) => re.test(b.id));

const out = `# 뭐든 던져: 이야기

이 문서의 **대본 표는 \`js/story.js\` 에서 자동으로 만든다** (\`node tests/storydoc.js\`). 대사를 고칠 때는 story.js 를 고치고 이 문서를 다시 만든다.
글을 쓸 때의 규칙, 말투, 용어는 [tone.md](tone.md) 와 [game-text-ko 스킬](../.claude/skills/game-text-ko/SKILL.md) 을 따른다.

## 세계관

던지면 도착하는 세상이다. 처음 던진 손이 별과 산을 던져 하늘과 땅을 만들었고, 그 뒤로 세상의 우체부가 됐다. 어느 날 탑 꼭대기에서 "오분만 쉴게"라고 한 순간 던진 것이 전부 허공에 멈췄고, 이 멈춤이 **고요**다. 오분은 백 년이 됐다. 그가 지금의 **고요의 군주**다. 악당이 아니라 일어나기 겁난 사람이다. 일어나면 밀린 백 년 치 편지를 혼자 던져야 한다.

몬스터는 못 던진 편지, 화살, 팽이가 뭉친 것이다. 문지기를 이길 때마다 갇힌 소리(바람, 새소리, 빨래 터는 소리)가 하나씩 돌아온다. 주인공은 군주의 옛 동료인 할아버지의 연필로 던진다. 목표는 할아버지의 편지(「같이 하자. 반씩.」)를 탑 꼭대기까지 전하는 것이다.

엔딩 뒤에는 군주가 일어나 느릿하게 탑을 계속 올리고(끝없는 탑), 못 다닌 배달길을 부탁하고(원정), 앉아 있던 동안 굳은 졸음이 사파이어가 된다. 12번째 땅 너머의 접힌 길은 두 바퀴째 배달이다. 자세한 사실은 [tone.md](tone.md)의 세계관 9항이 기준이다.

## 프롤로그 만화 (처음 켤 때, 세로로 내려 읽는 8컷)

| 컷 | 장면 | 글 |
|---|---|---|
${TG.COMIC.map((p, i) => `| ${i + 1} | ${p.scene} | ${p.caps.length ? p.caps.map(line).join(' / ') : `제목 "${p.title}"`} |`).join('\n')}

## 땅과 막 (스테이지에 처음 닿을 때)

| 제목 | 시작 | 글 |
|---|---|---|
${rows(TG.STORY.filter((b) => b.at))}

## 동료 합류 (처음 데려올 때)

| 제목 | | 글 |
|---|---|---|
${rows(ids(/^pet_/))}

## 문지기를 이겼을 때 (1~12번)

| 제목 | | 글 |
|---|---|---|
${rows(ids(/^boss_/))}

## 작은 장면과 끝

| 제목 | | 글 |
|---|---|---|
${rows(pick(['mine1', 'chase1', 'relic1', 'tower1', 'trip1', 'sapphire1', 'echo1', 'true_end']))}

## 세계 이야기 (코덱스)

대사가 하지 않는 설명은 임무 탭 "이야기"의 코덱스에 쉬운 말로 쓴다. 열리는 때는 \`js/story.js\` 의 \`TG.CODEX\`.

| 제목 | 글 |
|---|---|
${TG.CODEX.map((c) => `| ${c.title} | ${c.text} |`).join('\n')}

## 구현 메모

- 장면은 한 번만 나온다 (저장에 기록). 임무 탭의 "이야기" 칸에서 다시 볼 수 있다.
- 이야기 전부터 하던 저장은 이미 지난 장면을 조용히 본 것으로 친다. 프롤로그 만화를 보기 전에는 대사가 나오지 않는다.
- 설정에서 대사를 끌 수 있다.
`;
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'story.md'), out);
console.log('docs/story.md 를 다시 만들었다');
