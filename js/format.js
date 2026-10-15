(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 한국식 큰 수 단위. 일반 숫자(double)는 10의 300제곱까지 가서 이 게임엔 충분하다 */
  const UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정'];

  TG.fmt = (n) => {
    if (!Number.isFinite(n)) return '∞';
    n = Math.floor(n);
    if (n < 10000) return String(n);
    let k = 0;
    let v = n;
    while (v >= 10000 && k < UNITS.length - 1) {
      v /= 10000;
      k++;
    }
    if (v >= 10000) return n.toExponential(2).replace('+', '');
    const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return (s.includes('.') ? s.replace(/\.?0+$/, '') : s) + UNITS[k];
  };

  /* 시간 표시: 75 -> 1분 15초 */
  TG.fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return `${h}시간 ${m}분`;
    if (m) return `${m}분 ${s}초`;
    return `${s}초`;
  };
})(globalThis);
