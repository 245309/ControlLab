import { formatCoefficient } from "../lib/format";
import type { CoefficientTerm } from "../lib/coefficients";

interface CoefficientInputProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  terms: CoefficientTerm[];
}

function powerLabel(power: number): string {
  if (power === 0) {
    return "常数项";
  }
  if (power === 1) {
    return "s";
  }
  return `s^${power}`;
}

export function CoefficientInput({ label, hint, value, onChange, error, terms }: CoefficientInputProps) {
  return (
    <div className="field">
      <div className="field-head">
        <label className="field-label">{label}</label>
        <span className="field-hint">{hint}</span>
      </div>
      <input
        className={`text-input ${error ? "has-error" : ""}`}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如 1 2 10"
      />
      {error ? (
        <p className="field-error">{error}</p>
      ) : (
        <div className="chips">
          {terms.length === 0 && <span className="chip chip-empty">等待输入</span>}
          {terms.map((term) => (
            <span
              key={term.power}
              className={`chip ${term.value === 0 ? "chip-muted" : ""}`}
              title={powerLabel(term.power)}
            >
              <span className="chip-value">{formatCoefficient(term.value)}</span>
              <span className="chip-power">{powerLabel(term.power)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
