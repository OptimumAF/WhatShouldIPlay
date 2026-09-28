use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

use rand::RngExt;
use serde::{Deserialize, Serialize};

use crate::{
    normalize_name, provenance::ids_from_legacy_labels, DesktopLocalState, ManualGameRecord,
    SpinHistoryItem,
};

const MANUAL_STORE_VERSION: u32 = 1;
const LEGACY_DESKTOP_STATE_VERSION: u32 = 2;
const DESKTOP_STATE_VERSION: u32 = 3;

#[derive(Deserialize, Serialize)]
struct ManualStore {
    version: u32,
    records: Vec<ManualGameRecord>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct DesktopStateFile {
    version: u32,
    state: DesktopLocalState,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacyDesktopStateFile {
    version: u32,
    state: LegacyDesktopLocalState,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacyDesktopLocalState {
    manual_records: Vec<ManualGameRecord>,
    history: Vec<LegacySpinHistoryItem>,
    played_ids: Vec<String>,
    completed_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacySpinHistoryItem {
    id: Option<String>,
    name: String,
    display_name: String,
    sources: String,
    odds: f64,
}

fn storage_path() -> io::Result<PathBuf> {
    let app_data = dirs::data_local_dir().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "local app-data directory unavailable",
        )
    })?;
    Ok(app_data
        .join("WhatShouldIPlay")
        .join("manual-games.v1.json"))
}

fn current_storage_path() -> io::Result<PathBuf> {
    let app_data = dirs::data_local_dir().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "local app-data directory unavailable",
        )
    })?;
    Ok(app_data
        .join("WhatShouldIPlay")
        .join("desktop-state.v3.json"))
}

fn legacy_desktop_state_path() -> io::Result<PathBuf> {
    let app_data = dirs::data_local_dir().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "local app-data directory unavailable",
        )
    })?;
    Ok(app_data
        .join("WhatShouldIPlay")
        .join("desktop-state.v2.json"))
}

pub(crate) fn load_desktop_state() -> io::Result<DesktopLocalState> {
    load_desktop_state_at(
        &current_storage_path()?,
        &legacy_desktop_state_path()?,
        &storage_path()?,
    )
}

pub(crate) fn save_desktop_state(state: &DesktopLocalState) -> io::Result<()> {
    save_desktop_state_at(&current_storage_path()?, state)
}

pub(crate) fn append_manual_records(
    existing: &[ManualGameRecord],
    input: &str,
) -> Vec<ManualGameRecord> {
    let mut records = existing.to_vec();
    let mut used = records
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<HashSet<_>>();
    let mut rng = rand::rng();
    for line in input.split(['\n', ',']) {
        let name = normalize_name(line);
        if name.is_empty() {
            continue;
        }
        let id = loop {
            let id = format!("manual:{:032x}", rng.random::<u128>());
            if used.insert(id.clone()) {
                break id;
            }
        };
        records.push(ManualGameRecord { id, name });
    }
    records
}

pub(crate) fn rename_manual_record(
    existing: &[ManualGameRecord],
    id: &str,
    input: &str,
) -> io::Result<Vec<ManualGameRecord>> {
    let name = normalize_name(input);
    if name.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "empty manual game name",
        ));
    }
    let mut records = existing.to_vec();
    let record = records
        .iter_mut()
        .find(|entry| entry.id == id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "manual game ID not found"))?;
    record.name = name;
    Ok(records)
}

pub(crate) fn manual_record_label(records: &[ManualGameRecord], id: &str) -> Option<String> {
    let record = records.iter().find(|entry| entry.id == id)?;
    let name_key = record.name.to_lowercase();
    let mut matching_ids = records
        .iter()
        .filter(|entry| entry.name.to_lowercase() == name_key)
        .map(|entry| entry.id.as_str())
        .collect::<Vec<_>>();
    if matching_ids.len() == 1 {
        return Some(record.name.clone());
    }
    matching_ids.sort_unstable();
    let ordinal = matching_ids.iter().position(|entry| *entry == id)? + 1;
    Some(format!("{} ({ordinal})", record.name))
}

#[derive(Clone, Copy)]
pub(crate) enum ManualStatus {
    Eligible,
    Played,
    Completed,
}

pub(crate) fn set_manual_status(
    current: &DesktopLocalState,
    id: &str,
    status: ManualStatus,
) -> io::Result<DesktopLocalState> {
    if !current.manual_records.iter().any(|entry| entry.id == id) {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "manual game ID not found",
        ));
    }
    let mut next = current.clone();
    next.played_ids.retain(|entry| entry != id);
    next.completed_ids.retain(|entry| entry != id);
    match status {
        ManualStatus::Eligible => {}
        ManualStatus::Played => next.played_ids.push(id.to_string()),
        ManualStatus::Completed => next.completed_ids.push(id.to_string()),
    }
    Ok(next)
}

fn invalid_data(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn validate(records: &[ManualGameRecord]) -> io::Result<()> {
    let mut used = HashSet::new();
    for entry in records {
        let suffix = entry
            .id
            .strip_prefix("manual:")
            .ok_or_else(|| invalid_data("invalid manual ID"))?;
        if suffix.is_empty()
            || !suffix
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(invalid_data("invalid manual ID"));
        }
        if normalize_name(&entry.name).is_empty() {
            return Err(invalid_data("empty manual game name"));
        }
        if !used.insert(&entry.id) {
            return Err(invalid_data("duplicate manual ID"));
        }
    }
    Ok(())
}

fn validate_desktop_state(state: &DesktopLocalState) -> io::Result<()> {
    validate(&state.manual_records)?;
    if state.history.len() > 30 {
        return Err(invalid_data("too many spin history entries"));
    }
    let manual_ids = state
        .manual_records
        .iter()
        .map(|record| record.id.as_str())
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    for status_ids in [&state.played_ids, &state.completed_ids] {
        for id in status_ids {
            if !manual_ids.contains(id.as_str()) || !seen.insert(id) {
                return Err(invalid_data("invalid or conflicting manual status ID"));
            }
        }
    }
    for item in &state.history {
        if normalize_name(&item.name).is_empty()
            || !item.odds.is_finite()
            || !(0.0..=1.0).contains(&item.odds)
            || item.id.as_ref().is_some_and(|id| id.is_empty())
        {
            return Err(invalid_data("invalid spin history entry"));
        }
        let mut sources_seen = HashSet::new();
        if !item.source_ids.iter().all(|id| sources_seen.insert(*id)) {
            return Err(invalid_data("duplicate spin history source ID"));
        }
    }
    Ok(())
}

fn load_at(path: &Path) -> io::Result<Vec<ManualGameRecord>> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };
    let stored: ManualStore = serde_json::from_str(&content).map_err(io::Error::other)?;
    if stored.version != MANUAL_STORE_VERSION {
        return Err(invalid_data("unsupported manual library version"));
    }
    validate(&stored.records)?;
    Ok(stored.records)
}

#[cfg(test)]
fn save_at(path: &Path, records: &[ManualGameRecord]) -> io::Result<()> {
    validate(records)?;
    let payload = serde_json::to_vec_pretty(&ManualStore {
        version: MANUAL_STORE_VERSION,
        records: records.to_vec(),
    })
    .map_err(io::Error::other)?;
    write_atomically(path, &payload)
}

fn load_desktop_state_at(
    current: &Path,
    legacy_state: &Path,
    legacy_manual: &Path,
) -> io::Result<DesktopLocalState> {
    let content = match fs::read_to_string(current) {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return load_legacy_desktop_state_at(legacy_state, legacy_manual);
        }
        Err(error) => return Err(error),
    };
    let stored: DesktopStateFile = serde_json::from_str(&content).map_err(io::Error::other)?;
    if stored.version != DESKTOP_STATE_VERSION {
        return Err(invalid_data("unsupported desktop state version"));
    }
    validate_desktop_state(&stored.state)?;
    Ok(stored.state)
}

fn load_legacy_desktop_state_at(
    legacy_state: &Path,
    legacy_manual: &Path,
) -> io::Result<DesktopLocalState> {
    let content = match fs::read_to_string(legacy_state) {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(DesktopLocalState {
                manual_records: load_at(legacy_manual)?,
                ..DesktopLocalState::default()
            });
        }
        Err(error) => return Err(error),
    };
    let stored: LegacyDesktopStateFile =
        serde_json::from_str(&content).map_err(io::Error::other)?;
    if stored.version != LEGACY_DESKTOP_STATE_VERSION {
        return Err(invalid_data("unsupported legacy desktop state version"));
    }
    let state = DesktopLocalState {
        manual_records: stored.state.manual_records,
        history: stored
            .state
            .history
            .into_iter()
            .map(|item| SpinHistoryItem {
                id: item.id,
                name: item.name,
                display_name: item.display_name,
                source_ids: ids_from_legacy_labels(&item.sources),
                sources: item.sources,
                odds: item.odds,
            })
            .collect(),
        played_ids: stored.state.played_ids,
        completed_ids: stored.state.completed_ids,
    };
    validate_desktop_state(&state)?;
    Ok(state)
}

fn save_desktop_state_at(path: &Path, state: &DesktopLocalState) -> io::Result<()> {
    validate_desktop_state(state)?;
    let payload = serde_json::to_vec_pretty(&DesktopStateFile {
        version: DESKTOP_STATE_VERSION,
        state: state.clone(),
    })
    .map_err(io::Error::other)?;
    write_atomically(path, &payload)
}

fn write_atomically(path: &Path, payload: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| invalid_data("state path has no parent"))?;
    fs::create_dir_all(parent)?;
    let mut rng = rand::rng();
    let (temporary, mut file) = loop {
        let temporary = parent.join(format!(".manual-games-{:032x}.tmp", rng.random::<u128>()));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
        {
            Ok(file) => break (temporary, file),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    };
    let write_result = (|| {
        file.write_all(&payload)?;
        file.sync_all()
    })();
    drop(file);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }
    let result = fs::rename(&temporary, path);
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::{
        append_manual_records, load_at, load_desktop_state_at, manual_record_label,
        rename_manual_record, save_at, save_desktop_state_at, set_manual_status, ManualStatus,
    };
    use crate::{provenance::SourceId, ManualGameRecord, SpinHistoryItem};

    #[test]
    fn version_two_history_labels_migrate_to_canonical_sources_without_overwrite() {
        let directory = tempfile::tempdir().unwrap();
        let current_path = directory.path().join("desktop-state.v3.json");
        let version_two_path = directory.path().join("desktop-state.v2.json");
        let manual_path = directory.path().join("manual-games.v1.json");
        let version_two = serde_json::json!({
            "version": 2,
            "state": {
                "manual_records": [],
                "history": [
                    {"id":"steam:10101","name":"Echo Harbor","display_name":"Echo Harbor",
                     "sources":"SteamCharts + Steam Import","odds":0.5},
                    {"id":null,"name":"Unknown Adventure","display_name":"Unknown Adventure",
                     "sources":"Unknown Provider","odds":0.5}
                ],
                "played_ids": [],
                "completed_ids": []
            }
        });
        let original = serde_json::to_vec(&version_two).unwrap();
        std::fs::write(&version_two_path, &original).unwrap();

        let migrated =
            load_desktop_state_at(&current_path, &version_two_path, &manual_path).unwrap();
        assert_eq!(
            migrated.history[0].source_ids,
            [SourceId::Steamcharts, SourceId::SteamImport]
        );
        assert_eq!(migrated.history[0].sources, "SteamCharts + Steam Import");
        assert!(migrated.history[1].source_ids.is_empty());
        assert_eq!(migrated.history[1].sources, "Unknown Provider");
        assert!(!current_path.exists());
        assert_eq!(std::fs::read(&version_two_path).unwrap(), original);

        save_desktop_state_at(&current_path, &migrated).unwrap();
        let saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&current_path).unwrap()).unwrap();
        assert_eq!(saved["version"], 3);
        assert_eq!(
            saved["state"]["history"][0]["source_ids"],
            serde_json::json!(["steamcharts", "steamImport"]),
        );
        assert_eq!(
            load_desktop_state_at(&current_path, &version_two_path, &manual_path).unwrap(),
            migrated,
        );
        assert_eq!(std::fs::read(&version_two_path).unwrap(), original);
    }

    #[test]
    fn malformed_or_unsupported_version_two_state_blocks_fallback_without_replacement() {
        let directory = tempfile::tempdir().unwrap();
        let current_path = directory.path().join("desktop-state.v3.json");
        let version_two_path = directory.path().join("desktop-state.v2.json");
        let manual_path = directory.path().join("manual-games.v1.json");
        let legacy_records = vec![ManualGameRecord {
            id: "manual:synthetic-one".into(),
            name: "Echo Harbor".into(),
        }];
        save_at(&manual_path, &legacy_records).unwrap();
        let original_manual = std::fs::read(&manual_path).unwrap();

        for content in [
            "{broken".to_string(),
            serde_json::json!({"version": 99, "state": {
                "manual_records": [], "history": [], "played_ids": [], "completed_ids": []
            }})
            .to_string(),
        ] {
            std::fs::write(&version_two_path, &content).unwrap();
            assert!(load_desktop_state_at(&current_path, &version_two_path, &manual_path).is_err());
            assert_eq!(std::fs::read_to_string(&version_two_path).unwrap(), content);
            assert_eq!(std::fs::read(&manual_path).unwrap(), original_manual);
            assert!(!current_path.exists());
        }
    }

    #[test]
    fn version_one_manual_data_migrates_with_id_status_and_history_round_trip() {
        let directory = tempfile::tempdir().unwrap();
        let legacy_path = directory.path().join("manual-games.v1.json");
        let legacy_state_path = directory.path().join("desktop-state.v2.json");
        let current_path = directory.path().join("desktop-state.v3.json");
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/selection-edge-cases.json"
        ))
        .unwrap();
        let records: Vec<ManualGameRecord> =
            serde_json::from_value(fixture["manualGames"].clone()).unwrap();
        save_at(&legacy_path, &records).unwrap();
        let mut state =
            load_desktop_state_at(&current_path, &legacy_state_path, &legacy_path).unwrap();
        assert_eq!(state.manual_records, records);
        assert!(state.played_ids.is_empty());
        assert!(state.completed_ids.is_empty());
        assert!(state.history.is_empty());

        state = set_manual_status(&state, "manual:synthetic-one", ManualStatus::Played).unwrap();
        assert_eq!(state.played_ids, ["manual:synthetic-one"]);
        assert!(state.completed_ids.is_empty());
        assert!(set_manual_status(&state, "manual:missing", ManualStatus::Played).is_err());
        state = set_manual_status(&state, "manual:synthetic-one", ManualStatus::Completed).unwrap();
        assert!(state.played_ids.is_empty());
        assert_eq!(state.completed_ids, ["manual:synthetic-one"]);
        state.history.push(SpinHistoryItem {
            id: Some("manual:synthetic-one".into()),
            name: "Echo Harbor".into(),
            display_name: "Echo Harbor (1)".into(),
            sources: "Manual".into(),
            source_ids: vec![SourceId::Manual],
            odds: 0.5,
        });
        state.manual_records =
            rename_manual_record(&state.manual_records, "manual:synthetic-one", "New Harbor")
                .unwrap();
        save_desktop_state_at(&current_path, &state).unwrap();
        let restored =
            load_desktop_state_at(&current_path, &legacy_state_path, &legacy_path).unwrap();
        assert_eq!(restored, state);
        assert_eq!(
            load_at(&legacy_path).unwrap(),
            records,
            "migration leaves legacy file untouched"
        );

        let valid_current = std::fs::read(&current_path).unwrap();
        let mut conflicting = state.clone();
        conflicting.played_ids.push("manual:synthetic-one".into());
        assert!(save_desktop_state_at(&current_path, &conflicting).is_err());
        assert_eq!(std::fs::read(&current_path).unwrap(), valid_current);

        std::fs::write(&current_path, b"{broken").unwrap();
        assert!(load_desktop_state_at(&current_path, &legacy_state_path, &legacy_path).is_err());
        assert_eq!(std::fs::read(&current_path).unwrap(), b"{broken");
        assert_eq!(load_at(&legacy_path).unwrap(), records);

        let unsupported = serde_json::json!({"version": 99, "state": state}).to_string();
        std::fs::write(&current_path, &unsupported).unwrap();
        assert!(load_desktop_state_at(&current_path, &legacy_state_path, &legacy_path).is_err());
        assert_eq!(std::fs::read_to_string(&current_path).unwrap(), unsupported);
        assert_eq!(load_at(&legacy_path).unwrap(), records);
    }

    #[test]
    fn rename_one_equal_title_record_keeps_its_id_after_reload() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/selection-edge-cases.json"
        ))
        .unwrap();
        let records: Vec<ManualGameRecord> =
            serde_json::from_value(fixture["manualGames"].clone()).unwrap();
        assert_eq!(
            manual_record_label(&records, "manual:synthetic-one").as_deref(),
            Some("Echo Harbor (1)")
        );
        assert_eq!(
            manual_record_label(&records, "manual:synthetic-two").as_deref(),
            Some("Echo Harbor (2)")
        );
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("manual-games.v1.json");
        save_at(&path, &records).unwrap();

        let renamed = rename_manual_record(
            &load_at(&path).unwrap(),
            "manual:synthetic-one",
            "New Harbor",
        )
        .unwrap();
        save_at(&path, &renamed).unwrap();
        assert_eq!(
            load_at(&path).unwrap(),
            vec![
                ManualGameRecord {
                    id: "manual:synthetic-one".into(),
                    name: "New Harbor".into()
                },
                ManualGameRecord {
                    id: "manual:synthetic-two".into(),
                    name: "Echo Harbor".into()
                },
            ]
        );
        assert!(rename_manual_record(&renamed, "manual:missing", "Another").is_err());
        assert!(rename_manual_record(&renamed, "manual:synthetic-one", "   ").is_err());
    }

    #[test]
    fn same_title_records_keep_unique_ids_across_two_replacements() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("manual-games.v1.json");
        let first = append_manual_records(&[], "Echo Harbor\nEcho Harbor");
        assert_eq!(first.len(), 2);
        assert_ne!(first[0].id, first[1].id);
        save_at(&path, &first).unwrap();
        assert_eq!(load_at(&path).unwrap(), first);
        let second = append_manual_records(&first, "Another Game");
        save_at(&path, &second).unwrap();
        assert_eq!(load_at(&path).unwrap(), second);
    }

    #[test]
    fn corrupt_or_unsupported_state_is_rejected_without_replacement() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("manual-games.v1.json");
        std::fs::write(&path, b"{broken").unwrap();
        assert!(load_at(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"{broken");
        std::fs::write(&path, br#"{"version":2,"records":[]}"#).unwrap();
        assert!(load_at(&path).is_err());
        let repeated_id = vec![
            ManualGameRecord {
                id: "manual:one".into(),
                name: "One".into(),
            },
            ManualGameRecord {
                id: "manual:one".into(),
                name: "Two".into(),
            },
        ];
        assert!(save_at(&path, &repeated_id).is_err());
        assert_eq!(
            std::fs::read(&path).unwrap(),
            br#"{"version":2,"records":[]}"#
        );
    }
}
