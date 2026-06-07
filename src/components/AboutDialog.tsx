import { useEffect } from "react";
import logoUrl from "@/assets/logo.png";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TAGLINE,
  APP_URL,
  APP_VERSION,
  COPYRIGHT_NOTICE,
  GIT_DESCRIBE,
} from "@/appInfo";
import { useAboutStore } from "@/store/aboutStore";
import "./AboutDialog.css";

export function AboutDialog() {
  const open = useAboutStore((s) => s.open);
  const hide = useAboutStore((s) => s.hide);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, hide]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-dialog-title"
      className="about-dialog-overlay"
      onClick={hide}
    >
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <img src={logoUrl} alt="" className="about-dialog-logo" />
        <h2 id="about-dialog-title" className="about-dialog-title">
          {APP_NAME}
        </h2>
        <p className="about-dialog-tagline">{APP_TAGLINE}</p>
        <p className="about-dialog-description">{APP_DESCRIPTION}</p>
        <p className="about-dialog-meta">
          Version {APP_VERSION}
          <span className="about-dialog-meta-separator" aria-hidden="true">
            ·
          </span>
          {GIT_DESCRIBE}
        </p>
        <p className="about-dialog-link-row">
          <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="about-dialog-link">
            {APP_URL.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <p className="about-dialog-copyright">{COPYRIGHT_NOTICE}</p>
        <div className="about-dialog-actions">
          <button type="button" onClick={hide} className="app-toolbar-button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
