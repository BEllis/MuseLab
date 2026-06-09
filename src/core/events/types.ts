import type {
  ActorExpression,
  Asset,
  EndNodeLayout,
  Project,
  ModuleInterface,
  Story,
  StoryEdge,
  StoryNode,
} from "@/core/model/types";
import type { LocalePrompts, StoryPrompts } from "@/core/model/types";
import type { NavigationSnapshot, SelectionSnapshot } from "./appState";

export type AppEventBase = {
  id: string;
  timestamp: number;
};

export type ProjectPatch = Partial<
  Pick<
    Project,
    "name" | "thumbnailAspectRatio" | "playerResolution" | "locales" | "promptRendererTypescriptSource"
  >
>;

export type StoryPatch = Partial<Pick<Story, "name" | "entryNodeId" | "globalState">>;

export type NodePatch = Partial<Omit<StoryNode, "id">>;

export type EdgePatch = Partial<Pick<StoryEdge, "condition" | "vertices" | "manualRoute">>;

export type AssetPatch = Partial<
  Pick<Asset, "name" | "personality" | "appearance" | "backstory" | "notes" | "expressions">
>;

export type ModulePatch = Partial<
  Pick<ModuleInterface, "name" | "bindingName" | "methods" | "typescriptSource">
>;

export type ExpressionPatch = Partial<Pick<ActorExpression, "name">>;

export type NodePromptValue = { textTemplate?: string; speaker?: string };

export type EdgePromptValue = { optionText?: string };

export type RemoveNodePayload = {
  node: StoryNode;
  edges: StoryEdge[];
  entryNodeId?: string;
  nodePromptsByLocale: Record<string, NodePromptValue>;
};

export type RemoveEdgePayload = {
  edge: StoryEdge;
  edgePromptsByLocale: Record<string, EdgePromptValue>;
};

export type RemoveStoryPayload = {
  story: Story;
  storyPromptsByLocale: Record<string, StoryPrompts>;
};

export type RemoveLocalePayload = {
  locale: string;
  localePrompts: LocalePrompts;
};

export type UpdateProjectEvent = AppEventBase & {
  type: "updateProject";
  before: ProjectPatch;
  after: ProjectPatch;
};

export type AddLocaleEvent = AppEventBase & {
  type: "addLocale";
  locale: string;
  before: null;
  after: { locale: string; localePrompts: LocalePrompts };
};

export type RemoveLocaleEvent = AppEventBase & {
  type: "removeLocale";
  before: RemoveLocalePayload;
  after: null;
};

export type AddStoryEvent = AppEventBase & {
  type: "addStory";
  before: NavigationSnapshot;
  after: { story: Story; navigation: NavigationSnapshot };
};

export type RemoveStoryEvent = AppEventBase & {
  type: "removeStory";
  before: RemoveStoryPayload & { navigation: NavigationSnapshot };
  after: NavigationSnapshot;
};

export type UpdateStoryEvent = AppEventBase & {
  type: "updateStory";
  storyId: string;
  before: StoryPatch;
  after: StoryPatch;
};

export type AddNodeEvent = AppEventBase & {
  type: "addNode";
  storyId: string;
  before: null;
  after: StoryNode;
};

export type CloneNodeEvent = AppEventBase & {
  type: "cloneNode";
  storyId: string;
  sourceNodeId: string;
  before: null;
  after: { node: StoryNode; nodePromptsByLocale: Record<string, NodePromptValue> };
};

export type RemoveNodeEvent = AppEventBase & {
  type: "removeNode";
  storyId: string;
  before: RemoveNodePayload;
  after: null;
};

export type UpdateNodeEvent = AppEventBase & {
  type: "updateNode";
  storyId: string;
  nodeId: string;
  before: NodePatch;
  after: NodePatch;
};

export type UpdateNodePositionEvent = AppEventBase & {
  type: "updateNodePosition";
  storyId: string;
  nodeId: string;
  before: { x: number; y: number };
  after: { x: number; y: number };
};

export type UpdateEndNodeLayoutEvent = AppEventBase & {
  type: "updateEndNodeLayout";
  storyId: string;
  sceneId: string;
  before: EndNodeLayout | null;
  after: EndNodeLayout;
};

export type AddEdgeEvent = AppEventBase & {
  type: "addEdge";
  storyId: string;
  before: null;
  after: StoryEdge;
};

export type RemoveEdgeEvent = AppEventBase & {
  type: "removeEdge";
  storyId: string;
  before: RemoveEdgePayload;
  after: null;
};

export type UpdateEdgeEvent = AppEventBase & {
  type: "updateEdge";
  storyId: string;
  edgeId: string;
  before: EdgePatch;
  after: EdgePatch;
};

export type UpdateNodePromptEvent = AppEventBase & {
  type: "updateNodePrompt";
  storyId: string;
  locale: string;
  nodeId: string;
  before: string;
  after: string;
};

export type UpdateNodeSpeakerEvent = AppEventBase & {
  type: "updateNodeSpeaker";
  storyId: string;
  locale: string;
  nodeId: string;
  before: string;
  after: string;
};

export type UpdateEdgePromptEvent = AppEventBase & {
  type: "updateEdgePrompt";
  storyId: string;
  locale: string;
  edgeId: string;
  before: string | undefined;
  after: string | undefined;
};

export type AddAssetEvent = AppEventBase & {
  type: "addAsset";
  before: null;
  after: Asset;
};

export type AddBlankActorEvent = AppEventBase & {
  type: "addBlankActor";
  before: null;
  after: Asset;
};

export type AddActorFromImageEvent = AppEventBase & {
  type: "addActorFromImage";
  before: null;
  after: Asset;
};

export type UpdateAssetEvent = AppEventBase & {
  type: "updateAsset";
  assetId: string;
  before: AssetPatch;
  after: AssetPatch;
};

export type ReplaceAssetMediaEvent = AppEventBase & {
  type: "replaceAssetMedia";
  assetId: string;
  before: Pick<Asset, "path" | "url" | "blobStored">;
  after: Pick<Asset, "path" | "url" | "blobStored">;
};

export type RemoveAssetEvent = AppEventBase & {
  type: "removeAsset";
  before: { asset: Asset; navigation: SelectionSnapshot };
  after: SelectionSnapshot;
};

export type AddActorExpressionEvent = AppEventBase & {
  type: "addActorExpression";
  actorId: string;
  before: null;
  after: ActorExpression;
};

export type UpdateActorExpressionEvent = AppEventBase & {
  type: "updateActorExpression";
  actorId: string;
  expressionId: string;
  before: ExpressionPatch;
  after: ExpressionPatch;
};

export type ReplaceActorExpressionMediaEvent = AppEventBase & {
  type: "replaceActorExpressionMedia";
  actorId: string;
  expressionId: string;
  before: Pick<ActorExpression, "path" | "url" | "blobStored">;
  after: Pick<ActorExpression, "path" | "url" | "blobStored">;
};

export type RemoveActorExpressionEvent = AppEventBase & {
  type: "removeActorExpression";
  actorId: string;
  before: ActorExpression;
  after: null;
};

export type AddModuleEvent = AppEventBase & {
  type: "addModule";
  before: SelectionSnapshot;
  after: { module: ModuleInterface; navigation: SelectionSnapshot };
};

export type RemoveModuleEvent = AppEventBase & {
  type: "removeModule";
  before: { module: ModuleInterface; navigation: SelectionSnapshot };
  after: SelectionSnapshot;
};

export type UpdateModuleEvent = AppEventBase & {
  type: "updateModule";
  moduleId: string;
  before: ModulePatch;
  after: ModulePatch;
};

export type SetActiveStoryIdEvent = AppEventBase & {
  type: "setActiveStoryId";
  before: NavigationSnapshot;
  after: NavigationSnapshot;
};

export type SetSelectionEvent = AppEventBase & {
  type: "setSelection";
  before: SelectionSnapshot;
  after: SelectionSnapshot;
};

export type SetSelectedAssetIdEvent = AppEventBase & {
  type: "setSelectedAssetId";
  before: SelectionSnapshot;
  after: SelectionSnapshot;
};

export type SetSelectedModuleIdEvent = AppEventBase & {
  type: "setSelectedModuleId";
  before: SelectionSnapshot;
  after: SelectionSnapshot;
};

export type ClearSelectionEvent = AppEventBase & {
  type: "clearSelection";
  before: SelectionSnapshot;
  after: SelectionSnapshot;
};

export type SetHighlightedRootNodeIdsEvent = AppEventBase & {
  type: "setHighlightedRootNodeIds";
  before: string[];
  after: string[];
};

export type ClearPlayValidationHighlightEvent = AppEventBase & {
  type: "clearPlayValidationHighlight";
  before: string[];
  after: string[];
};

export type BatchEvent = AppEventBase & {
  type: "batch";
  events: AppEvent[];
};

export type AppEvent =
  | UpdateProjectEvent
  | AddLocaleEvent
  | RemoveLocaleEvent
  | AddStoryEvent
  | RemoveStoryEvent
  | UpdateStoryEvent
  | AddNodeEvent
  | CloneNodeEvent
  | RemoveNodeEvent
  | UpdateNodeEvent
  | UpdateNodePositionEvent
  | UpdateEndNodeLayoutEvent
  | AddEdgeEvent
  | RemoveEdgeEvent
  | UpdateEdgeEvent
  | UpdateNodePromptEvent
  | UpdateNodeSpeakerEvent
  | UpdateEdgePromptEvent
  | AddAssetEvent
  | AddBlankActorEvent
  | AddActorFromImageEvent
  | UpdateAssetEvent
  | ReplaceAssetMediaEvent
  | RemoveAssetEvent
  | AddActorExpressionEvent
  | UpdateActorExpressionEvent
  | ReplaceActorExpressionMediaEvent
  | RemoveActorExpressionEvent
  | AddModuleEvent
  | RemoveModuleEvent
  | UpdateModuleEvent
  | SetActiveStoryIdEvent
  | SetSelectionEvent
  | SetSelectedAssetIdEvent
  | SetSelectedModuleIdEvent
  | ClearSelectionEvent
  | SetHighlightedRootNodeIdsEvent
  | ClearPlayValidationHighlightEvent
  | BatchEvent;

export function getEventType(event: AppEvent): AppEvent["type"] {
  return event.type;
}

export function eventTouchesProjectData(event: AppEvent): boolean {
  switch (event.type) {
    case "setSelection":
    case "setSelectedAssetId":
    case "setSelectedModuleId":
    case "clearSelection":
    case "setHighlightedRootNodeIds":
    case "clearPlayValidationHighlight":
      return false;
    case "setActiveStoryId":
    case "addStory":
    case "removeStory":
      return true;
    case "batch":
      return event.events.some(eventTouchesProjectData);
    default:
      return true;
  }
}

export function eventTouchesActiveStory(event: AppEvent): boolean {
  switch (event.type) {
    case "setActiveStoryId":
    case "addStory":
    case "removeStory":
      return true;
    case "batch":
      return event.events.some(eventTouchesActiveStory);
    default:
      return false;
  }
}
