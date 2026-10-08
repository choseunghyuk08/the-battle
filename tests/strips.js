/* 프레임을 한 줄로 늘어놓은 그림을 만든다. 도트 작업 확인용.
   node tests/strips.js <id,id,...> [배율=2] [출력이름=strips] [줄=idle,walk,atk,hurt]
   id: 적은 e:rat, 동료는 basic 또는 basic@2(각성). 결과는 tests/out/<출력이름>.png */
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const OUT = path.join(__dirname, 'out') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const ids = (process.argv[2] || 'basic,rat').split(',');
const zoom = Number(process.argv[3] || 2);
const name = process.argv[4] || 'strips';
const only = (process.argv[5] || 'idle,walk,atk,hurt').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1900, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(([ids, zoom, only]) => {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#1d1b24;color:#ddd;font:11px sans-serif';
    const K = YG.sprites.K;
    const rows = [['idle', YG.POSE_COUNT.idle], ['walk', YG.POSE_COUNT.walk], ['atk', YG.POSE_COUNT.atk], ['hurt', YG.POSE_COUNT.hurt]].filter((r) => only.includes(r[0]));
    for (const id of ids) {
      const def = YG.unitById(id.replace(/^e:/, '')) && !id.startsWith('e:') ? YG.unitById(id) : YG.enemyById(id.replace(/^e:/, ''));
      const lvlMatch = id.match(/^(\w+)@(\d)$/);
      let d = def;
      if (lvlMatch) d = YG.resolveDef(YG.unitById(lvlMatch[1]), Number(lvlMatch[2]));
      // cell size from union of all frames
      let up = 0, down = 0, left = 0, right = 0;
      for (const k of YG.FRAME_KEYS) { const f = YG.sprites.frame(d, k); up = Math.max(up, f.ay); down = Math.max(down, f.height - f.ay); left = Math.max(left, f.ax); right = Math.max(right, f.width - f.ax); }
      const cw = Math.ceil((left + right) / K * zoom) + 6, ch = Math.ceil((up + down) / K * zoom) + 6;
      const wrap = document.createElement('div');
      const h = document.createElement('div'); h.textContent = `${id}  ${d.name}  fit ${d.fit}`; h.style.margin = '4px'; wrap.appendChild(h);
      for (const [kind, n] of rows) {
        const cv = document.createElement('canvas');
        cv.width = cw * n; cv.height = ch;
        const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#2b2733'; ctx.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < n; i++) {
          const f = YG.sprites.frame(d, `${kind}${i}`);
          const bx = i * cw + 3 + left / K * zoom, by = 3 + up / K * zoom;
          ctx.fillStyle = '#3d3948'; ctx.fillRect(i * cw + 3, by, cw - 6, 1);
          ctx.drawImage(f, bx - f.ax / K * zoom, by - f.ay / K * zoom, f.width / K * zoom, f.height / K * zoom);
          ctx.fillStyle = '#9aa'; ctx.fillText(String(i), i * cw + 4, 10);
        }
        cv.style.display = 'block'; cv.style.marginBottom = '2px';
        wrap.appendChild(cv);
      }
      document.body.appendChild(wrap);
    }
  }, [ids, zoom, only]);
  const h = await page.evaluate(() => document.body.scrollHeight);
  const w = await page.evaluate(() => Math.max(...[...document.querySelectorAll('canvas')].map((c) => c.width)));
  await page.setViewportSize({ width: Math.min(w + 20, 4000), height: Math.min(h + 20, 5000) });
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
  console.log(errs.join('\n') || 'no errors', w, h);
  await browser.close();
})();
