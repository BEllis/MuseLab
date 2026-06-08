import { useState } from "react";
import { AssetsPanel } from "./AssetsPanel";
import { ProjectPanel } from "./ProjectPanel";
import { ServicesPanel } from "./ServicesPanel";
import { StoriesPanel } from "./StoriesPanel";

type LeftPanelTab = "project" | "stories" | "assets" | "services";

export function LeftPanel() {
  const [tab, setTab] = useState<LeftPanelTab>("project");

  return (
    <aside className="app-side-panel">
      <div className="app-side-panel-tabs" role="tablist" aria-label="Left panel">
        <button
          type="button"
          role="tab"
          id="left-panel-tab-project"
          aria-selected={tab === "project"}
          aria-controls="left-panel-panel-project"
          className={`app-side-panel-tab${tab === "project" ? " is-active" : ""}`}
          onClick={() => setTab("project")}
        >
          Project
        </button>
        <button
          type="button"
          role="tab"
          id="left-panel-tab-stories"
          aria-selected={tab === "stories"}
          aria-controls="left-panel-panel-stories"
          className={`app-side-panel-tab${tab === "stories" ? " is-active" : ""}`}
          onClick={() => setTab("stories")}
        >
          Stories
        </button>
        <button
          type="button"
          role="tab"
          id="left-panel-tab-assets"
          aria-selected={tab === "assets"}
          aria-controls="left-panel-panel-assets"
          className={`app-side-panel-tab${tab === "assets" ? " is-active" : ""}`}
          onClick={() => setTab("assets")}
        >
          Assets
        </button>
        <button
          type="button"
          role="tab"
          id="left-panel-tab-services"
          aria-selected={tab === "services"}
          aria-controls="left-panel-panel-services"
          className={`app-side-panel-tab${tab === "services" ? " is-active" : ""}`}
          onClick={() => setTab("services")}
        >
          Services
        </button>
      </div>
      <div className="app-side-panel-content">
        {tab === "project" && (
          <div
            role="tabpanel"
            id="left-panel-panel-project"
            aria-labelledby="left-panel-tab-project"
          >
            <ProjectPanel />
          </div>
        )}
        {tab === "stories" && (
          <div
            role="tabpanel"
            id="left-panel-panel-stories"
            aria-labelledby="left-panel-tab-stories"
          >
            <StoriesPanel />
          </div>
        )}
        {tab === "assets" && (
          <div
            role="tabpanel"
            id="left-panel-panel-assets"
            aria-labelledby="left-panel-tab-assets"
          >
            <AssetsPanel />
          </div>
        )}
        {tab === "services" && (
          <div
            role="tabpanel"
            id="left-panel-panel-services"
            aria-labelledby="left-panel-tab-services"
          >
            <ServicesPanel />
          </div>
        )}
      </div>
    </aside>
  );
}
