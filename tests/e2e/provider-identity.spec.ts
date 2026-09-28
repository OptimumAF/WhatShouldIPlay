import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const feed = JSON.parse(readFileSync(new URL("../fixtures/top-games-identity.json", import.meta.url), "utf8"));
test.use({ serviceWorkers: "block" });
const singleTrendFeed = structuredClone(feed);
singleTrendFeed.sources.steamdb.games = [];
singleTrendFeed.sources.twitchmetrics.games = [];
singleTrendFeed.sources.itchio.games = [];

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

for (const imported of [false, true]) {
  test(`winner availability distinguishes ${imported ? "Steam import" : "trend only"}`, async ({ page }) => {
    await page.addInitScript(({ importedGame }) => {
      localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
      localStorage.setItem("pickagame.settings.v1", JSON.stringify({
        activePreset: "custom",
        enabledSources: {
          steamcharts: true,
          steamdb: false,
          twitchmetrics: false,
          itchio: false,
          manual: false,
          steamImport: importedGame,
        },
        weightedMode: false,
        adaptiveRecommendations: false,
        cooldownSpins: 0,
        spinSpeedProfile: "rapid",
        reducedSpinAnimation: true,
      }));
      if (importedGame) {
        localStorage.setItem("pickagame.steam-import.v1", JSON.stringify({
          steamId: "synthetic-id",
          steamImportGames: [{ name: "Echo Harbor", appId: 10101 }],
        }));
      }
    }, { importedGame: imported });
    await page.route("**/data/top-games.json", async (route) => route.fulfill({ json: singleTrendFeed }));
    await page.goto("/");
    const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
    await expect(page.locator(".wheel-label span")).toHaveCount(1);
    await spinButton.click();
    const expected = imported
      ? "In imported Steam library; installation has not been checked."
      : "Trend listing only; ownership and installation have not been checked.";
    await expect(page.locator(".winner.winner-rich p.muted")).toHaveText(expected, { timeout: 10_000 });
  });
}
