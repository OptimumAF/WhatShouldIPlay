use serde::{Deserialize, Serialize};

/// Canonical source IDs shared with the web snapshot contract.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SourceId {
    Steamcharts,
    Steamdb,
    Twitchmetrics,
    Itchio,
    Manual,
    Scan,
    SteamImport,
}

impl SourceId {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Steamcharts => "steamcharts",
            Self::Steamdb => "steamdb",
            Self::Twitchmetrics => "twitchmetrics",
            Self::Itchio => "itchio",
            Self::Manual => "manual",
            Self::Scan => "scan",
            Self::SteamImport => "steamImport",
        }
    }

    pub(crate) fn display_label(self) -> &'static str {
        match self {
            Self::Steamcharts => "SteamCharts",
            Self::Steamdb => "SteamDB",
            Self::Twitchmetrics => "TwitchMetrics",
            Self::Itchio => "itch.io",
            Self::Manual => "Manual",
            Self::Scan => "Scanned",
            Self::SteamImport => "Steam Import",
        }
    }

    fn from_legacy_label(label: &str) -> Option<Self> {
        match label.trim() {
            "SteamCharts" => Some(Self::Steamcharts),
            "SteamDB" => Some(Self::Steamdb),
            "TwitchMetrics" => Some(Self::Twitchmetrics),
            "itch.io" => Some(Self::Itchio),
            "Manual" => Some(Self::Manual),
            "Scanned" | "Escaneado" => Some(Self::Scan),
            "Steam Import" | "Importacion Steam" => Some(Self::SteamImport),
            _ => None,
        }
    }
}

/// Unknown legacy labels remain visible as snapshots but gain no inferred facts.
pub(crate) fn ids_from_legacy_labels(labels: &str) -> Vec<SourceId> {
    let mut ids = Vec::new();
    for label in labels.split('+') {
        if let Some(id) = SourceId::from_legacy_label(label) {
            if !ids.contains(&id) {
                ids.push(id);
            }
        }
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::{ids_from_legacy_labels, SourceId};

    #[test]
    fn source_ids_match_web_contract_and_unknown_labels_stay_unknown() {
        for (id, wire) in [
            (SourceId::Steamcharts, "steamcharts"),
            (SourceId::Steamdb, "steamdb"),
            (SourceId::Twitchmetrics, "twitchmetrics"),
            (SourceId::Itchio, "itchio"),
            (SourceId::Manual, "manual"),
            (SourceId::Scan, "scan"),
            (SourceId::SteamImport, "steamImport"),
        ] {
            assert_eq!(id.as_str(), wire);
            assert_eq!(serde_json::to_string(&id).unwrap(), format!("\"{wire}\""));
        }
        assert_eq!(
            ids_from_legacy_labels("SteamCharts + Unknown Provider + Steam Import"),
            [SourceId::Steamcharts, SourceId::SteamImport]
        );
        assert!(ids_from_legacy_labels("Unknown Provider").is_empty());
    }
}
