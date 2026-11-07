import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { ComplexNumber } from "../types/analysis";
import { formatComplex, formatNumber } from "../lib/format";
import { useEChart } from "./useEChart";

interface PoleZeroChartProps {
  poles: ComplexNumber[];
  zeros: ComplexNumber[];
  /** 卡片标题；单位负反馈模式下传入「闭环极零点分布」 */
  title?: string;
  /** 卡片右上角标签 */
  tag?: string;
}

interface AxisRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function niceSpan(raw: number): number {
  const value = Math.max(raw, 1);
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const fraction = value / base;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const step = steps.find((candidate) => fraction <= candidate + 1e-9) ?? 10;
  return step * base;
}

function computeRange(poles: ComplexNumber[], zeros: ComplexNumber[]): AxisRange {
  const points = [...poles, ...zeros];
  if (points.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }

  const maxRe = Math.max(1, ...points.map((point) => Math.abs(point.re)));
  const maxIm = Math.max(0, ...points.map((point) => Math.abs(point.im)));
  const spanX = niceSpan(maxRe * 1.3);
  const spanY = niceSpan(Math.max(maxIm * 1.3, spanX * 0.5));
  return { minX: -spanX, maxX: spanX, minY: -spanY, maxY: spanY };
}

export function PoleZeroChart({
  poles,
  zeros,
  title = "极点零点分布",
  tag = "s 平面",
}: PoleZeroChartProps) {
  const range = useMemo(() => computeRange(poles, zeros), [poles, zeros]);

  const option = useMemo<EChartsOption>(
    () => ({
      animationDuration: 350,
      grid: { left: 64, right: 26, top: 40, bottom: 46 },
      legend: {
        top: 2,
        right: 8,
        data: ["极点", "零点"],
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 11, color: "#64748b" },
      },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const [re, im] = params.data as [number, number, string];
          const symbol = params.seriesName === "极点" ? "极点" : "零点";
          return `${symbol}<br/>${formatComplex(re, im, 4)}`;
        },
      },
      xAxis: {
        type: "value",
        min: range.minX,
        max: range.maxX,
        name: "实部 σ",
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 10, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      yAxis: {
        type: "value",
        min: range.minY,
        max: range.maxY,
        name: "虚部 jω",
        nameLocation: "middle",
        nameGap: 46,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 10, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      series: [
        {
          name: "极点",
          type: "scatter",
          symbol: "diamond",
          symbolSize: 13,
          data: poles.map((point) => [point.re, point.im, "pole"]),
          itemStyle: { color: "#e11d48" },
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(225, 29, 72, 0.05)" },
            data: [[{ xAxis: 0 }, { xAxis: range.maxX }]],
          },
        },
        {
          name: "零点",
          type: "scatter",
          symbol: "circle",
          symbolSize: 12,
          data: zeros.map((point) => [point.re, point.im, "zero"]),
          itemStyle: { color: "#ffffff", borderColor: "#2563eb", borderWidth: 2 },
        },
        {
          name: "坐标轴",
          type: "scatter",
          data: [],
          silent: true,
          tooltip: { show: false },
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: "#94a3b8", width: 1 },
            data: [{ xAxis: 0 }, { yAxis: 0 }],
          },
        },
      ],
    }),
    [poles, zeros, range],
  );

  const ref = useEChart(option);

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
        <span className="card-tag">{tag}</span>
      </div>
      <div ref={ref} className="chart chart-square" />
      <div className="card-foot">
        <span className="legend-dot legend-pole" /> 极点
        <span className="legend-dot legend-zero" /> 零点
        <span className="legend-shade" /> 右半平面（不稳定区）
      </div>
    </section>
  );
}
