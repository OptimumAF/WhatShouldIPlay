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

/// Scan evidence is local and deliberately contains no machine location.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum LauncherId {
    Steam,
    Epic,
    Gog,
    Ubisoft,
    Xbox,
    Generic,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ScanEvidenceKind {
    Manifest,
    DirectoryName,
    #[cfg(feature = "deep-shortcut-scan")]
    ShortcutName,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct ScanEvidence {
    pub(crate) launcher: LauncherId,
    pub(crate) kind: ScanEvidenceKind,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ScanCandidate {
    pub(crate) name: String,
    pub(crate) evidence: Vec<ScanEvidence>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OwnershipStatus {
    Unknown,
    ObservedSteamImport,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum InstallationStatus {
    Unknown,
    Candidate,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GameObservations {
    pub(crate) trend_sources: Vec<SourceId>,
    pub(crate) ownership: OwnershipStatus,
    pub(crate) installation: InstallationStatus,
    pub(crate) scan_evidence: Vec<ScanEvidence>,
}

/// A scan can suggest an installation, but cannot verify it or establish ownership.
pub(crate) fn observe_sources(
    source_ids: &[SourceId],
    scan_evidence: &[ScanEvidence],
) -> GameObservations {
    let mut trend_sources = Vec::new();
    for source in source_ids {
        if matches!(
            source,
            SourceId::Steamcharts | SourceId::Steamdb | SourceId::Twitchmetrics | SourceId::Itchio
        ) && !trend_sources.contains(source)
        {
            trend_sources.push(*source);
        }
    }
    let scanned = source_ids.contains(&SourceId::Scan);
    GameObservations {
        trend_sources,
        ownership: if source_ids.contains(&SourceId::SteamImport) {
            OwnershipStatus::ObservedSteamImport
        } else {
            OwnershipStatus::Unknown
        },
        installation: if scanned {
            InstallationStatus::Candidate
        } else {
            InstallationStatus::Unknown
        },
        scan_evidence: if scanned {
            scan_evidence.to_vec()
        } else {
            Vec::new()
        },
    }
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
    use super::{
        ids_from_legacy_labels, observe_sources, InstallationStatus, LauncherId, OwnershipStatus,
        ScanEvidence, ScanEvidenceKind, SourceId,
    };

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

    #[test]
    fn trends_import_and_scans_do_not_overstate_availability() {
        let trend = observe_sources(&[SourceId::Steamcharts], &[]);
        assert_eq!(trend.trend_sources, [SourceId::Steamcharts]);
        assert_eq!(trend.ownership, OwnershipStatus::Unknown);
        assert_eq!(trend.installation, InstallationStatus::Unknown);

        let imported = observe_sources(&[SourceId::Steamcharts, SourceId::SteamImport], &[]);
        assert_eq!(imported.ownership, OwnershipStatus::ObservedSteamImport);
        assert_eq!(imported.installation, InstallationStatus::Unknown);

        let evidence = ScanEvidence {
            launcher: LauncherId::Generic,
            kind: ScanEvidenceKind::DirectoryName,
        };
        let scanned = observe_sources(&[SourceId::Scan], &[evidence]);
        assert_eq!(scanned.ownership, OwnershipStatus::Unknown);
        assert_eq!(scanned.installation, InstallationStatus::Candidate);
        assert_eq!(scanned.scan_evidence, [evidence]);
        assert!(observe_sources(&[SourceId::Steamdb], &[evidence])
            .scan_evidence
            .is_empty());
    }
}
