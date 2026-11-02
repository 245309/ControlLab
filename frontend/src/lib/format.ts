export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "+∞" : "−∞";
  }
  if (value !== 0 && (Math.abs(value) >= 10000 || Math.abs(value) < 0.001)) {
    return value.toExponential(2);
  }
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function formatComplex(re: number, im: number, digits = 3): string {
  const real = formatNumber(re, digits);
  if (Math.abs(im) < 1e-9) {
    return real;
  }
  const sign = im >= 0 ? "+" : "−";
  return `${real} ${sign} j${formatNumber(Math.abs(im), digits)}`;
}

export function formatCoefficient(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return formatNumber(value, 4);
}
