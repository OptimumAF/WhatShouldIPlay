// A source may list the same title for distinct provider games. Keep the
// first observation for each known App ID; name-only rows remain best-effort.
export function dedupeFeedGames(games) {
  const seen = new Set();
  const output = [];
  for (const game of games) {
    const name = game.name?.trim();
    if (!name) continue;
    const key = Number.isSafeInteger(game.appId) && game.appId > 0
      ? `steam:${game.appId}`
      : `name:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(game);
  }
  return output;
}
