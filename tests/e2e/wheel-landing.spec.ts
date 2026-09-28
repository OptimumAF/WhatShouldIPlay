import { expect, test } from "@playwright/test";

const settings = {
  activePreset: "custom",
  enabledSources: {
    steamcharts: false,
    steamdb: false,
    twitchmetrics: false,
    itchio: false,
    manual: true,
    steamImport: false,
  },
  weightedMode: false,
  adaptiveRecommendations: false,
  cooldownSpins: 0,
  spinSpeedProfile: "rapid",
  reducedSpinAnimation: true,
};

test("the pointer, winner, and history agree across repeated spins", async ({ page }) => {
  await page.addInitScript((initialSettings) => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify(initialSettings));
    localStorage.setItem("pickagame.manual-games.v1", JSON.stringify(["Alpha", "Beta", "Gamma", "Delta"]));
  }, settings);
  await page.goto("/");
  const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
  await expect(spinButton).toBeEnabled();

  for (let spin = 0; spin < 2; spin += 1) {
    await spinButton.click();
    await expect(spinButton).toBeEnabled({ timeout: 10_000 });
    const winnerCard = page.locator(".winner.winner-rich");
    await expect(winnerCard).toBeVisible();
    const winnerName = (await winnerCard.locator("strong").textContent())?.trim();
    const labels = await page.locator(".wheel-label span").allTextContents();
    const rotation = await page.locator(".wheel").evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).getPropertyValue("--rotation")),
    );
    const pointerAngle = ((-rotation % 360) + 360) % 360;
    const pointerIndex = Math.floor(pointerAngle / (360 / labels.length));
    expect(labels[pointerIndex]).toBe(winnerName);
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.locator(".history-list li").first()).toContainText(winnerName ?? "");
    await page.getByRole("tab", { name: "Play" }).click();
  }
});
