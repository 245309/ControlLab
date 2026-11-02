export interface ParsedCoefficients {
  values: number[];
  error: string | null;
}

export function parseCoefficients(text: string): ParsedCoefficients {
  const tokens = text
    .split(/[\s,，;；]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { values: [], error: "请输入系数（降幂，空格或逗号分隔）" };
  }

  const values: number[] = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value)) {
      return { values: [], error: `无法解析的系数：「${token}」` };
    }
    values.push(value);
  }

  return { values, error: null };
}

export interface CoefficientTerm {
  power: number;
  value: number;
}

export function toTerms(values: number[]): CoefficientTerm[] {
  const degree = values.length - 1;
  return values.map((value, index) => ({ power: degree - index, value }));
}
