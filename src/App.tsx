import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import clsx from "clsx";
import { pickSpin, normalizeGames } from "./lib/wheel";
import { Wheel } from "./components/Wheel";
import type { GameEntry, TopGamesPayload } from "./types";

const payloadSchema = z.object({
  generatedAt: z.string(),
  sources: z.object({
    steamcharts: z.object({
      id: z.literal("steamcharts"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(
        z.object({
          name: z.string(),
          source: z.string(),
          rank: z.number().optional(),
          score: z.number().optional(),
          appId: z.number().optional(),
          url: z.string().optional(),
        }),
      ),
    }),
    steamdb: z.object({
      id: z.literal("steamdb"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(
        z.object({
          name: z.string(),
          source: z.string(),
          rank: z.number().optional(),
          score: z.number().optional(),
          appId: z.number().optional(),
          url: z.string().optional(),
        }),
      ),
    }),
    twitchmetrics: z.object({
      id: z.literal("twitchmetrics"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(
        z.object({
          name: z.string(),
          source: z.string(),
          rank: z.number().optional(),
          score: z.number().optional(),
          appId: z.number().optional(),
          url: z.string().optional(),
        }),
      ),
    }),
  }),
});

async function fetchTopGames(): Promise<TopGamesPayload> {
  const url = `${import.meta.env.BASE_URL}data/top-games.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load game data (${response.status})`);
  }
  const json = await response.json();
  return payloadSchema.parse(json) as TopGamesPayload;
}

type EnabledSources = {
  steamcharts: boolean;
  steamdb: boolean;
  twitchmetrics: boolean;
  manual: boolean;
};

export default function App() {
  const [enabledSources, setEnabledSources] = useState<EnabledSources>({
    steamcharts: true,
    steamdb: true,
    twitchmetrics: true,
    manual: true,
  });
  const [manualInput, setManualInput] = useState("");
  const [manualGames, setManualGames] = useState<string[]>([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [pendingWinner, setPendingWinner] = useState<string>("");

  const topGamesQuery = useQuery({
    queryKey: ["top-games"],
    queryFn: fetchTopGames,
    staleTime: 1000 * 60 * 10,
  });

  const topGames = topGamesQuery.data;

  const activePool = useMemo(() => {
    const pool: string[] = [];
    if (topGames && enabledSources.steamcharts) {
      pool.push(...topGames.sources.steamcharts.games.map((game) => game.name));
    }
    if (topGames && enabledSources.steamdb) {
      pool.push(...topGames.sources.steamdb.games.map((game) => game.name));
    }
    if (topGames && enabledSources.twitchmetrics) {
      pool.push(...topGames.sources.twitchmetrics.games.map((game) => game.name));
    }
    if (enabledSources.manual) {
      pool.push(...manualGames);
    }
    return normalizeGames(pool);
  }, [enabledSources, topGames, manualGames]);

  const addManualGames = () => {
    const incoming = normalizeGames(manualInput.split(/\r?\n|,/g));
    setManualGames((current) => normalizeGames([...current, ...incoming]));
    setManualInput("");
  };

  const clearManualGames = () => {
    setManualGames([]);
  };

  const handleSpin = () => {
    if (spinning || activePool.length === 0) {
      return;
    }
    const result = pickSpin(activePool.length, rotation);
    const selected = activePool[result.winnerIndex];
    setPendingWinner(selected ?? "");
    setWinner("");
    setRotation(result.nextRotation);
    setSpinning(true);
  };

  const onSpinEnd = () => {
    if (!spinning) return;
    setWinner(pendingWinner);
    setPendingWinner("");
    setSpinning(false);
  };

  return (
    <main className="layout">
      <header className="hero">
        <p className="kicker">PickAGame</p>
        <h1>Spin For Your Next Game</h1>
        <p>
          Mix top games from SteamCharts, SteamDB/Steam charts data, TwitchMetrics, and your own list.
          Then spin.
        </p>
      </header>

      <section className="panel">
        <h2>Sources</h2>
        <div className="grid-sources">
          {(["steamcharts", "steamdb", "twitchmetrics", "manual"] as const).map((source) => {
            const sourceMeta =
              source === "manual"
                ? null
                : (topGames?.sources[source].games as GameEntry[] | undefined);
            const note = source === "manual" ? "Your custom list" : topGames?.sources[source].note;
            const fetchedAt = source === "manual" ? null : topGames?.sources[source].fetchedAt;

            return (
              <label key={source} className={clsx("source-card", enabledSources[source] && "is-enabled")}>
                <input
                  type="checkbox"
                  checked={enabledSources[source]}
                  onChange={() =>
                    setEnabledSources((current) => ({
                      ...current,
                      [source]: !current[source],
                    }))
                  }
                />
                <div>
                  <strong>{source}</strong>
                  <p>{sourceMeta ? `${sourceMeta.length} games loaded` : note}</p>
                  {fetchedAt ? <small>Updated {new Date(fetchedAt).toLocaleString()}</small> : null}
                  {note && source !== "manual" ? <small>{note}</small> : null}
                </div>
              </label>
            );
          })}
        </div>
        {topGamesQuery.isLoading ? <p className="status">Loading source data...</p> : null}
        {topGamesQuery.isError ? <p className="status error">{(topGamesQuery.error as Error).message}</p> : null}
      </section>

      <section className="panel">
        <h2>Manual List</h2>
        <p className="muted">Add games by newline or comma. For desktop game scanning, use the Rust app in `apps/desktop`.</p>
        <textarea
          rows={5}
          value={manualInput}
          onChange={(event) => setManualInput(event.target.value)}
          placeholder="Helldivers 2&#10;Hades II&#10;Monster Hunter Wilds"
        />
        <div className="button-row">
          <button type="button" onClick={addManualGames}>
            Add Games
          </button>
          <button type="button" className="ghost" onClick={clearManualGames}>
            Clear Manual
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Wheel</h2>
        <p className="muted">{activePool.length} unique games in your current pool.</p>
        <Wheel games={activePool} rotation={rotation} spinning={spinning} onSpinEnd={onSpinEnd} />
        <div className="button-row">
          <button type="button" onClick={handleSpin} disabled={spinning || activePool.length === 0}>
            {spinning ? "Spinning..." : "Spin The Wheel"}
          </button>
        </div>
        {winner ? (
          <div className="winner">
            <p>You should play:</p>
            <strong>{winner}</strong>
          </div>
        ) : null}
      </section>
    </main>
  );
}

