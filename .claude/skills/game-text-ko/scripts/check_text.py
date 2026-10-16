#!/usr/bin/env python3
"""게임 한국어 텍스트 점검기.

사용법:
  python3 check_text.py story.txt
  python3 check_text.py src/data/dialogue.json   # 코드/JSON이면 따옴표 속 한국어만 검사
  echo "문장들" | python3 check_text.py -

검사 항목: 같은 어미 3연속, 문장 길이 단조로움, 같은 첫 단어 반복, AI 상투어.
문제가 있으면 종료 코드 1.
"""
import re
import sys
from pathlib import Path

CODE_EXT = {".js", ".ts", ".jsx", ".tsx", ".json", ".py", ".gd", ".cs", ".lua", ".java", ".html", ".yaml", ".yml"}

BANNED = [
    "그러던 어느 날", "아주 먼 옛날", "모든 것이 평화로웠다", "평화는 오래가지 않았다",
    "운명", "전설의", "선택받은", "고대의 힘", "세상의 균형", "어둠이 드리", "빛과 어둠",
    "의 틈으로", "정적이 감돌", "고요가 내려앉", "숨을 삼켰", "심장이 쿵",
    "모든 것의 시작", "너에게 달렸", "이야기는 지금부터",
    "마지막 희망", "너도 알다시피", "너 하나 남았", "너뿐이",
    "것이 가능", "에 대한", "을 통해", "를 통해", "되어지",
    "강력한 힘", "신비로운", "기운이 느껴", "전설로 전해",
    "하실 수 있습니다", "해 주시기 바랍니다", "가 가능합니다",
]

HANGUL = re.compile(r"[가-힣]")


def extract_text(path: str) -> list[tuple[int, str]]:
    raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    lines = raw.splitlines()
    if path != "-" and Path(path).suffix.lower() in CODE_EXT:
        out = []
        for i, line in enumerate(lines, 1):
            for m in re.finditer(r"([\"'`])((?:\\.|(?!\1).)*)\1", line):
                if HANGUL.search(m.group(2)):
                    out.append((i, m.group(2).replace("\\n", " ")))
        return out
    return [(i, l) for i, l in enumerate(lines, 1) if HANGUL.search(l)]


def split_sentences(items):
    sents = []
    for lineno, text in items:
        text = re.sub(r"^[^:：]{1,10}[:：]\s*", "", text.strip())  # "할아버지: " 화자 표시 제거
        for s in re.split(r"(?<=[.!?…~])\s+|(?<=[.!?])(?=[가-힣\"'])", text):
            s = s.strip()
            if HANGUL.search(s):
                sents.append((lineno, s))
    return sents


def ending_class(s: str) -> str:
    core = re.sub(r"[^가-힣]+$", "", s)
    if not core:
        return ""
    last = core[-1]
    if last == "다" and len(core) >= 2:
        prev = core[-2]
        if (ord(prev) - 0xAC00) % 28 == 20:  # 받침 ㅆ → 었다/았다/했다
            return "-었다(과거)"
        return "-다"
    return "-" + core[-2:] if len(core) >= 2 else "-" + last


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sents = split_sentences(extract_text(sys.argv[1]))
    issues = []

    run, run_start = 1, 0
    for i in range(1, len(sents) + 1):
        same = i < len(sents) and ending_class(sents[i][1]) == ending_class(sents[i - 1][1]) != ""
        if same:
            run += 1
            continue
        if run >= 3:
            cls = ending_class(sents[i - 1][1])
            issues.append(f"{sents[run_start][0]}~{sents[i - 1][0]}행: '{cls}' 어미 {run}연속 → 어미·구조 섞기")
        run, run_start = 1, i

    for i in range(0, max(0, len(sents) - 4)):
        lens = [len(s) for _, s in sents[i:i + 5]]
        if min(lens) * 2 > max(lens):
            issues.append(f"{sents[i][0]}~{sents[i + 4][0]}행: 5문장 길이가 비슷함 ({min(lens)}~{max(lens)}자) → 짧은 문장 하나 넣기")
            break

    for i in range(1, len(sents)):
        a, b = sents[i - 1][1].split()[0], sents[i][1].split()[0]
        if a == b and len(a) >= 2 and HANGUL.search(a):
            issues.append(f"{sents[i][0]}행: '{a}'로 시작하는 문장 연속 → 주어·첫마디 바꾸기")

    for lineno, s in sents:
        for w in BANNED:
            if w in s:
                issues.append(f"{lineno}행: 상투어 '{w}' → \"{s}\"")

    if not sents:
        print("한국어 문장을 찾지 못했어요.")
        sys.exit(0)
    if issues:
        print(f"문장 {len(sents)}개 검사 / 걸린 곳 {len(issues)}개\n")
        print("\n".join("- " + x for x in issues))
        sys.exit(1)
    print(f"문장 {len(sents)}개 검사 / 문제 없음")


if __name__ == "__main__":
    main()
