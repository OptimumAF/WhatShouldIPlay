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
