const A = 65;
const chr = i => String.fromCharCode(A + i);

export const MAPPINGS = [
  {
    id: 'a1',
    label: 'A=1',
    desc: '1→A · 2→B · … · 9→I · 0→J',
    hint: 'K–Z CANNOT OCCUR UNDER A=1',
    build(digits) {
      const out = new Array(digits.length);
      for (let i = 0; i < digits.length; i++) {
        const d = digits.charCodeAt(i) - 48;
        out[i] = chr((d + 9) % 10); // 1→A … 9→I, 0→J
      }
      return out.join('');
    },
    digitRange: li => [li, li],
    letterAt(stream, di) { return stream[di]; },
    encode(word) {
      let lossy = false;
      const parts = [];
      for (const c of word) {
        const v = c.charCodeAt(0) - A;
        if (v > 9) { parts.push('·'); lossy = true; }
        else parts.push(String((v + 1) % 10));
      }
      return { prefix: '→', text: parts.join('·'), lossy };
    },
  },
  {
    id: 'a0',
    label: 'A=0',
    desc: '0→A · 1→B · … · 8→I · 9→J',
    hint: 'K–Z CANNOT OCCUR UNDER A=0',
    build(digits) {
      const out = new Array(digits.length);
      for (let i = 0; i < digits.length; i++) out[i] = chr(digits.charCodeAt(i) - 48);
      return out.join('');
    },
    digitRange: li => [li, li],
    letterAt(stream, di) { return stream[di]; },
    encode(word) {
      let lossy = false;
      const parts = [];
      for (const c of word) {
        const v = c.charCodeAt(0) - A;
        if (v > 9) { parts.push('·'); lossy = true; }
        else parts.push(String(v));
      }
      return { prefix: '→', text: parts.join('·'), lossy };
    },
  },
  {
    id: 'sigma',
    label: 'Σ MOD',
    desc: 'RUNNING DIGIT SUM · MOD 26 → A–Z',
    hint: null,
    build(digits) {
      let s = 0;
      const out = new Array(digits.length);
      for (let i = 0; i < digits.length; i++) {
        s = (s + digits.charCodeAt(i) - 48) % 26;
        out[i] = chr(s);
      }
      return out.join('');
    },
    digitRange: li => [li, li],
    letterAt(stream, di) { return stream[di]; },
    encode(word) {
      const parts = [];
      for (const c of word) parts.push(String(c.charCodeAt(0) - A).padStart(2, '0'));
      return { prefix: 'Σ', text: parts.join('·'), lossy: false };
    },
  },
  {
    id: 'pairs',
    label: 'PAIRS',
    desc: 'DIGIT PAIRS · MOD 26 → A–Z',
    hint: null,
    build(digits) {
      const L = digits.length >> 1;
      const out = new Array(L);
      for (let i = 0; i < L; i++) {
        const v = (digits.charCodeAt(2 * i) - 48) * 10 + (digits.charCodeAt(2 * i + 1) - 48);
        out[i] = chr(v % 26);
      }
      return out.join('');
    },
    digitRange: li => [2 * li, 2 * li + 1],
    letterAt(stream, di) { return stream[di >> 1]; },
    encode(word) {
      const parts = [];
      for (const c of word) parts.push(String(c.charCodeAt(0) - A).padStart(2, '0'));
      return { prefix: '→', text: parts.join('·') + ' (MOD 26)', lossy: false };
    },
  },
];

export const getMapping = id => MAPPINGS.find(m => m.id === id) ?? MAPPINGS[0];

export function findMatches(stream, word, cap = 800) {
  const res = [];
  if (!word || !stream) return res;
  let i = stream.indexOf(word);
  while (i !== -1 && res.length < cap) {
    res.push(i);
    i = stream.indexOf(word, i + 1);
  }
  return res;
}
