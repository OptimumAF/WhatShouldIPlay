import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.manual-games.v1", JSON.stringify(["Alpha", "Beta", "Gamma", "Delta"]));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify({
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
      cooldownSpins: 1,
      spinSpeedProfile: "rapid",
      reducedSpinAnimation: true,
    }));
  });
  await page.goto("/");
  await expect(page.locator(".wheel-label span")).toHaveCount(4);
});

const selectedAtPointer = async (page: import("@playwright/test").Page) => {
  const labels = await page.locator(".wheel-label span").allTextContents();
  const rotation = await page.locator(".wheel").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).getPropertyValue("--rotation")),
  );
  const angle = ((-rotation % 360) + 360) % 360;
  return labels[Math.floor(angle / (360 / labels.length))];
};

test("pool changes during a spin do not relabel that spin or its result", async ({ page }) => {
  const initialLabels = await page.locator(".wheel-label span").allTextContents();
  const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
  await spinButton.click();
  await page.getByRole("tab", { name: "Library" }).click();
  await page.locator("#manual-input").fill("Epsilon");
  await page.getByRole("button", { name: "Add Games" }).click();
  await page.getByRole("tab", { name: "Play" }).click();

  await expect(page.locator(".wheel-label span")).toHaveText(initialLabels);
  await expect(page.locator(".winner.winner-rich")).toBeVisible({ timeout: 10_000 });
  const winner = (await page.locator(".winner.winner-rich strong").textContent())?.trim();
  expect(await selectedAtPointer(page)).toBe(winner);
  await expect(page.locator(".wheel-label span")).toHaveText(initialLabels);
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".history-list li")).toHaveCount(1);
  await expect(page.locator(".history-list li").first()).toContainText(winner ?? "");
});

test("child transitions cannot finish a spin, and duplicate completion records one result", async ({ page }) => {
  const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
  await spinButton.click();
  await page.locator(".wheel-label").first().evaluate((element) => {
    element.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true, propertyName: "transform" }));
  });
  await expect(page.locator(".play-stage-actions button").first()).toBeDisabled();
  await page.locator(".wheel").evaluate((element) => {
    element.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true, propertyName: "transform" }));
    element.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true, propertyName: "transform" }));
  });
  await expect(page.locator(".winner.winner-rich")).toBeVisible();
  await page.waitForTimeout(1800);
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".history-list li")).toHaveCount(1);
});

test("synchronous repeat activation selects only once", async ({ page }) => {
  const randomCalls = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(".play-stage-actions button");
    if (!button) throw new Error("Spin button missing");
    const originalRandom = Math.random;
    let calls = 0;
    Math.random = () => {
      calls += 1;
      return 0.2;
    };
    try {
      button.click();
      button.click();
      return calls;
    } finally {
      Math.random = originalRandom;
    }
  });
  expect(randomCalls).toBe(2);
  await expect(page.locator(".winner.winner-rich")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".history-list li")).toHaveCount(1);
});
