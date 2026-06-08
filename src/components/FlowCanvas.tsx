import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Graph, Keyboard, MiniMap, Selection } from "@antv/x6";
import { useProjectStore } from "@/store/projectStore";
import { AddButton } from "./AddButton";
import { PlayButton } from "./PlayButton";
import { PlayValidationDialog } from "./PlayValidationDialog";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import { getPlayValidationMessage } from "@/core/model/playValidationMessage";
import {
  DEFAULT_NODE_WIDTH,
  findNonOverlappingPosition,
  MIN_NODE_GAP,
  type NodeWithPosition,
} from "@/utils/nodeOverlap";
import { createGraphOptions } from "@/x6/graphOptions";
import { bindGraphEvents, bindGraphKeyboard } from "@/x6/graphEvents";
import { bindGraphAssetDrop } from "@/x6/graphAssetDrop";
import { ensureShapesRegistered } from "@/x6/registerShapes";
import { syncProjectToGraph } from "@/x6/syncProjectToGraph";
import { VIEW_COMMANDS } from "@/core/view/viewCommands";
import { THEME_CHANGE_EVENT, getThemeCssVar } from "@/core/view/theme";
import { ThumbnailAspectRatioControl } from "@/components/ThumbnailAspectRatioControl";

type ContextMenu =
  | { type: "node"; id: string; x: number; y: number }
  | { type: "edge"; id: string; x: number; y: number };

function applyGraphTheme(graph: Graph): void {
  graph.drawBackground({
    color: getThemeCssVar("--app-canvas-bg") || "#f8f8f8",
  });
  graph.drawGrid({
    type: "dot",
    args: { color: getThemeCssVar("--app-grid-color") || "#ddd", thickness: 1 },
  });
}

export function FlowCanvas() {
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const setHighlightedRootNodeIds = useProjectStore((s) => s.setHighlightedRootNodeIds);
  const clearPlayValidationHighlight = useProjectStore((s) => s.clearPlayValidationHighlight);

  const navigate = useNavigate();
  const [playValidationMessage, setPlayValidationMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const isSyncingRef = useRef(false);
  const hasFitRef = useRef(false);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureShapesRegistered();
    const container = containerRef.current;
    if (!container) return;

    const graph = new Graph(createGraphOptions(container));
    graphRef.current = graph;

    if (minimapRef.current) {
      graph.use(
        new MiniMap({
          container: minimapRef.current,
          width: 160,
          height: 120,
        })
      );
    }

    graph.use(
      new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,
        rubberNode: true,
        rubberEdge: true,
        movable: true,
        strict: false,
        multipleSelectionModifiers: "shift",
        modifiers: "shift",
      })
    );

    const keyboard = new Keyboard({ enabled: true });
    graph.use(keyboard);
    bindGraphKeyboard(graph, keyboard);
    bindGraphEvents(graph, isSyncingRef);
    const unbindAssetDrop = bindGraphAssetDrop(graph);
    applyGraphTheme(graph);

    const syncGraphFromStore = () => {
      const state = useProjectStore.getState();
      syncProjectToGraph(
        graph,
        state.project,
        state.promptsByLocale,
        new Set(state.selectedNodeIds),
        new Set(state.selectedEdgeIds),
        new Set(state.highlightedRootNodeIds),
        isSyncingRef
      );

      if (state.selectedNodeIds.length === 0 && state.selectedEdgeIds.length === 0) {
        graph.cleanSelection();
      }

      if (!hasFitRef.current && state.project.nodes.length > 0) {
        graph.zoomToFit({ padding: 20 });
        hasFitRef.current = true;
      }
    };

    syncGraphFromStore();

    const unsubscribeProject = useProjectStore.subscribe((state, prevState) => {
      if (
        state.project === prevState.project &&
        state.promptsByLocale === prevState.promptsByLocale &&
        state.selectedNodeIds === prevState.selectedNodeIds &&
        state.selectedEdgeIds === prevState.selectedEdgeIds &&
        state.highlightedRootNodeIds === prevState.highlightedRootNodeIds
      ) {
        return;
      }
      syncGraphFromStore();
    });

    graph.on("blank:click", () => {
      setContextMenu(null);
    });

    graph.on("node:contextmenu", ({ e, node }) => {
      e.preventDefault();
      setContextMenu({
        type: "node",
        id: node.id,
        x: e.clientX,
        y: e.clientY,
      });
    });

    graph.on("edge:contextmenu", ({ e, edge }) => {
      e.preventDefault();
      setContextMenu({
        type: "edge",
        id: edge.id,
        x: e.clientX,
        y: e.clientY,
      });
    });

    return () => {
      unsubscribeProject();
      unbindAssetDrop();
      graph.dispose();
      graphRef.current = null;
      hasFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onThemeChange = () => {
      const graph = graphRef.current;
      if (graph) applyGraphTheme(graph);
    };
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  useEffect(() => {
    const onZoomIn = () => graphRef.current?.zoom(0.1);
    const onZoomOut = () => graphRef.current?.zoom(-0.1);
    const onZoomReset = () => graphRef.current?.zoomToFit({ padding: 20 });

    window.addEventListener(VIEW_COMMANDS.zoomIn, onZoomIn);
    window.addEventListener(VIEW_COMMANDS.zoomOut, onZoomOut);
    window.addEventListener(VIEW_COMMANDS.zoomReset, onZoomReset);
    return () => {
      window.removeEventListener(VIEW_COMMANDS.zoomIn, onZoomIn);
      window.removeEventListener(VIEW_COMMANDS.zoomOut, onZoomOut);
      window.removeEventListener(VIEW_COMMANDS.zoomReset, onZoomReset);
    };
  }, []);

  const onPlay = useCallback(() => {
    const state = useProjectStore.getState();
    const validation = validatePlayEntry(state.project);

    if (validation.ok) {
      clearPlayValidationHighlight();
      setPlayValidationMessage(null);
      navigate("/play");
      return;
    }

    setPlayValidationMessage(getPlayValidationMessage(validation));
    if (validation.reason === "multiple_entries") {
      setHighlightedRootNodeIds(validation.rootNodeIds);
      graphRef.current?.cleanSelection();
      for (const nodeId of validation.rootNodeIds) {
        const cell = graphRef.current?.getCellById(nodeId);
        if (cell) graphRef.current?.select(cell);
      }
      const firstRoot = graphRef.current?.getCellById(validation.rootNodeIds[0]);
      if (firstRoot) graphRef.current?.centerCell(firstRoot);
    } else {
      clearPlayValidationHighlight();
    }
  }, [clearPlayValidationHighlight, navigate, setHighlightedRootNodeIds]);

  const onAddNode = useCallback(() => {
    const store = useProjectStore.getState();
    store.beginHistoryTransaction();
    try {
      const newNode = store.addNode({ x: 100, y: 100 });
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
        useProjectStore.getState().updateNodePosition(newNode.id, resolved);
      }
    } finally {
      useProjectStore.getState().commitHistoryTransaction();
    }
  }, []);

  const placeClonedNode = useCallback(
    (sourceNodeId: string, linkToSource: boolean) => {
      if (!contextMenu || contextMenu.type !== "node") return;

      const store = useProjectStore.getState();
      const source = store.project.nodes.find((node) => node.id === sourceNodeId);
      if (!source) return;

      const proposedPosition = {
        x: source.position.x + DEFAULT_NODE_WIDTH + MIN_NODE_GAP,
        y: source.position.y,
      };

      store.beginHistoryTransaction();
      try {
        const cloned = store.cloneNode(sourceNodeId, proposedPosition);
        if (!cloned) {
          store.cancelHistoryTransaction();
          return;
        }

        const projectState = useProjectStore.getState().project;
        const resolved = findNonOverlappingPosition(
          cloned.id,
          cloned.position,
          projectState.nodes as NodeWithPosition[]
        );
        if (
          resolved.x !== cloned.position.x ||
          resolved.y !== cloned.position.y
        ) {
          useProjectStore.getState().updateNodePosition(cloned.id, resolved);
        }

        if (linkToSource) {
          useProjectStore.getState().addEdge(sourceNodeId, cloned.id);
        }

        store.setSelection([cloned.id], []);
        store.commitHistoryTransaction();
      } catch {
        store.cancelHistoryTransaction();
        return;
      }

      graphRef.current?.cleanSelection();
      const cell = graphRef.current?.getCellById(
        useProjectStore.getState().selectedNodeIds[0] ?? ""
      );
      if (cell) graphRef.current?.select(cell);

      setContextMenu(null);
    },
    [contextMenu]
  );

  const onCloneFromContextMenu = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "node") return;
    placeClonedNode(contextMenu.id, false);
  }, [contextMenu, placeClonedNode]);

  const onCloneAndLinkFromContextMenu = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "node") return;
    placeClonedNode(contextMenu.id, true);
  }, [contextMenu, placeClonedNode]);

  const onDeleteFromContextMenu = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.type === "node") {
      removeNode(contextMenu.id);
    } else {
      removeEdge(contextMenu.id);
    }
    clearSelection();
    graphRef.current?.cleanSelection();
    setContextMenu(null);
  }, [contextMenu, removeNode, removeEdge, clearSelection]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (
        menuRef.current &&
        target instanceof HTMLElement &&
        !menuRef.current.contains(target)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  const runZoom = useCallback((factor: number) => {
    graphRef.current?.zoom(factor);
  }, []);

  const runZoomToFit = useCallback(() => {
    graphRef.current?.zoomToFit({ padding: 20 });
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <AddButton onClick={onAddNode} title="Add scene" />
          <PlayButton onClick={onPlay} title="Play" />
        </div>
        <ThumbnailAspectRatioControl />
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            display: "flex",
            gap: 4,
            zIndex: 5,
          }}
        >
          <button type="button" className="app-toolbar-button" onClick={() => runZoom(0.1)}>
            +
          </button>
          <button type="button" className="app-toolbar-button" onClick={() => runZoom(-0.1)}>
            −
          </button>
          <button type="button" className="app-toolbar-button" onClick={runZoomToFit}>
            Fit
          </button>
        </div>
        <div
          ref={minimapRef}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            border: "1px solid var(--app-border)",
            borderRadius: 4,
            overflow: "hidden",
            zIndex: 5,
          }}
        />
      </div>
      {playValidationMessage && (
        <PlayValidationDialog
          message={playValidationMessage}
          onClose={() => setPlayValidationMessage(null)}
        />
      )}
      {contextMenu && (
        <div
          ref={menuRef}
          className="app-context-menu"
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
          }}
        >
          {contextMenu.type === "node" && (
            <>
              <button
                type="button"
                onClick={onCloneFromContextMenu}
                className="app-context-menu-item"
              >
                Clone
              </button>
              <button
                type="button"
                onClick={onCloneAndLinkFromContextMenu}
                className="app-context-menu-item"
              >
                Clone and link
              </button>
            </>
          )}
          <button type="button" onClick={onDeleteFromContextMenu} className="app-context-menu-item">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
