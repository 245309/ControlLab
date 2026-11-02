import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";

export function SignedEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const signed = Boolean(data?.signed);
  const sign = (data?.sign as number) ?? 1;
  const { setEdges } = useReactFlow();

  // 符号贴近比较点入端，而不是画在连线中点：教科书里 ± 号标在汇合处。
  const badgeX = sourceX + (targetX - sourceX) * 0.8;
  const badgeY = sourceY + (targetY - sourceY) * 0.8;

  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id ? { ...edge, data: { ...edge.data, sign: sign > 0 ? -1 : 1 } } : edge,
      ),
    );
  };

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ strokeWidth: 1.6, stroke: "#64748b" }} />
      {signed && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`edge-sign ${sign < 0 ? "negative" : ""}`}
            style={{
              position: "absolute",
              pointerEvents: "all",
              transform: `translate(-50%, -50%) translate(${badgeX}px, ${badgeY}px)`,
            }}
            title={sign < 0 ? "点击改为正号" : "点击改为负号"}
            onClick={toggle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {sign < 0 ? "−" : "+"}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
