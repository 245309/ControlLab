import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type Position,
} from "@xyflow/react";

interface Point {
  x: number;
  y: number;
}

const STUB = 18; // 出/入端直线段长度
const LANE = 70; // 反馈绕行时的通道偏移

function direction(pos: Position): Point {
  switch (pos) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 1 };
  }
}

/** 直角折线（曼哈顿路由）：出端直行 → 折线 → 入端直行，全部 90° 拐角。 */
function buildPoints(
  sx: number,
  sy: number,
  sourcePosition: Position,
  tx: number,
  ty: number,
  targetPosition: Position,
): Point[] {
  const sDir = direction(sourcePosition);
  const tDir = direction(targetPosition);
  const s: Point = { x: sx + sDir.x * STUB, y: sy + sDir.y * STUB };
  const t: Point = { x: tx + tDir.x * STUB, y: ty + tDir.y * STUB };
  const sHorizontal = sDir.x !== 0;
  const tHorizontal = tDir.x !== 0;

  const points: Point[] = [{ x: sx, y: sy }, s];

  if (sHorizontal && tHorizontal) {
    const forward = sDir.x > 0 ? t.x >= s.x - 1 : t.x <= s.x + 1;
    if (forward && Math.abs(s.y - t.y) <= 3) {
      // 只差几个像素（布局取整误差）时不要拉出小台阶
      points.push({ x: t.x, y: s.y });
    } else if (forward) {
      const midX = (s.x + t.x) / 2;
      points.push({ x: midX, y: s.y }, { x: midX, y: t.y });
    } else {
      // 反向（例如反馈绕回左侧）：下沉到一条通道再横向折回
      const laneY = Math.max(s.y, t.y) + LANE;
      points.push({ x: s.x, y: laneY }, { x: t.x, y: laneY });
    }
  } else if (!sHorizontal && !tHorizontal) {
    // 两端都是竖直方向（例如引出点向下进比较点底部）：走底部通道
    const laneY = Math.max(s.y, t.y) + LANE;
    points.push({ x: s.x, y: laneY }, { x: t.x, y: laneY });
  } else if (sHorizontal) {
    points.push({ x: t.x, y: s.y });
  } else {
    points.push({ x: s.x, y: t.y });
  }

  points.push(t, { x: tx, y: ty });

  // 去掉相邻重复点，避免 d 属性里出现零长度线段
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.abs(point.x - previous.x) > 0.5 || Math.abs(point.y - previous.y) > 0.5;
  });
}

function toPath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

export function OrthogonalEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    selected,
  } = props;

  const signed = Boolean(data?.signed);
  const sign = (data?.sign as number) ?? 1;
  const { setEdges } = useReactFlow();

  const points = buildPoints(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition);
  const path = toPath(points);

  // 符号画在比较点入端附近：沿入射方向退 16px，再向侧面让开 11px，避免压住箭头
  const approach = direction(targetPosition);
  const badgeX = targetX + approach.x * 16 - approach.y * 11;
  const badgeY = targetY + approach.y * 16 + approach.x * 11;

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
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={14}
        style={{ stroke: selected ? "#2563eb" : "#64748b", strokeWidth: 1.6 }}
      />
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
