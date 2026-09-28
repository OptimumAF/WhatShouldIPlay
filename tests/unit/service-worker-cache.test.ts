import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const scope = "https://example.test/WhatShouldIPlay/";
const scopePath = "/WhatShouldIPlay/";
const namespace = `pickagame:${encodeURIComponent(scope)}:`;
const script = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

const requestKey = (request: string | { url: string }) => typeof request === "string" ? request : request.url;

const createWorker = () => {
  const listeners = new Map<string, (event: any) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const deleted: string[] = [];
  const messages: Array<{ client: string; type: string }> = [];
  const network: string[] = [];
  let topGamesBody = "first";
  const cacheStorage = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => {
      deleted.push(name);
      return stores.delete(name);
    },
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: string | { url: string }) => store.get(requestKey(request))?.clone(),
        put: async (request: string | { url: string }, response: Response) => {
          store.set(requestKey(request), response.clone());
        },
      };
    },
  };
  const worker = {
    location: { origin: "https://example.test" },
    registration: { scope },
    clients: {
      claim: async () => undefined,
      matchAll: async () => [
        { url: scope, postMessage: (message: { type: string }) => messages.push({ client: "app", type: message.type }) },
        { url: "https://example.test/other/", postMessage: (message: { type: string }) => messages.push({ client: "other", type: message.type }) },
      ],
    },
    addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
    skipWaiting: () => undefined,
  };
  runInNewContext(script, {
    self: worker,
    caches: cacheStorage,
    URL,
    Response,
    fetch: async (request: { url: string }) => {
      network.push(request.url);
      return new Response(request.url.endsWith("top-games.json") ? topGamesBody : "app asset");
    },
  });
  const activate = async () => {
    let completion: Promise<unknown> | undefined;
    listeners.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
    await completion;
  };
  const fetchRequest = async (pathname: string, mode = "same-origin", destination = "") => {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: { url: `https://example.test${pathname}`, method: "GET", mode, destination },
      respondWith: (promise: Promise<Response>) => { response = promise; },
    });
    return response ? await response : undefined;
  };
  return { stores, deleted, messages, network, activate, fetchRequest, setTopGamesBody: (body: string) => { topGamesBody = body; } };
};

test("activation deletes only obsolete caches owned by this deployment scope", async () => {
  const worker = createWorker();
  const names = [
    "other-application-cache",
    "pickagame-runtime-v1",
    `pickagame:${encodeURIComponent("https://example.test/other/")}:runtime-v1`,
    `${namespace}runtime-v1`,
    `${namespace}data-v2`,
  ];
  for (const name of names) worker.stores.set(name, new Map());
  await worker.activate();
  assert.deepEqual(worker.deleted, [`${namespace}runtime-v1`]);
  for (const name of names.filter((name) => name !== `${namespace}runtime-v1`)) {
    assert.equal(worker.stores.has(name), true, `${name} must survive activation`);
  }
});

test("fetch only handles this app's navigation, data, and asset paths", async () => {
  const worker = createWorker();
  assert.equal(await worker.fetchRequest("/other/", "navigate"), undefined);
  assert.equal(await worker.fetchRequest("/other/assets/other.js", "same-origin", "script"), undefined);
  assert.equal(await worker.fetchRequest("/other/data/top-games.json"), undefined);
  assert.ok(await worker.fetchRequest(scopePath, "navigate"));
  assert.ok(await worker.fetchRequest(`${scopePath}assets/index.js`, "same-origin", "script"));
  assert.ok(await worker.fetchRequest(`${scopePath}data/top-games.json`));
  assert.equal(worker.network.length, 3);
  assert.equal([...worker.stores.keys()].every((name) => name.startsWith(namespace)), true);
});

test("a changed app data response updates its cache and only alerts this app's clients", async () => {
  const worker = createWorker();
  const path = `${scopePath}data/top-games.json`;
  assert.equal(await (await worker.fetchRequest(path))?.text(), "first");
  worker.setTopGamesBody("second");
  assert.equal(await (await worker.fetchRequest(path))?.text(), "second");
  const cache = worker.stores.get(`${namespace}data-v2`);
  assert.equal(await cache?.get(`https://example.test${path}`)?.text(), "second");
  assert.deepEqual(worker.messages, [{ client: "app", type: "TOP_GAMES_UPDATED" }]);
});
