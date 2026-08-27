import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import PiField from './components/PiField.jsx';
import { computePiDigits, COUNT_DEFAULT } from './pi/digits.js';
import { findAll, getEncoder } from './pi/encoders.js';

const fmt = n => n.toLocaleString('en-US');

export default function App() {
  const [count, setCount] = useState(COUNT_DEFAULT);
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(true);
  const [prog, setProg] = useState(0);
  const [encoderId, setEncoderId] = useState('a1z26');
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const [stats, setStats] = useState(null);
  const [calm, setCalm] = useState(false);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);
  const countRef = useRef(count);

  // compute π (worker, with progress) — cached per tier
  useEffect(() => {
    countRef.current = count;
    setBusy(true);
    setProg(0);
    computePiDigits(count, p => {
      if (countRef.current === count) setProg(p);
    }).then(d => {
      if (countRef.current === count) {
        setDigits(d);
        setBusy(false);
      }
    });
  }, [count]);

  useEffect(() => {
    const t = setTimeout(() => setCalm(true), 10000);
    const f = () => setCalm(true);
    window.addEventListener('pointerdown', f, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', f); };
  }, []);

  const encoder = getEncoder(encoderId);
  const isDigits = query.length > 0 && /^[0-9]+$/.test(query);
  const word = query.toUpperCase().replace(/[^A-Z]/g, '');
  const parts = !isDigits && word ? encoder.letters(word) : null;
  const needle = useMemo(
    () => (isDigits ? query : parts ? parts.join('') : ''),
    [query, isDigits, parts?.join('')] // eslint-disable-line
  );

  const occ = useMemo(() => {
    if (!digits || !needle) return [];
    return findAll(digits, needle, 500).map(ds => ({ ds, de: ds + needle.length - 1 }));
  }, [digits, needle]);

  useEffect(() => { setFocusIndex(occ.length ? 0 : -1); }, [occ]);

  const goto = useCallback(k => {
    if (!occ.length) return;
    const kk = ((k % occ.length) + occ.length) % occ.length;
    setFocusIndex(kk);
    fieldRef.current?.flyToDigitRange(occ[kk].ds);
  }, [occ]);

  const next = useCallback(() => {
    if (!occ.length) return;
    goto(focusIndex < 0 ? 0 : focusIndex + 1);
  }, [occ, focusIndex, goto]);

  const prev = useCallback(() => {
    if (!occ.length) return;
    goto(focusIndex < 0 ? occ.length - 1 : focusIndex - 1);
  }, [occ, focusIndex, goto]);

  useEffect(() => {
    const onKey = e => {
      const typing = document.activeElement === inputRef.current;
      if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus(); return; }
      if (typing) {
        if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prev() : next(); }
        else if (e.key === 'Escape') { setQuery(''); inputRef.current.blur(); }
        return;
      }
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowDown') { e.preventDefault(); fieldRef.current?.nudge(280); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); fieldRef.current?.nudge(-280); }
      else if (e.key === 'PageDown') { e.preventDefault(); fieldRef.current?.nudge(window.innerHeight * 0.8); }
      else if (e.key === 'PageUp') { e.preventDefault(); fieldRef.current?.nudge(-window.innerHeight * 0.8); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  return (
    <div className="app">
      <PiField
        ref={fieldRef}
        digits={digits}
        occ={occ}
        focusIndex={focusIndex}
        query={query}
        needle={needle}
        onFocusOccurrence={goto}
        onStats={setStats}
      />

      <Header
        inputRef={inputRef}
        query={query}
        onQuery={setQuery}
        needle={needle}
        parts={parts}
        isDigits={isDigits}
        encoderId={encoderId}
        onEncoder={setEncoderId}
        count={count}
        onCount={setCount}
        occ={occ}
        focusIndex={focusIndex}
        goto={goto}
        onNext={next}
        onPrev={prev}
        digitCount={digits.length}
        pct={stats?.pct}
        busy={busy}
      />

      <div className="hud l">
        {stats ? `DIGITS ${fmt(stats.from)}–${fmt(stats.to)} OF ${fmt(stats.total)}` : '· · ·'}
      </div>
      <div className={`hud r ${calm ? 'dim' : ''}`}>
        HOVER TO INSPECT · DRAG / SCROLL TO DESCEND · / TO SEARCH
      </div>

      {busy && (
        <div className="loading">
          <div className="pi">π</div>
          <div className="cap">
            {digits ? 'RECOMPUTING' : 'COMPUTING'} {fmt(count)} DIGITS OF π
          </div>
          <div className="bar"><i style={{ width: `${Math.round(prog * 100)}%` }} /></div>
          <div className="pct">{Math.round(prog * 100)}%</div>
        </div>
      )}
    </div>
  );
}
