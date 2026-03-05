use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TopGamesPayloadContract {
    pub generatedAt: String,
    pub sources: TopGamesSourcesContract,
}

#[derive(Debug, Deserialize)]
pub struct TopGamesSourcesContract {
    pub steamcharts: SourcePayloadContract,
    pub steamdb: SourcePayloadContract,
    pub twitchmetrics: SourcePayloadContract,
    pub itchio: SourcePayloadContract,
}

#[derive(Debug, Deserialize)]
pub struct SourcePayloadContract {
    pub id: String,
    pub label: String,
    pub fetchedAt: String,
    #[serde(default)]
    pub note: Option<String>,
    pub games: Vec<GameContract>,
}

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
    pub appId: Option<u64>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub platforms: Option<Vec<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub releaseDate: Option<String>,
    #[serde(default)]
    pub priceUsd: Option<f64>,
    #[serde(default)]
    pub isFree: Option<bool>,
    #[serde(default)]
    pub estimatedLength: Option<String>,
}
