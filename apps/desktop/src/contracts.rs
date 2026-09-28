use serde::Deserialize;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct TopGamesPayloadContract {
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    pub sources: TopGamesSourcesContract,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct TopGamesSourcesContract {
    pub steamcharts: SourcePayloadContract,
    pub steamdb: SourcePayloadContract,
    pub twitchmetrics: SourcePayloadContract,
    pub itchio: SourcePayloadContract,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SourcePayloadContract {
    pub id: String,
    pub label: String,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: String,
    #[serde(default)]
    pub note: Option<String>,
    pub games: Vec<GameContract>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct GameContract {
    pub name: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub rank: Option<usize>,
    #[serde(default)]
    pub score: Option<u64>,
    #[serde(default)]
    #[serde(rename = "appId")]
    pub app_id: Option<u64>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub platforms: Option<Vec<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    #[serde(rename = "releaseDate")]
    pub release_date: Option<String>,
    #[serde(default)]
    #[serde(rename = "priceUsd")]
    pub price_usd: Option<f64>,
    #[serde(default)]
    #[serde(rename = "isFree")]
    pub is_free: Option<bool>,
    #[serde(default)]
    #[serde(rename = "estimatedLength")]
    pub estimated_length: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::TopGamesPayloadContract;

    #[test]
    fn synthetic_feed_retains_provider_ids_failure_note_and_unknown_metadata() {
        let feed: TopGamesPayloadContract = serde_json::from_str(include_str!(
            "../../../tests/fixtures/top-games-identity.json"
        ))
        .expect("synthetic feed must parse on desktop");
        let charts = &feed.sources.steamcharts.games;
        let db = &feed.sources.steamdb.games;
        assert_eq!(charts[0].app_id, Some(10101));
        assert_eq!(db[0].app_id, Some(10101));
        assert_eq!(db[1].app_id, Some(20202));
        assert!(feed
            .sources
            .twitchmetrics
            .note
            .as_ref()
            .is_some_and(|note| note.contains("fetch failure")));
        assert_eq!(feed.sources.twitchmetrics.games[0].price_usd, None);
        assert_eq!(feed.sources.itchio.games[0].is_free, None);
    }
}
