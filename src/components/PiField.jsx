import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const ROTS = [-0.15, -0.075, 0, 0.075, 0.15]; // baked rotation variants
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = n => n.toLocaleString('en-US');

const mulberry32 = seed => () => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildMatches(w, occ) {
  const MS = new Int16Array(w.N);
  const segments = [];
  for (let k = 0; k < occ.length; k++) {
    const ds = occ[k].ds;
    const de = Math.min(occ[k].de, w.N - 1);
    if (ds > w.N - 1) continue;
    for (let i = ds; i <= de; i++) MS[i] = k + 1;
    let s = ds;
    while (s <= de) {
      const row = Math.floor(s / w.perRow);
      const end = Math.min(de, (row + 1) * w.perRow - 1);
      segments.push({ k, row, c0: s - row * w.perRow, c1: end - row * w.perRow });
      s = end + 1;
    }
  }
  w.MS = MS;
  w.segments = segments;
}

const PiField = forwardRef(function PiField(
  { digits, stream, mapping, occ, focusIndex, query, onFocusOccurrence, onStats },
  ref
) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const wRef = useRef(null);

  const streamRef = useRef(stream); streamRef.current = stream;
  const mappingRef = useRef(mapping); mappingRef.current = mapping;
  const occRef = useRef(occ); occRef.current = occ;
  const queryRef = useRef(query); queryRef.current = query;
  const cbRef = useRef(onFocusOccurrence); cbRef.current = onFocusOccurrence;
  const statsRef = useRef(onStats); statsRef.current = onStats;
  const focusRef = useRef(focusIndex); focusRef.current = focusIndex;
  const prevFocusRef = useRef(-1);

  useEffect(() => {
    const w = wRef.current;
    if (w && w.ready) buildMatches(w, occ);
  }, [occ]);

  useEffect(() => {
    const w = wRef.current;
    if (w && focusIndex !== prevFocusRef.current) {
      prevFocusRef.current = focusIndex;
      if (focusIndex >= 0) w.focusT0 = performance.now();
    }
  }, [focusIndex]);

  // soft re-reveal wave when the mapping changes
  const firstMapRef = useRef(true);
  useEffect(() => {
    const w = wRef.current;
    if (firstMapRef.current) { firstMapRef.current = false; return; }
    if (w && w.ready) {
      w.revealT0 = performance.now();
      w.stagger = Math.min(0.004, 1.4 / w.rows);
      w.drop = 5;
    }
  }, [mapping.id]);

  useImperativeHandle(ref, () => ({
    flyToDigitRange(a) {
      const w = wRef.current;
      if (!w || !w.ready) return;
      const y = w.topPad + Math.floor(a / w.perRow) * w.rowH;
      w.target = clamp(y - w.vh * 0.38, 0, w.maxCam);
      if (Math.abs(w.cam - w.target) > w.vh * 2.5) {
        w.cam = w.target + (w.cam > w.target ? 1 : -1) * w.vh * 0.9;
      }
    },
    nudge(dy) {
      const w = wRef.current;
      if (w && w.ready) w.target = clamp(w.target + dy, 0, w.maxCam);
    },
    clearSelection() { const w = wRef.current; if (w) w.sel = -1; },
  }), []);

  useEffect(() => {
    if (!digits) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');

    const w = {
      ctx, canvas, ready: false,
      cam: 0, target: 0, maxCam: 0,
      pointer: { x: -1e4, y: -1e4, on: false, down: false },
      hx: 0, hy: 0, sel: -1,
      revealT0: performance.now(), stagger: 0.01, drop: 16,
      sprites: new Map(), MS: new Int16Array(0), segments: [],
      focusT0: 0, lastStats: 0,
    };
    wRef.current = w;

    /* ——— glyph sprites (pre-rasterized, rotation baked in) ——— */
    const buildSprite = (ch, rotIdx, white) => {
      const S = Math.ceil(w.base * 1.7);
      const SS = 2;
      const c = document.createElement('canvas');
      c.width = S * SS; c.height = S * SS;
      const g = c.getContext('2d');
      g.scale(SS, SS);
      g.translate(S / 2, S / 2);
      g.rotate(ROTS[rotIdx]);
      g.font = `italic ${w.base}px Georgia,'Times New Roman',serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = white ? '#fff' : '#000';
      g.fillText(ch, 0, w.base * 0.045);
      return { c, S };
    };
    const sprite = (ch, rotIdx, white) => {
      const k = `${white ? 1 : 0}${rotIdx}${ch}`;
      let s = w.sprites.get(k);
      if (!s) { s = buildSprite(ch, rotIdx, white); w.sprites.set(k, s); }
      return s;
    };
    const drawSpr = (ch, rotIdx, white, x, y, scl, alp) => {
      if (alp <= 0.004) return;
      const s = sprite(ch, rotIdx, white);
      const sz = s.S * scl;
      ctx.globalAlpha = Math.min(1, alp);
      ctx.drawImage(s.c, x - sz / 2, y - sz / 2, sz, sz);
    };

    /* ——— layout ——— */
    const relayout = () => {
      const rect = wrap.getBoundingClientRect();
      const vw = Math.max(320, rect.width);
      const vh = Math.max(300, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      Object.assign(w, { vw, vh, dpr });
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = vw + 'px';
      canvas.style.height = vh + 'px';

      const N = digits.length;
      w.N = N;
      const mobile = vw < 640;
      w.cellW = mobile ? 14 : 15.5;
      w.rowH = w.cellW * 1.62;
      w.base = Math.round(w.cellW * 1.08);
      w.margin = Math.max(20, Math.min(64, vw * 0.055));
      w.topPad = mobile ? 208 : 140;
      w.groupGap = 0.75;
      w.originX = w.margin;
      w.gx = c => w.originX + (c + Math.floor(c / 10) * w.groupGap) * w.cellW;

      const usable = vw - w.margin * 2 - w.cellW;
      let perRow = Math.max(6, Math.floor(usable / (w.cellW * (1 + w.groupGap / 10))));
      let g = 0;
      while (w.gx(perRow) - w.originX > usable && perRow > 6 && g++ < 300) perRow--;
      g = 0;
      while (w.gx(perRow + 1) - w.originX <= usable && g++ < 300) perRow++;
      w.perRow = perRow;
      w.rows = Math.ceil(N / perRow);
      w.worldH = w.topPad + w.rows * w.rowH + 190;
      w.stagger = Math.min(0.012, 1.4 / w.rows);

      const prevMax = w.maxCam;
      w.maxCam = Math.max(0, w.worldH - vh);
      if (prevMax > 0) {
        const r = clamp(w.cam / prevMax, 0, 1);
        w.cam = w.target = r * w.maxCam;
      } else {
        w.cam = clamp(w.cam, 0, w.maxCam);
        w.target = clamp(w.target, 0, w.maxCam);
      }

      // deterministic organic jitter — a field, not a paragraph
      const rng = mulberry32(20250314);
      const X = new Float32Array(N), Y = new Float32Array(N);
      const SCL = new Float32Array(N), ALP = new Float32Array(N);
      const PH = new Float32Array(N), ROT = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        X[i] = w.gx(col) + (rng() - 0.5) * w.cellW * 0.46;
        Y[i] = w.topPad + row * w.rowH + (rng() - 0.5) * w.rowH * 0.44;
        ALP[i] = 0.28 + 0.64 * Math.pow(rng(), 1.6);
        SCL[i] = 0.84 + rng() * 0.34;
        ROT[i] = Math.floor(rng() * ROTS.length);
        PH[i] = rng() * Math.PI * 2;
      }
      Object.assign(w, { X, Y, SCL, ALP, PH, ROT });
      w.sprites.clear();
      w.ready = true;
      buildMatches(w, occRef.current);
    };

    /* ——— picking ——— */
    const nearestDigit = (x, y) => {
      const rowG = Math.round((y + w.cam - w.topPad) / w.rowH);
      let best = -1, bd = w.cellW * w.cellW * 0.9;
      for (let r = rowG - 1; r <= rowG + 1; r++) {
        if (r < 0 || r >= w.rows) continue;
        const base = r * w.perRow;
        const cGuess = Math.floor((x - w.originX) / (w.cellW * (1 + w.groupGap / 10)));
        for (let c = cGuess - 2; c <= cGuess + 2; c++) {
          const i = base + c;
          if (c < 0 || c >= w.perRow || i >= w.N) continue;
          const dx = w.X[i] - x, dy = w.Y[i] - (y + w.cam);
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = i; }
        }
      }
      return best;
    };

    const tap = (x, y) => {
      for (const seg of w.segments) {
        const cy = w.topPad + seg.row * w.rowH - w.cam;
        if (Math.abs(y - cy) > w.rowH * 0.48) continue;
        const x0 = w.gx(seg.c0) - w.cellW * 0.62, x1 = w.gx(seg.c1) + w.cellW * 0.62;
        if (x >= x0 && x <= x1) { cbRef.current?.(seg.k); return; }
      }
      const i = nearestDigit(x, y);
      w.sel = i >= 0 && i !== w.sel ? i : -1;
    };

    /* ——— pointer + camera ——— */
    let drag = null;
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = e => {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      w.pointer.down = true;
      canvas.style.cursor = 'grabbing';
      const p = pos(e);
      drag = { id: e.pointerId, lx: p.x, ly: p.y, lt: performance.now(), moved: 0, vel: 0 };
    };
    const onMove = e => {
      const p = pos(e);
      const pt = w.pointer;
      if (!pt.on) { w.hx = p.x; w.hy = p.y; }
      pt.x = p.x; pt.y = p.y; pt.on = true;
      if (drag && e.pointerId === drag.id) {
        const dyx = p.y - drag.ly;
        drag.moved += Math.abs(dyx) + Math.abs(p.x - drag.lx);
        if (drag.moved > 4) {
          w.cam = clamp(w.cam - dyx, 0, w.maxCam);
          w.target = w.cam;
          const t = performance.now();
          const dtm = Math.max(8, t - drag.lt);
          drag.vel = drag.vel * 0.65 + (-dyx / dtm) * 0.35;
          drag.lt = t;
        }
        drag.lx = p.x; drag.ly = p.y;
      }
    };
    const onUp = e => {
      w.pointer.down = false;
      canvas.style.cursor = 'crosshair';
      if (drag && e.pointerId === drag.id) {
        if (drag.moved < 7) {
          const p = pos(e);
          tap(p.x, p.y);
        } else {
          w.target = clamp(w.target + drag.vel * 300, 0, w.maxCam); // inertia
        }
        drag = null;
      }
    };
    const onLeave = () => { w.pointer.on = false; };
    const onWheel = e => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const m = e.deltaMode === 1 ? 18 : 1;
      w.target = clamp(w.target + e.deltaY * m, 0, w.maxCam);
    };

    /* ——— frame loop ——— */
    let raf = 0, last = performance.now();
    const loop = now => {
      raf = requestAnimationFrame(loop);
      if (!w.ready) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      w.cam += (w.target - w.cam) * (1 - Math.exp(-dt * 9));
      if (Math.abs(w.target - w.cam) < 0.1) w.cam = w.target;

      ctx.setTransform(w.dpr, 0, 0, w.dpr, 0, 0);
      ctx.clearRect(0, 0, w.vw, w.vh);

      const row0 = Math.max(0, Math.floor((w.cam - w.topPad - 80) / w.rowH));
      const row1 = Math.min(w.rows - 1, Math.ceil((w.cam + w.vh - w.topPad + 80) / w.rowH));
      if (row1 < row0) return;
      const i0 = row0 * w.perRow;
      const i1 = Math.min(w.N, (row1 + 1) * w.perRow);
      const tRev = (now - w.revealT0) / 1000;
      const revA = r => clamp((tRev - r * w.stagger) / 0.55, 0, 1);

      const mp = mappingRef.current;
      const st = streamRef.current;
      const occs = occRef.current;
      const fi = focusRef.current;
      const tp = Math.max(0, (now - w.focusT0) / 1000);
      const fk = Math.exp(-3 * tp);

      // the field begins with “3·”
      if (row0 === 0) {
        ctx.font = `italic ${w.base}px Georgia,'Times New Roman',serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.9 * revA(0);
        ctx.fillText('3·', w.originX - w.cellW * 0.5, w.topPad - w.cam + 1);
      }

      // match pills (solid black bands — no boxes, no translucency)
      for (const seg of w.segments) {
        if (seg.row < row0 || seg.row > row1) continue;
        const a = revA(seg.row);
        if (a <= 0) continue;
        const focused = seg.k === fi;
        const cy = w.topPad + seg.row * w.rowH - w.cam;
        const pad = w.cellW * 0.62;
        let x0 = w.gx(seg.c0) - pad;
        let x1 = w.gx(seg.c1) + pad;
        let h = w.rowH * 0.78;
        if (focused) {
          const s = 1 + 0.09 * fk;
          const cx = (x0 + x1) / 2, wd = x1 - x0;
          x0 = cx - (wd * s) / 2;
          x1 = cx + (wd * s) / 2;
          h *= s;
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = '#000';
        rr(ctx, x0, cy - h / 2, x1 - x0, h, h / 2);
        ctx.fill();
      }

      // digits
      const p = w.pointer;
      const R = p.down ? 150 : 112, R2 = R * R;
      for (let i = i0; i < i1; i++) {
        const row = Math.floor(i / w.perRow);
        const a = revA(row);
        if (a <= 0) continue;
        const ph = w.PH[i];
        let sx = w.X[i] + Math.sin(now * 0.00047 + ph) * 1.15;
        let sy = w.Y[i] - w.cam + Math.cos(now * 0.00038 + ph * 1.7) * 1.15 + (1 - a) * w.drop;
        let scl = w.SCL[i];
        let alp = w.ALP[i] * a;
        let morph = 0;

        if (p.on) {
          const dx = sx - p.x, dy = sy - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1;
            const e0 = 1 - d / R;
            const e = e0 * e0 * (3 - 2 * e0);
            const push = e * (p.down ? 12 : 7.5);
            sx += (dx / d) * push;
            sy += (dy / d) * push;
            scl *= 1 + e * 0.5;
            alp = Math.min(1, alp + e * 0.55);
            morph = e; // digits near the finger become their letters
          }
        }

        const m = i < w.MS.length ? w.MS[i] : 0;
        const rot = w.ROT[i];
        const ch = digits[i];
        if (m === 0) {
          if (morph > 0.04) {
            drawSpr(ch, rot, false, sx, sy, scl, alp * (1 - morph * 0.9));
            const L = mp.letterAt(st, i);
            if (L) drawSpr(L, rot, false, sx, sy, scl, alp * morph);
          } else drawSpr(ch, rot, false, sx, sy, scl, alp);
        } else {
          const focused = m - 1 === fi;
          const s2 = focused ? scl * (1 + 0.09 * fk) : scl;
          const wa = Math.max(alp, 0.92);
          if (morph > 0.04) {
            drawSpr(ch, rot, true, sx, sy, s2, wa * (1 - morph * 0.9));
            const L = mp.letterAt(st, i);
            if (L) drawSpr(L, rot, true, sx, sy, s2, wa * morph);
          } else drawSpr(ch, rot, true, sx, sy, s2, wa);
        }
      }

      // trailing ellipsis
      if (row1 === w.rows - 1 && w.N > 0) {
        const li = w.N - 1;
        ctx.globalAlpha = 0.55 * revA(w.rows - 1);
        ctx.font = `italic ${w.base}px Georgia,serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText('…', w.X[li] + w.cellW * 1.1, w.Y[li] - w.cam);
      }

      // museum-label for the focused match
      if (fi >= 0 && fi < occs.length) {
        const seg = w.segments.find(s => s.k === fi && s.row >= row0 && s.row <= row1);
        if (seg) {
          const cy = w.topPad + seg.row * w.rowH - w.cam;
          const label = `“${queryRef.current?.toUpperCase()}” · № ${fmt(occs[fi].ds + 1)}`;
          ctx.font = `600 9.5px ${MONO}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.globalAlpha = Math.min(1, tp * 2.5) * revA(seg.row);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.strokeText(label, w.gx(seg.c0) - w.cellW * 0.62, cy - w.rowH * 0.39 - 10);
          ctx.fillStyle = '#000';
          ctx.fillText(label, w.gx(seg.c0) - w.cellW * 0.62, cy - w.rowH * 0.39 - 10);
        }
      }

      // specimen tag for a clicked digit
      if (w.sel >= 0 && w.sel < w.N) {
        const sy = w.Y[w.sel] - w.cam;
        if (sy > -60 && sy < w.vh + 60) {
          const L = mp.letterAt(st, w.sel) || '·';
          const label = `№ ${fmt(w.sel + 1)} · ${L}`;
          ctx.font = `600 9.5px ${MONO}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const ty = sy + w.rowH * 0.72;
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.strokeText(label, w.X[w.sel], ty);
          ctx.fillStyle = '#000';
          ctx.fillText(label, w.X[w.sel], ty);
          ctx.fillRect(w.X[w.sel] - 0.5, sy + w.cellW * 0.55, 1, w.rowH * 0.16);
        }
      }

      // pointer halo
      if (p.on) {
        w.hx += (p.x - w.hx) * 0.22;
        w.hy += (p.y - w.hy) * 0.22;
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w.hx, w.hy, p.down ? 76 : 57, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (now - w.lastStats > 300) {
        w.lastStats = now;
        statsRef.current?.({
          from: i0 + 1, to: i1, total: w.N,
          pct: w.maxCam > 0 ? (w.cam / w.maxCam) * 100 : 0,
        });
      }
    };

    const ro = new ResizeObserver(() => relayout());
    ro.observe(wrap);
    relayout();
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('wheel', onWheel, { passive: false });
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('wheel', onWheel);
      wRef.current = null;
    };
  }, [digits]);

  return (
    <div className="field-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
});

export default PiField;
