import { Fragment } from 'react';
import { ENCODERS } from '../pi/encoders.js';
import { TIERS } from '../pi/digits.js';

const fmt = n => n.toLocaleString('en-US');

export default function Header({
  inputRef, query, onQuery, needle, parts, isDigits,
  encoderId, onEncoder, count, onCount,
  occ, focusIndex, goto, onNext, onPrev, digitCount, pct, busy,
}) {
  const shown = occ.length <= 3
    ? occ.map((_, i) => i)
    : focusIndex >= 3 ? [0, 1, focusIndex] : [0, 1, 2];

  let results;
  if (busy) {
    results = <span>COMPUTING π · {fmt(count)} DIGITS</span>;
  } else if (!query) {
    results = (
      <>
        <span>{ENCODERS.find(e => e.id === encoderId)?.desc}</span>
        <span className="dim">· TYPE A WORD — OR DIGITS DIRECTLY</span>
      </>
    );
  } else if (occ.length === 0) {
    results = (
      <>
        <span className="q">{parts ? `“${query.toUpperCase()}” → ${needle}` : needle}</span>
        <span>· NOT FOUND IN THE FIRST {fmt(digitCount)} DIGITS</span>
        {needle.length >= 8 && <span className="dim">· LONG PATTERNS GET RARE FAST</span>}
      </>
    );
  } else {
    results = (
      <>
        <span className="q">{parts ? `“${query.toUpperCase()}” → ${needle}` : needle}</span>
        <span>· {occ.length >= 500 ? '500+' : occ.length} {occ.length === 1 ? 'MATCH' : 'MATCHES'}</span>
        {shown.map(k => (
          <button key={k} className={`pos ${k === focusIndex ? 'focus' : ''}`} onClick={() => goto(k)}>
            № {fmt(occ[k].ds + 1)}
          </button>
        ))}
        {occ.length > 3 && <span className="dim">+{occ.length - 3}</span>}
        <button className="nav" aria-label="previous match" onClick={onPrev}>‹</button>
        <span className="dim">{Math.max(1, focusIndex + 1)}/{occ.length >= 500 ? '500+' : occ.length}</span>
        <button className="nav" aria-label="next match" onClick={onNext}>›</button>
      </>
    );
  }

  return (
    <header className="hdr">
      <div className="hdr-row">
        <div className="brand">
          <h1>PiLex</h1>
          <small>FIND ANY WORD HIDDEN IN π</small>
        </div>

        <label className="search">
          <span className="glyph">π</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQuery(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14))}
            placeholder="type a word — try “pi” — or digits like 169"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            enterKeyHint="search"
            aria-label="search a word or number in pi"
          />
          {needle && (
            <span className="code">→ {isDigits ? needle : parts.join('·')}</span>
          )}
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

        <nav className="opts" aria-label="options">
          <div className="grp">
            {ENCODERS.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 && <span className="dot">·</span>}
                <button
                  className={`opt ${e.id === encoderId ? 'on' : ''}`}
                  title={e.desc}
                  onClick={() => onEncoder(e.id)}
                >
                  {e.label}
                </button>
              </Fragment>
            ))}
          </div>
          <span className="vsep" />
          <div className="grp">
            {TIERS.map((t, i) => (
              <Fragment key={t.n}>
                {i > 0 && <span className="dot">·</span>}
                <button
                  className={`opt ${t.n === count ? 'on' : ''}`}
                  title={`compute ${fmt(t.n)} digits of π`}
                  onClick={() => onCount(t.n)}
                >
                  {t.l}
                </button>
              </Fragment>
            ))}
          </div>
        </nav>
      </div>

      <div className="results">{results}</div>
      <div className="hair" />
      <div className="prog" style={{ width: `${pct || 0}%` }} />
    </header>
  );
}
