import type { StepMetricsInfo } from "../types/analysis";
import { formatNumber } from "../lib/format";

interface MetricsGridProps {
  metrics: StepMetricsInfo;
  band: number;
}

interface MetricItem {
  label: string;
  value: string;
  unit: string;
  hint: string;
}

export function MetricsGrid({ metrics, band }: MetricsGridProps) {
  const defined = metrics.defined;
  const items: MetricItem[] = [
    {
      label: "超调量 σ%",
      value: defined ? formatNumber(metrics.overshoot_pct, 2) : "—",
      unit: defined ? "%" : "",
      hint: "峰值相对稳态值的百分比",
    },
    {
      label: "峰值时间 tp",
      value: defined ? formatNumber(metrics.peak_time, 3) : "—",
      unit: defined ? "s" : "",
      hint: "首次到达峰值的时间",
    },
    {
      label: "上升时间 tr",
      value: defined ? formatNumber(metrics.rise_time, 3) : "—",
      unit: defined ? "s" : "",
      hint: "欠阻尼取首次到达稳态值，过阻尼取 10%→90%",
    },
    {
      label: "调节时间 ts",
      value: defined ? formatNumber(metrics.settling_time, 3) : "—",
      unit: defined ? "s" : "",
      hint: `进入 ±${band * 100}% 误差带且不再离开`,
    },
    {
      label: "稳态误差 ess",
      value: defined ? formatNumber(metrics.steady_state_error, 4) : "—",
      unit: "",
      hint: "单位阶跃输入（0 型系统）",
    },
    {
      label: "稳态值 y(∞)",
      value: metrics.steady_state === null ? (defined ? "∞" : "—") : formatNumber(metrics.steady_state, 4),
      unit: "",
      hint: "终值定理 num(0)/den(0)",
    },
  ];

  return (
    <section className="metrics">
      {items.map((item) => (
        <div key={item.label} className="metric-card" title={item.hint}>
          <span className="metric-label">{item.label}</span>
          <span className={`metric-value ${item.value === "—" ? "metric-muted" : ""}`}>
            {item.value}
            {item.unit && item.value !== "—" && <span className="metric-unit">{item.unit}</span>}
          </span>
        </div>
      ))}
    </section>
  );
}
