import type { Project, Story } from "../model/types";
import type { ProjectBundle } from "../model/projectBundle";
import { getFirstStoryId } from "../model/project";
import { getNodeDisplayName, resolveJumpTargetStoryId } from "../model/nodeNames";
import { getPlayEntryNodeId } from "../model/graphHierarchy";
import { isJumpNode, isSceneNode, isStartNode } from "../model/nodeTypes";
import { buildExportCiPreamble } from "../modules/generateModuleCi";
import { assetArchivePath, extensionForMime } from "../project/assetArchivePaths";
import { compileProjectExportCi } from "./compileProjectExportCi";
import { escapeCiStringLiteral } from "./ciString";

function ifEqualsIntChain(
  subject: string,
  cases: { value: number; result: string }[],
  fallback: string
): string {
  const lines: string[] = [];
  for (const entry of cases) {
    lines.push(`if (${subject} == ${entry.value})`);
    lines.push(`    return ${entry.result};`);
  }
  lines.push(`return ${fallback};`);
  return lines.join("\n        ");
}

function ifEqualsChain(
  subject: string,
  cases: { value: string; result: string }[],
  fallback: string
): string {
  const lines: string[] = [];
  for (const entry of cases) {
    lines.push(`if (${subject} == ${escapeCiStringLiteral(entry.value)})`);
    lines.push(`    return ${entry.result};`);
  }
  if (fallback.startsWith("throw ")) {
    lines.push(fallback.endsWith(";") ? fallback : `${fallback};`);
  } else {
    lines.push(`return ${fallback};`);
  }
  return lines.join("\n        ");
}

function getStoryGroupPath(project: Project, groupId?: string): string {
  if (!groupId) return "";
  const groups = project.storyGroups ?? [];
  const segments: string[] = [];
  let current: string | undefined = groupId;
  while (current) {
    const group = groups.find((entry) => entry.id === current);
    if (!group) break;
    segments.unshift(group.name);
    current = group.parentGroupId;
  }
  return segments.join("/");
}

function generateStoryResolvers(project: Project): string {
  const entryCases = project.stories
    .map((story) => {
      const entry = getPlayEntryNodeId(story);
      if (!entry) return null;
      return { value: story.id, result: escapeCiStringLiteral(entry) };
    })
    .filter((entry): entry is { value: string; result: string } => entry != null);

  const startNodeCases: { storyId: string; value: string; result: string }[] = [];
  for (const story of project.stories) {
    for (const node of story.nodes) {
      if (!isStartNode(node)) continue;
      startNodeCases.push({
        storyId: story.id,
        value: getNodeDisplayName(node, project),
        result: escapeCiStringLiteral(node.id),
      });
    }
  }

  const resolveStoryLines = [
    `public static string ResolveStoryId(string groupPath, string storyName)`,
    `{`,
  ];
  for (const story of project.stories) {
    const groupPath = getStoryGroupPath(project, story.groupId);
    resolveStoryLines.push(
      `    if (groupPath == ${escapeCiStringLiteral(groupPath)} && storyName == ${escapeCiStringLiteral(story.name)}) return ${escapeCiStringLiteral(story.id)};`
    );
  }
  resolveStoryLines.push(`    return "";`);
  resolveStoryLines.push(`}`);

  const resolveEntryLines = [
    `public static string GetStoryEntryNodeId(string storyId)`,
    `{`,
    ifEqualsChain(
      "storyId",
      entryCases,
      `""`
    ),
    `}`,
  ];

  const resolveStartByNameLines = [
    `public static string ResolveStartNodeId(string storyId, string startNodeName)`,
    `{`,
  ];
  for (const entry of startNodeCases) {
    resolveStartByNameLines.push(
      `    if (storyId == ${escapeCiStringLiteral(entry.storyId)} && startNodeName == ${escapeCiStringLiteral(entry.value)}) return ${entry.result};`
    );
  }
  resolveStartByNameLines.push(`    return "";`);
  resolveStartByNameLines.push(`}`);

  return [...resolveStoryLines, ``, ...resolveEntryLines, ``, ...resolveStartByNameLines].join("\n    ");
}

function nodeMatchCondition(storyId: string, nodeId: string): string {
  return `storyId == ${escapeCiStringLiteral(storyId)} && nodeId == ${escapeCiStringLiteral(nodeId)}`;
}

function generateNodeLookups(project: Project): string {
  const lines: string[] = [];

  lines.push(`public static int GetNodeKind(string storyId, string nodeId)
    {`);
  for (const story of project.stories) {
    for (const node of story.nodes) {
      const kind = isStartNode(node) ? "0" : isSceneNode(node) ? "1" : "2";
      lines.push(`        if (${nodeMatchCondition(story.id, node.id)}) return ${kind};`);
    }
  }
  lines.push(`        return -1;`);
  lines.push(`    }`);

  lines.push(`public static string GetJumpTargetStoryId(string storyId, string nodeId)
    {`);
  for (const story of project.stories) {
    for (const node of story.nodes.filter(isJumpNode)) {
      const targetStoryId =
        resolveJumpTargetStoryId(project, node) ?? node.jumpTargetStoryId ?? "";
      lines.push(
        `        if (${nodeMatchCondition(story.id, node.id)}) return ${escapeCiStringLiteral(targetStoryId)};`
      );
    }
  }
  lines.push(`        return "";`);
  lines.push(`    }`);

  lines.push(`public static string GetJumpTargetStartNodeId(string storyId, string nodeId)
    {`);
  for (const story of project.stories) {
    for (const node of story.nodes.filter(isJumpNode)) {
      lines.push(
        `        if (${nodeMatchCondition(story.id, node.id)}) return ${escapeCiStringLiteral(node.jumpTargetStartNodeId ?? "")};`
      );
    }
  }
  lines.push(`        return "";`);
  lines.push(`    }`);

  lines.push(`public static int GetOutgoingEdgeCount(string storyId, string nodeId)
    {`);
  for (const story of project.stories) {
    for (const node of story.nodes) {
      const count = story.edges.filter((edge) => edge.sourceNodeId === node.id).length;
      lines.push(`        if (${nodeMatchCondition(story.id, node.id)}) return ${count};`);
    }
  }
  lines.push(`        return 0;`);
  lines.push(`    }`);

  lines.push(`public static string GetOutgoingEdgeId(string storyId, string nodeId, int index)
    {
        ${project.stories
          .flatMap((story) =>
            story.nodes.map((node) => {
              const edges = story.edges.filter((edge) => edge.sourceNodeId === node.id);
              const cases = edges.map((edge, edgeIndex) => ({
                value: edgeIndex,
                result: escapeCiStringLiteral(edge.id),
              }));
              return `if (storyId == ${escapeCiStringLiteral(story.id)} && nodeId == ${escapeCiStringLiteral(node.id)})
        {
            ${ifEqualsIntChain("index", cases, `""`)}
        }`;
            })
          )
          .join("\n        ")}
        return "";
    }`);

  lines.push(`public static string GetEdgeTargetNodeId(string storyId, string edgeId)
    {`);
  for (const story of project.stories) {
    for (const edge of story.edges) {
      lines.push(
        `        if (storyId == ${escapeCiStringLiteral(story.id)} && edgeId == ${escapeCiStringLiteral(edge.id)}) return ${escapeCiStringLiteral(edge.targetNodeId)};`
      );
    }
  }
  lines.push(`        return "";`);
  lines.push(`    }`);

  return lines.join("\n\n    ");
}

function generateGlobalStateInitializer(project: Project): string {
  const lines = [`public static void ApplyStoryGlobalState(string storyId, IMuseLabRuntime rt)
    {`];
  for (const story of project.stories) {
    const stateLines: string[] = [];
    for (const [key, value] of Object.entries(story.globalState ?? {})) {
      if (typeof value === "boolean") {
        stateLines.push(
          `        rt.SetBool(${escapeCiStringLiteral(key)}, ${value ? "true" : "false"});`
        );
      } else if (typeof value === "number" && Number.isInteger(value)) {
        stateLines.push(`        rt.SetInt(${escapeCiStringLiteral(key)}, ${value});`);
      } else if (typeof value === "string") {
        stateLines.push(
          `        rt.SetString(${escapeCiStringLiteral(key)}, ${escapeCiStringLiteral(value)});`
        );
      }
    }
    if (stateLines.length === 0) continue;
    lines.push(`    if (storyId == ${escapeCiStringLiteral(story.id)})`);
    lines.push(`    {`);
    lines.push(...stateLines);
    lines.push(`        return;`);
    lines.push(`    }`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

function generateAssetPathLookup(project: Project): string {
  const lines = [
    `public static string GetAssetArchivePath(string assetId)
    {`,
  ];
  for (const asset of project.assets) {
    const ext = asset.path
      ? asset.path.slice(asset.path.lastIndexOf("."))
      : extensionForMime(asset.imageMimeType ?? "application/octet-stream", ".bin");
    const path = assetArchivePath(asset.type, asset.id, ext);
    lines.push(
      `    if (assetId == ${escapeCiStringLiteral(asset.id)}) return ${escapeCiStringLiteral(path)};`
    );
  }
  lines.push(`    return "";`);
  lines.push(`}`);
  return lines.join("\n    ");
}

function generateTemplateDispatch(
  project: Project,
  compiled: ReturnType<typeof compileProjectExportCi>
): string {
  const renderLines = [
    `string RenderNodePrompt(string locale, string storyId, string nodeId)
    {`,
  ];
  for (const [key, ref] of compiled.nodeTemplateClass) {
    if (ref.kind === "none") continue;
    const [locale, storyId, nodeId] = key.split("\0");
    renderLines.push(
      `    if (locale == ${escapeCiStringLiteral(locale)} && storyId == ${escapeCiStringLiteral(storyId)} && nodeId == ${escapeCiStringLiteral(nodeId)}) return ${ref.className}.Render(rt, prompter, format${project.modules.length ? ", " + project.modules.map((m) => m.bindingName).join(", ") : ""});`
    );
  }
  renderLines.push(`    return "";`);
  renderLines.push(`}`);

  const speakerLines = [
    `string RenderNodeSpeaker(string locale, string storyId, string nodeId)
    {`,
  ];
  for (const [key, className] of compiled.nodeSpeakerClass) {
    if (!className) continue;
    const [locale, storyId, nodeId] = key.split("\0");
    speakerLines.push(
      `    if (locale == ${escapeCiStringLiteral(locale)} && storyId == ${escapeCiStringLiteral(storyId)} && nodeId == ${escapeCiStringLiteral(nodeId)}) return ${className}.Render(rt, prompter, format${project.modules.length ? ", " + project.modules.map((m) => m.bindingName).join(", ") : ""});`
    );
  }
  speakerLines.push(`    return "";`);
  speakerLines.push(`}`);

  const optionLines = [
    `string RenderEdgeOption(string locale, string storyId, string edgeId)
    {`,
  ];
  for (const [key, ref] of compiled.nodeTemplateClass) {
    const parts = key.split("\0");
    if (parts[3] !== "option" || ref.kind !== "prompt") continue;
    const [locale, storyId, edgeId] = parts;
    optionLines.push(
      `    if (locale == ${escapeCiStringLiteral(locale)} && storyId == ${escapeCiStringLiteral(storyId)} && edgeId == ${escapeCiStringLiteral(edgeId)}) return ${ref.className}.Render(rt, prompter, format${project.modules.length ? ", " + project.modules.map((m) => m.bindingName).join(", ") : ""});`
    );
  }
  optionLines.push(`    return "";`);
  optionLines.push(`}`);

  const conditionLines = [
    `bool EvaluateEdgeCondition(string storyId, string edgeId)
    {`,
  ];
  for (const [key, className] of compiled.edgeConditionClass) {
    if (!className) {
      const [storyId, edgeId] = key.split("\0");
      conditionLines.push(
        `    if (storyId == ${escapeCiStringLiteral(storyId)} && edgeId == ${escapeCiStringLiteral(edgeId)}) return true;`
      );
      continue;
    }
    const [storyId, edgeId] = key.split("\0");
    conditionLines.push(
      `    if (storyId == ${escapeCiStringLiteral(storyId)} && edgeId == ${escapeCiStringLiteral(edgeId)}) return ${className}.Eval(rt, prompter, format${project.modules.length ? ", " + project.modules.map((m) => m.bindingName).join(", ") : ""});`
    );
  }
  conditionLines.push(`    return true;`);
  conditionLines.push(`}`);

  return [...renderLines, ``, ...speakerLines, ``, ...optionLines, ``, ...conditionLines].join("\n    ");
}

function sceneHasOutgoingContinuation(story: Story, sceneId: string): boolean {
  return story.edges.some((edge) => {
    if (edge.sourceNodeId !== sceneId) return false;
    const target = story.nodes.find((node) => node.id === edge.targetNodeId);
    return target != null && (isSceneNode(target) || isJumpNode(target));
  });
}

function generateEngineClass(project: Project, compiled: ReturnType<typeof compileProjectExportCi>): string {
  const moduleFields = project.modules
    .map((module) => `    ${module.name} ${module.bindingName};`)
    .join("\n");
  const moduleParams = project.modules
    .map((module) => `${module.name} ${module.bindingName}`)
    .join(", ");
  const moduleAssign = project.modules
    .map((module) => `        engine.${module.bindingName} = ${module.bindingName};`)
    .join("\n");

  const terminalSceneChecks = project.stories
    .flatMap((story) =>
      story.nodes
        .filter(isSceneNode)
        .map((node) => {
          const hasContinuation = sceneHasOutgoingContinuation(story, node.id);
          if (hasContinuation) return null;
          return `        if (activeStoryId == ${escapeCiStringLiteral(story.id)} && currentNodeId == ${escapeCiStringLiteral(node.id)} && choiceCount == 0) isTerminalScene = true;`;
        })
        .filter(Boolean)
    )
    .join("\n");

  return `public class MuseLabEngine
{
    IMuseLabRuntime rt;
    IMuseLabFormat format;
    IMuseLabPromptRenderer prompter;
${moduleFields ? `${moduleFields}\n` : ""}    string activeLocale;
    string activeStoryId;
    string currentNodeId;
    bool isEnded;

    public MuseLabEngine()
    {
        this.activeStoryId = "";
        this.currentNodeId = "";
        this.isEnded = false;
    }

    public static MuseLabEngine# Create(IMuseLabRuntime rt, IMuseLabFormat format, IMuseLabPromptRenderer prompter${moduleParams ? `, ${moduleParams}` : ""}, string defaultLocale)
    {
        MuseLabEngine# engine = new MuseLabEngine();
        engine.rt = rt;
        engine.format = format;
        engine.prompter = prompter;
${moduleAssign ? `${moduleAssign}\n` : ""}        engine.activeLocale = defaultLocale;
        return engine;
    }

    public void Start()
    {
        StartStoryById(${escapeCiStringLiteral(getFirstStoryId(project))});
    }

    public void StartStoryById(string storyId)
    {
        string startNodeId = MuseLabProjectData.GetStoryEntryNodeId(storyId);
        if (startNodeId == "")
            return;
        StartStory(storyId, startNodeId);
    }

    public void StartStoryByIdAtNode(string storyId, string startNodeId)
    {
        if (storyId == "" || startNodeId == "")
            return;
        StartStory(storyId, startNodeId);
    }

    public void StartStoryByPath(string groupPath, string storyName)
    {
        string storyId = MuseLabProjectData.ResolveStoryId(groupPath, storyName);
        if (storyId == "")
            return;
        StartStoryById(storyId);
    }

    public void StartStoryByPathAtStartNode(string groupPath, string storyName, string startNodeName)
    {
        string storyId = MuseLabProjectData.ResolveStoryId(groupPath, storyName);
        if (storyId == "")
            return;
        string startNodeId = MuseLabProjectData.ResolveStartNodeId(storyId, startNodeName);
        if (startNodeId == "")
            return;
        StartStory(storyId, startNodeId);
    }

    public void SetActiveLocale(string locale)
    {
        activeLocale = locale;
    }

    public string GetActiveLocale()
    {
        return activeLocale;
    }

    public void FinishStory()
    {
        isEnded = true;
    }

    public void GoToNode(string nodeId)
    {
        int kind = MuseLabProjectData.GetNodeKind(activeStoryId, nodeId);
        if (kind < 0)
            return;
        if (kind == 2)
        {
            string targetStoryId = MuseLabProjectData.GetJumpTargetStoryId(activeStoryId, nodeId);
            string targetStartNodeId = MuseLabProjectData.GetJumpTargetStartNodeId(activeStoryId, nodeId);
            SwitchStory(targetStoryId, targetStartNodeId);
            return;
        }
        currentNodeId = nodeId;
        isEnded = false;
    }

    public RuntimeState# GetRuntimeState()
    {
        int kind = MuseLabProjectData.GetNodeKind(activeStoryId, currentNodeId);
        string html = "";
        string speaker = "";
        int choiceCount = 0;
        RuntimeChoice#[]# choices = new RuntimeChoice#[0];
        bool isTerminalScene = false;

        if (kind == 1)
        {
            html = RenderNodePrompt(activeLocale, activeStoryId, currentNodeId);
            speaker = RenderNodeSpeaker(activeLocale, activeStoryId, currentNodeId);
            RuntimeChoices# builtChoices = BuildChoices();
            choiceCount = builtChoices.GetCount();
            choices = builtChoices.GetItems();
${terminalSceneChecks}
        }

        return RuntimeState.Create(activeStoryId, currentNodeId, html, speaker, choiceCount, choices, isTerminalScene, isEnded);
    }

    void StartStory(string storyId, string startNodeId)
    {
        MuseLabProjectData.ApplyStoryGlobalState(storyId, rt);
        activeStoryId = storyId;
        currentNodeId = startNodeId;
        isEnded = false;
    }

    void SwitchStory(string storyId, string startNodeId)
    {
        MuseLabProjectData.ApplyStoryGlobalState(storyId, rt);
        activeStoryId = storyId;
        currentNodeId = startNodeId;
        isEnded = false;
    }

    RuntimeChoices# BuildChoices()
    {
        int edgeCount = MuseLabProjectData.GetOutgoingEdgeCount(activeStoryId, currentNodeId);
        RuntimeChoice#[]# result = new RuntimeChoice#[edgeCount];
        int count = 0;
        for (int i = 0; i < edgeCount; i++)
        {
            string edgeId = MuseLabProjectData.GetOutgoingEdgeId(activeStoryId, currentNodeId, i);
            if (!EvaluateEdgeCondition(activeStoryId, edgeId))
                continue;
            string targetNodeId = MuseLabProjectData.GetEdgeTargetNodeId(activeStoryId, edgeId);
            int targetKind = MuseLabProjectData.GetNodeKind(activeStoryId, targetNodeId);
            string optionText = "";
            if (targetKind == 1)
                optionText = RenderEdgeOption(activeLocale, activeStoryId, edgeId);
            result[count] = RuntimeChoice.Create(edgeId, targetNodeId, optionText);
            count++;
        }
        return RuntimeChoices.Create(count, result);
    }

    ${generateTemplateDispatch(project, compiled)}
}`;

}

function generateSupportClasses(): string {
  return `public class RuntimeChoices
{
    int count;
    RuntimeChoice#[]# items;

    public RuntimeChoices()
    {
    }

    public static RuntimeChoices# Create(int count, RuntimeChoice#[]# items)
    {
        RuntimeChoices# holder = new RuntimeChoices();
        holder.count = count;
        holder.items = items;
        return holder;
    }

    public int GetCount()
    {
        return count;
    }

    public RuntimeChoice#[]# GetItems()
    {
        return items;
    }
}

public class RuntimeChoice
{
    string edgeId;
    string targetNodeId;
    string optionText;

    public RuntimeChoice()
    {
    }

    public static RuntimeChoice# Create(string edgeId, string targetNodeId, string optionText)
    {
        RuntimeChoice# choice = new RuntimeChoice();
        choice.edgeId = edgeId;
        choice.targetNodeId = targetNodeId;
        choice.optionText = optionText;
        return choice;
    }

    public string GetEdgeId()
    {
        return edgeId;
    }

    public string GetTargetNodeId()
    {
        return targetNodeId;
    }

    public string GetOptionText()
    {
        return optionText;
    }
}

public class RuntimeState
{
    string activeStoryId;
    string currentNodeId;
    string currentHtml;
    string currentSpeaker;
    int choiceCount;
    RuntimeChoice#[]# choices;
    bool isTerminalScene;
    bool isEnded;

    public RuntimeState()
    {
    }

    public static RuntimeState# Create(string activeStoryId, string currentNodeId, string currentHtml, string currentSpeaker, int choiceCount, RuntimeChoice#[]# choices, bool isTerminalScene, bool isEnded)
    {
        RuntimeState# state = new RuntimeState();
        state.activeStoryId = activeStoryId;
        state.currentNodeId = currentNodeId;
        state.currentHtml = currentHtml;
        state.currentSpeaker = currentSpeaker;
        state.choiceCount = choiceCount;
        state.choices = choices;
        state.isTerminalScene = isTerminalScene;
        state.isEnded = isEnded;
        return state;
    }

    public string GetActiveStoryId()
    {
        return activeStoryId;
    }

    public string GetCurrentNodeId()
    {
        return currentNodeId;
    }

    public string GetCurrentHtml()
    {
        return currentHtml;
    }

    public string GetCurrentSpeaker()
    {
        return currentSpeaker;
    }

    public int GetChoiceCount()
    {
        return choiceCount;
    }

    public RuntimeChoice# GetChoice(int index)
    {
        return choices[index];
    }

    public bool GetIsTerminalScene()
    {
        return isTerminalScene;
    }

    public bool GetIsEnded()
    {
        return isEnded;
    }
}`;
}

export function generateMuseLabEngineCi(bundle: ProjectBundle): string {
  const { project, promptsByLocale } = bundle;
  const compiled = compileProjectExportCi(project, promptsByLocale);

  const projectDataClass = `public static class MuseLabProjectData
{
    ${generateStoryResolvers(project)}

    ${generateNodeLookups(project)}

    ${generateGlobalStateInitializer(project)}

    ${generateAssetPathLookup(project)}
}`;

  const parts = [
    buildExportCiPreamble(project).trim(),
    generateSupportClasses(),
    projectDataClass,
    ...compiled.classSources,
    generateEngineClass(project, compiled),
  ];

  return `${parts.filter(Boolean).join("\n\n")}\n`;
}
