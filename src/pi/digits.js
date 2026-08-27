// π computed in a Web Worker (Machin's formula, BigInt) so the UI never freezes.

export const TIERS = [
  { n: 10000, l: '10K' },
  { n: 50000, l: '50K' },
  { n: 100000, l: '100K' },
  { n: 200000, l: '200K' },
];
export const COUNT_DEFAULT = 50000;

const WORKER_SRC = `
function arctanInv(x, decimals, guard, onProg) {
  var scale = 10n ** BigInt(decimals + guard);
  var xB = BigInt(x), x2 = xB * xB;
  var term = scale / xB, sum = 0n, k = 0;
  var total = Math.ceil((decimals + guard) / (2 * Math.log10(x))) + 1;
  while (term > 0n) {
    var piece = term / BigInt(2 * k + 1);
    if (k & 1) sum -= piece; else sum += piece;
    term /= x2;
    if ((k & 1023) === 0) onProg(k / total);
    k++;
  }
  onProg(1);
  return sum / 10n ** BigInt(guard);
}
self.onmessage = function (e) {
  var n = e.data, guard = 12;
  var w1 = Math.ceil(n / 1.4), w2 = Math.ceil(n / 4.76);
  var a = arctanInv(5, n, guard, function (p) {
    self.postMessage({ type: 'p', v: (p * w1) / (w1 + w2) });
  });
  var b = arctanInv(239, n, guard, function (p) {
    self.postMessage({ type: 'p', v: (w1 + p * w2) / (w1 + w2) });
  });
  var pi = (16n * a - 4n * b).toString();
  var digits = pi.charAt(0) === '3' ? pi.slice(1, 1 + n) : pi.slice(0, n);
  self.postMessage({ type: 'done', digits: digits });
};
`;

const cache = new Map();

export function computePiDigits(count, onProgress) {
  if (cache.has(count)) {
    // instant replay for already-computed tiers
    const done = cache.get(count);
    if (done.then) return done;
    return Promise.resolve(done);
  }
  const promise = new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'p') onProgress?.(m.v);
      else {
        worker.terminate();
        URL.revokeObjectURL(url);
        cache.set(count, m.digits);
        resolve(m.digits);
      }
    };
    worker.onerror = err => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(err);
    };
    worker.postMessage(count);
  });
  cache.set(count, promise);
  return promise;
}
