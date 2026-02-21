import { useRef, useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useProjectStore } from "@/store/projectStore";
import { createRunner } from "@/core/runtime/runner";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import type { Project } from "@/core/model/types";

const vnBoxStyle: React.CSSProperties = {
  background: "#c5dff0",
  border: "2px solid #1e5a8a",
  borderRadius: "12px",
  padding: "16px 20px",
  color: "#0f172a",
  boxShadow: "0 4px 16px rgba(30, 90, 138, 0.25)",
};
const vnButtonStyle: React.CSSProperties = {
  ...vnBoxStyle,
  cursor: "pointer",
  fontSize: "16px",
  textAlign: "left",
  width: "100%",
  fontFamily: "inherit",
};

/** Fixed height of the bottom dialogue panel (dialogue box ~5 lines + padding). */
const DIALOGUE_PANEL_HEIGHT = "220px";

const STANDARD_RESOLUTIONS: { key: string; width: number; height: number; label: string }[] = [
  { key: "1920x1080", width: 1920, height: 1080, label: "1920 × 1080 (16:9)" },
  { key: "1280x720", width: 1280, height: 720, label: "1280 × 720 (16:9)" },
  { key: "1366x768", width: 1366, height: 768, label: "1366 × 768 (16:9)" },
  { key: "2560x1440", width: 2560, height: 1440, label: "2560 × 1440 (16:9)" },
  { key: "3840x2160", width: 3840, height: 2160, label: "3840 × 2160 (16:9)" },
  { key: "1280x800", width: 1280, height: 800, label: "1280 × 800 (16:10)" },
  { key: "1920x1200", width: 1920, height: 1200, label: "1920 × 1200 (16:10)" },
  { key: "800x600", width: 800, height: 600, label: "800 × 600 (4:3)" },
  { key: "1024x768", width: 1024, height: 768, label: "1024 × 768 (4:3)" },
  { key: "1600x1200", width: 1600, height: 1200, label: "1600 × 1200 (4:3)" },
];
const CUSTOM_RESOLUTION_KEY = "custom";

export default function PlayerView() {
  const project = useProjectStore((s) => s.project);
  const entryId = useMemo(
    () => (project.nodes[0]?.id ?? null),
    [project]
  );

  const runnerRef = useRef<ReturnType<typeof createRunner> | null>(null);
  if (!runnerRef.current) {
    runnerRef.current = createRunner(project, {
      onPlaySound: (assetId, options) => {
        window.__playerPlaySound?.(assetId, options);
      },
    });
  }
  if (runnerRef.current.project !== project) {
    runnerRef.current = createRunner(project, {
      onPlaySound: (assetId, options) => {
        window.__playerPlaySound?.(assetId, options);
      },
    });
  }
  const runner = runnerRef.current;

  const [, setTick] = useState(0);
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
        <Link to="/">Back to Designer</Link>
      </div>
    );
  }

  if (!runtime.currentNodeId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No entry node.</p>
        <Link to="/">Back to Designer</Link>
      </div>
    );
  }

  const node = project.nodes.find((n) => n.id === runtime.currentNodeId)!;
  const hasOptions = runtime.choices.some((c) => c.edge.optionText);
  const singleChoice = runtime.choices.length === 1 && !hasOptions;

  const [resolutionKey, setResolutionKey] = useState("1280x720");
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);
  const [contentAreaSize, setContentAreaSize] = useState({ width: 1280, height: 720 });
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const frameWidth = resolutionKey === CUSTOM_RESOLUTION_KEY ? customWidth : (STANDARD_RESOLUTIONS.find((r) => r.key === resolutionKey)?.width ?? 1280);
  const frameHeight = resolutionKey === CUSTOM_RESOLUTION_KEY ? customHeight : (STANDARD_RESOLUTIONS.find((r) => r.key === resolutionKey)?.height ?? 720);

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
    setResolutionKey(e.target.value);
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
              {STANDARD_RESOLUTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
              <option value={CUSTOM_RESOLUTION_KEY}>Custom</option>
            </select>
          </label>
          {resolutionKey === CUSTOM_RESOLUTION_KEY && (
            <>
              <input
                type="number"
                min={1}
                max={7680}
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value) || 1)}
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
                onChange={(e) => setCustomHeight(Number(e.target.value) || 1)}
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
        <Link to="/" style={{ color: "#7fdbff" }}>Designer</Link>
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

function actorRowJustifyContent(count: number): React.CSSProperties["justifyContent"] {
  if (count <= 1) return "center";
  if (count === 2 || count === 3) return "space-between";
  return "space-evenly";
}

function PlayerStage({
  project,
  node,
  runtime,
  singleChoice,
  handleChoice,
  onRestart,
}: {
  project: Project;
  node: { id: string; backdropId: string | null; actorIds: string[] };
  runtime: { currentHtml: string; choices: Array<{ edge: { id: string; optionText?: string }; targetNode: { id: string; label?: string } }> };
  singleChoice: boolean;
  handleChoice: (targetId: string) => void;
  onRestart?: () => void;
}) {
  const backdropUrl = useAssetUrl(project, node.backdropId);
  const actorCount = node.actorIds.length;

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {backdropUrl && (
        <img
          src={backdropUrl}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          display: "flex",
          alignItems: "stretch",
          justifyContent: actorRowJustifyContent(actorCount),
          padding: "24px 32px 0",
        }}
      >
        {node.actorIds.map((actorId) => (
          <ActorImage key={actorId} project={project} assetId={actorId} />
        ))}
      </div>

      {runtime.choices.length > 0 && !singleChoice && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: DIALOGUE_PANEL_HEIGHT,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxWidth: "80%",
              width: "max-content",
            }}
          >
            {runtime.choices.map(({ edge, targetNode }) => (
              <button
                key={edge.id}
                type="button"
                onClick={() => handleChoice(targetNode.id)}
                style={vnButtonStyle}
              >
                {edge.optionText || `Go to ${targetNode.label ?? targetNode.id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: DIALOGUE_PANEL_HEIGHT,
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "16px 24px 24px",
          background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
        }}
      >
        <div
          style={{
            ...vnBoxStyle,
            position: "relative",
            height: "8em",
            minHeight: "8em",
            overflowY: "auto",
            ...(singleChoice && {
              cursor: "pointer",
              userSelect: "none",
            }),
          }}
          {...(singleChoice && {
            onClick: () => handleChoice(runtime.choices[0].targetNode.id),
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleChoice(runtime.choices[0].targetNode.id);
              }
            },
          })}
        >
          <div
            dangerouslySetInnerHTML={{ __html: runtime.currentHtml }}
            style={{ lineHeight: 1.6 }}
          />
          {singleChoice && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleChoice(runtime.choices[0].targetNode.id);
              }}
              style={{
                position: "absolute",
                bottom: "8px",
                right: "12px",
                background: "transparent",
                border: "none",
                color: "#0f172a",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px 8px",
                lineHeight: 1,
                fontFamily: "inherit",
              }}
              aria-label="Continue"
            >
              Continue &gt;&gt;
            </button>
          )}
        </div>

        {runtime.choices.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <p style={{ margin: 0, padding: "8px 0", color: "#334155", fontSize: "14px" }}>End of story.</p>
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: "#1e5a8a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(30, 90, 138, 0.3)",
                }}
              >
                Restart
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActorImage({ project, assetId }: { project: Project; assetId: string }) {
  const url = useAssetUrl(project, assetId);
  if (!url) return null;
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <img
        src={url}
        alt=""
        style={{
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          objectPosition: "bottom",
          display: "block",
        }}
      />
    </div>
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
