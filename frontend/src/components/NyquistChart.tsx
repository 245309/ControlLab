import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { FrequencyInfo } from "../types/analysis";
import { formatNumber } from "../lib/format";
import { useEChart } from "./useEChart";

interface NyquistChartProps {
  frequency: FrequencyInfo;
}

function quantile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 1;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)));
  return sorted[index];
}

export function NyquistChart({ frequency }: NyquistChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const { nyquist } = frequency;
    const positive = nyquist.re.map((re, index) => [re, nyquist.im[index]] as [number, number]);
    const mirror = nyquist.re.map((re, index) => [re, -nyquist.im[index]] as [number, number]);

    const magnitudes = [...nyquist.re.map(Math.abs), ...nyquist.im.map(Math.abs)];
    const span = Math.min(Math.max(1.5, quantile(magnitudes, 0.8) * 1.35), 30);

    return {
      animationDuration: 380,
      grid: { left: 58, right: 26, top: 26, bottom: 46 },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const [re, im] = params.data as [number, number];
          return `${params.seriesName}<br/>Re = ${formatNumber(re, 4)}<br/>Im = ${formatNumber(im, 4)}`;
        },
      },
      xAxis: {
        type: "value",
        min: -span,
        max: span,
        name: "实部",
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 9, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#f1f4f9" } },
      },
      yAxis: {
        type: "value",
        min: -span,
        max: span,
        name: "虚部",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 9, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#f1f4f9" } },
      },
      series: [
        {
          name: "ω > 0",
          type: "line",
          showSymbol: false,
          data: positive,
          lineStyle: { color: "#4f46e5", width: 2 },
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(225, 29, 72, 0.04)" },
            data: [[{ xAxis: -span }, { xAxis: -1 }]],
          },
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: "#94a3b8", width: 1 },
            data: [{ xAxis: 0 }, { yAxis: 0 }],
          },
        },
        {
          name: "ω < 0（镜像）",
          type: "line",
          showSymbol: false,
          data: mirror,
          lineStyle: { color: "rgba(79, 70, 229, 0.35)", width: 1.5, type: "dashed" },
        },
        {
          name: "临界点 (-1, j0)",
          type: "scatter",
          symbol: "diamond",
          symbolSize: 13,
          data: [[-1, 0]],
          itemStyle: { color: "#e11d48" },
          label: {
            show: true,
            position: "bottom",
            fontSize: 10,
            color: "#e11d48",
            formatter: "(-1, j0)",
          },
        },
      ],
    };
  }, [frequency]);

  const ref = useEChart(option);

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2 className="card-title">Nyquist 图</h2>
        <span className={`scope-chip ${frequency.scope === "open" ? "scope-open" : "scope-closed"}`}>
          {frequency.scope === "open" ? "开环 L" : "闭环 T"}
        </span>
        <span className="card-tag">ω: 0⁺ → ∞</span>
      </div>
      <div ref={ref} className="chart chart-square" />
      <div className="card-foot">
        <span>实线为 ω&gt;0，虚线为镜像</span>
        <span className="legend-critical" />
        <span>
          {frequency.scope === "open"
            ? "(-1, j0) 是稳定判据的关键点"
            : "闭环曲线的 (-1, j0) 不作为开环稳定判据使用"}
        </span>
      </div>
    </section>
  );
}
