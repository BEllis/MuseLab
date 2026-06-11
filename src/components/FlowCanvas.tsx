import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Graph, Keyboard, MiniMap, Selection } from "@antv/x6";
import { getDefaultLocale, getNodeTextTemplateForLocale } from "@/core/locale/prompts";
import { isSceneNode } from "@/core/model/nodeTypes";
import { selectActiveStory, useProjectStore } from "@/store/projectStore";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import { ADD_NODE_MENU_OPTIONS, AddNodeMenu } from "./AddNodeMenu";
import type { StoryNodeType } from "@/core/model/types";
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
import { bindGraphEvents, bindGraphKeyboard, type ConnectionDropOnBlank } from "@/x6/graphEvents";
import {
  CONNECTION_DROP_LABELS,
  type ConnectionDropAction,
  canSourceStartConnection,
  connectionDropMenuOptions,
  proposedNodePositionAtPoint,
  proposedNodePositionAtViewportCenter,
} from "@/x6/connectionDrop";
import { bindGraphAssetDrop } from "@/x6/graphAssetDrop";
import { ensureShapesRegistered } from "@/x6/registerShapes";
import { syncProjectToGraph } from "@/x6/syncProjectToGraph";
import { VIEW_COMMANDS } from "@/core/view/viewCommands";
import { THEME_CHANGE_EVENT, getThemeCssVar } from "@/core/view/theme";
import { ThumbnailAspectRatioControl } from "@/components/ThumbnailAspectRatioControl";
import { ScenePreviewOverlay } from "@/components/NodeEditor/ScenePreviewOverlay";

type ContextMenu =
  | { type: "node"; id: string; x: number; y: number }
  | { type: "edge"; id: string; x: number; y: number };

type ConnectionDropMenuState = ConnectionDropOnBlank;

type BlankAddMenuState = {
  clientX: number;
  clientY: number;
  graphPoint: { x: number; y: number };
};

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
  const project = useProjectStore((s) => s.project);
  const activeStoryId = useProjectStore((s) => s.activeStoryId);
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
  const [connectionDropMenu, setConnectionDropMenu] = useState<ConnectionDropMenuState | null>(
    null
  );
  const [blankAddMenu, setBlankAddMenu] = useState<BlankAddMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const connectionDropMenuRef = useRef<HTMLDivElement>(null);
  const blankAddMenuRef = useRef<HTMLDivElement>(null);

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
    bindGraphEvents(graph, isSyncingRef, {
      onConnectionDropOnBlank: (payload) => {
        setContextMenu(null);
        setBlankAddMenu(null);
        setConnectionDropMenu(payload);
      },
    });
    const unbindAssetDrop = bindGraphAssetDrop(graph);
    applyGraphTheme(graph);

    const syncGraphFromStore = (fullRefresh = false) => {
      isSyncingRef.current = true;
      try {
        const state = useProjectStore.getState();
        const story = selectActiveStory(state.project, state.activeStoryId);
        syncProjectToGraph(
          graph,
          state.project,
          story,
          state.activeStoryId,
          state.promptsByLocale,
          new Set(state.selectedNodeIds),
          new Set(state.selectedEdgeIds),
          new Set(state.highlightedRootNodeIds),
          undefined,
          fullRefresh ? { fullRefresh: true } : undefined
        );

        if (state.selectedNodeIds.length === 0 && state.selectedEdgeIds.length === 0) {
          graph.cleanSelection();
        } else if (fullRefresh) {
          graph.cleanSelection();
          for (const nodeId of state.selectedNodeIds) {
            const cell = graph.getCellById(nodeId);
            if (cell) graph.select(cell);
          }
          for (const edgeId of state.selectedEdgeIds) {
            const cell = graph.getCellById(edgeId);
            if (cell) graph.select(cell);
          }
        }

        if (!hasFitRef.current && story.nodes.length > 0) {
          // Cap zoom so a lone start node is not blown up to fill the canvas.
          graph.zoomToFit({ padding: 20, maxScale: 1 });
          hasFitRef.current = true;
        }
      } finally {
        isSyncingRef.current = false;
      }
    };

    syncGraphFromStore();

    const unsubscribeProject = useProjectStore.subscribe((state, prevState) => {
      const fullRefresh =
        state.graphRevision !== prevState.graphRevision ||
        state.activeStoryId !== prevState.activeStoryId;
      if (
        !fullRefresh &&
        state.project === prevState.project &&
        state.promptsByLocale === prevState.promptsByLocale &&
        state.selectedNodeIds === prevState.selectedNodeIds &&
        state.selectedEdgeIds === prevState.selectedEdgeIds &&
        state.highlightedRootNodeIds === prevState.highlightedRootNodeIds
      ) {
        return;
      }
      if (fullRefresh) {
        hasFitRef.current = false;
      }
      syncGraphFromStore(fullRefresh);
    });

    graph.on("blank:click", () => {
      setContextMenu(null);
      setConnectionDropMenu(null);
      setBlankAddMenu(null);
    });

    graph.on("blank:contextmenu", ({ e, x, y }) => {
      e.preventDefault();
      setContextMenu(null);
      setConnectionDropMenu(null);
      const graphPoint =
        typeof x === "number" && typeof y === "number"
          ? { x, y }
          : graph.clientToLocal(e.clientX, e.clientY);
      setBlankAddMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        graphPoint,
      });
    });

    graph.on("node:contextmenu", ({ e, node }) => {
      e.preventDefault();
      setBlankAddMenu(null);
      const store = useProjectStore.getState();
      store.setSelection([node.id], []);
      graph.cleanSelection();
      graph.select(node);
      setContextMenu({
        type: "node",
        id: node.id,
        x: e.clientX,
        y: e.clientY,
      });
    });

    graph.on("edge:contextmenu", ({ e, edge }) => {
      e.preventDefault();
      setBlankAddMenu(null);
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
    const story = selectActiveStory(state.project, state.activeStoryId);
    const validation = validatePlayEntry(story);

    if (validation.ok) {
      clearPlayValidationHighlight();
      setPlayValidationMessage(null);
      navigate("/play");
      return;
    }

    setPlayValidationMessage(getPlayValidationMessage(validation));
    if (
      validation.reason === "invalid_entry" ||
      validation.reason === "no_entry_configured"
    ) {
      const highlightId =
        validation.reason === "invalid_entry" ? validation.entryNodeId : undefined;
      const ids = highlightId ? [highlightId] : [];
      setHighlightedRootNodeIds(ids);
      graphRef.current?.cleanSelection();
      if (highlightId) {
        const cell = graphRef.current?.getCellById(highlightId);
        if (cell) {
          graphRef.current?.select(cell);
          graphRef.current?.centerCell(cell);
        }
      }
    } else {
      clearPlayValidationHighlight();
    }
  }, [clearPlayValidationHighlight, navigate, setHighlightedRootNodeIds]);

  const addNodeAtPosition = useCallback(
    (type: StoryNodeType, graphPoint?: { x: number; y: number } | null) => {
      const store = useProjectStore.getState();
      const story = selectActiveStory(store.project, store.activeStoryId);
      const graph = graphRef.current;
      const container = containerRef.current;
      const initialPosition = graphPoint
        ? proposedNodePositionAtPoint(graphPoint, story.nodes as NodeWithPosition[])
        : graph && container
          ? proposedNodePositionAtViewportCenter(
              graph,
              container,
              story.nodes as NodeWithPosition[]
            )
          : { x: 100, y: 100 };

      store.beginHistoryTransaction();
      try {
        const newNode = store.addNode(initialPosition, { type });
        const nextStory = selectActiveStory(store.project, store.activeStoryId);
        const resolved = findNonOverlappingPosition(
          newNode.id,
          newNode.position,
          nextStory.nodes as NodeWithPosition[]
        );
        if (resolved.x !== newNode.position.x || resolved.y !== newNode.position.y) {
          useProjectStore.getState().updateNodePosition(newNode.id, resolved);
        }
        if (type === "start") {
          const storyAfterAdd = selectActiveStory(
            useProjectStore.getState().project,
            useProjectStore.getState().activeStoryId
          );
          if (!storyAfterAdd.entryNodeId) {
            useProjectStore.getState().updateStory(store.activeStoryId, {
              entryNodeId: newNode.id,
            });
          }
        }
      } finally {
        useProjectStore.getState().commitHistoryTransaction();
      }
    },
    []
  );

  const onAddNode = useCallback(
    (type: StoryNodeType) => {
      addNodeAtPosition(type);
    },
    [addNodeAtPosition]
  );

  const onBlankAddNode = useCallback(
    (type: StoryNodeType) => {
      if (!blankAddMenu) return;
      addNodeAtPosition(type, blankAddMenu.graphPoint);
      setBlankAddMenu(null);
    },
    [addNodeAtPosition, blankAddMenu]
  );

  const placeClonedNode = useCallback(
    (sourceNodeId: string, linkToSource: boolean) => {
      if (!contextMenu || contextMenu.type !== "node") return;

      const store = useProjectStore.getState();
      const story = selectActiveStory(store.project, store.activeStoryId);
      const source = story.nodes.find((node) => node.id === sourceNodeId);
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

        const nextStory = selectActiveStory(
          useProjectStore.getState().project,
          useProjectStore.getState().activeStoryId
        );
        const resolved = findNonOverlappingPosition(
          cloned.id,
          cloned.position,
          nextStory.nodes as NodeWithPosition[]
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

  const openSceneNodePromptFromContextMenu = useCallback(
    (mode: "view" | "edit") => {
      if (!contextMenu || contextMenu.type !== "node") return;

      const store = useProjectStore.getState();
      const story = selectActiveStory(store.project, store.activeStoryId);
      const node = story.nodes.find((entry) => entry.id === contextMenu.id);
      if (!node || !isSceneNode(node)) return;

      const locale = getDefaultLocale(store.project);
      const draftTemplate = getNodeTextTemplateForLocale(
        store.promptsByLocale,
        locale,
        store.activeStoryId,
        node.id
      );

      store.setSelection([node.id], []);
      graphRef.current?.cleanSelection();
      const cell = graphRef.current?.getCellById(node.id);
      if (cell) graphRef.current?.select(cell);

      const previewStore = useSceneEditorPreviewStore.getState();
      if (mode === "view") {
        previewStore.showPreview({ locale, draftTemplate, editingTemplate: false });
      } else {
        previewStore.showTemplateEditor(locale, draftTemplate);
      }

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

  const onConnectionDropAction = useCallback(
    (action: ConnectionDropAction) => {
      if (action === "cancel" || !connectionDropMenu) {
        setConnectionDropMenu(null);
        return;
      }

      const store = useProjectStore.getState();
      const story = selectActiveStory(store.project, store.activeStoryId);
      const source = story.nodes.find((node) => node.id === connectionDropMenu.sourceId);
      if (!canSourceStartConnection(source)) {
        setConnectionDropMenu(null);
        return;
      }

      const proposedPosition = proposedNodePositionAtPoint(
        connectionDropMenu.graphPoint,
        story.nodes as NodeWithPosition[]
      );

      store.beginHistoryTransaction();
      try {
        let newNode;
        if (action === "clone-scene") {
          if (!source || source.type !== "scene") {
            store.cancelHistoryTransaction();
            setConnectionDropMenu(null);
            return;
          }
          newNode = store.cloneNode(connectionDropMenu.sourceId, proposedPosition);
        } else if (action === "new-scene") {
          newNode = store.addNode(proposedPosition, { type: "scene" });
        } else {
          newNode = store.addNode(proposedPosition, { type: "jump" });
        }

        if (!newNode) {
          store.cancelHistoryTransaction();
          setConnectionDropMenu(null);
          return;
        }

        const nextStory = selectActiveStory(
          useProjectStore.getState().project,
          useProjectStore.getState().activeStoryId
        );
        const resolved = findNonOverlappingPosition(
          newNode.id,
          newNode.position,
          nextStory.nodes as NodeWithPosition[]
        );
        if (resolved.x !== newNode.position.x || resolved.y !== newNode.position.y) {
          useProjectStore.getState().updateNodePosition(newNode.id, resolved);
        }

        store.addEdge(connectionDropMenu.sourceId, newNode.id, {
          sourcePortId: connectionDropMenu.sourcePort,
        });
        store.setSelection([newNode.id], []);
        store.commitHistoryTransaction();
      } catch {
        store.cancelHistoryTransaction();
      }

      graphRef.current?.cleanSelection();
      const cell = graphRef.current?.getCellById(
        useProjectStore.getState().selectedNodeIds[0] ?? ""
      );
      if (cell) graphRef.current?.select(cell);

      setConnectionDropMenu(null);
    },
    [connectionDropMenu]
  );

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
    if (!contextMenu && !connectionDropMenu && !blankAddMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (menuRef.current?.contains(target)) return;
      if (connectionDropMenuRef.current?.contains(target)) return;
      if (blankAddMenuRef.current?.contains(target)) return;
      setContextMenu(null);
      setConnectionDropMenu(null);
      setBlankAddMenu(null);
    };
    // Defer so the mouseup that finishes a connector drag does not immediately dismiss the menu.
    const listenerTimer = window.setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      window.clearTimeout(listenerTimer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu, connectionDropMenu, blankAddMenu]);

  const runZoom = useCallback((factor: number) => {
    graphRef.current?.zoom(factor);
  }, []);

  const runZoomToFit = useCallback(() => {
    graphRef.current?.zoomToFit({ padding: 20 });
  }, []);

  const connectionDropSource = connectionDropMenu
    ? selectActiveStory(project, activeStoryId).nodes.find(
        (node) => node.id === connectionDropMenu.sourceId
      )
    : undefined;

  const contextMenuNode =
    contextMenu?.type === "node"
      ? selectActiveStory(project, activeStoryId).nodes.find((node) => node.id === contextMenu.id)
      : undefined;
  const contextMenuSceneNode =
    contextMenuNode != null && isSceneNode(contextMenuNode) ? contextMenuNode : undefined;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <ScenePreviewOverlay />
      <AddNodeMenu onAdd={onAddNode} variant="overlay" />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
        }}
      >
        <ThumbnailAspectRatioControl variant="overlay" />
      </div>
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 6,
        }}
      >
        <PlayButton onClick={onPlay} title="Play" variant="overlay" />
      </div>
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
      {playValidationMessage && (
        <PlayValidationDialog
          message={playValidationMessage}
          onClose={() => setPlayValidationMessage(null)}
        />
      )}
      {blankAddMenu && (
        <div
          ref={blankAddMenuRef}
          className="app-context-menu"
          style={{
            position: "fixed",
            left: blankAddMenu.clientX,
            top: blankAddMenu.clientY,
            zIndex: 1000,
            minWidth: "180px",
          }}
        >
          {ADD_NODE_MENU_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              className="app-context-menu-item"
              onClick={() => onBlankAddNode(option.type)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {connectionDropMenu && (
        <div
          ref={connectionDropMenuRef}
          className="app-context-menu"
          style={{
            position: "fixed",
            left: connectionDropMenu.clientX,
            top: connectionDropMenu.clientY,
            zIndex: 1000,
          }}
        >
          {connectionDropMenuOptions(connectionDropSource).map((action) => (
            <button
              key={action}
              type="button"
              className="app-context-menu-item"
              onClick={() => onConnectionDropAction(action)}
            >
              {CONNECTION_DROP_LABELS[action]}
            </button>
          ))}
        </div>
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
              {contextMenuSceneNode && (
                <>
                  <button
                    type="button"
                    onClick={() => openSceneNodePromptFromContextMenu("view")}
                    className="app-context-menu-item"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => openSceneNodePromptFromContextMenu("edit")}
                    className="app-context-menu-item"
                  >
                    Edit
                  </button>
                </>
              )}
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
