import type { ParameterInfo } from "../types/analysis";
import { formatNumber } from "../lib/format";

interface ParameterSlidersProps {
  parameters: ParameterInfo[];
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
}

interface Range {
  min: number;
  max: number;
  step: number;
}

/** 按参数名猜一个顺手的滑块范围，用户仍可在右侧直接键入精确值。 */
export function sliderRange(name: string, value: number): Range {
  const key = name.toLowerCase();
  let range: Range;

  if (key.includes("zeta") || key.includes("ζ") || key.includes("damp")) {
    range = { min: 0, max: 2, step: 0.01 };
  } else if (key.includes("wn") || key.includes("ωn") || key.includes("omega")) {
    range = { min: 0.1, max: 50, step: 0.1 };
  } else if (key === "k" || key.includes("gain")) {
    range = { min: 0, max: 100, step: 0.1 };
  } else {
    range = { min: 0, max: 10, step: 0.01 };
  }

  if (Math.abs(value) > range.max) {
    range = { ...range, max: Math.abs(value) * 1.5 };
  }
  return range;
}

export function ParameterSliders({ parameters, values, onChange }: ParameterSlidersProps) {
  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="param-sliders">
      <span className="param-group-title">未知参数</span>
      {parameters.map((parameter) => {
        const value = values[parameter.name] ?? parameter.value;
        const range = sliderRange(parameter.name, value);
        return (
          <div key={parameter.name} className="slider-row">
            <label className="slider-name" title={parameter.name}>
              {parameter.name}
            </label>
            <input
              className="slider"
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={Math.min(Math.max(value, range.min), range.max)}
              onChange={(event) => onChange(parameter.name, Number(event.target.value))}
            />
            <input
              className="text-input text-input-xs"
              value={Number.isFinite(value) ? formatNumber(value, 4) : ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  onChange(parameter.name, next);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
