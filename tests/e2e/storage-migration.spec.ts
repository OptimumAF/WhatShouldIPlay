import { expect, test } from "@playwright/test";

const SETTINGS_KEY = "pickagame.settings.v1";
const ONBOARDING_KEY = "pickagame.onboarding.v1";

test("sanitizes legacy localStorage settings into stable defaults", async ({ page }) => {
  await page.addInitScript(
    ({ settingsKey, onboardingKey }) => {
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          enabledSources: {
            manual: true,
          },
          sourceWeights: {
            manual: 2.4,
          },
          weightedMode: false,
          cooldownSpins: 999,
          spinSpeedProfile: "ultra-fast",
          reducedSpinAnimation: "yes",
          activePreset: "legacy-v0",
          filters: {
            platform: "ps5",
            tag: "",
            length: "marathon",
            releaseFrom: 42,
            releaseTo: null,
            freeOnly: "sometimes",
            maxPriceUsd: 9_999,
          },
        }),
      );
      localStorage.setItem(onboardingKey, JSON.stringify(true));
    },
    {
      settingsKey: SETTINGS_KEY,
      onboardingKey: ONBOARDING_KEY,
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Show Settings" }).click();

  await expect(page.getByLabel("Spin Speed Profile")).toHaveValue("balanced");
  await expect(page.getByLabel("Cooldown spins")).toHaveValue("20");
  await expect(page.getByLabel("Reduced spin animation")).not.toBeChecked();

  await expect(page.getByRole("checkbox", { name: /^Manual\b/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^itch\.io\b/ })).not.toBeChecked();
});
