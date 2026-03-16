use std::collections::{HashMap, HashSet};

use crate::{source_index_from_label, GameItem, SpinHistoryItem, WeightedPoolGame};

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
    pub(crate) segment_angle: f64,
    pub(crate) wheel_background: String,
    pub(crate) wheel_labels: Vec<(f64, f64, String)>,
    pub(crate) behavior_signal_count: usize,
    pub(crate) suggested_weights: SuggestedWeights,
    pub(crate) adaptive_spin_weights: Vec<f64>,
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
    manual: &[String],
    scanned: &[String],
) -> Vec<WeightedPoolGame> {
    let mut pool = HashMap::<String, WeightedPoolGame>::new();

    let mut insert =
        |name: &str, source: &str, base_weight: f64, rank: Option<usize>, score: Option<u64>| {
            let trimmed = crate::normalize_name(name);
            if trimmed.is_empty() {
                return;
            }
            let key = trimmed.to_lowercase();
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
                    key,
                    WeightedPoolGame {
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
                steamcharts_weight,
                game.rank,
                game.score,
            );
        }
    }
    if include_steamdb {
        for game in steamdb {
            insert(&game.name, "SteamDB", steamdb_weight, game.rank, game.score);
        }
    }
    if include_twitch {
        for game in twitch {
            insert(
                &game.name,
                "TwitchMetrics",
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
                steam_import_weight,
                game.rank,
                game.score,
            );
        }
    }
    if include_manual {
        for game in manual {
            insert(game, "Manual", manual_weight, None, None);
        }
    }
    if include_scanned {
        for game in scanned {
            insert(game, "Scanned", scanned_weight, None, None);
        }
    }

    let mut output = pool.into_values().collect::<Vec<_>>();
    output.sort_by(|left, right| left.name.cmp(&right.name));
    output
}

pub(crate) fn derive_wheel_data(
    full_pool: &[WeightedPoolGame],
    spin_history: &[SpinHistoryItem],
    cooldown_spins: usize,
    adaptive_recommendations: bool,
) -> DerivedWheelData {
    let blocked = spin_history
        .iter()
        .take(cooldown_spins)
        .map(|entry| entry.name.to_lowercase())
        .collect::<HashSet<_>>();
    let mut spin_pool = full_pool
        .iter()
        .filter(|entry| !blocked.contains(&entry.name.to_lowercase()))
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
            (angle, flip, pool_game.name.clone())
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
        segment_angle,
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
        "#f25f5c",
        "#247ba0",
        "#70c1b3",
        "#ffe066",
        "#ff9f1c",
        "#2ec4b6",
        "#e76f51",
        "#118ab2",
        "#8ac926",
        "#ef476f",
    ];
    COLORS[index % COLORS.len()]
}

fn wheel_gradient(count: usize) -> String {
    let mut stops = Vec::new();
    for index in 0..count {
        let start = index as f64 * (360.0 / count as f64);
        let end = (index + 1) as f64 * (360.0 / count as f64);
        stops.push(format!("{} {:.4}deg {:.4}deg", segment_color(index), start, end));
    }
    format!("conic-gradient({})", stops.join(", "))
}
