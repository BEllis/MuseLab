import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Connection,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
  type EdgeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { useProjectStore } from "@/store/projectStore";
import { StoryNode as StoryNodeComponent } from "./StoryNode";
import { StoryEdge as StoryEdgeComponent } from "./StoryEdge";
import { AddButton } from "./AddButton";
import { PlayButton } from "./PlayButton";
import {
  findNonOverlappingPosition,
  type NodeWithPosition,
} from "@/utils/nodeOverlap";

const nodeTypes: NodeTypes = { storyNode: StoryNodeComponent };
const edgeTypes: EdgeTypes = { storyEdge: StoryEdgeComponent };

type ProjectEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  optionText?: string;
  condition?: string;
};

function projectToFlow(
  nodes: Array<{ id: string; position: { x: number; y: number }; label?: string; textTemplate: string }>,
  edges: ProjectEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: "storyNode",
    position: n.position,
    data: {
      label: n.label,
      preview: n.textTemplate.slice(0, 60) || "(no text)",
    },
  }));

  const flowEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "storyEdge",
    data: { optionText: e.optionText, condition: e.condition },
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}

type ContextMenu =
  | { type: "node"; id: string; x: number; y: number }
  | { type: "edge"; id: string; x: number; y: number };

export function FlowCanvas() {
  const { project, addNode, removeNode, updateNodePosition, addEdge, removeEdge } =
    useProjectStore();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { nodes, edges } = useMemo(
    () => projectToFlow(project.nodes, project.edges),
    [project.nodes, project.edges]
  );

  const isValidConnection = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    return true;
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      addEdge(connection.source, connection.target);
    },
    [addEdge]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, __: Node, nodesList: Node[]) => {
      nodesList.forEach((n) => {
        if (!n.position) return;
        const allNodes: NodeWithPosition[] = project.nodes.map((nn) => ({
          id: nn.id,
          position:
            nn.id === n.id
              ? { x: n.position.x, y: n.position.y }
              : (nn.position ?? { x: 0, y: 0 }),
        }));
        const resolved = findNonOverlappingPosition(n.id, n.position, allNodes);
        updateNodePosition(n.id, resolved);
      });
    },
    [project.nodes, updateNodePosition]
  );

  const onNodesChangeWithSync: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((c) => {
        if (c.type === "remove" && c.id) removeNode(c.id);
        if (c.type === "position" && c.id && c.position) {
          const newPosition = c.position;
          const allNodes: NodeWithPosition[] = project.nodes.map((nn) => ({
            id: nn.id,
            position: nn.id === c.id ? newPosition : (nn.position ?? { x: 0, y: 0 }),
          }));
          const resolved = findNonOverlappingPosition(c.id, newPosition, allNodes);
          updateNodePosition(c.id, resolved);
        }
      });
    },
    [project.nodes, removeNode, updateNodePosition]
  );

  const onEdgesChangeWithSync: OnEdgesChange = useCallback(
    (changes) => {
      changes.forEach((c) => {
        if (c.type === "remove" && c.id) removeEdge(c.id);
      });
    },
    [removeEdge]
  );

  const onAddNode = useCallback(() => {
    const newNode = addNode({ x: 100, y: 100 });
    const projectState = useProjectStore.getState().project;
    const resolved = findNonOverlappingPosition(
      newNode.id,
      newNode.position,
      projectState.nodes as NodeWithPosition[]
    );
    if (
      resolved.x !== newNode.position.x ||
      resolved.y !== newNode.position.y
    ) {
      updateNodePosition(newNode.id, resolved);
    }
  }, [addNode, updateNodePosition]);

  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeId = useProjectStore((s) => s.setSelectedEdgeId);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [setSelectedNodeId, setSelectedEdgeId]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
    },
    [setSelectedEdgeId, setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ type: "node", id: node.id, x: e.clientX, y: e.clientY });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setContextMenu({ type: "edge", id: edge.id, x: e.clientX, y: e.clientY });
  }, []);

  const onDeleteFromContextMenu = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.type === "node") {
      removeNode(contextMenu.id);
      setSelectedNodeId(null);
    } else {
      removeEdge(contextMenu.id);
      setSelectedEdgeId(null);
    }
    setContextMenu(null);
  }, [contextMenu, removeNode, removeEdge, setSelectedNodeId, setSelectedEdgeId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (menuRef.current && target instanceof HTMLElement && !menuRef.current.contains(target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
        <AddButton onClick={onAddNode} title="Add scene" />
        <PlayButton href="/play" />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeWithSync}
          onEdgesChange={onEdgesChangeWithSync}
          isValidConnection={isValidConnection}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          elevateEdgesOnSelect
          fitView
          connectionRadius={250}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            background: "#fff",
            border: "1px solid #999",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: "4px 0",
            minWidth: "120px",
          }}
        >
          <button
            type="button"
            onClick={onDeleteFromContextMenu}
            style={{
              display: "block",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "none",
              textAlign: "left",
              fontSize: "13px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#eee";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
