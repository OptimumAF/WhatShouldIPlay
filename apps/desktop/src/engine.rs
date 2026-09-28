use std::collections::{HashMap, HashSet};

use crate::{
    source_index_from_label, GameItem, ManualGameRecord, SpinHistoryItem, WeightedPoolGame,
};

#[derive(Clone, Debug)]
pub(crate) struct SuggestedWeights {
    pub(crate) steamcharts: f64,
    pub(crate) steamdb: f64,
    pub(crate) twitch: f64,
    pub(crate) steam_import: f64,
    pub(crate) manual: f64,
    pub(crate) scanned: f64,
}

#[derive(Clone, Debug)]
pub(crate) struct DerivedWheelData {
    pub(crate) spin_pool: Vec<WeightedPoolGame>,
    pub(crate) cooldown_exhausted: bool,
    pub(crate) wheel_background: String,
    pub(crate) wheel_labels: Vec<(f64, f64, String)>,
    pub(crate) behavior_signal_count: usize,
    pub(crate) suggested_weights: SuggestedWeights,
    pub(crate) adaptive_spin_weights: Vec<f64>,
}

#[derive(Clone, Debug)]
pub(crate) struct SpinOperation {
    pub(crate) id: u64,
    pub(crate) eligible: Vec<WeightedPoolGame>,
    pub(crate) effective_weights: Vec<f64>,
    pub(crate) winner_index: usize,
    pub(crate) winner: SpinHistoryItem,
    pub(crate) wheel_labels: Vec<(f64, f64, String)>,
    pub(crate) wheel_background: String,
    pub(crate) transition: String,
}

impl SpinOperation {
    pub(crate) fn new(
        id: u64,
        eligible: &[WeightedPoolGame],
        effective_weights: &[f64],
        winner_index: usize,
        wheel_labels: &[(f64, f64, String)],
        wheel_background: &str,
        transition: &str,
    ) -> Self {
        assert!(!eligible.is_empty() && winner_index < eligible.len());
        assert_eq!(eligible.len(), effective_weights.len());
        let selected = &eligible[winner_index];
        let total = effective_weights.iter().sum::<f64>().max(0.0001);
        Self {
            id,
            eligible: eligible.to_vec(),
            effective_weights: effective_weights.to_vec(),
            winner_index,
            winner: SpinHistoryItem {
                id: Some(selected.id.clone()),
                name: selected.name.clone(),
                display_name: selected.display_name.clone(),
                sources: selected.sources.join(" + "),
                odds: effective_weights[winner_index] / total,
            },
            wheel_labels: wheel_labels.to_vec(),
            wheel_background: wheel_background.to_string(),
            transition: transition.to_string(),
        }
    }
}

pub(crate) fn take_spin_result(
    pending: &mut Option<SpinOperation>,
    expected_id: u64,
) -> Option<SpinOperation> {
    if pending
        .as_ref()
        .is_some_and(|operation| operation.id == expected_id)
    {
        pending.take()
    } else {
        None
    }
}

pub(crate) fn build_weighted_pool(
    include_steamcharts: bool,
    include_steamdb: bool,
    include_twitch: bool,
    include_steam_import: bool,
    include_manual: bool,
    include_scanned: bool,
    weighted_mode: bool,
    steamcharts_weight: f64,
    steamdb_weight: f64,
    twitch_weight: f64,
    steam_import_weight: f64,
    manual_weight: f64,
    scanned_weight: f64,
    steamcharts: &[GameItem],
    steamdb: &[GameItem],
    twitch: &[GameItem],
    steam_import: &[GameItem],
    manual: &[ManualGameRecord],
    scanned: &[String],
) -> Vec<WeightedPoolGame> {
    let mut pool = HashMap::<String, WeightedPoolGame>::new();

    let mut insert = |name: &str,
                      source: &str,
                      id: Option<String>,
                      base_weight: f64,
                      rank: Option<usize>,
                      score: Option<u64>| {
        let trimmed = crate::normalize_name(name);
        if trimmed.is_empty() {
            return;
        }
        let source_id = match source {
            "SteamCharts" => "steamcharts",
            "SteamDB" => "steamdb",
            "TwitchMetrics" => "twitchmetrics",
            "Steam Import" => "steamImport",
            "Manual" => "manual",
            "Scanned" => "scan",
            _ => "unknown",
        };
        let key = id.unwrap_or_else(|| format!("source:{source_id}:{}", trimmed.to_lowercase()));
        let score_weight = if weighted_mode {
            compute_weight(base_weight, rank, score)
        } else {
            1.0
        };
        if let Some(existing) = pool.get_mut(&key) {
            existing.weight += score_weight;
            if !existing.sources.iter().any(|entry| entry == source) {
                existing.sources.push(source.to_string());
            }
        } else {
            pool.insert(
                key.clone(),
                WeightedPoolGame {
                    id: key,
                    display_name: trimmed.clone(),
                    name: trimmed,
                    sources: vec![source.to_string()],
                    weight: score_weight,
                },
            );
        }
    };

    if include_steamcharts {
        for game in steamcharts {
            insert(
                &game.name,
                "SteamCharts",
                game.app_id
                    .filter(|id| *id > 0)
                    .map(|id| format!("steam:{id}")),
                steamcharts_weight,
                game.rank,
                game.score,
            );
        }
    }
    if include_steamdb {
        for game in steamdb {
            insert(
                &game.name,
                "SteamDB",
                game.app_id
                    .filter(|id| *id > 0)
                    .map(|id| format!("steam:{id}")),
                steamdb_weight,
                game.rank,
                game.score,
            );
        }
    }
    if include_twitch {
        for game in twitch {
            insert(
                &game.name,
                "TwitchMetrics",
                game.app_id
                    .filter(|id| *id > 0)
                    .map(|id| format!("steam:{id}")),
                twitch_weight,
                game.rank,
                game.score,
            );
        }
    }
    if include_steam_import {
        for game in steam_import {
            insert(
                &game.name,
                "Steam Import",
                game.app_id
                    .filter(|id| *id > 0)
                    .map(|id| format!("steam:{id}")),
                steam_import_weight,
                game.rank,
                game.score,
            );
        }
    }
    if include_manual {
        for game in manual {
            insert(
                &game.name,
                "Manual",
                Some(game.id.clone()),
                manual_weight,
                None,
                None,
            );
        }
    }
    if include_scanned {
        for game in scanned {
            insert(game, "Scanned", None, scanned_weight, None, None);
        }
    }

    let mut output = pool.into_values().collect::<Vec<_>>();
    output.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    let mut title_counts = HashMap::new();
    for game in &output {
        *title_counts
            .entry(game.name.to_lowercase())
            .or_insert(0_usize) += 1;
    }
    let mut title_ordinals = HashMap::new();
    for game in &mut output {
        let key = game.name.to_lowercase();
        if title_counts[&key] > 1 {
            let ordinal = title_ordinals.entry(key).or_insert(0_usize);
            *ordinal += 1;
            game.display_name = format!("{} ({})", game.name, ordinal);
        }
    }
    output
}

pub(crate) fn derive_wheel_data(
    full_pool: &[WeightedPoolGame],
    spin_history: &[SpinHistoryItem],
    cooldown_spins: usize,
    adaptive_recommendations: bool,
) -> DerivedWheelData {
    let blocked_ids = spin_history
        .iter()
        .take(cooldown_spins)
        .filter_map(|entry| entry.id.as_ref().cloned())
        .collect::<HashSet<_>>();
    let blocked_legacy_names = spin_history
        .iter()
        .take(cooldown_spins)
        .filter(|entry| entry.id.is_none())
        .map(|entry| entry.name.to_lowercase())
        .collect::<HashSet<_>>();
    let mut spin_pool = full_pool
        .iter()
        .filter(|entry| {
            !blocked_ids.contains(&entry.id)
                && !blocked_legacy_names.contains(&entry.name.to_lowercase())
        })
        .cloned()
        .collect::<Vec<_>>();
    let cooldown_exhausted = cooldown_spins > 0 && !full_pool.is_empty() && spin_pool.is_empty();
    if cooldown_exhausted {
        spin_pool = full_pool.to_vec();
    }

    let segment_count = spin_pool.len().max(1);
    let segment_angle = 360.0 / segment_count as f64;
    let wheel_background = if spin_pool.is_empty() {
        "#f4f0e6".to_string()
    } else {
        wheel_gradient(spin_pool.len())
    };
    let wheel_labels = spin_pool
        .iter()
        .enumerate()
        .map(|(index, pool_game)| {
            let angle = index as f64 * segment_angle + (segment_angle / 2.0);
            let flip = if angle > 90.0 && angle < 270.0 {
                180.0
            } else {
                0.0
            };
            (angle, flip, pool_game.display_name.clone())
        })
        .collect::<Vec<_>>();

    let behavior_signal_count = spin_history.len().min(20);
    let behavior_multipliers = compute_behavior_multipliers(spin_history);
    let suggested_weights = SuggestedWeights {
        steamcharts: suggested_source_weight(1.2, behavior_multipliers[0]),
        steamdb: suggested_source_weight(1.15, behavior_multipliers[1]),
        twitch: suggested_source_weight(1.0, behavior_multipliers[2]),
        steam_import: suggested_source_weight(1.35, behavior_multipliers[3]),
        manual: suggested_source_weight(0.9, behavior_multipliers[4]),
        scanned: suggested_source_weight(1.0, behavior_multipliers[5]),
    };
    let adaptive_spin_weights = spin_pool
        .iter()
        .map(|entry| {
            let source_multiplier = if adaptive_recommendations {
                average_source_multiplier(&entry.sources, &behavior_multipliers)
            } else {
                1.0
            };
            (entry.weight * source_multiplier).max(0.05)
        })
        .collect::<Vec<_>>();

    DerivedWheelData {
        spin_pool,
        cooldown_exhausted,
        wheel_background,
        wheel_labels,
        behavior_signal_count,
        suggested_weights,
        adaptive_spin_weights,
    }
}

pub(crate) fn pick_weighted_index(weights: &[f64], rng: &mut impl rand::Rng) -> usize {
    if weights.is_empty() {
        return 0;
    }
    let total = weights.iter().map(|value| value.max(0.0)).sum::<f64>();
    if total <= 0.0 {
        return rand::RngExt::random_range(rng, 0..weights.len());
    }
    let mut cursor = rand::RngExt::random_range(rng, 0.0..total);
    for (index, weight) in weights.iter().enumerate() {
        cursor -= weight.max(0.0);
        if cursor <= 0.0 {
            return index;
        }
    }
    weights.len() - 1
}

pub(crate) fn spin_target_rotation(
    count: usize,
    selected_index: usize,
    current_rotation: f64,
    revolutions: f64,
    jitter_ratio: f64,
    jitter_unit: f64,
) -> f64 {
    if count == 0 {
        return current_rotation;
    }
    debug_assert!(selected_index < count);
    let segment = 360.0 / count as f64;
    let winner_center = selected_index as f64 * segment + segment / 2.0;
    let bounded_jitter = jitter_ratio.clamp(0.0, 0.49);
    let jitter = (jitter_unit * 2.0 - 1.0) * segment * bounded_jitter;
    let target_orientation = (-winner_center + jitter).rem_euclid(360.0);
    let forward_offset =
        (target_orientation - current_rotation.rem_euclid(360.0)).rem_euclid(360.0);
    let whole_turns = revolutions.clamp(0.5, 16.0).round().max(1.0);
    current_rotation + 360.0 * whole_turns + forward_offset
}

#[cfg(test)]
mod tests {
    use super::{
        build_weighted_pool, derive_wheel_data, spin_target_rotation, take_spin_result,
        SpinOperation,
    };
    use crate::{
        online_data_from_contract, ManualGameRecord, SpinHistoryItem, TopGamesPayloadContract,
        WeightedPoolGame,
    };

    #[test]
    fn shared_feed_keeps_distinct_same_title_app_ids_through_desktop_pool() {
        let feed: TopGamesPayloadContract = serde_json::from_str(include_str!(
            "../../../tests/fixtures/top-games-identity.json"
        ))
        .expect("synthetic feed must parse");
        let online = online_data_from_contract(feed);
        assert_eq!(
            online.steamdb.len(),
            2,
            "adapter must retain both SteamDB App IDs"
        );
        let pool = build_weighted_pool(
            true,
            true,
            false,
            false,
            false,
            false,
            false,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            &online.steamcharts,
            &online.steamdb,
            &[],
            &[],
            &[],
            &[],
        );
        assert_eq!(
            pool.len(),
            2,
            "matching App ID merges while a different ID stays separate"
        );
        assert_eq!(
            pool.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(),
            vec!["steam:10101", "steam:20202"]
        );
        assert_eq!(pool[0].sources, ["SteamCharts", "SteamDB"]);
        let operation = SpinOperation::new(
            10,
            &pool,
            &[1.0, 1.0],
            0,
            &[],
            "synthetic-gradient",
            "synthetic-transition",
        );
        assert_eq!(operation.winner.id.as_deref(), Some("steam:10101"));
        let next = derive_wheel_data(&pool, &[operation.winner], 1, false);
        assert_eq!(
            next.spin_pool
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            vec!["steam:20202"]
        );
        let legacy = SpinHistoryItem {
            id: None,
            name: "Echo Harbor".into(),
            display_name: "Echo Harbor".into(),
            sources: "SteamDB".into(),
            odds: 0.5,
        };
        let legacy_next = derive_wheel_data(&pool, &[legacy], 1, false);
        assert!(
            legacy_next.cooldown_exhausted,
            "a name-only legacy result still blocks both equal titles"
        );
    }

    #[test]
    fn desktop_manual_ids_keep_equal_titles_distinct_through_cooldown() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/selection-edge-cases.json"
        ))
        .unwrap();
        let manual: Vec<ManualGameRecord> =
            serde_json::from_value(fixture["manualGames"].clone()).unwrap();
        let pool = build_weighted_pool(
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            &[],
            &[],
            &[],
            &[],
            &manual,
            &[],
        );
        assert_eq!(pool.len(), 2);
        assert_eq!(pool[0].id, "manual:synthetic-one");
        assert_eq!(pool[1].id, "manual:synthetic-two");
        assert_eq!(pool[0].display_name, "Echo Harbor (1)");
        assert_eq!(pool[1].display_name, "Echo Harbor (2)");
        let result = SpinOperation::new(1, &pool, &[1.0, 1.0], 0, &[], "", "").winner;
        assert_eq!(result.id.as_deref(), Some("manual:synthetic-one"));
        assert_eq!(result.display_name, "Echo Harbor (1)");
        let next = derive_wheel_data(&pool, &[result], 1, false);
        assert_eq!(next.spin_pool.len(), 1);
        assert_eq!(next.spin_pool[0].id, "manual:synthetic-two");

        let renamed = crate::manual_store::rename_manual_record(
            &manual,
            "manual:synthetic-one",
            "New Harbor",
        )
        .unwrap();
        let renamed_pool = build_weighted_pool(
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            &[],
            &[],
            &[],
            &[],
            &renamed,
            &[],
        );
        let prior_history = SpinHistoryItem {
            id: Some("manual:synthetic-one".into()),
            name: "Echo Harbor".into(),
            display_name: "Echo Harbor (1)".into(),
            sources: "Manual".into(),
            odds: 0.5,
        };
        let after_rename = derive_wheel_data(&renamed_pool, &[prior_history], 1, false);
        assert_eq!(after_rename.spin_pool.len(), 1);
        assert_eq!(after_rename.spin_pool[0].id, "manual:synthetic-two");
    }

    fn index_at_top_pointer(count: usize, rotation: f64) -> usize {
        ((-rotation).rem_euclid(360.0) / (360.0 / count as f64)).floor() as usize
    }

    #[test]
    fn every_motion_profile_and_bounded_jitter_lands_on_selected_sector() {
        for count in [1, 2, 3, 4, 5, 10, 37] {
            for turns in [10.5, 8.0, 6.4, 2.2] {
                for jitter_unit in [0.0, 0.5, 0.999] {
                    let mut rotation = 90.0;
                    for selected_index in 0..count {
                        let next = spin_target_rotation(
                            count,
                            selected_index,
                            rotation,
                            turns,
                            0.28,
                            jitter_unit,
                        );
                        assert_eq!(
                            index_at_top_pointer(count, next),
                            selected_index,
                            "count={count}, turns={turns}, jitter={jitter_unit}, from={rotation}"
                        );
                        rotation = next;
                    }
                }
            }
        }
    }

    #[test]
    fn spin_operation_freezes_pool_and_can_be_consumed_only_once() {
        let mut pool = vec![
            WeightedPoolGame {
                id: "manual:alpha".into(),
                name: "Alpha".into(),
                display_name: "Alpha".into(),
                sources: vec!["Manual".into()],
                weight: 1.0,
            },
            WeightedPoolGame {
                id: "steam:2".into(),
                name: "Beta".into(),
                display_name: "Beta".into(),
                sources: vec!["Steam Import".into()],
                weight: 2.0,
            },
        ];
        let labels = vec![
            (90.0, 0.0, "Alpha".to_string()),
            (270.0, 180.0, "Beta".to_string()),
        ];
        let mut pending = Some(SpinOperation::new(
            7,
            &pool,
            &[1.0, 2.0],
            1,
            &labels,
            "frozen-gradient",
            "transform 760ms ease",
        ));
        pool[1].name = "Changed".into();
        assert_eq!(pending.as_ref().unwrap().eligible[1].name, "Beta");
        assert_eq!(pending.as_ref().unwrap().winner.name, "Beta");
        assert_eq!(
            pending.as_ref().unwrap().winner.id.as_deref(),
            Some("steam:2")
        );
        assert_eq!(pending.as_ref().unwrap().effective_weights, [1.0, 2.0]);
        assert!(take_spin_result(&mut pending, 6).is_none());
        let finished = take_spin_result(&mut pending, 7).unwrap();
        assert_eq!(finished.winner_index, 1);
        assert_eq!(finished.wheel_labels, labels);
        assert_eq!(finished.wheel_background, "frozen-gradient");
        assert_eq!(finished.transition, "transform 760ms ease");
        assert!(take_spin_result(&mut pending, 7).is_none());
    }
}

fn compute_weight(base_weight: f64, rank: Option<usize>, score: Option<u64>) -> f64 {
    let base = base_weight.clamp(0.1, 3.0);
    let rank_boost = rank
        .map(|value| (1.45 - ((value.saturating_sub(1)) as f64 / 40.0)).max(0.7))
        .unwrap_or(1.0);
    let score_boost = score
        .map(|value| (1.0 + ((value as f64 + 10.0).log10() / 4.0)).min(1.9))
        .unwrap_or(1.0);
    (base * rank_boost * score_boost).max(0.1)
}

fn compute_behavior_multipliers(history: &[SpinHistoryItem]) -> [f64; 6] {
    let mut scores = [0.0_f64; 6];
    for (index, entry) in history.iter().take(20).enumerate() {
        let recency = (1.0 - (index as f64 / 24.0)).max(0.22);
        for source in entry.sources.split('+') {
            if let Some(source_index) = source_index_from_label(source) {
                scores[source_index] += 0.55 * recency;
            }
        }
    }

    let max_score = scores.iter().copied().fold(0.0_f64, f64::max);
    if max_score <= 0.0 {
        return [1.0; 6];
    }

    scores.map(|score| {
        let normalized = score / max_score;
        (0.78 + normalized * 0.62).clamp(0.72, 1.45)
    })
}

fn average_source_multiplier(sources: &[String], multipliers: &[f64; 6]) -> f64 {
    let mut total = 0.0;
    let mut count = 0_u32;
    for source in sources {
        if let Some(index) = source_index_from_label(source) {
            total += multipliers[index];
            count += 1;
        }
    }
    if count == 0 {
        1.0
    } else {
        total / count as f64
    }
}

fn suggested_source_weight(base_weight: f64, multiplier: f64) -> f64 {
    ((base_weight * multiplier).clamp(0.1, 3.0) * 10.0).round() / 10.0
}

fn segment_color(index: usize) -> &'static str {
    const COLORS: [&str; 10] = [
        "#f25f5c", "#247ba0", "#70c1b3", "#ffe066", "#ff9f1c", "#2ec4b6", "#e76f51", "#118ab2",
        "#8ac926", "#ef476f",
    ];
    COLORS[index % COLORS.len()]
}

fn wheel_gradient(count: usize) -> String {
    let mut stops = Vec::new();
    for index in 0..count {
        let start = index as f64 * (360.0 / count as f64);
        let end = (index + 1) as f64 * (360.0 / count as f64);
        stops.push(format!(
            "{} {:.4}deg {:.4}deg",
            segment_color(index),
            start,
            end
        ));
    }
    format!("conic-gradient({})", stops.join(", "))
}
