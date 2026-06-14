import { expect, test } from "@playwright/test";
import {
  exportDialogLocator,
  openExportDialog,
  seedDesignerStorage,
  waitForDesignerReady,
} from "./helpers/app";
import { playableProjectPayload } from "./fixtures/projects";

test.describe("Export dialog", () => {
  test.beforeEach(async ({ page }) => {
    await seedDesignerStorage(page, playableProjectPayload());
    await waitForDesignerReady(page);
    await openExportDialog(page);
  });

  test("opens from the File menu", async ({ page }) => {
    await expect(page.getByText("Choose the language to export your project to.")).toBeVisible();
    await expect(page.getByLabel("Export to C#")).toBeVisible();
  });

  test("shows export target step baseline", async ({ page }) => {
    await expect(exportDialogLocator(page)).toHaveScreenshot("export-dialog-step1.png");
  });

  test("shows export options step baseline", async ({ page }) => {
    await page.getByLabel("Export to C#").check();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByLabel("Namespace")).toBeVisible();
    await expect(exportDialogLocator(page)).toHaveScreenshot("export-dialog-step2.png");
  });
});
