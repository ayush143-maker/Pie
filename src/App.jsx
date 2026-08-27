import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import PiField from './components/PiField.jsx';
import { computePiDigits, PI_COUNT } from './pi/digits.js';
import { findMatches, getMapping } from './pi/mappings.js';

const fmt = n => n.toLocaleString('en-US');

export default function App() {
  const [digits, setDigits] = useState('');
  const [mappingId, setMappingId] = useState('a1');
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const [stats, setStats] = useState(null);
  const [calm, setCalm] = useState(false);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    computePiDigits(PI_COUNT).then(d => { if (alive) setDigits(d); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setCalm(true), 10000);
    const f = () => setCalm(true);
    window.addEventListener('pointerdown', f, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', f); };
  }, []);

  const mapping = getMapping(mappingId);
  const stream = useMemo(() => (digits ? mapping.build(digits) : ''), [digits, mapping]);
  const q = useMemo(() => query.toUpperCase(), [query]);

  const occ = useMemo(() => {
    if (!stream || !q) return [];
    return findMatches(stream, q, 800).map(p => ({
      ds: mapping.digitRange(p)[0],
      de: mapping.digitRange(p + q.length - 1)[1],
      letter: p,
    }));
  }, [stream, q, mapping]);

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
      else if (e.key === 'Escape') fieldRef.current?.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const encode = q ? mapping.encode(q) : null;

  return (
    <div className="app">
      <PiField
        ref={fieldRef}
        digits={digits}
        stream={stream}
        mapping={mapping}
        occ={occ}
        focusIndex={focusIndex}
        query={query}
        onFocusOccurrence={goto}
        onStats={setStats}
      />

      <Header
        inputRef={inputRef}
        query={query}
        onQuery={setQuery}
        mappingId={mappingId}
        onMapping={setMappingId}
        mapping={mapping}
        encode={encode}
        occ={occ}
        focusIndex={focusIndex}
        goto={goto}
        onNext={next}
        onPrev={prev}
        digitCount={digits.length}
        pct={stats?.pct}
        loading={!digits}
      />

      <div className="hud l">
        {stats ? `DIGITS ${fmt(stats.from)}–${fmt(stats.to)} OF ${fmt(stats.total)}` : '· · ·'}
      </div>
      <div className={`hud r ${calm ? 'dim' : ''}`}>
        TOUCH THE FIELD TO REVEAL LETTERS · SCROLL TO DESCEND · / TO SEARCH
      </div>

      {!digits && (
        <div className="loading">
          <div className="pi">π</div>
          <div className="cap">COMPUTING {fmt(PI_COUNT)} DIGITS OF π</div>
        </div>
      )}
    </div>
  );
}
