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

test("legacy manual game keeps its identity, history, and played status after rename and reload", async ({ page }) => {
  await page.addInitScript((initialSettings) => {
    if (sessionStorage.getItem("manual-identity-seeded")) return;
    sessionStorage.setItem("manual-identity-seeded", "true");
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify(initialSettings));
    localStorage.setItem("pickagame.manual-games.v1", JSON.stringify(["Old Name"]));
    localStorage.setItem("pickagame.spin-history.v1", JSON.stringify([{
      name: "Old Name", sources: ["manual"], odds: 1, spunAt: "2026-01-01T00:00:00.000Z",
    }]));
    localStorage.setItem("pickagame.exclusions.v1", JSON.stringify({
      excludePlayed: true, excludeCompleted: true, playedGames: ["Old Name"], completedGames: [],
    }));
  }, settings);
  await page.goto("/");
  await page.getByRole("tab", { name: "Library" }).click();
  const rename = page.getByRole("textbox", { name: "Rename Old Name" });
  await rename.fill("New Name");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("textbox", { name: "Rename New Name" })).toHaveValue("New Name");

  await expect.poll(async () => page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("pickagame.manual-records.v1") ?? "[]") as Array<{ id: string; name: string }>;
    const history = JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]") as Array<{ id?: string }>;
    const exclusions = JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}") as { playedRecords?: Array<{ id: string }> };
    return { records, historyId: history[0]?.id, playedId: exclusions.playedRecords?.[0]?.id };
  })).toMatchObject({ records: [{ name: "New Name" }] });
  const beforeReload = await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("pickagame.manual-records.v1") ?? "[]") as Array<{ id: string }>;
    const history = JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]") as Array<{ id?: string }>;
    const exclusions = JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}") as { playedRecords?: Array<{ id: string }> };
    return { manualId: records[0]?.id, historyId: history[0]?.id, playedId: exclusions.playedRecords?.[0]?.id };
  });
  expect(beforeReload.manualId).toMatch(/^manual:/);
  expect(beforeReload.historyId).toBe(beforeReload.manualId);
  expect(beforeReload.playedId).toBe(beforeReload.manualId);

  await page.reload();
  await page.getByRole("tab", { name: "Library" }).click();
  await expect(page.getByRole("textbox", { name: "Rename New Name" })).toHaveValue("New Name");
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".history-list li").first()).toContainText("New Name");
  await page.getByRole("tab", { name: "Play" }).click();
  await expect(page.getByText(/0 games in this spin pool/)).toBeVisible();
});

test("removing a migrated manual status does not recreate it on reload", async ({ page }) => {
  await page.addInitScript((initialSettings) => {
    if (localStorage.getItem("manual-status-seeded")) return;
    localStorage.setItem("manual-status-seeded", "true");
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify(initialSettings));
    localStorage.setItem("pickagame.manual-games.v1", JSON.stringify(["Legacy Title"]));
    localStorage.setItem("pickagame.exclusions.v1", JSON.stringify({
      excludePlayed: true, excludeCompleted: true, playedGames: ["Legacy Title"], completedGames: [],
    }));
  }, settings);
  await page.goto("/");
  await expect.poll(async () => page.evaluate(() => {
    const exclusions = JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}") as {
      playedRecords?: unknown[];
    };
    return exclusions.playedRecords?.length;
  })).toBe(1);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Show Advanced Options" }).click();
  await page.locator(".exclude-list").first().getByRole("button", { name: "Remove" }).nth(1).click();
  await expect.poll(async () => page.evaluate(() => {
    const exclusions = JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}") as {
      playedGames?: string[]; playedRecords?: unknown[];
    };
    return { names: exclusions.playedGames, records: exclusions.playedRecords };
  })).toEqual({ names: ["Legacy Title"], records: [] });
  const beforeReload = await page.evaluate(() => ({
    seeded: localStorage.getItem("manual-status-seeded"),
    records: localStorage.getItem("pickagame.manual-records.v1"),
    exclusions: localStorage.getItem("pickagame.exclusions.v1"),
  }));
  await page.reload();
  const afterReload = await page.evaluate(() => ({
    seeded: localStorage.getItem("manual-status-seeded"),
    records: localStorage.getItem("pickagame.manual-records.v1"),
    exclusions: localStorage.getItem("pickagame.exclusions.v1"),
  }));
  expect(afterReload).toEqual(beforeReload);
});

test("two manual records with the same title remain separate wheel entries", async ({ page }) => {
  await page.addInitScript((initialSettings) => {
    Math.random = () => 0.25;
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify(initialSettings));
    localStorage.setItem("pickagame.manual-records.v1", JSON.stringify([
      { id: "manual:synthetic-one", name: "Echo Harbor" },
      { id: "manual:synthetic-two", name: "Echo Harbor" },
    ]));
  }, settings);
  await page.goto("/");
  await expect(page.locator(".wheel-label span")).toHaveCount(2);
  await page.getByRole("button", { name: "Spin The Wheel" }).click();
  await expect(page.locator(".winner-overlay")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("dialog").getByRole("button", { name: "Mark Played" }).click();
  const playedId = await page.evaluate(() => {
    const exclusions = JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}") as {
      playedRecords?: Array<{ id: string }>;
    };
    return exclusions.playedRecords?.[0]?.id;
  });
  expect(["manual:synthetic-one", "manual:synthetic-two"]).toContain(playedId);
  await page.getByRole("dialog").getByRole("button", { name: "Nice" }).click();
  await expect(page.getByText(/1 games in this spin pool/)).toBeVisible();
  const survivingId = playedId === "manual:synthetic-one" ? "manual:synthetic-two" : "manual:synthetic-one";
  await page.getByRole("button", { name: "Spin The Wheel" }).click();
  await expect(page.locator(".wheel-label span")).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]") as Array<{ id: string }>).map((item) => item.id),
  )).toEqual([survivingId, playedId]);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Mark Completed" }).click();
  await expect.poll(async () => page.evaluate(() => {
    const exclusions = JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}") as {
      completedRecords?: Array<{ id: string }>;
    };
    return exclusions.completedRecords?.[0]?.id;
  })).toBe(survivingId);
  await page.getByRole("dialog").getByRole("button", { name: "Nice" }).click();
  await expect(page.getByText(/0 games in this spin pool/)).toBeVisible();
});

test("portable Gist snapshot restores manual IDs, status, and history after a local rename", async ({ page }) => {
  let remoteSnapshot: Record<string, unknown> | undefined;
  await page.addInitScript((initialSettings) => {
    if (sessionStorage.getItem("manual-cloud-seeded")) return;
    sessionStorage.setItem("manual-cloud-seeded", "true");
    localStorage.setItem("pickagame.onboarding.v1", JSON.stringify(true));
    localStorage.setItem("pickagame.settings.v1", JSON.stringify(initialSettings));
    localStorage.setItem("pickagame.manual-records.v1", JSON.stringify([
      { id: "manual:cloud-one", name: "Cloud Name" },
      { id: "manual:cloud-two", name: "Second Name" },
    ]));
    localStorage.setItem("pickagame.spin-history.v1", JSON.stringify([{
      id: "manual:cloud-one", name: "Cloud Name", sources: ["manual"], odds: 0.5,
      spunAt: "2026-01-01T00:00:00.000Z",
    }]));
    localStorage.setItem("pickagame.exclusions.v1", JSON.stringify({
      excludePlayed: true, excludeCompleted: true, playedGames: [], completedGames: [],
      playedRecords: [{ id: "manual:cloud-one", name: "Cloud Name" }], completedRecords: [],
    }));
  }, settings);
  await page.route("https://api.github.com/gists/synthetic-manual-gist", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { files: Record<string, { content: string }> };
      remoteSnapshot = JSON.parse(body.files["whatshouldiplay-sync.json"].content);
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ files: {
        "whatshouldiplay-sync.json": { content: JSON.stringify(remoteSnapshot) },
      } }),
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Show Advanced Options" }).click();
  await page.getByLabel("GitHub token with gist scope").fill("synthetic-auth-only");
  await page.getByLabel("Sync Gist ID").fill("synthetic-manual-gist");
  await page.getByRole("button", { name: "Push Sync" }).click();
  await expect.poll(() => remoteSnapshot?.manualRecords).toEqual([
    { id: "manual:cloud-one", name: "Cloud Name" },
    { id: "manual:cloud-two", name: "Second Name" },
  ]);
  expect(remoteSnapshot?.spinHistory).toMatchObject([{ id: "manual:cloud-one" }]);
  expect(remoteSnapshot?.exclusions).toMatchObject({ playedRecords: [{ id: "manual:cloud-one" }] });
  expect(JSON.stringify(remoteSnapshot)).not.toContain("synthetic-auth-only");

  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("textbox", { name: "Rename Cloud Name" }).fill("Local Change");
  await page.getByRole("button", { name: "Save name" }).first().click();
  await expect(page.getByRole("textbox", { name: "Rename Local Change" })).toHaveValue("Local Change");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Pull Sync" }).click();
  await page.getByRole("tab", { name: "Library" }).click();
  await expect(page.getByRole("textbox", { name: "Rename Cloud Name" })).toHaveValue("Cloud Name");
  await page.reload();
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".history-list li").first()).toContainText("Cloud Name");
  const restored = await page.evaluate(() => ({
    records: JSON.parse(localStorage.getItem("pickagame.manual-records.v1") ?? "[]"),
    exclusions: JSON.parse(localStorage.getItem("pickagame.exclusions.v1") ?? "{}"),
    history: JSON.parse(localStorage.getItem("pickagame.spin-history.v1") ?? "[]"),
  }));
  expect(restored.records[0]).toEqual({ id: "manual:cloud-one", name: "Cloud Name" });
  expect(restored.exclusions.playedRecords[0]).toEqual({ id: "manual:cloud-one", name: "Cloud Name" });
  expect(restored.history[0].id).toBe("manual:cloud-one");
});
