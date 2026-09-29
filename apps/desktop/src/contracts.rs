use serde::{de::Error, Deserialize, Deserializer};

fn deserialize_supported_version<'de, D>(deserializer: D) -> Result<Option<u32>, D::Error>
where
    D: Deserializer<'de>,
{
    let version = u32::deserialize(deserializer)?;
    if version == 1 {
        Ok(Some(version))
    } else {
        Err(D::Error::custom(format!(
            "unsupported top-games schemaVersion {version}; expected 1"
        )))
    }
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct TopGamesPayloadContract {
    #[serde(
        default,
        rename = "schemaVersion",
        deserialize_with = "deserialize_supported_version"
    )]
    pub schema_version: Option<u32>,
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
    #[serde(rename = "providerId")]
    #[serde(deserialize_with = "deserialize_nonempty_provider_id")]
    pub provider_id: Option<String>,
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
    pub price: Option<PriceContract>,
    #[serde(default)]
    #[serde(rename = "isFree")]
    pub is_free: Option<bool>,
    #[serde(default)]
    #[serde(rename = "estimatedLength")]
    pub estimated_length: Option<String>,
    #[serde(default)]
    #[serde(rename = "lengthEstimate")]
    pub length_estimate: Option<LengthEstimateContract>,
    #[serde(default)]
    #[serde(rename = "metadataObservedAt")]
    pub metadata_observed_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(try_from = "RawPriceContract")]
pub struct PriceContract {
    pub amount: f64,
    pub currency: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawPriceContract {
    amount: f64,
    currency: String,
}

fn deserialize_nonempty_provider_id<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let id = String::deserialize(deserializer)?;
    if id.is_empty() {
        Err(D::Error::custom("providerId must not be empty"))
    } else {
        Ok(Some(id))
    }
}

impl TryFrom<RawPriceContract> for PriceContract {
    type Error = String;

    fn try_from(raw: RawPriceContract) -> Result<Self, Self::Error> {
        if !raw.amount.is_finite() || raw.amount < 0.0 {
            return Err("price amount must be finite and nonnegative".to_string());
        }
        if raw.currency.len() != 3 || !raw.currency.bytes().all(|byte| byte.is_ascii_uppercase()) {
            return Err("price currency must be a three-letter uppercase code".to_string());
        }
        Ok(Self {
            amount: raw.amount,
            currency: raw.currency,
        })
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LengthEstimateContract {
    pub value: GameLengthContract,
    pub method: LengthEstimateMethodContract,
    pub confidence: EstimateConfidenceContract,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GameLengthContract {
    Short,
    Medium,
    Long,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LengthEstimateMethodContract {
    GenreHeuristic,
    Provider,
    User,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EstimateConfidenceContract {
    Low,
    Medium,
    High,
}

#[cfg(test)]
mod tests {
    use super::{
        EstimateConfidenceContract, GameLengthContract, LengthEstimateMethodContract,
        TopGamesPayloadContract,
    };

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
        assert_eq!(feed.schema_version, None);
        assert!(feed
            .sources
            .twitchmetrics
            .note
            .as_ref()
            .is_some_and(|note| note.contains("fetch failure")));
        assert_eq!(feed.sources.twitchmetrics.games[0].price_usd, None);
        assert_eq!(feed.sources.itchio.games[0].is_free, None);
    }

    #[test]
    fn versioned_metadata_fixture_retains_currency_provenance_and_rejects_future_versions() {
        let raw = include_str!("../../../tests/fixtures/top-games-metadata-v1.json");
        let feed: TopGamesPayloadContract = serde_json::from_str(raw).unwrap();
        let game = &feed.sources.steamcharts.games[0];
        assert_eq!(feed.schema_version, Some(1));
        assert_eq!(
            feed.sources.steamcharts.fetched_at,
            "2026-01-01T12:00:00.000Z"
        );
        assert_eq!(game.app_id, Some(10101));
        assert_eq!(game.provider_id.as_deref(), Some("10101"));
        assert_eq!(
            game.url.as_deref(),
            Some("https://example.invalid/games/echo-harbor")
        );
        assert_eq!(
            game.platforms.as_deref(),
            Some(&["windows".into(), "linux".into()][..])
        );
        assert_eq!(game.price.as_ref().map(|price| price.amount), Some(19.99));
        assert_eq!(
            game.price.as_ref().map(|price| price.currency.as_str()),
            Some("EUR")
        );
        assert_eq!(
            game.length_estimate.as_ref().map(|estimate| estimate.value),
            Some(GameLengthContract::Long)
        );
        assert_eq!(
            game.length_estimate
                .as_ref()
                .map(|estimate| estimate.method),
            Some(LengthEstimateMethodContract::GenreHeuristic)
        );
        assert_eq!(
            game.length_estimate
                .as_ref()
                .map(|estimate| estimate.confidence),
            Some(EstimateConfidenceContract::Low)
        );
        assert_eq!(
            game.metadata_observed_at.as_deref(),
            Some("2026-01-01T11:30:00.000Z")
        );
        assert!(feed.sources.itchio.games[0].price.is_none());
        assert!(feed.sources.itchio.games[0].is_free.is_none());

        let mut unsupported: serde_json::Value = serde_json::from_str(raw).unwrap();
        unsupported["schemaVersion"] = serde_json::json!(99);
        let error = serde_json::from_value::<TopGamesPayloadContract>(unsupported).unwrap_err();
        assert!(error
            .to_string()
            .contains("unsupported top-games schemaVersion"));

        let mut invalid_price: serde_json::Value = serde_json::from_str(raw).unwrap();
        invalid_price["sources"]["steamcharts"]["games"][0]["price"]["currency"] =
            serde_json::json!("eur");
        assert!(serde_json::from_value::<TopGamesPayloadContract>(invalid_price.clone()).is_err());
        invalid_price["sources"]["steamcharts"]["games"][0]["price"] =
            serde_json::json!({"amount":-1,"currency":"EUR"});
        assert!(serde_json::from_value::<TopGamesPayloadContract>(invalid_price).is_err());
    }
}
