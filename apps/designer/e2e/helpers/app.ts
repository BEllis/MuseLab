import { expect, type Page } from "@playwright/test";
export const AUTOSAVE_STORAGE_KEY = "muselab-project";
export const THEME_STORAGE_KEY = "muselab-theme";
export const LEFT_PANEL_COLLAPSED_KEY = "muselab-left-panel-collapsed";

export async function seedDesignerStorage(page: Page, projectPayload?: string): Promise<void> {
  await page.addInitScript(
    ({ autosaveKey, themeKey, panelKey, payload }) => {
      localStorage.clear();
      localStorage.setItem(themeKey, "light");
      localStorage.setItem(panelKey, "true");
      if (payload) {
        localStorage.setItem(autosaveKey, payload);
      }
    },
    {
      autosaveKey: AUTOSAVE_STORAGE_KEY,
      themeKey: THEME_STORAGE_KEY,
      panelKey: LEFT_PANEL_COLLAPSED_KEY,
      payload: projectPayload ?? null,
    }
  );
}

export async function dismissLoadWarningsIfPresent(page: Page): Promise<void> {
  const dismiss = page.getByRole("button", { name: "Dismiss" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(dismiss).toBeHidden();
  }
}

export async function waitForDesignerReady(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("menubar", { name: "Application menu" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await dismissLoadWarningsIfPresent(page);
}

export async function openExportDialog(page: Page): Promise<void> {
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export…" }).click();
  await expect(page.getByRole("dialog", { name: "Export Project" })).toBeVisible();
}

export async function addSceneNode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add node" }).click();
  await page.getByRole("button", { name: "Create New Scene" }).click();
  await expect(graphNodeLabel(page, "Scene")).toBeVisible();
}

export async function startPlay(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("link", { name: "Back to designer" })).toBeVisible();
}

export async function advanceToSceneDialogue(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Begin" })).toBeVisible();
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Welcome to MuseLab/i })).toBeVisible();
}

export function designerCanvasLocator(page: Page) {
  return page.locator("div").filter({ has: page.getByRole("button", { name: "Play" }) }).first();
}

/** X6 renders duplicate SVG labels; always target the first visible match on the canvas. */
export function graphNodeLabel(page: Page, label: string) {
  return designerCanvasLocator(page).getByText(label, { exact: true }).first();
}

export function exportDialogLocator(page: Page) {
  return page.locator(".export-dialog");
}

export function playerHudLocator(page: Page) {
  return page.locator(".app-player");
}

export function playerStageLocator(page: Page) {
  return page.locator(".app-player-stage-area");
}
