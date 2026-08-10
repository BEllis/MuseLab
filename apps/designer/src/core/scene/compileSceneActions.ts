import type { Project } from "../model/types";
import { escapeCiString } from "../cito/escapeCiString";
import { compileTemplateFragmentLines } from "../cito/compileTemplate";
import { hashId } from "../cito/hashId";
import {
  buildCiPreamble,
  buildExportRenderParameterList,
  buildRenderParameterList,
} from "../modules/generateModuleCi";
import type { RevealSpec, SceneAction } from "./actions";
import type { StagePosition } from "./positions";
import { parseTaggedText, type TaggedTextNode } from "./taggedText";

export type CompiledSceneActions = {
  className: string;
  ciSource: string;
};

export type SceneWrapTemplates = {
  promptStart?: string;
  promptEnd?: string;
  speakerStart?: string;
  speakerEnd?: string;
};

export type CompileSceneActionsOptions = {
  forExport?: boolean;
  includePreamble?: boolean;
  /** Story-level Razor wrappers spliced around dialogue output. */
  wrap?: SceneWrapTemplates;
};

function lit(value: string): string {
  return `"${escapeCiString(value)}"`;
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function ms(value: number): string {
  return String(Math.max(0, Math.trunc(value)));
}

/**
 * Emit a position argument list. Slots and vectors use different method names so
 * engines can apply slot-specific anchoring without inspecting coordinates.
 */
function positionCall(
  binding: string,
  slotMethod: string,
  vectorMethod: string,
  position: StagePosition,
  leading: string[],
  trailing: string[]
): string {
  const args =
    position.kind === "slot"
      ? [...leading, lit(position.slot), ...trailing]
      : [...leading, num(position.x), num(position.y), ...trailing];
  const method = position.kind === "slot" ? slotMethod : vectorMethod;
  return `${binding}.${method}(${args.join(", ")});`;
}

function openFormatCall(node: Extract<TaggedTextNode, { kind: "open" }>): string {
  switch (node.tag) {
    case "b":
      return "format.BoldStart()";
    case "i":
      return "format.ItalicStart()";
    case "u":
      return "format.UnderlineStart()";
    case "shake":
      return "format.ShakePhraseStart()";
    case "color":
      return `format.ColorStart(${lit(node.color ?? "#ffffff")})`;
  }
}

function closeFormatCall(node: Extract<TaggedTextNode, { kind: "close" }>): string {
  switch (node.tag) {
    case "b":
      return "format.BoldEnd()";
    case "i":
      return "format.ItalicEnd()";
    case "u":
      return "format.UnderlineEnd()";
    case "shake":
      return "format.ShakePhraseEnd()";
    case "color":
      return "format.ColorEnd()";
  }
}

/** Lower author tags into interleaved prompter literal / format calls. */
function emitTaggedText(text: string, lines: string[]): void {
  for (const node of parseTaggedText(text)) {
    if (node.kind === "text") {
      if (node.text) lines.push(`prompter.AddLiteral(${lit(node.text)});`);
      continue;
    }
    if (node.kind === "open") {
      lines.push(`prompter.ApplyFormat(${openFormatCall(node)});`);
      continue;
    }
    lines.push(`prompter.ApplyFormat(${closeFormatCall(node)});`);
  }
}

function emitRevealBegin(reveal: RevealSpec, lines: string[]): boolean {
  switch (reveal.mode) {
    case "instant":
      return false;
    case "charsPerSecond":
      lines.push(`prompter.RevealCharsBegin(${num(reveal.rate)});`);
      return true;
    case "wordsPerSecond":
      lines.push(`prompter.RevealWordsBegin(${num(reveal.rate)});`);
      return true;
    case "charsOverTime":
      lines.push(`prompter.RevealCharsOverTimeBegin(${ms(reveal.durationMs)});`);
      return true;
    case "wordsOverTime":
      lines.push(`prompter.RevealWordsOverTimeBegin(${ms(reveal.durationMs)});`);
      return true;
  }
}

export function sceneActionToCito(
  action: SceneAction,
  speakerWrap: { start: string[]; end: string[] } = { start: [], end: [] }
): string[] {
  const lines: string[] = [];

  switch (action.kind) {
    case "bg.show":
      lines.push(`bg.Show(${lit(action.assetId)});`);
      break;
    case "bg.clear":
      lines.push("bg.Clear();");
      break;
    case "bg.fade":
      lines.push(`bg.Fade(${lit(action.assetId)}, ${ms(action.durationMs)});`);
      break;
    case "bg.slideIn":
      lines.push(
        `bg.SlideIn(${lit(action.assetId)}, ${lit(action.direction)}, ${ms(action.durationMs)});`
      );
      break;
    case "bg.slideOut":
      lines.push(`bg.SlideOut(${lit(action.direction)}, ${ms(action.durationMs)});`);
      break;

    case "prop.add":
      if (action.variationId) {
        lines.push(
          `prop.AddVariant(${lit(action.id)}, ${lit(action.assetId)}, ${lit(action.variationId)});`
        );
      } else {
        lines.push(`prop.Add(${lit(action.id)}, ${lit(action.assetId)});`);
      }
      break;
    case "prop.remove":
      lines.push(`prop.Remove(${lit(action.id)});`);
      break;
    case "prop.show":
      if (action.position) {
        lines.push(
          positionCall("prop", "ShowAt", "ShowAtXY", action.position, [lit(action.id)], [])
        );
      } else {
        lines.push(`prop.Show(${lit(action.id)});`);
      }
      break;
    case "prop.hide":
      lines.push(`prop.Hide(${lit(action.id)});`);
      break;
    case "prop.fadeIn":
      if (action.position) {
        lines.push(
          positionCall(
            "prop",
            "FadeInAt",
            "FadeInAtXY",
            action.position,
            [lit(action.id)],
            [ms(action.durationMs)]
          )
        );
      } else {
        lines.push(`prop.FadeIn(${lit(action.id)}, ${ms(action.durationMs)});`);
      }
      break;
    case "prop.fadeOut":
      lines.push(`prop.FadeOut(${lit(action.id)}, ${ms(action.durationMs)});`);
      break;
    case "prop.slideIn":
      lines.push(
        positionCall(
          "prop",
          "SlideIn",
          "SlideInXY",
          action.position,
          [lit(action.id)],
          [lit(action.direction), ms(action.durationMs)]
        )
      );
      break;
    case "prop.slideOut":
      lines.push(
        `prop.SlideOut(${lit(action.id)}, ${lit(action.direction)}, ${ms(action.durationMs)});`
      );
      break;
    case "prop.move":
      lines.push(
        positionCall(
          "prop",
          "Move",
          "MoveXY",
          action.position,
          [lit(action.id)],
          [ms(action.durationMs)]
        )
      );
      break;
    case "prop.setPosition":
      lines.push(
        positionCall("prop", "SetPosition", "SetPositionXY", action.position, [lit(action.id)], [])
      );
      break;
    case "prop.setZ":
      lines.push(`prop.SetZ(${lit(action.id)}, ${Math.trunc(action.z)});`);
      break;
    case "prop.setVariation":
      lines.push(`prop.SetVariation(${lit(action.id)}, ${lit(action.variationId)});`);
      break;

    case "dialogue.show":
      lines.push(`prompter.ShowDialogue(${lit(action.channel)});`);
      break;
    case "dialogue.hide":
      lines.push(`prompter.HideDialogue(${lit(action.channel)});`);
      break;
    case "dialogue.setSpeaker":
      lines.push("prompter.SpeakerBegin();");
      lines.push(...speakerWrap.start);
      emitTaggedText(action.text, lines);
      lines.push(...speakerWrap.end);
      lines.push("prompter.SpeakerEnd();");
      break;
    case "dialogue.revealText": {
      const opened = emitRevealBegin(action.reveal, lines);
      emitTaggedText(action.text, lines);
      if (opened) lines.push("prompter.RevealEnd();");
      break;
    }
    case "dialogue.clear":
      lines.push("prompter.Clear();");
      break;
    case "dialogue.reset":
      lines.push("prompter.Reset();");
      break;

    case "wait":
      lines.push(`prompter.WaitInMs(${ms(action.milliseconds)});`);
      break;
    case "waitForContinue":
      lines.push("prompter.WaitForContinue();");
      break;

    case "playSound":
      lines.push(
        `rt.PlaySoundClip(${lit(action.assetId)}, ${num(action.delaySeconds)}, ${num(
          action.startTime ?? -1
        )}, ${num(action.endTime ?? -1)});`
      );
      break;

    case "rt.setBool":
      lines.push(`rt.SetBool(${lit(action.key)}, ${action.value ? "true" : "false"});`);
      break;
    case "rt.setInt":
      lines.push(`rt.SetInt(${lit(action.key)}, ${Math.trunc(action.value)});`);
      break;
    case "rt.setString":
      lines.push(`rt.SetString(${lit(action.key)}, ${lit(action.value)});`);
      break;
    case "rt.emit":
      lines.push(`rt.Emit(${lit(action.eventName)});`);
      break;

    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported scene action: ${JSON.stringify(exhaustive)}`);
    }
  }

  return lines;
}

export function sceneActionsToCitoBody(
  actions: SceneAction[],
  project?: Project,
  wrap?: SceneWrapTemplates
): string[] {
  const fragment = (template?: string): string[] =>
    template && project ? compileTemplateFragmentLines(template, project) : [];

  const speakerWrap = {
    start: fragment(wrap?.speakerStart),
    end: fragment(wrap?.speakerEnd),
  };

  const lines: string[] = [...fragment(wrap?.promptStart)];
  for (const action of actions) {
    lines.push(...sceneActionToCito(action, speakerWrap));
  }
  lines.push(...fragment(wrap?.promptEnd));
  lines.push("return prompter.Render();");
  return lines;
}

/**
 * Compile an authored action list into a Cito scene template.
 *
 * This output is generated on every preview/export and is never edited by hand.
 */
export function compileSceneActions(
  actions: SceneAction[],
  project: Project,
  options: CompileSceneActionsOptions = {}
): CompiledSceneActions {
  const body = sceneActionsToCitoBody(actions, project, options.wrap);
  const className = hashId(JSON.stringify([actions, options.wrap ?? null]), "Scene");
  const params = options.forExport
    ? buildExportRenderParameterList(project)
    : buildRenderParameterList(project);
  const classSource = `public static class ${className}
{
    public static string Render(${params})
    {
        ${body.join("\n        ")}
    }
}`;
  const includePreamble = options.includePreamble !== false;
  const preamble = options.forExport ? "" : buildCiPreamble(project);
  return {
    className,
    ciSource: includePreamble ? `${preamble}${classSource}\n` : `${classSource}\n`,
  };
}
