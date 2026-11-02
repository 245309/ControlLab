import type { MasonInfo } from "../../types/diagram";

interface Props {
  mason: MasonInfo;
  labels: Record<string, string>;
}

function pathLabel(nodes: string[], labels: Record<string, string>): string {
  return nodes.map((id) => labels[id] || id).join(" → ");
}

export function MasonPanel({ mason, labels }: Props) {
  const hasContent = mason.forward_paths.length > 0 || mason.loops.length > 0;
  if (!hasContent) return null;

  return (
    <details className="mason" open>
      <summary>
        <span>Mason 增益公式</span>
        <span className="mason-meta">
          {mason.forward_paths.length} 条前向通路 · {mason.loops.length} 个回路
        </span>
      </summary>

      <div className="mason-body">
        <div className="mason-group">
          <span className="mason-title">前向通路 P</span>
          {mason.forward_paths.map((path, index) => (
            <div className="mason-row" key={`p-${index}`}>
              <span className="mason-tag">P{index + 1}</span>
              <span className="mason-chain">{pathLabel(path.nodes, labels)}</span>
              <span className="mason-gain">{path.gain_expr}</span>
            </div>
          ))}
        </div>

        <div className="mason-group">
          <span className="mason-title">回路 L</span>
          {mason.loops.length === 0 ? (
            <div className="mason-row">
              <span className="mason-empty">无闭合回路（开环系统）</span>
            </div>
          ) : (
            mason.loops.map((loop, index) => (
              <div className="mason-row" key={`l-${index}`}>
                <span className="mason-tag">L{index + 1}</span>
                <span className="mason-chain">{pathLabel(loop.nodes, labels)}</span>
                <span className="mason-gain">{loop.gain_expr}</span>
              </div>
            ))
          )}
        </div>

        <div className="mason-group">
          <span className="mason-title">特征式</span>
          <div className="mason-row">
            <span className="mason-tag">Δ</span>
            <span className="mason-gain wide">{mason.delta_expr}</span>
          </div>
          <div className="mason-row">
            <span className="mason-tag">T</span>
            <span className="mason-gain wide">
              ({mason.numerator_expr}) / ({mason.denominator_expr})
            </span>
          </div>
        </div>
      </div>
    </details>
  );
}
