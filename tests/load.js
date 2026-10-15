/* node 에서 게임 스크립트를 index.html 과 같은 순서로 불러온다 */
const fs = require('fs');
const path = require('path');

function scripts() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
}

function loadAll() {
  if (!globalThis.TG || !globalThis.TG.loaded) {
    for (const s of scripts()) require(path.join(__dirname, '..', s));
    globalThis.TG.loaded = true;
  }
  return globalThis.TG;
}

module.exports = { loadAll, scripts };
