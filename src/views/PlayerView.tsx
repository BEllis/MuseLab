import { useRef, useState, useMemo, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useProjectStore } from "@/store/projectStore";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import { createRunner, type RuntimeChoice } from "@/core/runtime/runner";
import {
  getStoredPlayerLocale,
  readElectronPlayerLocale,
  setStoredPlayerLocale,
} from "@/core/locale/playerLocalePreference";
import type { PromptsByLocale } from "@/core/locale/prompts";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import type { Project, StoryNode } from "@/core/model/types";
import {
  clampPlayerResolution,
  CUSTOM_PLAYER_RESOLUTION_KEY,
  findPlayerResolutionPresetKey,
  getProjectPlayerResolution,
  STANDARD_PLAYER_RESOLUTIONS,
} from "@/core/view/playerResolution";

export default function PlayerView() {
  const project = useProjectStore((s) => s.project);
  const playValidation = useMemo(() => validatePlayEntry(project), [project]);

  if (!playValidation.ok) {
    return <Navigate to="/" replace />;
  }

  return <PlayerViewInner project={project} entryId={playValidation.entryNodeId} />;
}

function PlayerViewInner({
  project,
  entryId,
}: {
  project: Project;
  entryId: string;
}) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const loadedMlvnPath = useProjectStore((s) => s.loadedMlvnPath);
  const storedResolution = getProjectPlayerResolution(project);
  const storedPresetKey = findPlayerResolutionPresetKey(storedResolution);
  const [activeLocale, setActiveLocale] = useState(() =>
    getStoredPlayerLocale(project.name, project.locales, loadedMlvnPath)
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const locale = await readElectronPlayerLocale(
        loadedMlvnPath ?? project.name,
        project.name,
        project.locales
      );
      if (!cancelled) {
        setActiveLocale(locale);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadedMlvnPath, project.name, project.locales]);

  const runner = useMemo(
    () =>
      createRunner(project, promptsByLocale, activeLocale, {
        onPlaySound: (assetId, options) => {
          window.__playerPlaySound?.(assetId, options);
        },
      }),
    [project, promptsByLocale, activeLocale]
  );

  const runtime = runner.getRuntimeState();

  // Start at entry when project has nodes and we don't have a current node
  useEffect(() => {
    if (entryId && !runner.currentNodeId) {
      runner.goToNode(entryId);
      setTick((t) => t + 1);
    }
  }, [entryId, runner]);

  const handleChoice = (targetId: string) => {
    runner.goToNode(targetId);
    setTick((t) => t + 1);
  };

  const handleRestart = useMemo(
    () =>
      entryId
        ? () => {
            runner.goToNode(entryId);
            setTick((t) => t + 1);
          }
        : undefined,
    [entryId, runner]
  );

  if (!project.nodes.length) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No nodes in the project. Add nodes in the designer.</p>
        <Link to="/">Back to designer</Link>
      </div>
    );
  }

  if (!runtime.currentNodeId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No entry node.</p>
        <Link to="/">Back to designer</Link>
      </div>
    );
  }

  const node = project.nodes.find((n) => n.id === runtime.currentNodeId)!;
  const hasOptions = runtime.choices.some((c) => c.optionText);
  const singleChoice = runtime.choices.length === 1 && !hasOptions;

  const handleLocaleChange = (locale: string) => {
    setActiveLocale(locale);
    setStoredPlayerLocale(project.name, locale, loadedMlvnPath);
    setTick((t) => t + 1);
  };

  const [resolutionKey, setResolutionKey] = useState(storedPresetKey);
  const [customWidth, setCustomWidth] = useState(storedResolution.width);
  const [customHeight, setCustomHeight] = useState(storedResolution.height);
  const [contentAreaSize, setContentAreaSize] = useState({ width: 1280, height: 720 });
  const contentAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResolutionKey(storedPresetKey);
    setCustomWidth(storedResolution.width);
    setCustomHeight(storedResolution.height);
  }, [storedPresetKey, storedResolution.width, storedResolution.height]);

  const persistResolution = (width: number, height: number) => {
    updateProject({ playerResolution: clampPlayerResolution({ width, height }) }, { record: false });
  };

  const frameWidth =
    resolutionKey === CUSTOM_PLAYER_RESOLUTION_KEY
      ? customWidth
      : (STANDARD_PLAYER_RESOLUTIONS.find((r) => r.key === resolutionKey)?.width ?? 1280);
  const frameHeight =
    resolutionKey === CUSTOM_PLAYER_RESOLUTION_KEY
      ? customHeight
      : (STANDARD_PLAYER_RESOLUTIONS.find((r) => r.key === resolutionKey)?.height ?? 720);

  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContentAreaSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setContentAreaSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(
    contentAreaSize.width / frameWidth,
    contentAreaSize.height / frameHeight,
    4
  );
  const scaledWidth = frameWidth * scale;
  const scaledHeight = frameHeight * scale;

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setResolutionKey(key);
    if (key === CUSTOM_PLAYER_RESOLUTION_KEY) return;
    const preset = STANDARD_PLAYER_RESOLUTIONS.find((r) => r.key === key);
    if (preset) {
      setCustomWidth(preset.width);
      setCustomHeight(preset.height);
      persistResolution(preset.width, preset.height);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a12",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "8px 16px",
          background: "#16213e",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#eee" }}>{project.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "#aaa", fontSize: "14px" }}>
            Locale
            <select
              value={activeLocale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              style={{
                marginLeft: "6px",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#1a1a2e",
                color: "#eee",
                fontSize: "14px",
              }}
            >
              {project.locales.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </label>
          <label style={{ color: "#aaa", fontSize: "14px" }}>
            Resolution
            <select
              value={resolutionKey}
              onChange={handleResolutionChange}
              style={{
                marginLeft: "6px",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#1a1a2e",
                color: "#eee",
                fontSize: "14px",
              }}
            >
              {STANDARD_PLAYER_RESOLUTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
              <option value={CUSTOM_PLAYER_RESOLUTION_KEY}>Custom</option>
            </select>
          </label>
          {resolutionKey === CUSTOM_PLAYER_RESOLUTION_KEY && (
            <>
              <input
                type="number"
                min={1}
                max={7680}
                value={customWidth}
                onChange={(e) => {
                  const width = Number(e.target.value) || 1;
                  setCustomWidth(width);
                  persistResolution(width, customHeight);
                }}
                style={{
                  width: "64px",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  border: "1px solid #444",
                  background: "#1a1a2e",
                  color: "#eee",
                  fontSize: "14px",
                }}
                aria-label="Width"
              />
              <span style={{ color: "#888" }}>×</span>
              <input
                type="number"
                min={1}
                max={4320}
                value={customHeight}
                onChange={(e) => {
                  const height = Number(e.target.value) || 1;
                  setCustomHeight(height);
                  persistResolution(customWidth, height);
                }}
                style={{
                  width: "64px",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  border: "1px solid #444",
                  background: "#1a1a2e",
                  color: "#eee",
                  fontSize: "14px",
                }}
                aria-label="Height"
              />
            </>
          )}
        </div>
        <Link to="/" style={{ color: "#7fdbff" }}>Back to designer</Link>
      </header>

      <div
        ref={contentAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a12",
        }}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: frameWidth,
              height: frameHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PlayerStage
              project={project}
              promptsByLocale={promptsByLocale}
              locale={activeLocale}
              node={node}
              runtime={runtime}
              singleChoice={singleChoice}
              handleChoice={handleChoice}
              onRestart={handleRestart}
            />
          </div>
        </div>
      </div>

      <SoundManager project={project} node={node} runner={runner} />
    </div>
  );
}

function PlayerStage({
  project,
  promptsByLocale,
  locale,
  node,
  runtime,
  singleChoice,
  handleChoice,
  onRestart,
}: {
  project: Project;
  promptsByLocale: PromptsByLocale;
  locale: string;
  node: Pick<StoryNode, "id" | "backdropId" | "actorIds">;
  runtime: { currentHtml: string; choices: RuntimeChoice[] };
  singleChoice: boolean;
  handleChoice: (targetId: string) => void;
  onRestart?: () => void;
}) {
  return (
    <SceneStagePreview
      project={project}
      promptsByLocale={promptsByLocale}
      locale={locale}
      node={node}
      variant="full"
      dialogueHtml={runtime.currentHtml}
      choices={runtime.choices}
      singleChoice={singleChoice}
      onChoice={handleChoice}
      onRestart={onRestart}
      style={{ flex: 1 }}
    />
  );
}

function SoundManager({
  project,
  node,
  runner,
}: {
  project: Project;
  node: { id: string };
  runner: ReturnType<typeof createRunner>;
}) {
  const configs = runner.getSoundConfigsForCurrentNode();
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    window.__playerPlaySound = (assetId: string, options?: { startTime?: number; endTime?: number }) => {
      const el = audioRefs.current.get(assetId);
      if (el) {
        if (options?.startTime != null) el.currentTime = options.startTime;
        el.play().catch(() => {});
      }
    };
    return () => {
      delete (window as unknown as { __playerPlaySound?: unknown }).__playerPlaySound;
    };
  }, []);

  useEffect(() => {
    configs.forEach((config) => {
      if (config.stopOnLoad) {
        const el = audioRefs.current.get(config.assetId);
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
      }
      if (config.startOnLoad) {
        const el = audioRefs.current.get(config.assetId);
        if (el) {
          if (config.startTime != null) el.currentTime = config.startTime;
          if (config.loop) el.loop = true;
          el.play().catch(() => {});
        }
      }
    });
  }, [node.id, configs]);

  return (
    <div style={{ display: "none" }} aria-hidden>
      {configs.map((config) => (
        <SoundElement
          key={config.assetId}
          project={project}
          assetId={config.assetId}
          loop={config.loop}
          startTime={config.startTime}
          endTime={config.endTime}
          audioRefs={audioRefs}
        />
      ))}
    </div>
  );
}

function SoundElement({
  project,
  assetId,
  loop,
  endTime,
  audioRefs,
}: {
  project: Project;
  assetId: string;
  loop?: boolean;
  startTime?: number;
  endTime?: number;
  audioRefs: React.MutableRefObject<Map<string, HTMLAudioElement>>;
}) {
  const url = useAssetUrl(project, assetId);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && url) audioRefs.current.set(assetId, ref.current);
    return () => {
      audioRefs.current.delete(assetId);
    };
  }, [assetId, url, audioRefs]);
  if (!url) return null;
  return (
    <audio
      ref={ref}
      src={url}
      loop={loop}
      preload="metadata"
      onTimeUpdate={() => {
        const el = ref.current;
        if (el && endTime != null && el.currentTime >= endTime) el.pause();
      }}
    />
  );
}
