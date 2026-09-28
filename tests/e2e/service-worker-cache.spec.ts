import { expect, test } from "@playwright/test";

test("activation preserves sibling caches and caches this app's data under its scope", async ({ page }) => {
  await page.route("**/__sw-test-blank", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Cache setup</title>",
  }));
  await page.goto("/__sw-test-blank");
  const ownObsoleteName = await page.evaluate(async () => {
    const scope = new URL("/", location.href).href;
    const obsolete = `pickagame:${encodeURIComponent(scope)}:runtime-v1`;
    await caches.open("other-application-cache");
    await caches.open("pickagame-runtime-v1");
    await caches.open(obsolete);
    return obsolete;
  });

  await page.goto("/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const dataUrl = new URL("data/top-games.json", registration.scope).href;
    const response = await fetch(dataUrl);
    const namespace = `pickagame:${encodeURIComponent(registration.scope)}:`;
    const dataCache = await caches.open(`${namespace}data-v2`);
    return {
      keys: await caches.keys(),
      responseOk: response.ok,
      cached: Boolean(await dataCache.match(dataUrl)),
    };
  });
  expect(result.keys).toContain("other-application-cache");
  expect(result.keys).toContain("pickagame-runtime-v1");
  expect(result.keys).not.toContain(ownObsoleteName);
  expect(result.responseOk).toBe(true);
  expect(result.cached).toBe(true);
});
