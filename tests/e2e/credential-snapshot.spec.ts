import { expect, test } from "@playwright/test";

const STEAM_CANARY = "synthetic-steam-key-never-export";

test("legacy restore points are scrubbed and Gist upload contains only portable data", async ({ page }) => {
  await page.addInitScript((canary) => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.manual-games.v1", JSON.stringify(["Synthetic Game"]));
    localStorage.setItem(
      "pickagame.steam-import.v1",
      JSON.stringify({ steamApiKey: canary, steamId: "synthetic-steam-id", steamImportGames: [] }),
    );
    localStorage.setItem(
      "pickagame.cloud-sync.restore-points.v1",
      JSON.stringify([
        {
          id: "legacy-point",
          createdAt: "2026-09-28T00:00:00.000Z",
          reason: "synthetic test",
          snapshot: {
            version: 1,
            manualGames: ["Synthetic Game"],
            steamImport: { steamApiKey: canary, steamId: "synthetic-steam-id", steamImportGames: [] },
          },
        },
      ]),
    );
  }, STEAM_CANARY);

  await page.route("https://api.github.com/gists/synthetic-gist-id", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Spin For Your Next Game" })).toBeVisible();

  const storedPoints = () => page.evaluate(() => localStorage.getItem("pickagame.cloud-sync.restore-points.v1"));
  await expect.poll(storedPoints).toContain("Synthetic Game");
  await expect.poll(storedPoints).not.toContain(STEAM_CANARY);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("pickagame.cloud-sync.restore-points.v1") ?? "[]"));
  expect(restored[0].snapshot.manualGames).toEqual(["Synthetic Game"]);

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Show Advanced Options" }).click();
  await page.getByLabel("GitHub token with gist scope").fill("synthetic-auth-only");
  await page.getByLabel("Sync Gist ID").fill("synthetic-gist-id");
  const requestPromise = page.waitForRequest(
    (request) => request.url() === "https://api.github.com/gists/synthetic-gist-id" && request.method() === "PATCH",
  );
  await page.getByRole("button", { name: "Push Sync" }).click();
  const request = await requestPromise;
  const body = request.postDataJSON();
  expect(JSON.stringify(body)).not.toContain(STEAM_CANARY);
  const snapshot = JSON.parse(body.files["whatshouldiplay-sync.json"].content);
  expect(snapshot.manualGames).toEqual(["Synthetic Game"]);
  expect(snapshot.steamImport.steamId).toBe("synthetic-steam-id");
});
