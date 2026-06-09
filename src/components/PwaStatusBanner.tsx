import { useEffect } from "react";
import { usePwaStore } from "@/store/pwaStore";

const bannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 16px",
  fontSize: "13px",
  lineHeight: 1.5,
  borderBottom: "1px solid var(--app-border, #333)",
} as const;

export function PwaStatusBanner() {
  const isOffline = usePwaStore((state) => state.isOffline);
  const updateAvailable = usePwaStore((state) => state.updateAvailable);
  const applyUpdate = usePwaStore((state) => state.applyUpdate);
  const setOffline = usePwaStore((state) => state.setOffline);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [setOffline]);

  if (!isOffline && !updateAvailable) {
    return null;
  }

  if (updateAvailable) {
    return (
      <div
        role="status"
        style={{
          ...bannerStyle,
          background: "var(--app-info-bg, #1a2a4a)",
          color: "var(--app-info-text, #e8f0ff)",
        }}
      >
        <span style={{ flex: 1 }}>A new version of MuseLab is available.</span>
        <button
          type="button"
          className="app-toolbar-button"
          onClick={() => applyUpdate?.()}
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      style={{
        ...bannerStyle,
        background: "var(--app-surface-muted, #1a1a1a)",
        color: "var(--app-text-muted, #aaa)",
      }}
    >
      You&apos;re offline. Changes are saved locally in this browser.
    </div>
  );
}
