import { MathText } from "./MathText";
import type { TransferFunctionInfo } from "../types/analysis";

interface FormulaViewProps {
  numExpr: string;
  denExpr: string;
  quotientExpr: string | null;
  openLoop?: TransferFunctionInfo | null;
}

function Fraction({ numExpr, denExpr }: { numExpr: string; denExpr: string }) {
  return (
    <span className="fraction">
      <span className="fraction-num">
        <MathText text={numExpr} />
      </span>
      <span className="fraction-den">
        <MathText text={denExpr} />
      </span>
    </span>
  );
}

export function FormulaView({ numExpr, denExpr, quotientExpr, openLoop }: FormulaViewProps) {
  return (
    <div className="formula">
      {openLoop && (
        <div className="formula-main formula-open">
          <span className="formula-lhs">L(s) =</span>
          <Fraction numExpr={openLoop.num_expr} denExpr={openLoop.den_expr} />
          <span className="formula-arrow">⟶ 单位负反馈 ⟶</span>
        </div>
      )}
      <div className="formula-main">
        <span className="formula-lhs">{openLoop ? "T(s) =" : "G(s) ="}</span>
        <Fraction numExpr={numExpr} denExpr={denExpr} />
      </div>
      {quotientExpr && (
        <div className="formula-extra">
          = <MathText text={quotientExpr} /> + 真分式
        </div>
      )}
      {openLoop && (
        <div className="formula-extra">
          T(s) = L(s) / (1 + L(s))，闭环特征方程取 T(s) 的分母
        </div>
      )}
    </div>
  );
}
