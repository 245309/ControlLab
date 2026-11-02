import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { StepMetricsInfo } from "../types/analysis";
import { formatNumber } from "../lib/format";
import { useEChart } from "./useEChart";

interface StepResponseChartProps {
  t: number[];
  y: number[];
  metrics: StepMetricsInfo;
  band: number;
}

export function StepResponseChart({ t, y, metrics, band }: StepResponseChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const points = t.map((time, index) => [time, y[index]] as [number, number]);
    const yss = metrics.steady_state;

    const markLineData: any[] = [];
    if (yss !== null && metrics.defined) {
      markLineData.push({
        yAxis: yss,
        lineStyle: { color: "#64748b", type: "dashed", width: 1 },
        label: {
          formatter: "稳态值",
          position: "insideEndBottom",
          fontSize: 10,
          color: "#64748b",
        },
      });
      const tolerance = Math.abs(yss) * band;
      markLineData.push({
        yAxis: yss + tolerance,
        lineStyle: { color: "#f59e0b", type: "dotted", width: 1 },
        label: { formatter: `+${band * 100}%`, position: "insideStartTop", fontSize: 9, color: "#d97706" },
      });
      markLineData.push({
        yAxis: yss - tolerance,
        lineStyle: { color: "#f59e0b", type: "dotted", width: 1 },
        label: { formatter: `−${band * 100}%`, position: "insideStartBottom", fontSize: 9, color: "#d97706" },
      });
    }

    const markPointData: any[] = [];
    if (metrics.peak_time !== null && yss !== null && metrics.overshoot_pct !== null && metrics.overshoot_pct > 0.1) {
      markPointData.push({
        coord: [metrics.peak_time, Math.max(...y)],
        value: `${formatNumber(metrics.overshoot_pct, 2)}%`,
      });
    }

    return {
      animationDuration: 400,
      grid: { left: 60, right: 26, top: 30, bottom: 46 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", lineStyle: { color: "#cbd5e1" } },
        formatter: (params: any) => {
          const item = Array.isArray(params) ? params[0] : params;
          const [time, value] = item.data as [number, number];
          return `t = ${formatNumber(time, 3)} s<br/>y(t) = ${formatNumber(value, 4)}`;
        },
      },
      xAxis: {
        type: "value",
        name: "t / s",
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 10, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#eef2f7" } },
        min: 0,
        max: t.length > 0 ? t[t.length - 1] : 1,
      },
      yAxis: {
        type: "value",
        name: "y(t)",
        nameLocation: "middle",
        nameGap: 44,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 10, color: "#94a3b8" },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      series: [
        {
          name: "阶跃响应",
          type: "line",
          smooth: false,
          showSymbol: false,
          data: points,
          lineStyle: { color: "#4f46e5", width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(79, 70, 229, 0.22)" },
                { offset: 1, color: "rgba(79, 70, 229, 0.02)" },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: "none",
            data: markLineData,
          },
          markPoint: {
            symbol: "circle",
            symbolSize: 9,
            itemStyle: { color: "#e11d48", borderColor: "#ffffff", borderWidth: 1.5 },
            label: {
              position: "top",
              fontSize: 10,
              color: "#e11d48",
              fontWeight: 600,
              formatter: "σ={c}",
            },
            data: markPointData,
          },
        },
      ],
    };
  }, [t, y, metrics, band]);

  const ref = useEChart(option);

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2 className="card-title">单位阶跃响应</h2>
        <span className="card-tag">时域</span>
      </div>
      <div ref={ref} className="chart chart-square" />
      <div className="card-foot">
        {metrics.defined ? (
          <>
            <span>稳态值 {formatNumber(metrics.steady_state, 3)}</span>
            <span>峰值 {formatNumber(metrics.peak_time, 3)} s</span>
            <span>超调 {formatNumber(metrics.overshoot_pct, 2)} %</span>
            <span>±{band * 100}% 误差带</span>
          </>
        ) : (
          <span>{metrics.note ?? "时域指标不适用"}</span>
        )}
      </div>
    </section>
  );
}
