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

던진 건 더 크게 돌아오던 세상이 있었다. 어느 날부터 던진 것이 허공에 박혀 멈췄고, 사람들은 그 멈춤을 **고요**라고 부른다. 고요는 **처음 던진 손**의 마지막 숨이 만들었다. 너무 오래 던져서 잠깐 쉬었는데, 세상이 같이 쉬어 버렸다. 주인공은 할아버지가 쓰던 연필로 아직 던질 수 있고, 이유는 아무도 모른다.

이야기의 보상은 소리와 움직임이다. 고요가 물러날 때마다 바람, 새소리, 빨래 터는 소리가 하나씩 돌아온다.

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
${rows(pick(['mine1', 'chase1', 'relic1', 'true_end']))}

## 구현 메모

- 장면은 한 번만 나온다 (저장에 기록). 임무 탭의 "이야기" 칸에서 다시 볼 수 있다.
- 이야기 전부터 하던 저장은 이미 지난 장면을 조용히 본 것으로 친다. 프롤로그 만화를 보기 전에는 대사가 나오지 않는다.
- 설정에서 대사를 끌 수 있다.
`;
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'story.md'), out);
console.log('docs/story.md 를 다시 만들었다');
