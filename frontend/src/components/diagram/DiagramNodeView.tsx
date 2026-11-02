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
        <div className="diagram-sum-body">Σ</div>
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
      </div>
    );
  }

  return (
    <div className={`diagram-block ${selected}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <span className="diagram-block-name">{label || "G"}</span>
      <span className="diagram-block-formula">{data.formula || "1"}</span>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
