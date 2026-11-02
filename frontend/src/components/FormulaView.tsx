import { MathText } from "./MathText";

interface FormulaViewProps {
  numExpr: string;
  denExpr: string;
  quotientExpr: string | null;
}

export function FormulaView({ numExpr, denExpr, quotientExpr }: FormulaViewProps) {
  return (
    <div className="formula">
      <div className="formula-main">
        <span className="formula-lhs">G(s) =</span>
        <span className="fraction">
          <span className="fraction-num">
            <MathText text={numExpr} />
          </span>
          <span className="fraction-den">
            <MathText text={denExpr} />
          </span>
        </span>
      </div>
      {quotientExpr && (
        <div className="formula-extra">
          = <MathText text={quotientExpr} /> + 真分式
        </div>
      )}
    </div>
  );
}
