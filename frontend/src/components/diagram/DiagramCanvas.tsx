import { useCallback } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";

import type { DiagramNodeData } from "../../types/diagram";
import { DiagramNodeView } from "./DiagramNodeView";
import { OrthogonalEdge } from "./OrthogonalEdge";

const nodeTypes: NodeTypes = { diagram: DiagramNodeView };
const edgeTypes: EdgeTypes = { orthogonal: OrthogonalEdge };

export const EDGE_DEFAULTS = {
  type: "orthogonal",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#64748b" },
} as const;

interface Props {
  nodes: Node<DiagramNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<Node<DiagramNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onSelectNode: (nodeId: string | null) => void;
}

export function DiagramCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function DiagramCanvasInner({ nodes, edges, onNodesChange, onEdgesChange, setEdges, onSelectNode }: Props) {
  const { screenToFlowPosition } = useReactFlow();
  void screenToFlowPosition;

  const onConnect = useCallback(
    (connection: Connection) => {
      const target = nodes.find((node) => node.id === connection.target);
      const targetKind = (target?.data as DiagramNodeData | undefined)?.kind;
      setEdges((current) => {
        // 同一对节点之间只保留一条线，避免重复回路把 Δ 算歪
        if (current.some((edge) => edge.source === connection.source && edge.target === connection.target)) {
          return current;
        }
        return addEdge(
          {
            ...connection,
            ...EDGE_DEFAULTS,
            id: `e-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
            data: { sign: 1, signed: targetKind === "sum" },
          },
          current,
        );
      });
    },
    [nodes, setEdges],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);
      if (!source || !target || source.id === target.id) return false;
      if ((source.data as DiagramNodeData).kind === "output") return false;
      if ((target.data as DiagramNodeData).kind === "input") return false;
      return true;
    },
    [nodes],
  );

  return (
    <div className="diagram-canvas" onDragOver={(event) => event.preventDefault()}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        defaultEdgeOptions={EDGE_DEFAULTS}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Delete", "Backspace"]}
        connectionLineStyle={{ stroke: "#64748b", strokeWidth: 1.6 }}
      >
        <Background gap={18} size={1.4} color="#dbe3ef" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
