import { expect, test } from "@playwright/test";
import {
  addSceneNode,
  designerCanvasLocator,
  graphNodeLabel,
  seedDesignerStorage,
  waitForDesignerReady,
} from "./helpers/app";
import { starterProjectPayload, playableProjectPayload } from "./fixtures/projects";

test.describe("Designer flows", () => {
  test("loads the designer after cito wasm bootstrap", async ({ page }) => {
    await seedDesignerStorage(page);
    await waitForDesignerReady(page);

    await expect(page.getByRole("tab", { name: "Project" })).toBeVisible();
    await expect(graphNodeLabel(page, "Start")).toBeVisible();
  });

  test("creates a scene node from the canvas toolbar", async ({ page }) => {
    await seedDesignerStorage(page, starterProjectPayload());
    await waitForDesignerReady(page);

    await addSceneNode(page);
    await expect(graphNodeLabel(page, "Scene")).toBeVisible();
  });

  test("shows starter canvas baseline", async ({ page }) => {
    await seedDesignerStorage(page, starterProjectPayload());
    await waitForDesignerReady(page);

    await expect(designerCanvasLocator(page)).toHaveScreenshot("designer-starter-canvas.png");
  });

  test("shows valid graph baseline", async ({ page }) => {
    await seedDesignerStorage(page, playableProjectPayload());
    await waitForDesignerReady(page);

    await expect(graphNodeLabel(page, "Scene")).toBeVisible();
    await expect(designerCanvasLocator(page)).toHaveScreenshot("designer-valid-graph.png");
  });
});
