use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

use rand::RngExt;
use serde::{Deserialize, Serialize};

use crate::{normalize_name, ManualGameRecord};

const STORE_VERSION: u32 = 1;

#[derive(Deserialize, Serialize)]
struct ManualStore {
    version: u32,
    records: Vec<ManualGameRecord>,
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

pub(crate) fn load_manual_records() -> io::Result<Vec<ManualGameRecord>> {
    load_at(&storage_path()?)
}

pub(crate) fn save_manual_records(records: &[ManualGameRecord]) -> io::Result<()> {
    save_at(&storage_path()?, records)
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

fn load_at(path: &Path) -> io::Result<Vec<ManualGameRecord>> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };
    let stored: ManualStore = serde_json::from_str(&content).map_err(io::Error::other)?;
    if stored.version != STORE_VERSION {
        return Err(invalid_data("unsupported manual library version"));
    }
    validate(&stored.records)?;
    Ok(stored.records)
}

fn save_at(path: &Path, records: &[ManualGameRecord]) -> io::Result<()> {
    validate(records)?;
    let parent = path
        .parent()
        .ok_or_else(|| invalid_data("manual library path has no parent"))?;
    fs::create_dir_all(parent)?;
    let payload = serde_json::to_vec_pretty(&ManualStore {
        version: STORE_VERSION,
        records: records.to_vec(),
    })
    .map_err(io::Error::other)?;
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
    use super::{append_manual_records, load_at, save_at};
    use crate::ManualGameRecord;

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
