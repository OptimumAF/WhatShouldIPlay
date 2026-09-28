import { expect, test } from "@playwright/test";

const STEAM_CANARY = "synthetic-steam-key-never-export";
const GIST_CANARY = "synthetic-gist-token-never-export";

test("Cloud Sync explains secret Gists and disconnect keeps the local library", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.manual-games.v1", JSON.stringify(["Local Only Game"]));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Show Advanced Options" }).click();
  await expect(page.getByText(/Secret Gists are unlisted, not private/)).toBeVisible();
  await expect(page.getByText(/Uploads settings, profiles, manual and imported games/)).toBeVisible();

  await page.getByLabel("GitHub token with gist scope").fill(GIST_CANARY);
  await page.getByLabel("Sync Gist ID").fill("synthetic-gist-id");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByLabel("GitHub token with gist scope")).toBeEmpty();
  await expect(page.getByLabel("Sync Gist ID")).toBeEmpty();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pickagame.cloud-sync.v1"))).not.toContain(
    "synthetic-gist-id",
  );
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pickagame.manual-games.v1"))).toContain(
    "Local Only Game",
  );
});

test("Steam import errors never display a provider response containing a credential", async ({ page }) => {
  const canary = "synthetic-secret-in-provider-response";
  await page.addInitScript(() => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
  });
  await page.route("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/**", async (route) => {
    await route.fulfill({
      status: 403,
      headers: { "access-control-allow-origin": "*" },
      body: `request rejected: ${canary}`,
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Steam Web API Key").fill("synthetic-session-only-key");
  await page.getByRole("textbox", { name: "SteamID64", exact: true }).fill("synthetic-id");
  await page.getByRole("button", { name: "Import Steam Library" }).click();
  await expect(page.getByText(/Steam import failed/).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(canary);
});

test("legacy browser storage drops retained credentials but keeps imported games and IDs", async ({ page }) => {
  await page.addInitScript(({ steamCanary, gistCanary }) => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem(
      "pickagame.steam-import.v1",
      JSON.stringify({
        steamApiKey: steamCanary,
        steamId: "synthetic-steam-id",
        steamImportGames: [{ name: "Synthetic Owned Game", appId: 42 }],
      }),
    );
    localStorage.setItem(
      "pickagame.cloud-sync.v1",
      JSON.stringify({ provider: "githubGist", gistId: "synthetic-gist-id", gistToken: gistCanary }),
    );
  }, { steamCanary: STEAM_CANARY, gistCanary: GIST_CANARY });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Spin For Your Next Game" })).toBeVisible();

  const storedSteam = () => page.evaluate(() => localStorage.getItem("pickagame.steam-import.v1"));
  const storedGist = () => page.evaluate(() => localStorage.getItem("pickagame.cloud-sync.v1"));
  await expect.poll(storedSteam).toContain("Synthetic Owned Game");
  await expect.poll(storedSteam).not.toContain(STEAM_CANARY);
  await expect.poll(storedGist).toContain("synthetic-gist-id");
  await expect.poll(storedGist).not.toContain(GIST_CANARY);

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByLabel("Steam Web API Key")).toBeEmpty();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Show Advanced Options" }).click();
  await expect(page.getByText(/Updating the Gist file does not erase its revision history/)).toBeVisible();
  await expect(page.getByLabel("GitHub token with gist scope")).toBeEmpty();
  await expect(page.getByLabel("Sync Gist ID")).toHaveValue("synthetic-gist-id");
});

test("pulling a legacy Gist keeps the session key local and never uploads the old key", async ({ page }) => {
  const remoteKey = "synthetic-legacy-remote-key";
  const methods: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
  });
  await page.route("https://api.github.com/gists/synthetic-gist-id", async (route) => {
    const method = route.request().method();
    methods.push(method);
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          files: {
            "whatshouldiplay-sync.json": {
              content: JSON.stringify({
                version: 1,
                manualGames: ["Legacy Game"],
                steamImport: {
                  steamApiKey: remoteKey,
                  steamId: "legacy-steam-id",
                  steamImportGames: [{ name: "Legacy Owned Game", appId: 77 }],
                },
              }),
            },
          },
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Steam Web API Key").fill("synthetic-session-only-key");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Show Advanced Options" }).click();
  await page.getByLabel("GitHub token with gist scope").fill("synthetic-auth-only");
  await page.getByLabel("Sync Gist ID").fill("synthetic-gist-id");
  await page.getByRole("button", { name: "Pull Sync" }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("pickagame.manual-games.v1"))).toContain("Legacy Game");
  await page.getByRole("tab", { name: "Sources" }).click();
  await expect(page.getByLabel("Steam Web API Key")).toHaveValue("synthetic-session-only-key");
  await page.getByRole("tab", { name: "Advanced" }).click();
  const requestPromise = page.waitForRequest(
    (request) => request.url() === "https://api.github.com/gists/synthetic-gist-id" && request.method() === "PATCH",
  );
  await page.getByRole("button", { name: "Push Sync" }).click();
  const request = await requestPromise;
  const body = JSON.stringify(request.postDataJSON());
  expect(body).not.toContain(remoteKey);
  expect(body).not.toContain("synthetic-session-only-key");
  expect(methods).toEqual(["GET", "PATCH"]);
});

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
