import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useProjectStore, selectActiveStory } from "@/store/projectStore";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import { createRunner, type RuntimeState } from "@/core/runtime/runner";
import {
  getStoredPlayerLocale,
  readElectronPlayerLocale,
  setStoredPlayerLocale,
} from "@/core/locale/playerLocalePreference";
import type { PromptsByLocale } from "@/core/locale/prompts";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { BackToDesignerButton } from "@/components/BackToDesignerButton";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import type { Project, Story, StoryNode } from "@/core/model/types";
import {
  clampPlayerResolution,
  computeStagePreviewScale,
  CUSTOM_PLAYER_RESOLUTION_KEY,
  findPlayerResolutionPresetKey,
  getProjectPlayerResolution,
  STANDARD_PLAYER_RESOLUTIONS,
} from "@/core/view/playerResolution";

export default function PlayerView() {
  const project = useProjectStore((s) => s.project);
  const activeStoryId = useProjectStore((s) => s.activeStoryId);
  const story = useMemo(
    () => selectActiveStory(project, activeStoryId),
    [project, activeStoryId]
  );
  const playValidation = useMemo(() => validatePlayEntry(story), [story]);

  if (!playValidation.ok) {
    return <Navigate to="/" replace />;
  }

  return (
    <PlayerViewInner
      project={project}
      story={story}
      storyId={story.id}
      entryId={playValidation.entryNodeId}
    />
  );
}

function PlayerViewInner({
  project,
  story,
  storyId,
  entryId,
}: {
  project: Project;
  story: Story;
  storyId: string;
  entryId: string;
}) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const loadedMlvnPath = useProjectStore((s) => s.loadedMlvnPath);
  const storedResolution = getProjectPlayerResolution(project);
  const storedPresetKey = findPlayerResolutionPresetKey(storedResolution);
  const [activeLocale, setActiveLocale] = useState(() =>
    getStoredPlayerLocale(project.name, project.locales, loadedMlvnPath, project.defaultLocale)
  );
  const [tick, setTick] = useState(0);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [resolutionKey, setResolutionKey] = useState(storedPresetKey);
  const [customWidth, setCustomWidth] = useState(storedResolution.width);
  const [customHeight, setCustomHeight] = useState(storedResolution.height);
  const [contentAreaSize, setContentAreaSize] = useState({ width: 1280, height: 720 });
  const contentAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const locale = await readElectronPlayerLocale(
        loadedMlvnPath ?? project.name,
        project.name,
        project.locales,
        project.defaultLocale
      );
      if (!cancelled) {
        setActiveLocale(locale);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadedMlvnPath, project.name, project.locales, project.defaultLocale]);

  const runner = useMemo(
    () =>
      createRunner(project, storyId, entryId, promptsByLocale, activeLocale, {
        onPlaySound: (assetId, options) => {
          window.__playerPlaySound?.(assetId, options);
        },
      }),
    [project, storyId, entryId, promptsByLocale, activeLocale]
  );

  useEffect(() => {
    runner.setActiveLocale(activeLocale);
  }, [runner, activeLocale]);

  useEffect(() => {
    let cancelled = false;
    void runner
      .getRuntimeState()
      .then((state) => {
        if (!cancelled) {
          setRuntime(state);
          setRuntimeError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRuntimeError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runner, tick]);

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

  const handleContinue = () => {
    runner.finishStory();
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

  useEffect(() => {
    setResolutionKey(storedPresetKey);
    setCustomWidth(storedResolution.width);
    setCustomHeight(storedResolution.height);
  }, [storedPresetKey, storedResolution.width, storedResolution.height]);

  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContentAreaSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setContentAreaSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [runtime?.currentNodeId]);

  if (!story.nodes.length) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No scenes in this story. Add scenes in the designer.</p>
        <BackToDesignerButton variant="overlay" />
      </div>
    );
  }

  if (runtimeError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Template error: {runtimeError}</p>
        <BackToDesignerButton variant="overlay" />
      </div>
    );
  }

  if (!runtime) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading story…</p>
      </div>
    );
  }

  if (!runner.currentNodeId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No entry node.</p>
        <BackToDesignerButton variant="overlay" />
      </div>
    );
  }

  const runtimeSynced =
    runtime.activeStoryId === runner.activeStoryId &&
    runtime.currentNodeId === runner.currentNodeId;

  if (!runtimeSynced) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading story…</p>
      </div>
    );
  }

  const activeStory = runner.story;
  const node = activeStory.nodes.find((n) => n.id === runner.currentNodeId);
  if (!node) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Current node not found in active story.</p>
        <BackToDesignerButton variant="overlay" />
      </div>
    );
  }
  const hasOptions = runtime.choices.some((c) => c.optionText);
  const singleChoice = runtime.choices.length === 1 && !hasOptions;

  if (runtime.isEnded) {
    return (
      <div className="app-player-end-screen">
        <h2 className="app-player-end-screen__title">The End</h2>
        <BackToDesignerButton variant="overlay" />
        {handleRestart && (
          <button type="button" onClick={handleRestart} className="app-player-restart-button">
            Play again
          </button>
        )}
      </div>
    );
  }

  const handleLocaleChange = (locale: string) => {
    setActiveLocale(locale);
    runner.setActiveLocale(locale);
    setStoredPlayerLocale(project.name, locale, loadedMlvnPath);
    setTick((t) => t + 1);
  };

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

  const { scale, scaledWidth, scaledHeight } = computeStagePreviewScale(
    contentAreaSize.width,
    contentAreaSize.height,
    { width: frameWidth, height: frameHeight },
  );

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
    <div className="app-player">
      <header className="app-player-header">
        <BackToDesignerButton variant="player" />
        <div className="app-player-header-controls">
          <label className="app-player-header-label">
            Locale
            <select
              className="app-player-header-select"
              value={activeLocale}
              onChange={(e) => handleLocaleChange(e.target.value)}
            >
              {project.locales.map((entry) => (
                <option key={entry.id} value={entry.locale}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="app-player-header-label">
            Resolution
            <select
              className="app-player-header-select"
              value={resolutionKey}
              onChange={handleResolutionChange}
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
                className="app-player-header-input"
                min={1}
                max={7680}
                value={customWidth}
                onChange={(e) => {
                  const width = Number(e.target.value) || 1;
                  setCustomWidth(width);
                  persistResolution(width, customHeight);
                }}
                aria-label="Width"
              />
              <span className="app-player-header-separator">×</span>
              <input
                type="number"
                className="app-player-header-input"
                min={1}
                max={4320}
                value={customHeight}
                onChange={(e) => {
                  const height = Number(e.target.value) || 1;
                  setCustomHeight(height);
                  persistResolution(customWidth, height);
                }}
                aria-label="Height"
              />
            </>
          )}
        </div>
      </header>

      <div ref={contentAreaRef} className="app-player-stage-area">
        <div
          className="app-player-stage-frame"
          style={{
            width: scaledWidth,
            height: scaledHeight,
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
              key={`${node.id}:${tick}`}
              project={project}
              story={activeStory}
              storyId={runner.activeStoryId}
              promptsByLocale={promptsByLocale}
              locale={activeLocale}
              node={node}
              runtime={runtime}
              singleChoice={singleChoice}
              handleChoice={handleChoice}
              handleContinue={handleContinue}
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
  story,
  storyId,
  promptsByLocale,
  locale,
  node,
  runtime,
  singleChoice,
  handleChoice,
  handleContinue,
  onRestart,
}: {
  project: Project;
  story: Story;
  storyId: string;
  promptsByLocale: PromptsByLocale;
  locale: string;
  node: Pick<StoryNode, "id" | "backdropId" | "actorConfigs">;
  runtime: Pick<
    RuntimeState,
    | "currentHtml"
    | "currentSpeaker"
    | "promptInstructions"
    | "choices"
    | "isTerminalScene"
    | "state"
  >;
  singleChoice: boolean;
  handleChoice: (targetId: string) => void;
  handleContinue: () => void;
  onRestart?: () => void;
}) {
  return (
    <SceneStagePreview
      project={project}
      story={story}
      storyId={storyId}
      promptsByLocale={promptsByLocale}
      locale={locale}
      node={node}
      variant="full"
      dialogueHtml={runtime.currentHtml}
      dialogueSpeaker={runtime.currentSpeaker}
      templateState={runtime.state}
      promptInstructions={runtime.promptInstructions}
      onPlaySound={(assetId, options) => {
        window.__playerPlaySound?.(assetId, options);
      }}
      choices={runtime.choices}
      singleChoice={singleChoice}
      showContinue={runtime.isTerminalScene}
      onChoice={handleChoice}
      onContinue={handleContinue}
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
  const configs = runner.getSoundConfigsForCurrentNode() ?? [];
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingPlays = useRef<Map<string, { startTime?: number; endTime?: number }>>(new Map());
  const activeNodeIdRef = useRef(node.id);
  activeNodeIdRef.current = node.id;
  const [onDemandAssetIds, setOnDemandAssetIds] = useState<string[]>([]);

  const playAsset = useCallback(
    (assetId: string, options?: { startTime?: number; endTime?: number }) => {
      const el = audioRefs.current.get(assetId);
      if (el) {
        if (options?.startTime != null) el.currentTime = options.startTime;
        el.play().catch(() => {});
        pendingPlays.current.delete(assetId);
        return;
      }

      pendingPlays.current.set(assetId, options ?? {});
      setOnDemandAssetIds((current) => (current.includes(assetId) ? current : [...current, assetId]));
    },
    []
  );

  useEffect(() => {
    window.__playerPlaySound = playAsset;
    return () => {
      delete (window as unknown as { __playerPlaySound?: unknown }).__playerPlaySound;
    };
  }, [playAsset]);

  useEffect(() => {
    configs.forEach((config) => {
      if (!config.stopOnLoad) return;
      const el = audioRefs.current.get(config.assetId);
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    });
  }, [node.id, configs]);

  const tryStartOnLoad = useCallback(() => {
    if (activeNodeIdRef.current !== node.id) return;
    configs.forEach((config) => {
      if (!config.startOnLoad) return;
      const el = audioRefs.current.get(config.assetId);
      if (!el) return;
      if (config.startTime != null) el.currentTime = config.startTime;
      if (config.loop) el.loop = true;
      el.play().catch(() => {});
    });
  }, [configs, node.id]);

  useEffect(() => {
    tryStartOnLoad();
  }, [node.id, tryStartOnLoad]);

  const handleAudioReady = useCallback(
    (assetId: string, el: HTMLAudioElement) => {
      audioRefs.current.set(assetId, el);

      const pending = pendingPlays.current.get(assetId);
      if (pending) {
        if (pending.startTime != null) el.currentTime = pending.startTime;
        el.play().catch(() => {});
        pendingPlays.current.delete(assetId);
        return;
      }

      tryStartOnLoad();
    },
    [tryStartOnLoad]
  );

  const handleAudioUnmount = useCallback((assetId: string) => {
    audioRefs.current.delete(assetId);
  }, []);

  const configuredAssetIds = new Set(configs.map((config) => config.assetId));
  const extraAssetIds = onDemandAssetIds.filter((assetId) => !configuredAssetIds.has(assetId));

  return (
    <div style={{ display: "none" }} aria-hidden>
      {configs.map((config) => (
        <SoundElement
          key={config.assetId}
          project={project}
          assetId={config.assetId}
          loop={config.loop}
          endTime={config.endTime}
          onReady={handleAudioReady}
          onUnmount={handleAudioUnmount}
        />
      ))}
      {extraAssetIds.map((assetId) => (
        <SoundElement
          key={`on-demand-${assetId}`}
          project={project}
          assetId={assetId}
          onReady={handleAudioReady}
          onUnmount={handleAudioUnmount}
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
  onReady,
  onUnmount,
}: {
  project: Project;
  assetId: string;
  loop?: boolean;
  endTime?: number;
  onReady: (assetId: string, el: HTMLAudioElement) => void;
  onUnmount: (assetId: string) => void;
}) {
  const url = useAssetUrl(project, assetId);
  const ref = useRef<HTMLAudioElement>(null);
  const onReadyRef = useRef(onReady);
  const onUnmountRef = useRef(onUnmount);
  onReadyRef.current = onReady;
  onUnmountRef.current = onUnmount;

  useEffect(() => {
    const el = ref.current;
    if (!el || !url) return;
    onReadyRef.current(assetId, el);
    return () => {
      onUnmountRef.current(assetId);
    };
  }, [assetId, url]);

  if (!url) return null;
  return (
    <audio
      ref={ref}
      src={url}
      loop={loop}
      preload="auto"
      onTimeUpdate={() => {
        const el = ref.current;
        if (el && endTime != null && el.currentTime >= endTime) el.pause();
      }}
    />
  );
}
