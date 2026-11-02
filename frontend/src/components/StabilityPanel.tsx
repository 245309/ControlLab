import type { StabilityInfo, Verdict } from "../types/analysis";
import { formatNumber } from "../lib/format";
import { MathText } from "./MathText";

interface StabilityPanelProps {
  stability: StabilityInfo;
  characteristicExpr: string;
  warnings: string[];
}

const VERDICT_META: Record<Verdict, { label: string; tone: string; caption: string }> = {
  stable: { label: "稳定", tone: "ok", caption: "全部闭环极点位于左半平面" },
  marginal: { label: "临界稳定", tone: "warn", caption: "存在虚轴极点，响应等幅振荡" },
  unstable: { label: "不稳定", tone: "bad", caption: "存在右半平面极点，响应发散" },
};

const SPECIAL_CASE_LABEL: Record<string, string> = {
  all_zero_row: "全零行",
  first_column_zero: "首列为零",
};

export function StabilityPanel({ stability, characteristicExpr, warnings }: StabilityPanelProps) {
  const meta = VERDICT_META[stability.verdict];
  const { necessary, routh, root_real_parts: roots } = stability.basis;

  return (
    <section className={`card verdict-card tone-${meta.tone}`}>
      <div className="characteristic">
        <span className="characteristic-label">特征方程</span>
        <span className="characteristic-expr">
          <MathText text={characteristicExpr} /> = 0
        </span>
        <span className="characteristic-hint">闭环极点即该方程的根</span>
      </div>

      <div className="verdict-head">
        <div className="verdict-badge">
          <span className="verdict-dot" />
          {meta.label}
        </div>
        <div className="verdict-text">
          <p className="verdict-summary">{stability.summary}</p>
          <p className="verdict-caption">{meta.caption}</p>
        </div>
      </div>

      <div className="basis-grid">
        <div className="basis-item">
          <div className="basis-head">
            <span className="basis-title">必要条件</span>
            <span className={`basis-flag ${necessary.all_coefficients_present && necessary.same_sign ? "flag-ok" : "flag-bad"}`}>
              {necessary.all_coefficients_present && necessary.same_sign ? "满足" : "不满足"}
            </span>
          </div>
          <p className="basis-text">{necessary.note}</p>
        </div>

        <div className="basis-item">
          <div className="basis-head">
            <span className="basis-title">Routh 首列变号</span>
            <span className={`basis-flag ${routh.sign_changes === 0 ? "flag-ok" : "flag-bad"}`}>
              {routh.sign_changes} 次
            </span>
          </div>
          <p className="basis-text">
            右半平面极点数 = {routh.sign_changes}
            {routh.special_case ? `（特殊情形：${SPECIAL_CASE_LABEL[routh.special_case] ?? routh.special_case}）` : ""}
          </p>
        </div>

        <div className="basis-item">
          <div className="basis-head">
            <span className="basis-title">极点实部</span>
            <span className={`basis-flag ${roots.has_rhp ? "flag-bad" : roots.on_imaginary_axis ? "flag-warn" : "flag-ok"}`}>
              max Re = {formatNumber(roots.max_real, 4)}
            </span>
          </div>
          <p className="basis-text">
            {roots.has_rhp ? "存在右半平面极点" : roots.on_imaginary_axis ? "存在虚轴极点" : "全部极点严格在左半平面"}
          </p>
        </div>
      </div>

      <details className="routh" open>
        <summary>
          Routh 表
          <span className="routh-meta">
            {routh.rows.length} 行 · 首列变号 {routh.sign_changes} 次
            {routh.special_case && ` · ${SPECIAL_CASE_LABEL[routh.special_case] ?? routh.special_case}`}
          </span>
        </summary>
        <div className="routh-scroll">
          <table className="routh-table">
            <thead>
              <tr>
                {routh.header.map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routh.rows.map((row, rowIndex) => (
                <tr key={routh.header[rowIndex] ?? rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="routh-note">{routh.note}</p>
      </details>

      {warnings.length > 0 && (
        <ul className="warning-list">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
