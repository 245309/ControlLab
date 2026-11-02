import { useCallback } from "react";
import {
  Background,
  Controls,
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
import { SignedEdge } from "./SignedEdge";

const nodeTypes: NodeTypes = { diagram: DiagramNodeView };
const edgeTypes: EdgeTypes = { signed: SignedEdge };

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
      const isSum = (target?.data as DiagramNodeData | undefined)?.kind === "sum";
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
            type: "signed",
            data: { sign: 1, signed: isSum },
          },
          current,
        ),
      );
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
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "signed" }}
        deleteKeyCode={["Delete", "Backspace"]}
      >
        <Background gap={18} size={1.4} color="#dbe3ef" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
