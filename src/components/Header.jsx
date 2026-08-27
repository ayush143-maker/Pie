import { Fragment } from 'react';
import { MAPPINGS } from '../pi/mappings.js';

const fmt = n => n.toLocaleString('en-US');

export default function Header({
  inputRef, query, onQuery, mappingId, onMapping, mapping,
  encode, occ, focusIndex, goto, onNext, onPrev, digitCount, pct, loading,
}) {
  const shown = occ.length <= 3
    ? occ.map((_, i) => i)
    : focusIndex >= 3 ? [0, 1, focusIndex] : [0, 1, 2];

  let results;
  if (loading) {
    results = <span>COMPUTING THE FIELD · {fmt(digitCount || 20000)} DIGITS</span>;
  } else if (!query) {
    results = (
      <>
        <span>{mapping.desc}</span>
        <span className="dim">· ENTER A WORD</span>
      </>
    );
  } else if (occ.length === 0) {
    results = (
      <>
        <span className="q">“{query.toUpperCase()}”</span>
        <span>· NO MATCH IN THE FIRST {fmt(digitCount)} DIGITS</span>
        {encode?.lossy && <span className="dim">· {mapping.hint}</span>}
      </>
    );
  } else {
    results = (
      <>
        <span className="q">“{query.toUpperCase()}”</span>
        <span>· {occ.length >= 800 ? '800+' : occ.length} {occ.length === 1 ? 'MATCH' : 'MATCHES'}</span>
        {shown.map(k => (
          <button
            key={k}
            className={`pos ${k === focusIndex ? 'focus' : ''}`}
            onClick={() => goto(k)}
          >
            № {fmt(occ[k].ds + 1)}
          </button>
        ))}
        {occ.length > 3 && <span className="dim">+{occ.length - 3}</span>}
        <button className="nav" aria-label="previous match" onClick={onPrev}>‹</button>
        <span className="dim">{Math.max(1, focusIndex + 1)}/{occ.length >= 800 ? '800+' : occ.length}</span>
        <button className="nav" aria-label="next match" onClick={onNext}>›</button>
      </>
    );
  }

  return (
    <header className="hdr">
      <div className="hdr-row">
        <div className="brand">
          <h1>PiLex</h1>
          <small>π → LANGUAGE · {fmt(digitCount || 20000)} DIGITS</small>
        </div>

        <label className="search">
          <span className="glyph">π</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQuery(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 14))}
            placeholder="search a word in π — try “math”"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            enterKeyHint="search"
            aria-label="search a word in pi"
          />
          {encode && <span className="code">{encode.prefix} {encode.text}</span>}
          {query && (
            <button
              className="clear"
              aria-label="clear search"
              onClick={() => { onQuery(''); inputRef.current?.focus(); }}
            >
              ×
            </button>
          )}
        </label>

        <nav className="maps" aria-label="digit to letter mapping">
          {MAPPINGS.map((m, i) => (
            <Fragment key={m.id}>
              {i > 0 && <span className="dot">·</span>}
              <button
                className={`map-btn ${m.id === mappingId ? 'on' : ''}`}
                title={m.desc}
                onClick={() => onMapping(m.id)}
              >
                {m.label}
              </button>
            </Fragment>
          ))}
        </nav>
      </div>

      <div className="results">{results}</div>
      <div className="hair" />
      <div className="prog" style={{ width: `${pct || 0}%` }} />
    </header>
  );
}
