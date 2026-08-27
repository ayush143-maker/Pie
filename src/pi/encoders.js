// word → number, then plain substring search inside π's digits.

const KEYPAD = {
  A: 2, B: 2, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4,
  J: 5, K: 5, L: 5, M: 6, N: 6, O: 6, P: 7, Q: 7, R: 7, S: 7,
  T: 8, U: 8, V: 8, W: 9, X: 9, Y: 9, Z: 9,
};

export const ENCODERS = [
  {
    id: 'a1z26',
    label: 'A1Z26',
    desc: 'A=1 · B=2 · … · Z=26 → CONCATENATED DIGITS',
    letters(word) { return [...word].map(c => String(c.charCodeAt(0) - 64)); },
  },
  {
    id: 'keypad',
    label: 'KEYPAD',
    desc: 'PHONE KEYPAD · ABC=2 · DEF=3 · … · WXYZ=9',
    letters(word) { return [...word].map(c => String(KEYPAD[c])); },
  },
];

export const getEncoder = id => ENCODERS.find(e => e.id === id) ?? ENCODERS[0];

export function findAll(haystack, needle, cap = 500) {
  const res = [];
  if (!needle || !haystack) return res;
  let i = haystack.indexOf(needle);
  while (i !== -1 && res.length < cap) {
    res.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return res;
}
