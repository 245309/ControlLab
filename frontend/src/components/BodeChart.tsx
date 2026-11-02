import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { FrequencyInfo } from "../types/analysis";
import { formatNumber } from "../lib/format";
import { useEChart } from "./useEChart";

interface BodeChartProps {
  frequency: FrequencyInfo;
}

export function BodeChart({ frequency }: BodeChartProps) {
  const { bode, gain_crossover, phase_crossover } = frequency;

  const option = useMemo<EChartsOption>(() => {
    const magnitude = bode.omega.map((omega, index) => [omega, bode.magnitude_db[index]] as [number, number]);
    const phase = bode.omega.map((omega, index) => [omega, bode.phase_deg[index]] as [number, number]);

    const crossings: any[] = [];
    if (gain_crossover !== null) {
      crossings.push({
        xAxis: gain_crossover,
        lineStyle: { color: "#f59e0b", type: "dashed", width: 1 },
        label: { formatter: "ωc", position: "insideEndTop", fontSize: 10, color: "#d97706" },
      });
    }
    if (phase_crossover !== null) {
      crossings.push({
        xAxis: phase_crossover,
        lineStyle: { color: "#e11d48", type: "dashed", width: 1 },
        label: { formatter: "ωg", position: "insideEndTop", fontSize: 10, color: "#e11d48" },
      });
    }

    return {
      animationDuration: 380,
      grid: [
        { left: 62, right: 26, top: 30, height: "33%" },
        { left: 62, right: 26, top: "58%", height: "32%" },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", lineStyle: { color: "#cbd5e1" } },
        formatter: (params: any) => {
          const list = Array.isArray(params) ? params : [params];
          const omega = list[0]?.data?.[0];
          const rows = list.map((item: any) => {
            const unit = item.seriesName === "幅频" ? " dB" : "°";
            return `${item.marker}${item.seriesName}：${formatNumber(item.data[1], 3)}${unit}`;
          });
          return `ω = ${formatNumber(omega, 3)} rad/s<br/>${rows.join("<br/>")}`;
        },
      },
      xAxis: [
        {
          type: "log",
          gridIndex: 0,
          min: frequency.omega_min,
          max: frequency.omega_max,
          axisLabel: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#f1f4f9" } },
        },
        {
          type: "log",
          gridIndex: 1,
          min: frequency.omega_min,
          max: frequency.omega_max,
          name: "ω / (rad/s)",
          nameLocation: "middle",
          nameGap: 26,
          nameTextStyle: { fontSize: 11, color: "#94a3b8" },
          axisLabel: { fontSize: 9, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 3) },
          splitLine: { lineStyle: { color: "#f1f4f9" } },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          name: "L(ω) / dB",
          nameTextStyle: { fontSize: 11, color: "#94a3b8" },
          axisLabel: { fontSize: 9, color: "#94a3b8" },
          splitLine: { lineStyle: { color: "#f1f4f9" } },
        },
        {
          type: "value",
          gridIndex: 1,
          name: "φ(ω) / °",
          nameTextStyle: { fontSize: 11, color: "#94a3b8" },
          axisLabel: { fontSize: 9, color: "#94a3b8" },
          splitLine: { lineStyle: { color: "#f1f4f9" } },
          min: (value: any) => Math.min(-180, Math.ceil(value.min / 45) * 45),
          max: (value: any) => Math.max(0, Math.floor(value.max / 45) * 45),
        },
      ],
      series: [
        {
          name: "幅频",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          data: magnitude,
          lineStyle: { color: "#4f46e5", width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(79, 70, 229, 0.18)" },
                { offset: 1, color: "rgba(79, 70, 229, 0.01)" },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: "none",
            label: { formatter: "0 dB", fontSize: 9, color: "#94a3b8" },
            lineStyle: { color: "#cbd5e1", type: "dashed", width: 1 },
            data: [{ yAxis: 0 }, ...crossings],
          },
        },
        {
          name: "相频",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          showSymbol: false,
          data: phase,
          lineStyle: { color: "#0ea5e9", width: 2 },
          markLine: {
            silent: true,
            symbol: "none",
            label: { formatter: "-180°", position: "insideEndTop", fontSize: 9, color: "#94a3b8" },
            lineStyle: { color: "#cbd5e1", type: "dashed", width: 1 },
            data: [{ yAxis: -180 }],
          },
        },
      ],
    };
  }, [bode, gain_crossover, phase_crossover, frequency.omega_min, frequency.omega_max]);

  const ref = useEChart(option);

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2 className="card-title">Bode 图</h2>
        <span className="card-tag">幅频 / 相频</span>
      </div>
      <div ref={ref} className="chart chart-bode" />
      <div className="card-foot">
        <span>ω 范围 {formatNumber(frequency.omega_min, 3)} – {formatNumber(frequency.omega_max, 3)} rad/s</span>
        <span>
          相角裕度 γ ={" "}
          {frequency.phase_margin_deg === null ? "—" : `${formatNumber(frequency.phase_margin_deg, 2)}°`}
        </span>
        <span>
          幅值裕度 Kg ={" "}
          {frequency.gain_margin_db === null ? "—" : `${formatNumber(frequency.gain_margin_db, 2)} dB`}
        </span>
        {frequency.note && <span className="foot-note">{frequency.note}</span>}
      </div>
    </section>
  );
}
