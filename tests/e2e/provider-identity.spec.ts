import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const feed = JSON.parse(readFileSync(new URL("../fixtures/top-games-identity.json", import.meta.url), "utf8"));

test("same Steam ID merges across sources while same-title distinct IDs stay separate", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
  });
  await page.route("**/data/top-games.json", async (route) => route.fulfill({ json: feed }));
  await page.goto("/");
  const labels = page.locator(".wheel-label span");
  await expect(labels).toHaveCount(3);
  const names = await labels.allTextContents();
  expect(names.filter((name) => name.toLowerCase() === "echo harbor")).toHaveLength(2);
  expect(names).toContain("Unknown Fields Adventure");
});

test("cooldown and saved history distinguish same-title Steam IDs", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.25;
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify({
      activePreset: "custom",
      enabledSources: {
        steamcharts: true,
        steamdb: true,
        twitchmetrics: false,
        itchio: false,
        manual: false,
        steamImport: false,
      },
      weightedMode: false,
      adaptiveRecommendations: false,
      cooldownSpins: 1,
      spinSpeedProfile: "rapid",
      reducedSpinAnimation: true,
    }));
  });
  await page.route("**/data/top-games.json", async (route) => route.fulfill({ json: feed }));
  await page.goto("/");
  const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
  await expect(page.locator(".wheel-label span")).toHaveCount(2);
  for (let count = 1; count <= 2; count += 1) {
    await spinButton.click();
    await expect(spinButton).toBeEnabled({ timeout: 10_000 });
    await expect.poll(async () => page.evaluate(() =>
      (JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]") as unknown[]).length,
    )).toBe(count);
    await expect(page.locator(".winner-overlay")).toBeHidden({ timeout: 10_000 });
  }
  const historyIds = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]") as Array<{ id: string }>).map((item) => item.id),
  );
  expect(historyIds).toEqual(["steam:20202", "steam:10101"]);
});
