import { expect, test } from "@playwright/test";
import {
  advanceToSceneDialogue,
  playerHudLocator,
  seedDesignerStorage,
  startPlay,
  waitForDesignerReady,
} from "./helpers/app";
import { playableProjectPayload } from "./fixtures/projects";

test.describe("Player flows", () => {
  test.beforeEach(async ({ page }) => {
    await seedDesignerStorage(page, playableProjectPayload());
    await waitForDesignerReady(page);
  });

  test("opens play mode from the designer", async ({ page }) => {
    await startPlay(page);
    await expect(page.getByRole("button", { name: "Begin" })).toBeVisible();
  });

  test("advances from start to scene dialogue", async ({ page }) => {
    await startPlay(page);
    await advanceToSceneDialogue(page);
  });

  test("returns to the designer from play mode", async ({ page }) => {
    await startPlay(page);
    await page.getByRole("link", { name: "Back to designer" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("shows play HUD baseline on scene dialogue", async ({ page }) => {
    await startPlay(page);
    await advanceToSceneDialogue(page);

    await expect(playerHudLocator(page)).toHaveScreenshot("player-hud.png");
  });
});
