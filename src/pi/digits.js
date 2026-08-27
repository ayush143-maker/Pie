// Machin's formula:  π = 16·arctan(1/5) − 4·arctan(1/239)
// Each arctan series only divides a huge integer by a tiny one → very fast in BigInt.

export const PI_COUNT = 20000;

const CHECK_50 = '14159265358979323846264338327950288419716939937510';

function arctanInv(x, decimals) {
  const guard = 12;
  const scale = 10n ** BigInt(decimals + guard);
  const xBig = BigInt(x);
  const x2 = xBig * xBig;
  let term = scale / xBig;
  let sum = 0n;
  let k = 0;
  while (term > 0n) {
    const piece = term / BigInt(2 * k + 1);
    if ((k & 1) === 0) sum += piece;
    else sum -= piece;
    term /= x2;
    k += 1;
  }
  return sum / 10n ** BigInt(guard);
}

let cache = null;

export function computePiDigits(count = PI_COUNT) {
  cache ??= (async () => {
    const tick = () => new Promise(r => setTimeout(r, 30)); // let the loading state paint
    await tick();
    const a = arctanInv(5, count + 1);
    await tick();
    const b = arctanInv(239, count + 1);
    const pi = (16n * a - 4n * b).toString(); // "31415…" × 10^n
    const digits = pi.startsWith('3') ? pi.slice(1, 1 + count) : pi.slice(0, count);
    if (!digits.startsWith(CHECK_50)) console.warn('PiLex: π self-check failed');
    return digits;
  })();
  return cache;
}
