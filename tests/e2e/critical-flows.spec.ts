import { expect, test } from "@playwright/test";

const SETTINGS_KEY = "pickagame.settings.v1";
const MANUAL_GAMES_KEY = "pickagame.manual-games.v1";
const ONBOARDING_KEY = "pickagame.onboarding.v1";

const reducedMotionManualSettings = {
  enabledSources: {
    steamcharts: false,
    steamdb: false,
    twitchmetrics: false,
    itchio: false,
    manual: true,
    steamImport: false,
  },
  sourceWeights: {
    steamcharts: 1,
    steamdb: 1,
    twitchmetrics: 1,
    itchio: 1,
    manual: 1,
    steamImport: 1,
  },
  weightedMode: false,
  adaptiveRecommendations: false,
  cooldownSpins: 0,
  spinSpeedProfile: "rapid",
  reducedSpinAnimation: true,
  activePreset: "custom",
  filters: {
    platform: "any",
    tag: "any",
    length: "any",
    releaseFrom: "",
    releaseTo: "",
    freeOnly: false,
    maxPriceUsd: 70,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ onboardingKey, settingsKey, manualKey, settings }) => {
      localStorage.setItem(onboardingKey, JSON.stringify(true));
      localStorage.setItem(settingsKey, JSON.stringify(settings));
      localStorage.setItem(manualKey, JSON.stringify(["Hades", "Balatro", "Factorio"]));
    },
    {
      onboardingKey: ONBOARDING_KEY,
      settingsKey: SETTINGS_KEY,
      manualKey: MANUAL_GAMES_KEY,
      settings: reducedMotionManualSettings,
    },
  );
});

test("spins and records a winner in history", async ({ page }) => {
  await page.goto("/");

  const spinButton = page.getByRole("button", { name: "Spin The Wheel" });
  await expect(spinButton).toBeEnabled();
  await spinButton.click();

  const winnerCard = page.locator(".winner.winner-rich");
  await expect(winnerCard).toBeVisible({ timeout: 10_000 });

  const winnerName = (await winnerCard.locator("strong").textContent())?.trim();
  expect(winnerName && winnerName.length > 0).toBeTruthy();

  const historyItems = page.locator(".history-list li");
  await expect(historyItems.first()).toBeVisible();
  await expect(historyItems.first()).toContainText(winnerName ?? "");
});

test("keeps settings hidden by default and reveals advanced options on demand", async ({ page }) => {
  await page.goto("/");

  const showSettingsButton = page.getByRole("button", { name: "Show Settings" });
  await expect(showSettingsButton).toBeVisible();
  await showSettingsButton.click();

  await expect(page.getByRole("heading", { name: "Mode Presets" })).toBeVisible();

  const showAdvancedButton = page.getByRole("button", { name: "Show Advanced Options" });
  await showAdvancedButton.click();

  await expect(page.getByRole("heading", { name: "Advanced Filters" })).toBeVisible();
});

test("allows adding manual games from the Library tab", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Library" }).click();

  const manualInput = page.locator("#manual-input");
  await manualInput.fill("Dead Cells, Slay the Spire");
  await page.getByRole("button", { name: "Add Games" }).click();

  await page.getByRole("tab", { name: "Play" }).click();
  await expect(page.getByText("5 games in this spin pool")).toBeVisible();
});
