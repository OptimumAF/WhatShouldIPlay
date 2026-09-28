import { expect, test } from "@playwright/test";

test("a fresh profile spins manual games twice and keeps its settings after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".onboarding-card")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.locator(".settings-section-switcher").getByRole("tab", { name: "Rules" }).click();
  await page.getByRole("button", { name: /Owned Focus/ }).click();
  await page.getByLabel("Reduced spin animation").check();

  await page.getByRole("tab", { name: "Library" }).click();
  await page.locator("#manual-input").fill("Alpha, Beta, Gamma");
  await page.getByRole("button", { name: "Add Games" }).click();
  await page.getByRole("tab", { name: "Play" }).click();
  await expect(page.locator(".wheel-label span")).toHaveCount(3);

  const winners: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
    await expect(spinButton).toBeEnabled();
    await spinButton.click();
    const card = page.locator(".winner.winner-rich");
    await expect(card).toBeVisible({ timeout: 10_000 });
    winners.push((await card.locator("strong").textContent())?.trim() ?? "");
    await page.getByRole("button", { name: "Nice" }).click();
  }
  expect(new Set(winners).size).toBe(2);
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".history-list li")).toHaveCount(2);
  await expect(page.locator(".history-list li").first()).toContainText(winners[1]);

  await page.reload();
  await expect(page.locator(".onboarding-card")).toHaveCount(0);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.locator(".settings-section-switcher").getByRole("tab", { name: "Rules" }).click();
  await expect(page.getByLabel("Reduced spin animation")).toBeChecked();
  await page.locator(".settings-section-switcher").getByRole("tab", { name: "Sources" }).click();
  await expect(page.getByRole("checkbox", { name: /^Manual\b/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^SteamCharts\b/ })).not.toBeChecked();
  const stored = await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem("pickagame.settings.v1") ?? "{}"),
    manual: JSON.parse(localStorage.getItem("pickagame.manual-games.v1") ?? "[]"),
    history: JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]"),
  }));
  expect(stored.settings.activePreset).toBe("custom");
  expect(stored.settings.reducedSpinAnimation).toBe(true);
  expect(stored.manual).toEqual(["Alpha", "Beta", "Gamma"]);
  expect(stored.history).toHaveLength(2);
});
