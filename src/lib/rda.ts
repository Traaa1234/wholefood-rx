type Num = number | string | null | undefined;

function toNum(v: Num): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function pctRda(amount: Num, rda: Num): number | null {
  const a = toNum(amount);
  const r = toNum(rda);
  if (a === null || r === null || r === 0) return null;
  return Math.round((a / r) * 100);
}
