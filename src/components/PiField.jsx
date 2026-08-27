import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = n => n.toLocaleString('en-US');
const easeOut = t => 1 - Math.pow(1 - t, 3);

// deterministic jitter → hand-drawn marker edges
const jit = seed => {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296 - 0.5;
  };
};

function buildBands(w, occ) {
  const segs = [];
  for (let k = 0; k < occ.length; k++) {
    const ds = occ[k].ds;
    const de = Math.min(occ[k].de, w.N - 1);
    if (ds > w.N - 1) continue;
    let s = ds;
    while (s <= de) {
      const row = Math.floor(s / w.per);
      const end = Math.min(de, (row + 1) * w.per - 1);
      segs.push({ k, row, c0: s - row * w.per, i0: s, i1: end });
      s = end + 1;
    }
  }
  for (const seg of segs) {
    const r = jit(seg.k * 7919 + seg.row * 31 + seg.i0 + 11);
    seg.j = [r() * 3, r() * 3, r() * 3, r() * 3, r() * 2.4, r() * 2.4];
    const c1 = seg.i1 - seg.row * w.per;
    seg.x0 = w.xOf(seg.c0) - w.cellW * 0.32;
    seg.x1 = w.xOf(c1) + w.charW + w.cellW * 0.3;
    seg.wy = w.topPad + seg.row * w.rowH; // world y
  }
  w.segs = segs;
}

const PiField = forwardRef(function PiField(
  { digits, occ, focusIndex, query, needle, onFocusOccurrence, onStats },
  ref
) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const wRef = useRef(null);

  const occRef = useRef(occ); occRef.current = occ;
  const queryRef = useRef(query); queryRef.current = query;
  const needleRef = useRef(needle); needleRef.current = needle;
  const cbRef = useRef(onFocusOccurrence); cbRef.current = onFocusOccurrence;
  const statsRef = useRef(onStats); statsRef.current = onStats;
  const focusRef = useRef(focusIndex); focusRef.current = focusIndex;
  const prevFocusRef = useRef(-1);

  // new matches → repaint + run the marker animation
  useEffect(() => {
    const w = wRef.current;
    if (w && w.ready) {
      buildBands(w, occ);
      w.bandT0 = performance.now();
      w.animUntil = Math.max(w.animUntil || 0, w.bandT0 + 30 * 45 + 320);
      w.dirty = true;
    }
  }, [occ]);

  useEffect(() => {
    const w = wRef.current;
    if (w && focusIndex !== prevFocusRef.current) {
      prevFocusRef.current = focusIndex;
      if (focusIndex >= 0) w.focusT0 = performance.now();
      if (w.ready) w.dirty = true;
    }
  }, [focusIndex]);

  useImperativeHandle(ref, () => ({
    flyToDigitRange(a) {
      const w = wRef.current;
      if (!w || !w.ready) return;
      const y = w.topPad + Math.floor(a / w.per) * w.rowH;
      w.target = clamp(y - w.vh * 0.38, 0, w.maxCam);
      if (Math.abs(w.cam - w.target) > w.vh * 2.5) {
        w.cam = w.target + (w.cam > w.target ? 1 : -1) * w.vh * 0.9;
      }
      w.dirty = true;
    },
    nudge(dy) {
      const w = wRef.current;
      if (w && w.ready) { w.target = clamp(w.target + dy, 0, w.maxCam); w.dirty = true; }
    },
  }), []);

  useEffect(() => {
    if (!digits) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');

    const w = {
      ctx, canvas, ready: false, dirty: true,
      cam: 0, target: 0, maxCam: 0,
      pointer: { x: -1e4, y: -1e4, on: false, down: false },
      hover: -1,
      revealT0: performance.now(), bandT0: performance.now(), focusT0: 0,
      animUntil: 0, lastStats: 0, segs: [],
    };
    wRef.current = w;

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
      w.fontPx = mobile ? 14 : 15.5;
      w.font = `${w.fontPx}px ${MONO}`;
      ctx.font = w.font;
      w.charW = ctx.measureText('0').width;
      w.cellW = w.charW + (mobile ? 1.2 : 2.2);
      w.groupGap = w.cellW * 0.95;
      w.rowH = w.fontPx * 2.0;
      w.margin = mobile ? 26 : Math.max(52, vw * 0.07);
      w.topPad = mobile ? 210 : 150;
      w.xOf = c => w.margin + c * w.cellW + Math.floor(c / 10) * w.groupGap;

      const usable = vw - w.margin * 2;
      let per = Math.floor(usable / (w.cellW + w.groupGap / 10));
      per = Math.max(10, Math.floor(per / 10) * 10); // rows of clean groups of 10
      w.per = per;
      w.rows = Math.ceil(N / per);
      w.worldH = w.topPad + w.rows * w.rowH + 240;

      const prevMax = w.maxCam;
      w.maxCam = Math.max(0, w.worldH - vh);
      if (prevMax > 0) {
        const r = clamp(w.cam / prevMax, 0, 1);
        w.cam = w.target = r * w.maxCam;
      } else {
        w.cam = clamp(w.cam, 0, w.maxCam);
        w.target = clamp(w.target, 0, w.maxCam);
      }

      w.revealT0 = performance.now();
      w.animUntil = Math.max(w.animUntil || 0, w.revealT0 + w.rows * 3 + 320);
      buildBands(w, occRef.current);
      w.dirty = true;
    };

    /* ——— picking ——— */
    const cellAt = (x, y) => {
      const wy = y + w.cam;
      const row = Math.floor((wy - w.topPad + w.rowH * 0.4) / w.rowH);
      if (row < 0 || row >= w.rows) return -1;
      const cGuess = Math.floor((x - w.margin) / (w.cellW + w.groupGap / 10));
      for (let c = cGuess - 2; c <= cGuess + 2; c++) {
        if (c < 0 || c >= w.per) continue;
        const i = row * w.per + c;
        if (i >= w.N) continue;
        const cx = w.xOf(c);
        if (x >= cx - 2 && x <= cx + w.charW + 2 &&
            Math.abs(wy - (w.topPad + row * w.rowH)) < w.rowH * 0.55) return i;
      }
      return -1;
    };

    const tap = (x, y) => {
      for (const seg of w.segs) {
        const sy = seg.wy - w.cam;
        if (Math.abs(y - sy) > w.rowH * 0.5) continue;
        if (x >= seg.x0 && x <= seg.x1) { cbRef.current?.(seg.k); return; }
      }
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
      const p = pos(e);
      drag = { id: e.pointerId, lx: p.x, ly: p.y, lt: performance.now(), moved: 0, vel: 0 };
    };
    const onMove = e => {
      const p = pos(e);
      const pt = w.pointer;
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
          w.dirty = true;
        }
        drag.lx = p.x; drag.ly = p.y;
      } else {
        const h = cellAt(p.x, p.y);
        if (h !== w.hover) { w.hover = h; w.dirty = true; }
      }
    };
    const onUp = e => {
      w.pointer.down = false;
      if (drag && e.pointerId === drag.id) {
        if (drag.moved < 7) {
          const p = pos(e);
          tap(p.x, p.y);
        } else {
          w.target = clamp(w.target + drag.vel * 300, 0, w.maxCam);
          w.dirty = true;
        }
        drag = null;
      }
    };
    const onLeave = () => { w.pointer.on = false; if (w.hover !== -1) { w.hover = -1; w.dirty = true; } };
    const onWheel = e => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const m = e.deltaMode === 1 ? 18 : 1;
      w.target = clamp(w.target + e.deltaY * m, 0, w.maxCam);
      w.dirty = true;
    };

    /* ——— marker band path (hand-drawn) ——— */
    const bandPath = (seg, sy, edgeX, ex) => {
      const yT = sy - w.fontPx * 0.72 - ex;
      const yB = sy + w.fontPx * 0.78 + ex;
      const j = seg.j;
      const wd = edgeX - seg.x0;
      ctx.beginPath();
      ctx.moveTo(seg.x0, yT + j[0]);
      ctx.lineTo(seg.x0 + wd * 0.33, yT + j[4]);
      ctx.lineTo(seg.x0 + wd * 0.66, yT + j[1] * 0.7);
      ctx.lineTo(edgeX, yT + j[1]);
      ctx.lineTo(edgeX, yB + j[2]);
      ctx.lineTo(seg.x0 + wd * 0.66, yB + j[5]);
      ctx.lineTo(seg.x0 + wd * 0.33, yB + j[3] * 0.7);
      ctx.lineTo(seg.x0, yB + j[3]);
      ctx.closePath();
      return { yT, yB };
    };
    const segProg = (seg, now) =>
      easeOut(clamp((now - (w.bandT0 + Math.min(seg.k, 30) * 45)) / 280, 0, 1));

    /* ——— draw ——— */
    const draw = now => {
      ctx.setTransform(w.dpr, 0, 0, w.dpr, 0, 0);
      ctx.clearRect(0, 0, w.vw, w.vh);

      const row0 = Math.max(0, Math.floor((w.cam - w.topPad - 60) / w.rowH));
      const row1 = Math.min(w.rows - 1, Math.ceil((w.cam + w.vh - w.topPad + 60) / w.rowH));
      if (row1 < row0) return;
      const revA = r => clamp((now - w.revealT0 - r * 3) / 260, 0, 1);
      const fi = focusRef.current;
      const tp = Math.max(0, (now - w.focusT0) / 1000);
      const fk = Math.exp(-3 * tp);

      // “3.” — the sheet literally starts with 3.14159…
      if (row0 === 0) {
        ctx.font = `italic ${w.fontPx + 3}px Georgia,'Times New Roman',serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.92 * revA(0);
        ctx.fillText('3.', w.margin - 10, w.topPad - w.cam + 1);
      }

      // 1) all digits in black
      ctx.font = w.font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      for (let r = row0; r <= row1; r++) {
        const a = revA(r);
        if (a <= 0) continue;
        const y = w.topPad + r * w.rowH - w.cam;
        const base = r * w.per;
        ctx.globalAlpha = a * 0.92;
        for (let c = 0; c < w.per; c++) {
          const i = base + c;
          if (i >= w.N) break;
          if (i === w.hover) continue;
          ctx.fillText(digits[i], w.xOf(c), y);
        }
      }

      // 2) marker bands (animated left → right)
      ctx.fillStyle = '#000';
      const drawn = [];
      for (const seg of w.segs) {
        if (seg.row < row0 || seg.row > row1) continue;
        const p = segProg(seg, now);
        if (p <= 0) continue;
        const sy = seg.wy - w.cam;
        const ex = seg.k === fi ? 1.5 + 2 * fk : 0;
        const edgeX = seg.x0 + (seg.x1 - seg.x0) * p;
        ctx.globalAlpha = revA(seg.row);
        bandPath(seg, sy, edgeX, ex);
        ctx.fill();
        drawn.push({ seg, p, edgeX, sy, ex });
      }

      // 3) digits inside bands, knocked out in white (clipped to marker edge)
      ctx.font = w.font;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      for (const { seg, edgeX, sy, ex } of drawn) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(seg.x0, sy - w.fontPx * 0.72 - ex - 2, edgeX - seg.x0, w.fontPx * 1.5 + ex * 2 + 4);
        ctx.clip();
        ctx.globalAlpha = revA(seg.row);
        for (let i = seg.i0; i <= seg.i1; i++) {
          ctx.fillText(digits[i], w.xOf(i - seg.row * w.per), sy);
        }
        ctx.restore();
      }

      // hovered digit: lift + position tag
      if (w.hover >= 0) {
        const i = w.hover;
        const r = Math.floor(i / w.per), c = i % w.per;
        const sy = w.topPad + r * w.rowH - w.cam;
        if (sy > -40 && sy < w.vh + 40) {
          const cx = w.xOf(c) + w.charW / 2;
          ctx.font = `${w.fontPx * 1.3}px ${MONO}`;
          ctx.textAlign = 'center';
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#000';
          ctx.fillText(digits[i], cx, sy - 1);
          const label = `№ ${fmt(i + 1)}`;
          ctx.font = `600 9.5px ${MONO}`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.strokeText(label, cx, sy + w.rowH * 0.62);
          ctx.fillText(label, cx, sy + w.rowH * 0.62);
        }
      }

      // caption for the focused match
      if (fi >= 0 && fi < occRef.current.length) {
        const seg = w.segs.find(s => s.k === fi && s.row >= row0 && s.row <= row1);
        if (seg) {
          const sy = seg.wy - w.cam;
          const q = queryRef.current, nd = needleRef.current;
          const label = `${q ? `“${q.toUpperCase()}” → ` : ''}${nd} · № ${fmt(occRef.current[fi].ds + 1)}`;
          ctx.font = `600 9.5px ${MONO}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.globalAlpha = Math.min(1, tp * 2.5) * revA(seg.row);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.strokeText(label, seg.x0, sy - w.fontPx * 0.72 - 12);
          ctx.fillStyle = '#000';
          ctx.fillText(label, seg.x0, sy - w.fontPx * 0.72 - 12);
          ctx.textBaseline = 'middle';
        }
      }

      // after the last digit: π keeps going
      const ty = w.topPad + w.rows * w.rowH + w.rowH * 0.1 - w.cam;
      if (ty > -20 && ty < w.vh + 20) {
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#000';
        ctx.fillText(`π CONTINUES FOREVER · ${fmt(w.N)} DIGITS COMPUTED SO FAR — CHOOSE A LARGER COUNT ABOVE`, w.margin, ty);
      }
      ctx.globalAlpha = 1;

      if (now - w.lastStats > 300) {
        w.lastStats = now;
        const i0 = row0 * w.per;
        const i1 = Math.min(w.N, (row1 + 1) * w.per);
        statsRef.current?.({
          from: i0 + 1, to: i1, total: w.N,
          pct: w.maxCam > 0 ? (w.cam / w.maxCam) * 100 : 0,
        });
      }
    };

    let raf = 0, last = performance.now();
    const loop = now => {
      raf = requestAnimationFrame(loop);
      if (!w.ready) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const moving = Math.abs(w.target - w.cam) > 0.1;
      if (moving) {
        w.cam += (w.target - w.cam) * (1 - Math.exp(-dt * 9));
        if (Math.abs(w.target - w.cam) < 0.1) w.cam = w.target;
      }
      const animating = now < w.animUntil;
      if (!w.dirty && !moving && !animating) return; // idle → zero work
      w.dirty = moving || animating;
      draw(now);
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
