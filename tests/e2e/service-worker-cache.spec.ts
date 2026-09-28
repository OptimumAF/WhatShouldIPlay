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

test("first service-worker claim does not reload the active app page", async ({ page }) => {
  await page.addInitScript(() => {
    const serviceWorker = navigator.serviceWorker;
    const addListener = serviceWorker.addEventListener.bind(serviceWorker);
    let controller: object | null = null;
    Object.defineProperty(serviceWorker, "controller", { configurable: true, get: () => controller });
    (window as any).__setTestController = (id: number) => { controller = { id }; };
    (window as any).__controllerListenerCount = 0;
    serviceWorker.addEventListener = ((type: string, listener: EventListener) => {
      if (type === "controllerchange") (window as any).__controllerListenerCount += 1;
      addListener(type, listener);
    }) as typeof serviceWorker.addEventListener;
    serviceWorker.register = (() => new Promise(() => undefined)) as typeof serviceWorker.register;
  });
  let appNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/") {
      appNavigations += 1;
    }
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__controllerListenerCount > 0);
  await page.evaluate(() => {
    (window as any).__setTestController(1);
    navigator.serviceWorker.dispatchEvent(new Event("controllerchange"));
  });
  await page.waitForTimeout(300);
  expect(appNavigations).toBe(1);

  const replacementNavigation = page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame());
  await page.evaluate(() => {
    (window as any).__setTestController(2);
    navigator.serviceWorker.dispatchEvent(new Event("controllerchange"));
  });
  await replacementNavigation;
  expect(appNavigations).toBe(2);
});
