(function (g) {
  const YG = g.YG;

  const W = 320;
  const H = 180;
  const GY = 134;
  const CX = 160;
  const CY = 90;
  const SC = 3;

  /* 프레임 단위 타임라인. 진화는 짧게, 각성은 길게 간다 */
  const LINES = {
    1: { total: 104, charge: [10, 54], flashAt: 54, swapAt: 58, revealAt: 62, textAt: 66, loopAt: 84 },
    2: { total: 170, charge: [12, 90], flashAt: 90, swapAt: 96, revealAt: 102, textAt: 110, loopAt: 128 },
  };

  const COLORS = {
    1: { main: '#9fd8f0', light: '#e8fbff', deep: '#4a9ad0', ray: '232,251,255' },
    2: { main: '#f2d450', light: '#fff6c8', deep: '#d9483b', ray: '255,230,120' },
  };

  function rngOf(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function ring(ctx, cx, cy, rx, ry, color, dashed = 0, spin = 0) {
    ctx.fillStyle = color;
    const n = Math.max(24, Math.round(rx * 2.4));
    for (let i = 0; i < n; i++) {
      if (dashed && Math.floor(((i + spin) / n) * dashed * 2) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
  }

  function create(before, after, level) {
    const line = LINES[level];
    const col = COLORS[level];
    const rnd = rngOf(1000 + level * 77 + (after.name || '').length);
    const st = { f: 0, particles: [], bolts: [], rings: [], shake: 0, flash: 0, silent: false, done: false };

    const sfx = (name) => {
      if (!st.silent && YG.audio) YG.audio.sfx(name);
    };

    function spawnConverge() {
      const n = level === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 70 + rnd() * 60;
        st.particles.push({
          x: CX + Math.cos(a) * r * 1.4, y: CY + Math.sin(a) * r * 0.75, mode: 'in',
          size: rnd() < 0.3 ? 2 : 1, color: rnd() < 0.5 ? col.main : col.light, life: 60,
        });
      }
    }

    function burst() {
      const n = level === 2 ? 70 : 36;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const sp = 0.8 + rnd() * (level === 2 ? 3.4 : 2.2);
        st.particles.push({
          x: CX, y: CY, vx: Math.cos(a) * sp * 1.3, vy: Math.sin(a) * sp * 0.8 - 0.6, mode: 'out',
          size: rnd() < 0.25 ? 2 : 1, color: rnd() < 0.5 ? col.main : col.light, life: 36 + Math.floor(rnd() * 30),
        });
      }
    }

    function step() {
      const f = st.f;
      const [c0, c1] = line.charge;
      if (f === 0) sfx(level === 2 ? 'awakenCharge' : 'evoCharge');
      if (f >= c0 && f < c1) {
        spawnConverge();
        const every = level === 2 ? 11 : 15;
        if ((f - c0) % every === 0) {
          st.rings.push({ born: f, kind: 'in' });
          sfx('evoTick');
        }
        if (level === 2 && f > c0 + 40 && f % 3 === 0) {
          const a = rnd() * Math.PI * 2;
          const pts = [];
          let x = CX;
          let y = CY;
          for (let k = 0; k < 6; k++) {
            x += Math.cos(a + (rnd() - 0.5) * 0.9) * 16;
            y += Math.sin(a + (rnd() - 0.5) * 0.9) * 10;
            pts.push([Math.round(x), Math.round(y)]);
          }
          st.bolts.push({ born: f, pts });
        }
        st.shake = level === 2 ? Math.min(2, (f - c0) / 40) : (f - c0) / 80;
      }
      if (f === line.flashAt) sfx(level === 2 ? 'awakenBoom' : 'evoBoom');
      if (f === line.revealAt) {
        burst();
        st.rings.push({ born: f, kind: 'out' });
        if (level === 2) st.rings.push({ born: f + 6, kind: 'out' });
        st.shake = level === 2 ? 4 : 2;
      }
      if (f > line.revealAt) st.shake = Math.max(0, st.shake - 0.18);
      st.flash = f >= line.flashAt && f < line.revealAt ? (f - line.flashAt + 1) / (line.revealAt - line.flashAt) : f >= line.revealAt ? Math.max(0, 1 - (f - line.revealAt) / 22) : 0;
      for (const p of st.particles) {
        if (p.mode === 'in') {
          p.x += (CX - p.x) * 0.09;
          p.y += (CY - p.y) * 0.09;
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.07;
          p.vx *= 0.985;
        }
        p.life--;
      }
      st.particles = st.particles.filter((p) => p.life > 0 && (p.mode !== 'in' || Math.hypot(p.x - CX, p.y - CY) > 5));
      st.bolts = st.bolts.filter((b) => f - b.born < 4);
      st.f++;
      if (st.f >= line.total) st.done = true;
    }

    function draw(ctx) {
      const f = st.f;
      const shk = st.shake > 0.2 ? st.shake : 0;
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      if (shk) ctx.translate(Math.round((rnd() - 0.5) * 2 * shk), Math.round((rnd() - 0.5) * 2 * shk));
      ctx.fillStyle = '#05040a';
      ctx.fillRect(-4, -4, W + 8, H + 8);

      const lit = Math.min(1, f / 14);
      /* 바닥 */
      ctx.fillStyle = `rgba(30,26,46,${0.9 * lit})`;
      ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = `rgba(70,60,100,${0.6 * lit})`;
      ctx.fillRect(0, GY, W, 1);
      /* 스포트라이트 */
      const cone = (half, alpha) => {
        ctx.fillStyle = `rgba(${col.ray},${alpha * lit})`;
        ctx.beginPath();
        ctx.moveTo(CX - 8, 0);
        ctx.lineTo(CX + 8, 0);
        ctx.lineTo(CX + half, GY);
        ctx.lineTo(CX - half, GY);
        ctx.fill();
      };
      const revealed = f >= line.revealAt;
      if (!revealed || level === 1) {
        cone(78, 0.05);
        cone(54, 0.06);
        cone(32, 0.07);
      }

      /* 마법진 */
      const [c0, c1] = line.charge;
      const gather = f >= c0 ? Math.min(1, (f - c0) / (c1 - c0)) : 0;
      if (f >= c0 && f < line.revealAt + 40) {
        const k = revealed ? Math.max(0, 1 - (f - line.revealAt) / 40) : 0.35 + gather * 0.65;
        const spin = f * (level === 2 ? 1.6 : 1);
        ctx.globalAlpha = k;
        ring(ctx, CX, GY - 2, 54, 11, col.main, 12, spin);
        ring(ctx, CX, GY - 2, 40, 8, col.light, 8, -spin);
        if (level === 2) {
          ring(ctx, CX, GY - 2, 68, 14, col.deep, 18, spin * 0.6);
          ctx.fillStyle = col.main;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + spin * 0.02;
            ctx.fillRect(Math.round(CX + Math.cos(a) * 60), Math.round(GY - 2 + Math.sin(a) * 12), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      /* 파동 링 */
      for (const r of st.rings) {
        const age = f - r.born;
        if (age < 0 || age > 30) continue;
        const t = age / 30;
        ctx.globalAlpha = 1 - t;
        if (r.kind === 'in') ring(ctx, CX, CY + 20, 90 * (1 - t) + 10, 40 * (1 - t) + 4, col.light);
        else ring(ctx, CX, CY + 20, 10 + 190 * t, 6 + 90 * t, col.light);
        ctx.globalAlpha = 1;
      }

      /* 빛줄기 (공개 뒤) */
      if (revealed) {
        const age = f - line.revealAt;
        const n = level === 2 ? 22 : 14;
        const alpha = Math.max(0.07, 0.3 - age * 0.003);
        const grow = Math.min(1, age / 10);
        ctx.fillStyle = `rgba(${col.ray},${alpha})`;
        for (let k = 0; k < n; k += 2) {
          const a = (k / n) * Math.PI * 2 + f * 0.012;
          const w = 0.07;
          ctx.beginPath();
          ctx.moveTo(CX, CY);
          ctx.lineTo(CX + Math.cos(a - w) * 260 * grow, CY + Math.sin(a - w) * 260 * grow);
          ctx.lineTo(CX + Math.cos(a + w) * 260 * grow, CY + Math.sin(a + w) * 260 * grow);
          ctx.fill();
        }
      }

      /* 유닛 */
      const def = f < line.swapAt ? before : after;
      let key = 'idle0';
      if (f < line.swapAt) key = `idle${Math.floor(f / 7) % 4}`;
      else if (f >= line.loopAt) {
        const t = (f - line.loopAt) % 48;
        key = t < 30 ? `atk${Math.min(5, Math.floor(t / 5))}` : `idle${Math.floor(f / 7) % 4}`;
      } else key = `idle${Math.floor(f / 7) % 4}`;
      const hot = (f >= line.charge[1] - 12 && f < line.swapAt + 2) || (f >= line.revealAt && f < line.revealAt + 5);
      const mode = hot && f % 2 === 0 ? 'flash' : 'base';
      const img = YG.sprites.frame(def, key, mode);
      const lift = f >= c0 && f < line.flashAt ? Math.round(Math.min(1, gather * 1.6) * (level === 2 ? 10 : 4)) : 0;
      const pulse = f >= c0 && f < line.flashAt ? Math.round(Math.sin(f * 0.9) * gather * 2) : 0;
      const dx = f >= c0 && f < line.flashAt && level === 2 ? Math.round((rnd() - 0.5) * gather * 4) : 0;
      /* 그림자 */
      ctx.fillStyle = 'rgba(5,4,10,0.55)';
      ctx.fillRect(CX - 26 + lift / 2, GY - 1, 52 - lift, 3);
      const wide = SC * 48;
      const high = SC * 36;
      ctx.drawImage(img, CX - 20 * SC + dx - pulse, GY - 34 * SC - lift - pulse, wide + pulse * 2, high + pulse * 2);

      /* 번개 */
      for (const b of st.bolts) {
        ctx.fillStyle = col.light;
        for (let i = 0; i < b.pts.length - 1; i++) {
          const [x0, y0] = b.pts[i];
          const [x1, y1] = b.pts[i + 1];
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let s = 0; s <= steps; s += 1) ctx.fillRect(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 1, 1);
        }
      }

      /* 입자 */
      for (const p of st.particles) {
        ctx.globalAlpha = Math.min(1, p.life / 14);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* 위로 흐르는 속도선 (각성 충전) */
      if (level === 2 && f >= c0 && f < line.flashAt) {
        ctx.fillStyle = `rgba(${col.ray},${0.2 + gather * 0.3})`;
        for (let k = 0; k < 14; k++) {
          const x = (k * 53 + 11) % W;
          const y = (H - ((f * (6 + (k % 4)) + k * 37) % (H + 40))) | 0;
          ctx.fillRect(x, y, 1, 10 + (k % 3) * 6);
        }
      }

      /* 어두워지는 가장자리 (충전) */
      if (gather > 0 && !revealed) {
        ctx.fillStyle = `rgba(0,0,0,${0.35 * gather})`;
        ctx.fillRect(0, 0, W, 10);
        ctx.fillRect(0, H - 10, W, 10);
      }

      if (st.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, st.flash)})`;
        ctx.fillRect(-4, -4, W + 8, H + 8);
      }
      ctx.restore();
    }

    return { st, step, draw, line };
  }

  let dlg = null;
  let running = null;

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'cutscene';
    dlg.setAttribute('aria-label', '진화 연출');
    dlg.innerHTML = [
      '<div class="cs-stage">',
      '<canvas width="320" height="180"></canvas>',
      '<div class="cs-text" aria-live="polite">',
      '<span class="cs-label"></span><b class="cs-name"></b><p class="cs-blurb"></p><p class="cs-stat"></p>',
      '</div>',
      '<button class="btn small cs-skip" type="button">건너뛰기</button>',
      '</div>',
      '<div class="cs-actions"><button class="btn primary cs-ok" type="button" disabled>확인</button></div>',
    ].join('');
    document.body.append(dlg);
    return dlg;
  }

  const reduced = () => !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function stopRunning() {
    if (running) {
      cancelAnimationFrame(running.raf);
      running = null;
    }
  }

  /* 진화/각성 컷신. base: 유닛 정의, from/to: 진화 단계(0→1, 1→2) */
  function evolve(base, from, to, onDone) {
    if (!g.document || !YG.sprites) {
      if (onDone) onDone();
      return null;
    }
    stopRunning();
    const d = ensureDialog();
    const before = YG.resolveDef(base, from);
    const after = YG.resolveDef(base, to);
    const level = to >= 2 ? 2 : 1;
    const scene = create(before, after, level);
    const canvas = d.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const label = d.querySelector('.cs-label');
    const nameEl = d.querySelector('.cs-name');
    const blurb = d.querySelector('.cs-blurb');
    const stat = d.querySelector('.cs-stat');
    const ok = d.querySelector('.cs-ok');
    const skip = d.querySelector('.cs-skip');
    d.dataset.level = String(level);
    d.classList.remove('shown');
    label.textContent = level === 2 ? '각성' : '진화';
    nameEl.textContent = after.name;
    blurb.textContent = after.blurb;
    stat.textContent = level === 2 ? '체력 ×1.5 · 공격 ×1.4 · 재소환 ×0.9 (진화 대비)' : `체력 ×1.6 · 공격 ×1.5 · 재소환 ×0.9${(base.abilities || []).some((a) => a.type === 'strong') ? ' · 강하다 → 초데미지' : ''}`;
    ok.disabled = true;
    ok.textContent = '확인';
    d.classList.toggle('level2', level === 2);

    const finish = () => {
      stopRunning();
      d.close();
      if (onDone) onDone();
    };
    const fastForward = (target) => {
      scene.st.silent = true;
      while (scene.st.f < target) scene.step();
      scene.st.silent = false;
    };
    const showText = () => {
      d.classList.add('shown');
      ok.disabled = false;
      ok.focus();
    };
    ok.onclick = finish;
    skip.onclick = () => {
      if (scene.st.f < scene.line.textAt + 10) {
        fastForward(scene.line.textAt + 12);
        if (YG.audio) YG.audio.sfx(level === 2 ? 'awakenBoom' : 'evoBoom');
      }
      showText();
    };
    d.oncancel = (e) => {
      e.preventDefault();
      if (ok.disabled) skip.onclick();
      else finish();
    };

    d.showModal();
    if (reduced()) {
      fastForward(scene.line.textAt + 12);
      scene.draw(ctx);
      showText();
      running = null;
      return { skip: skip.onclick, close: finish };
    }
    let last = performance.now();
    let acc = 0;
    const tick = (now) => {
      acc += Math.min(100, now - last);
      last = now;
      const ms = 1000 / YG.FPS;
      while (acc >= ms) {
        acc -= ms;
        if (!scene.st.done) scene.step();
        if (scene.st.f >= scene.line.textAt && !d.classList.contains('shown')) showText();
      }
      /* 끝난 뒤에도 공격 모션을 계속 보여준다 */
      if (scene.st.done) {
        scene.st.f = scene.line.loopAt;
        scene.st.done = false;
      }
      scene.draw(ctx);
      running.raf = requestAnimationFrame(tick);
    };
    running = { raf: requestAnimationFrame(tick) };
    return { skip: skip.onclick, close: finish };
  }

  YG.cutscene = {
    evolve,
    timeline: (level) => ({ ...LINES[level === 2 ? 2 : 1] }),
    stop: stopRunning,
  };
})(globalThis);
