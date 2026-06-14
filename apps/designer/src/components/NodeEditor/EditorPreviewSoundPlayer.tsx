import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";

export function useEditorPreviewSoundPlayer(_project: Project) {
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingPlays = useRef<Map<string, { startTime?: number; endTime?: number }>>(new Map());
  const [onDemandAssetIds, setOnDemandAssetIds] = useState<string[]>([]);

  const playSound = useCallback(
    (assetId: string, options?: { startTime?: number; endTime?: number }) => {
      const el = audioRefs.current.get(assetId);
      if (el) {
        el.pause();
        if (options?.startTime != null) el.currentTime = options.startTime;
        else el.currentTime = 0;
        void el.play().catch(() => {});
        pendingPlays.current.delete(assetId);
        return;
      }

      pendingPlays.current.set(assetId, options ?? {});
      setOnDemandAssetIds((current) =>
        current.includes(assetId) ? current : [...current, assetId]
      );
    },
    []
  );

  const stopAll = useCallback(() => {
    for (const el of audioRefs.current.values()) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  const handleAudioReady = useCallback((assetId: string, el: HTMLAudioElement) => {
    audioRefs.current.set(assetId, el);
    const pending = pendingPlays.current.get(assetId);
    if (!pending) return;
    if (pending.startTime != null) el.currentTime = pending.startTime;
    void el.play().catch(() => {});
    pendingPlays.current.delete(assetId);
  }, []);

  const handleAudioUnmount = useCallback((assetId: string) => {
    audioRefs.current.delete(assetId);
  }, []);

  return {
    playSound,
    stopAll,
    onDemandAssetIds,
    handleAudioReady,
    handleAudioUnmount,
  };
}

function PreviewSoundElement({
  project,
  assetId,
  onReady,
  onUnmount,
}: {
  project: Project;
  assetId: string;
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
  return <audio ref={ref} src={url} preload="auto" />;
}

export function EditorPreviewSoundPlayer({
  project,
  assetIds,
  onReady,
  onUnmount,
}: {
  project: Project;
  assetIds: string[];
  onReady: (assetId: string, el: HTMLAudioElement) => void;
  onUnmount: (assetId: string) => void;
}) {
  return (
    <div style={{ display: "none" }} aria-hidden>
      {assetIds.map((assetId) => (
        <PreviewSoundElement
          key={assetId}
          project={project}
          assetId={assetId}
          onReady={onReady}
          onUnmount={onUnmount}
        />
      ))}
    </div>
  );
}
