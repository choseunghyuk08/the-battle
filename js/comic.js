(function (g) {
  const TG = g.TG;
  const W = 200;

  /* 프롤로그 만화. 컷마다 작은 캔버스(200 x h 점)에 이미 있는 그림을 겹쳐 그리고, 대사는 글자로 얹는다.
     그림이 아직 없으면 (spr_story.js) 모양만 비슷한 상자로 대신한다. 위에서 아래로 내려 읽는 세로 만화다 */
  const palOf = (def, i) => {
    const pals = def.palettes || [def.palette || {}];
    return { pal: pals[i % pals.length], key: `p${i % pals.length}` };
  };
  const def = (kind, name) => (TG.SPR[kind] && TG.SPR[kind][name]) || null;

  /* 그림 한 장 (땅 기준점에 맞춰). opt: pal, fps, prog(0..1 이면 한 번 하는 동작), scale, flip, alpha */
  function spr(ctx, kind, name, clip, t, x, y, opt = {}) {
    const d = def(kind, name);
    if (!d) return false;
    const cn = d.clips[clip] ? clip : Object.keys(d.clips)[0];
    const { pal, key } = palOf(d, opt.pal || 0);
    const c = TG.clip(d, cn, pal, 1, key);
    let i;
    if (opt.prog !== undefined) i = Math.min(c.n - 1, Math.max(0, Math.floor(opt.prog * c.n)));
    else i = ((Math.floor(t * (opt.fps || 8)) % c.n) + c.n) % c.n;
    const s = opt.scale || 1;
    ctx.save();
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (opt.flip) ctx.scale(-1, 1);
    ctx.drawImage(c.frames[i].canvas, Math.round(-c.ax * s), Math.round(-c.ay * s), Math.round(c.w * s), Math.round(c.h * s));
    ctx.restore();
    return true;
  }
  function itemImg(ctx, tier, x, y, scale = 1, rot = 0, alpha = 1) {
    const d = TG.itemDef(tier);
    const c = TG.clip(d, 'icon', d.palettes ? d.palettes[0] : {}, 1, 'p0');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    ctx.drawImage(c.frames[0].canvas, -c.ax * scale, -c.ay * scale, c.w * scale, c.h * scale);
    ctx.restore();
  }
  function glow(ctx, x, y, r, color, a = 0.5) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color.replace('A', String(a)));
    gr.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function tint(ctx, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, h);
  }
  /* 배경: 하늘, 먼 풍경, 가까운 풍경, 움직이는 겹. 땅 윗면이 y = 100 이 되게 아래에 맞춘다 */
  function bg(ctx, id, h, scroll = 0, t = 0) {
    const d = def('bg', id);
    ctx.save();
    ctx.translate(0, h - 120);
    if (!d) {
      ctx.fillStyle = '#10142a';
      ctx.fillRect(0, 0, W, 120);
      ctx.restore();
      return;
    }
    const pals = d.palettes || [{}];
    const layer = (clip, speed, fps) => {
      if (!d.clips[clip]) return;
      const c = TG.clip(d, clip, pals[0], 1, 'p0');
      const fr = c.frames[fps ? ((Math.floor(t * fps) % c.n) + c.n) % c.n : 0];
      const off = -Math.round((scroll * speed) % W);
      ctx.drawImage(fr.canvas, off, 0);
      ctx.drawImage(fr.canvas, off + W, 0);
    };
    layer('sky', 0);
    layer('far', 0.3);
    layer('near', 1);
    layer('anim', 0, 6);
    ctx.restore();
  }
  const GY = (h) => h - 20; /* 땅 윗면이 canvas 에서 놓이는 y */

  const SCENES = {
    /* 1. 이름 없는 손이 별을 던진다 */
    hand(ctx, t, h) {
      bg(ctx, 'space', h, t * 2, t);
      const k = t % 9;
      const hx = 52;
      const hy = h * 0.55;
      glow(ctx, hx, hy, 50, 'rgba(255,220,140,A)', 0.25);
      if (!spr(ctx, 'story', 'hand', 'throw', 0, hx, hy, { prog: Math.min(0.999, (k % 3) / 2.2), scale: 1.2 })) {
        ctx.fillStyle = 'rgba(255,224,150,0.5)';
        ctx.fillRect(hx - 22, hy - 16, 44, 32);
      }
      const fly = (tier, start, tx, ty, sc) => {
        if (k < start) return;
        const p = Math.min(1, (k - start) / 1.4);
        const e = 1 - (1 - p) * (1 - p);
        const x = hx + 18 + (tx - hx - 18) * e;
        const y = hy - 6 + (ty - hy + 6) * e - Math.sin(p * Math.PI) * 14;
        glow(ctx, x, y, 14 * sc, 'rgba(255,240,180,A)', 0.3 * p);
        itemImg(ctx, tier, x, y, sc * (0.6 + 0.4 * e), p * 6, 1);
      };
      fly(17, 0.2, 120, h * 0.28, 1.1);
      fly(18, 3.2, 160, h * 0.62, 1.7);
      fly(19, 3.8, 170, h * 0.2, 1.3);
      if (k > 6) {
        const p = Math.min(1, (k - 6) / 1.5);
        glow(ctx, 100, h * 0.5, 60 * p, 'rgba(255,255,255,A)', 0.35 * p);
        itemImg(ctx, 60, 100, h * 0.5 + Math.sin(t * 2) * 2, 2.6 * (0.5 + 0.5 * p), t * 0.5, p);
      }
    },
    /* 2. 평화로운 들판: 던진 것은 더 크게 돌아온다 */
    play(ctx, t, h) {
      bg(ctx, 'field', h, t * 4, t);
      tint(ctx, h, 'rgba(255,214,150,0.08)');
      spr(ctx, 'hero', 'main', 'idle', t, 38, GY(h), { fps: 6 });
      [[4, 0], [6, 0.36], [9, 0.7]].forEach(([tier, off]) => {
        const p = (t * 0.28 + off) % 1;
        const x = 50 + p * 170;
        const y = GY(h) - 30 - Math.sin(p * Math.PI) * 40;
        itemImg(ctx, tier, x, y, 0.7 + p * 0.9, p * 14, 1);
      });
    },
    /* 3. 고요가 내려앉았다 */
    silence(ctx, t, h) {
      bg(ctx, 'forest', h, 0, t);
      tint(ctx, h, 'rgba(90,100,130,0.62)');
      if (!spr(ctx, 'story', 'tower', 'idle', t, 150, GY(h) + 2, { fps: 6 })) {
        ctx.fillStyle = '#3a3a52';
        ctx.fillRect(140, 8, 20, GY(h) - 6);
        ctx.fillStyle = '#9fd8ff';
        ctx.fillRect(148, 6, 4, 4);
      }
      [34, 70, 104].forEach((x, i) => {
        if (!spr(ctx, 'story', 'frozen', 'idle', t + i, x, GY(h), { fps: 3 })) {
          ctx.fillStyle = '#8a92a8';
          ctx.fillRect(x - 5, GY(h) - 22, 10, 22);
        }
        itemImg(ctx, [3, 8, 2][i], x + 10, GY(h) - 34 - i * 4, 0.9, 0.6 * (i + 1), 0.85);
      });
      if (!spr(ctx, 'fx', 'silence', 'loop', t, 0, 0, { fps: 5 }) && !spr(ctx, 'story', 'silence', 'loop', t, 0, 0, { fps: 5 })) tint(ctx, h, 'rgba(120,130,160,0.2)');
    },
    /* 4. 몬스터가 기어 나온다 */
    monsters(ctx, t, h) {
      bg(ctx, 'field', h, 0, t);
      tint(ctx, h, 'rgba(80,90,120,0.4)');
      [['slime', 0], ['mushroom', 28], ['bee', 54]].forEach(([kind, off], i) => {
        const x = 205 - ((t * 11 + off * 1.4) % 110) - i * 6;
        const s = kind === 'bee' ? 0 : 0;
        spr(ctx, 'mob', kind, 'walk', t + i, x, GY(h) - (kind === 'bee' ? 14 : s), { fps: 9 });
      });
      [26, 52].forEach((x, i) => {
        if (!spr(ctx, 'story', 'frozen', 'idle', t + i, x, GY(h), { fps: 3 })) {
          ctx.fillStyle = '#8a92a8';
          ctx.fillRect(x - 5, GY(h) - 22, 10, 22);
        }
      });
    },
    /* 5. 할아버지가 연필을 건넨다 */
    gift(ctx, t, h) {
      bg(ctx, 'forest', h, 0, t);
      tint(ctx, h, 'rgba(255,170,90,0.12)');
      const k = (t % 6) / 6;
      if (!spr(ctx, 'story', 'grandpa', 'give', 0, 64, GY(h), { prog: Math.min(0.999, k * 1.6) })) {
        ctx.fillStyle = '#b08a60';
        ctx.fillRect(58, GY(h) - 26, 12, 26);
      }
      spr(ctx, 'hero', 'main', 'idle', t, 126, GY(h), { fps: 6 });
      const p = Math.max(0, Math.min(1, (k - 0.28) / 0.3));
      const x = 82 + (112 - 82) * p;
      const y = GY(h) - 24 - Math.sin(p * Math.PI) * 6;
      glow(ctx, x, y, 16, 'rgba(255,230,150,A)', 0.55);
      itemImg(ctx, 1, x, y, 1.4, -0.7 + p * 0.2, 1);
    },
    /* 6. 연필을 던진다 */
    throw(ctx, t, h) {
      bg(ctx, 'field', h, 0, t);
      const k = t % 4.2;
      spr(ctx, 'hero', 'main', k < 1.2 ? 'throw' : 'idle', t, 52, GY(h), k < 1.2 ? { prog: Math.min(0.999, k / 1.2) } : { fps: 6 });
      const sx = 150;
      if (k < 1.5) spr(ctx, 'mob', 'slime', 'idle', t, sx, GY(h), { fps: 6 });
      else if (k < 2.3) spr(ctx, 'mob', 'slime', 'die', 0, sx, GY(h), { prog: Math.min(0.999, (k - 1.5) / 0.8) });
      if (k > 0.5 && k < 1.5) {
        const p = (k - 0.5) / 1;
        const x = 68 + (sx - 68) * p;
        const y = GY(h) - 30 - Math.sin(p * Math.PI) * 14;
        glow(ctx, x, y, 18, 'rgba(255,235,160,A)', 0.55);
        itemImg(ctx, 1, x, y, 1.3 + p * 0.5, p * 18, 1);
      }
      if (k > 1.45 && k < 1.9) {
        const p = (k - 1.45) / 0.45;
        glow(ctx, sx, GY(h) - 14, 12 + p * 40, 'rgba(255,255,230,A)', 0.7 * (1 - p));
        spr(ctx, 'fx', 'bighit', 'play', 0, sx, GY(h) - 14, { prog: Math.min(0.999, p) });
      }
    },
    /* 7. 떠나는 뒷모습 */
    leave(ctx, t, h) {
      bg(ctx, 'forest', h, t * 18, t);
      tint(ctx, h, 'rgba(255,150,80,0.1)');
      if (!spr(ctx, 'story', 'tower', 'idle', t, 176, GY(h) + 2, { fps: 6, scale: 0.55 })) {
        ctx.fillStyle = '#3a3a52';
        ctx.fillRect(170, 30, 10, GY(h) - 28);
      }
      spr(ctx, 'story', 'grandpa', 'wave', t, 26, GY(h), { fps: 7, alpha: 1 });
      spr(ctx, 'hero', 'main', 'run', t, 100, GY(h), { fps: 12 });
    },
    /* 8. 제목 */
    title(ctx, t, h) {
      bg(ctx, 'space', h, t * 3, t);
      glow(ctx, 100, h / 2, 70, 'rgba(255,220,140,A)', 0.28);
      for (let i = 0; i < 10; i++) {
        const a = t * 0.5 + (i / 10) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 62;
        const y = h / 2 + Math.sin(a) * 28;
        itemImg(ctx, i + 1, x, y, 1.1, a * 2, 0.95);
      }
      itemImg(ctx, 60, 100, h / 2 + Math.sin(t * 2) * 2, 2.4 + Math.sin(t * 3) * 0.1, t * 0.4, 1);
    },
  };

  /* 만화를 연다. onDone 은 끝까지 읽었거나 건너뛰었을 때 한 번 */
  function show(onDone) {
    const root = document.getElementById('comic');
    const box = document.getElementById('comicScroll');
    const skip = document.getElementById('comicSkip');
    if (!root || !box) {
      if (onDone) onDone();
      return;
    }
    box.replaceChildren();
    box.scrollTop = 0;
    const panels = [];
    const visible = new Set();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      obs.disconnect();
      root.hidden = true;
      if (onDone) onDone();
    };
    const obs = new IntersectionObserver(
      (list) => {
        for (const e of list) {
          const p = e.target.__panel;
          if (e.isIntersecting) {
            e.target.classList.add('in');
            visible.add(p);
            if (p.t0 === undefined) p.t0 = performance.now();
          } else visible.delete(p);
        }
      },
      { root: box, threshold: 0.25 },
    );
    TG.COMIC.forEach((spec) => {
      const fig = document.createElement('figure');
      fig.className = 'panel';
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = spec.h;
      fig.append(cv);
      if (spec.title) {
        const ttl = document.createElement('div');
        ttl.className = 'ttl';
        ttl.textContent = spec.title;
        fig.append(ttl);
      }
      if (spec.caps.length) {
        const caps = document.createElement('div');
        caps.className = 'caps';
        spec.caps.forEach(([who, text]) => {
          const p = document.createElement('p');
          if (who === 'narr') {
            p.className = 'cap narr';
            p.textContent = text;
          } else {
            p.className = `cap say${who === 'kid' ? ' right' : ''}`;
            const b = document.createElement('b');
            b.textContent = TG.STORY_WHO[who].name;
            p.append(b, text);
          }
          caps.append(p);
        });
        fig.append(caps);
      }
      const panel = { spec, cv, ctx: cv.getContext('2d'), t0: undefined };
      panel.ctx.imageSmoothingEnabled = false;
      fig.__panel = panel;
      panels.push(panel);
      box.append(fig);
      obs.observe(fig);
    });
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'go';
    go.textContent = '모험 시작';
    go.addEventListener('click', finish);
    box.append(go);
    skip.onclick = finish;
    root.hidden = false;
    let raf = 0;
    const loop = (now) => {
      for (const p of visible) {
        const fn = SCENES[p.spec.scene];
        const t = (now - p.t0) / 1000;
        p.ctx.clearRect(0, 0, W, p.spec.h);
        try {
          fn(p.ctx, t, p.spec.h);
        } catch {
          p.ctx.fillStyle = '#10142a';
          p.ctx.fillRect(0, 0, W, p.spec.h);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  TG.comic = { show, SCENES };
})(globalThis);
