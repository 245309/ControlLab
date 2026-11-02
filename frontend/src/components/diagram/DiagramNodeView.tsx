import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { DiagramNodeData } from "../../types/diagram";

const LABEL_FALLBACK: Record<string, string> = {
  input: "R(s)",
  output: "Y(s)",
  sum: "E(s)",
  takeoff: "",
  block: "",
};

export function DiagramNodeView(props: NodeProps) {
  const data = props.data as unknown as DiagramNodeData;
  const selected = props.selected ? "node-selected" : "";
  const label = data.label || LABEL_FALLBACK[data.kind] || "";

  if (data.kind === "input" || data.kind === "output") {
    return (
      <div className={`diagram-terminal ${data.kind} ${selected}`}>
        {data.kind === "output" && <Handle type="target" position={Position.Left} id="in" />}
        <span>{label}</span>
        {data.kind === "input" && <Handle type="source" position={Position.Right} id="out" />}
      </div>
    );
  }

  if (data.kind === "sum") {
    return (
      <div className={`diagram-sum ${selected}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="target" position={Position.Bottom} id="in-bottom" />
        <div className="diagram-sum-body" aria-label="比较点">
          <svg className="sum-cross" viewBox="0 0 36 36" aria-hidden="true">
            <line x1="6.5" y1="6.5" x2="29.5" y2="29.5" />
            <line x1="29.5" y1="6.5" x2="6.5" y2="29.5" />
          </svg>
        </div>
        <span className="diagram-sum-label">{label}</span>
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    );
  }

  if (data.kind === "takeoff") {
    return (
      <div className={`diagram-takeoff ${selected}`} title={label || "引出点"}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="diagram-takeoff-dot" />
        <Handle type="source" position={Position.Right} id="out" />
        <Handle type="source" position={Position.Bottom} id="out-bottom" />
      </div>
    );
  }

  // 环节：flipped 时信号从右往左流（反馈支路）
  const flipped = Boolean(data.flipped);
  return (
    <div className={`diagram-block ${flipped ? "flipped" : ""} ${selected}`}>
      <Handle type="target" position={flipped ? Position.Right : Position.Left} id="in" />
      <span className="diagram-block-name">{label || "G"}</span>
      <span className="diagram-block-formula">{data.formula || "1"}</span>
      <Handle type="source" position={flipped ? Position.Left : Position.Right} id="out" />
    </div>
  );
}
