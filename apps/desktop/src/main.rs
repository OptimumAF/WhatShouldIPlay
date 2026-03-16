#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use anyhow::{anyhow, Context, Result};
use dioxus::prelude::*;
use rand::{Rng, RngExt};
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use tokio::time::{sleep, Duration};

mod contracts;
mod ui;
use contracts::TopGamesPayloadContract;
use ui::settings::render_settings_sidebar;
use ui::{render_spin_history_panel, render_wheel_panel, render_winner_overlay};

const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const TOP_N: usize = 30;
const SHARED_TOP_GAMES_URL: &str = "https://optimumaf.github.io/WhatShouldIPlay/data/top-games.json";

#[derive(Clone, Debug, Default)]
struct OnlineData {
    steamcharts: Vec<GameItem>,
    steamdb: Vec<GameItem>,
    twitchmetrics: Vec<GameItem>,
    steamdb_note: String,
}

#[derive(Clone, Debug, Default)]
struct GameItem {
    name: String,
    rank: Option<usize>,
    score: Option<u64>,
}

#[derive(Clone, Debug, Default)]
struct WeightedPoolGame {
    name: String,
    sources: Vec<String>,
    weight: f64,
}

#[derive(Clone, Debug, Default)]
struct SpinHistoryItem {
    name: String,
    sources: String,
    odds: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UiLang {
    En,
    Es,
}

fn tr(lang: UiLang, en: &'static str, es: &'static str) -> &'static str {
    match lang {
        UiLang::En => en,
        UiLang::Es => es,
    }
}

fn on_off_label(lang: UiLang, enabled: bool) -> &'static str {
    if enabled {
        tr(lang, "ON", "ACT")
    } else {
        tr(lang, "OFF", "DES")
    }
}

fn parse_ui_lang(value: &str) -> UiLang {
    if value.eq_ignore_ascii_case("es") {
        UiLang::Es
    } else {
        UiLang::En
    }
}

fn main() {
    dioxus::launch(App);
}

fn host_platform_class() -> &'static str {
    if cfg!(target_os = "windows") {
        "os-windows"
    } else if cfg!(target_os = "macos") {
        "os-macos"
    } else if cfg!(target_os = "linux") {
        "os-linux"
    } else {
        "os-generic"
    }
}

fn host_platform_label() -> &'static str {
    if cfg!(target_os = "windows") {
        "Windows"
    } else if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_os = "linux") {
        "Linux"
    } else {
        "Desktop"
    }
}

async fn refresh_scanned_games(
    mut scanned_games: Signal<Vec<String>>,
    mut status: Signal<String>,
    ui_lang: Signal<UiLang>,
) {
    let current_lang = ui_lang();
    status.set(
        tr(
            current_lang,
            "Scanning local game libraries...",
            "Escaneando bibliotecas locales de juegos...",
        )
        .to_string(),
    );

    let games = scan_installed_games();
    let scan_count = games.len();
    scanned_games.set(games);

    let current_lang = ui_lang();
    status.set(format!(
        "{} {}",
        tr(
            current_lang,
            "Local game libraries scanned:",
            "Bibliotecas locales escaneadas:",
        ),
        scan_count
    ));
}

#[component]
fn App() -> Element {
    let mut ui_lang = use_signal(|| UiLang::En);
    let steamcharts_games = use_signal(Vec::<GameItem>::new);
    let steamdb_games = use_signal(Vec::<GameItem>::new);
    let twitch_games = use_signal(Vec::<GameItem>::new);
    let steam_import_games = use_signal(Vec::<GameItem>::new);
    let scanned_games = use_signal(Vec::<String>::new);
    let manual_games = use_signal(Vec::<String>::new);
    let manual_text = use_signal(String::new);
    let steam_api_key = use_signal(String::new);
    let steam_id = use_signal(String::new);
    let steam_import_status = use_signal(String::new);
    let status = use_signal(|| tr(UiLang::En, "Idle", "En espera").to_string());
    let steamdb_note = use_signal(String::new);

    let include_steamcharts = use_signal(|| true);
    let include_steamdb = use_signal(|| true);
    let include_twitch = use_signal(|| true);
    let include_steam_import = use_signal(|| true);
    let include_manual = use_signal(|| true);
    let include_scanned = use_signal(|| true);
    let weighted_mode = use_signal(|| true);
    let adaptive_recommendations = use_signal(|| false);
    let cooldown_spins = use_signal(|| 2_usize);
    let steamcharts_weight = use_signal(|| 1.2_f64);
    let steamdb_weight = use_signal(|| 1.15_f64);
    let twitch_weight = use_signal(|| 1.0_f64);
    let steam_import_weight = use_signal(|| 1.35_f64);
    let manual_weight = use_signal(|| 0.9_f64);
    let scanned_weight = use_signal(|| 1.0_f64);
    let spin_speed_profile = use_signal(|| "balanced".to_string());
    let reduced_spin_animation = use_signal(|| false);

    let spinning = use_signal(|| false);
    let wheel_rotation = use_signal(|| 0.0_f64);
    let winner = use_signal(String::new);
    let winner_sources = use_signal(String::new);
    let winner_odds = use_signal(|| 0.0_f64);
    let pending_winner = use_signal(String::new);
    let pending_winner_sources = use_signal(String::new);
    let pending_winner_odds = use_signal(|| 0.0_f64);
    let spin_history = use_signal(Vec::<SpinHistoryItem>::new);
    let show_winner_popup = use_signal(|| false);
    let mut show_sidebar = use_signal(|| false);
    let active_settings_section = use_signal(|| "sources".to_string());

    use_future({
        let scanned_games = scanned_games;
        let status = status;
        let ui_lang = ui_lang;
        move || refresh_scanned_games(scanned_games, status, ui_lang)
    });

    let full_pool = build_weighted_pool(
        include_steamcharts(),
        include_steamdb(),
        include_twitch(),
        include_steam_import(),
        include_manual(),
        include_scanned(),
        weighted_mode(),
        steamcharts_weight(),
        steamdb_weight(),
        twitch_weight(),
        steam_import_weight(),
        manual_weight(),
        scanned_weight(),
        &steamcharts_games(),
        &steamdb_games(),
        &twitch_games(),
        &steam_import_games(),
        &manual_games(),
        &scanned_games(),
    );

    let blocked = spin_history()
        .iter()
        .take(cooldown_spins())
        .map(|entry| entry.name.to_lowercase())
        .collect::<HashSet<_>>();
    let mut spin_pool = full_pool
        .iter()
        .filter(|entry| !blocked.contains(&entry.name.to_lowercase()))
        .cloned()
        .collect::<Vec<_>>();
    let cooldown_exhausted = cooldown_spins() > 0 && !full_pool.is_empty() && spin_pool.is_empty();
    if cooldown_exhausted {
        spin_pool = full_pool.clone();
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
    let steamcharts_weight_label = format!("{:.1}x", steamcharts_weight());
    let steamdb_weight_label = format!("{:.1}x", steamdb_weight());
    let twitch_weight_label = format!("{:.1}x", twitch_weight());
    let steam_import_weight_label = format!("{:.1}x", steam_import_weight());
    let manual_weight_label = format!("{:.1}x", manual_weight());
    let scanned_weight_label = format!("{:.1}x", scanned_weight());
    let behavior_signal_count = spin_history().len().min(20);
    let behavior_multipliers = compute_behavior_multipliers(&spin_history());
    let suggested_steamcharts_weight = suggested_source_weight(1.2, behavior_multipliers[0]);
    let suggested_steamdb_weight = suggested_source_weight(1.15, behavior_multipliers[1]);
    let suggested_twitch_weight = suggested_source_weight(1.0, behavior_multipliers[2]);
    let suggested_steam_import_weight = suggested_source_weight(1.35, behavior_multipliers[3]);
    let suggested_manual_weight = suggested_source_weight(0.9, behavior_multipliers[4]);
    let suggested_scanned_weight = suggested_source_weight(1.0, behavior_multipliers[5]);
    let suggested_steamcharts_weight_label = format!("{:.1}x", suggested_steamcharts_weight);
    let suggested_steamdb_weight_label = format!("{:.1}x", suggested_steamdb_weight);
    let suggested_twitch_weight_label = format!("{:.1}x", suggested_twitch_weight);
    let suggested_steam_import_weight_label = format!("{:.1}x", suggested_steam_import_weight);
    let suggested_manual_weight_label = format!("{:.1}x", suggested_manual_weight);
    let suggested_scanned_weight_label = format!("{:.1}x", suggested_scanned_weight);
    let adaptive_spin_weights = spin_pool
        .iter()
        .map(|entry| {
            let source_multiplier = if adaptive_recommendations() {
                average_source_multiplier(&entry.sources, &behavior_multipliers)
            } else {
                1.0
            };
            (entry.weight * source_multiplier).max(0.05)
        })
        .collect::<Vec<_>>();
    let lang = ui_lang();
    let (profile_label, profile_duration_ms, profile_revolutions, profile_jitter_ratio) =
        match spin_speed_profile().as_str() {
            "cinematic" => (tr(lang, "Cinematic", "Cinematico"), 6200.0, 10.5, 0.28),
            "rapid" => (tr(lang, "Rapid", "Rapido"), 3200.0, 6.4, 0.20),
            _ => (tr(lang, "Balanced", "Equilibrado"), 4800.0, 8.0, 0.24),
        };
    let (spin_duration_ms, spin_revolutions, spin_jitter_ratio) = if reduced_spin_animation() {
        (760.0, 2.2, 0.10)
    } else {
        (profile_duration_ms, profile_revolutions, profile_jitter_ratio)
    };
    let spin_transition = format!(
        "transform {:.0}ms cubic-bezier(.17,.67,.11,.99)",
        spin_duration_ms
    );
    let platform_class = host_platform_class();
    let platform_label = host_platform_label();
    let spin_duration_label = format!("{:.1}s", spin_duration_ms / 1000.0);
    let spin_button_label = if spinning() {
        tr(lang, "Spinning...", "Girando...")
    } else {
        tr(lang, "Spin Wheel", "Girar ruleta")
    };
    let weighted_mode_label = on_off_label(lang, weighted_mode());
    let adaptive_recommendations_label = on_off_label(lang, adaptive_recommendations());
    let reduced_spin_animation_label = on_off_label(lang, reduced_spin_animation());
    let behavior_signal_status_label = if behavior_signal_count < 3 {
        tr(lang, "Need 3+", "Necesita 3+")
    } else {
        tr(lang, "Ready", "Listo")
    };
    let you_should_play_label = tr(lang, "You should play:", "Deberias jugar:");
    let sidebar_toggle_label = if show_sidebar() {
        tr(lang, "Hide Settings", "Ocultar ajustes")
    } else {
        tr(lang, "Show Settings", "Mostrar ajustes")
    };

    rsx! {
        style { "{DESKTOP_CSS}" }
        main { class: format!("layout {}", platform_class),
            section { class: "hero hero-masthead",
                div { class: "hero-topline",
                    p { class: "kicker", "{tr(lang, \"PickAGame Desktop\", \"PickAGame Desktop\")}" }
                    p { class: "hero-meta", "{tr(lang, \"Platform style\", \"Estilo de plataforma\")}: {platform_label}" }
                }
                div { class: "hero-main",
                    div { class: "hero-copy",
                        h1 { "{tr(lang, \"Spin For Your Next Game\", \"Gira para tu proximo juego\")}" }
                        p { "{tr(lang, \"Mode presets, weighted odds, cooldown history, Steam account import, and local scan in one desktop spinner.\", \"Modos predefinidos, probabilidades ponderadas, historial de enfriamiento, importacion de Steam y escaneo local en una sola ruleta desktop.\")}" }
                        p { class: "status", "{tr(lang, \"Status\", \"Estado\")}: {status}" }
                    }
                    div { class: "hero-utility",
                        select {
                            value: if matches!(lang, UiLang::Es) { "es" } else { "en" },
                            oninput: move |evt| ui_lang.set(parse_ui_lang(&evt.value())),
                            option { value: "en", "{tr(lang, \"English\", \"Ingles\")}" }
                            option { value: "es", "{tr(lang, \"Spanish\", \"Espanol\")}" }
                        }
                        div { class: "hero-actions-primary",
                            button {
                                class: "ghost",
                                onclick: move |_| show_sidebar.set(!show_sidebar()),
                                "{sidebar_toggle_label}"
                            }
                        }
                    }
                }
            }

            div { class: if show_sidebar() { "workspace" } else { "workspace sidebar-collapsed" },
                if show_sidebar() {
                    {render_settings_sidebar(
                        lang,
                        active_settings_section,
                        include_steamcharts,
                        include_steamdb,
                        include_twitch,
                        include_steam_import,
                        include_manual,
                        include_scanned,
                        weighted_mode,
                        adaptive_recommendations,
                        reduced_spin_animation,
                        cooldown_spins,
                        spin_speed_profile,
                        steamcharts_weight,
                        steamdb_weight,
                        twitch_weight,
                        steam_import_weight,
                        manual_weight,
                        scanned_weight,
                        steamcharts_games,
                        steamdb_games,
                        twitch_games,
                        steam_import_games,
                        scanned_games,
                        manual_games,
                        manual_text,
                        steam_api_key,
                        steam_id,
                        steam_import_status,
                        status,
                        steamdb_note,
                        ui_lang,
                        weighted_mode_label,
                        adaptive_recommendations_label,
                        reduced_spin_animation_label,
                        profile_label,
                        behavior_signal_count,
                        behavior_signal_status_label,
                        spin_duration_label.clone(),
                        steamcharts_weight_label.clone(),
                        steamdb_weight_label.clone(),
                        twitch_weight_label.clone(),
                        steam_import_weight_label.clone(),
                        manual_weight_label.clone(),
                        scanned_weight_label.clone(),
                        suggested_steamcharts_weight,
                        suggested_steamdb_weight,
                        suggested_twitch_weight,
                        suggested_steam_import_weight,
                        suggested_manual_weight,
                        suggested_scanned_weight,
                        suggested_steamcharts_weight_label.clone(),
                        suggested_steamdb_weight_label.clone(),
                        suggested_twitch_weight_label.clone(),
                        suggested_steam_import_weight_label.clone(),
                        suggested_manual_weight_label.clone(),
                        suggested_scanned_weight_label.clone(),
                    )}
                }

                div { class: "content-stack",
                    {render_wheel_panel(
                        lang,
                        spin_pool.clone(),
                        cooldown_exhausted,
                        wheel_labels.clone(),
                        wheel_rotation,
                        spinning,
                        &spin_transition,
                        &wheel_background,
                        weighted_mode,
                        adaptive_recommendations,
                        adaptive_spin_weights.clone(),
                        segment_angle,
                        spin_jitter_ratio,
                        spin_revolutions,
                        pending_winner,
                        pending_winner_sources,
                        pending_winner_odds,
                        winner,
                        winner_sources,
                        winner_odds,
                        spin_history,
                        show_winner_popup,
                        spin_button_label,
                        you_should_play_label,
                    )}

                    {render_spin_history_panel(lang, &spin_history())}
                }
            }
        }
        {render_winner_overlay(lang, show_winner_popup, &winner(), &winner_sources(), winner_odds())}
    }
}

fn build_weighted_pool(
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

    let mut insert = |name: &str, source: &str, base_weight: f64, rank: Option<usize>, score: Option<u64>| {
        let trimmed = normalize_name(name);
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

fn pick_weighted_index(weights: &[f64], rng: &mut impl Rng) -> usize {
    if weights.is_empty() {
        return 0;
    }
    let total = weights.iter().map(|value| value.max(0.0)).sum::<f64>();
    if total <= 0.0 {
        return rng.random_range(0..weights.len());
    }
    let mut cursor = rng.random_range(0.0..total);
    for (index, weight) in weights.iter().enumerate() {
        cursor -= weight.max(0.0);
        if cursor <= 0.0 {
            return index;
        }
    }
    weights.len() - 1
}

fn format_odds(odds: f64) -> String {
    if odds < 0.01 {
        format!("{:.2}%", odds * 100.0)
    } else {
        format!("{:.1}%", odds * 100.0)
    }
}

fn source_index_from_label(label: &str) -> Option<usize> {
    match label.trim() {
        "SteamCharts" => Some(0),
        "SteamDB" => Some(1),
        "TwitchMetrics" => Some(2),
        "Steam Import" => Some(3),
        "Manual" => Some(4),
        "Scanned" => Some(5),
        _ => None,
    }
}

fn source_label_for_lang(lang: UiLang, label: &str) -> &'static str {
    match label.trim() {
        "SteamCharts" => tr(lang, "SteamCharts", "SteamCharts"),
        "SteamDB" => tr(lang, "SteamDB", "SteamDB"),
        "TwitchMetrics" => tr(lang, "TwitchMetrics", "TwitchMetrics"),
        "Steam Import" => tr(lang, "Steam Import", "Importacion Steam"),
        "Manual" => tr(lang, "Manual", "Manual"),
        "Scanned" => tr(lang, "Scanned", "Escaneado"),
        _ => tr(lang, "Unknown source", "Fuente desconocida"),
    }
}

fn localize_source_chain(lang: UiLang, sources: &str) -> String {
    let localized = sources
        .split('+')
        .map(|part| source_label_for_lang(lang, part))
        .collect::<Vec<_>>();
    localized.join(" + ")
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

fn merge_lines(existing: &[String], input: &str) -> Vec<String> {
    let mut merged = existing.to_vec();
    for line in input.split(['\n', ',']) {
        let trimmed = normalize_name(line);
        if trimmed.is_empty() {
            continue;
        }
        merged.push(trimmed);
    }
    dedupe_and_sort(merged)
}

fn map_contract_games(items: Vec<contracts::GameContract>) -> Vec<GameItem> {
    let mut mapped = Vec::new();
    for (index, entry) in items.into_iter().enumerate() {
        let name = normalize_name(&entry.name);
        if name.is_empty() {
            continue;
        }
        mapped.push(GameItem {
            name,
            rank: entry.rank.or(Some(index + 1)),
            score: entry.score,
        });
    }
    dedupe_game_items(mapped)
}

fn online_data_from_contract(payload: TopGamesPayloadContract) -> OnlineData {
    let steamdb_note = payload
        .sources
        .steamdb
        .note
        .unwrap_or_else(|| "Shared top-games contract feed.".to_string());

    OnlineData {
        steamcharts: map_contract_games(payload.sources.steamcharts.games),
        steamdb: map_contract_games(payload.sources.steamdb.games),
        twitchmetrics: map_contract_games(payload.sources.twitchmetrics.games),
        steamdb_note,
    }
}

async fn fetch_shared_top_games(client: &Client) -> Result<TopGamesPayloadContract> {
    let url = std::env::var("WHATSHOULDIPLAY_TOP_GAMES_URL")
        .unwrap_or_else(|_| SHARED_TOP_GAMES_URL.to_string());
    client
        .get(url)
        .send()
        .await
        .context("shared top-games request failed")?
        .error_for_status()
        .context("shared top-games status was not successful")?
        .json::<TopGamesPayloadContract>()
        .await
        .context("shared top-games JSON parse failed")
}

async fn fetch_online_sources() -> Result<OnlineData> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .context("failed to build HTTP client")?;

    if let Ok(shared_payload) = fetch_shared_top_games(&client).await {
        return Ok(online_data_from_contract(shared_payload));
    }

    let steamcharts_html = client
        .get("https://steamcharts.com/top")
        .send()
        .await
        .context("steamcharts request failed")?
        .error_for_status()
        .context("steamcharts status was not successful")?
        .text()
        .await
        .context("steamcharts body read failed")?;

    let steamcharts = parse_steamcharts(&steamcharts_html)?;

    let twitch_html = client
        .get("https://www.twitchmetrics.net/games/popularity")
        .send()
        .await
        .context("twitchmetrics request failed")?
        .error_for_status()
        .context("twitchmetrics status was not successful")?
        .text()
        .await
        .context("twitchmetrics body read failed")?;

    let twitchmetrics = parse_twitchmetrics(&twitch_html)?;

    let (steamdb, steamdb_note) = match fetch_steamdb_or_fallback(&client).await {
        Ok(data) => data,
        Err(err) => {
            let fallback = fetch_steam_api_top(&client)
                .await
                .context("steamdb and steam api fallback both failed")?;
            (
                fallback,
                format!("SteamDB blocked request; using Steam API fallback ({err})"),
            )
        }
    };

    Ok(OnlineData {
        steamcharts,
        steamdb,
        twitchmetrics,
        steamdb_note,
    })
}

async fn fetch_steamdb_or_fallback(client: &Client) -> Result<(Vec<GameItem>, String)> {
    let html = client
        .get("https://steamdb.info/charts/")
        .send()
        .await
        .context("steamdb request failed")?
        .error_for_status()
        .context("steamdb status failed")?
        .text()
        .await
        .context("steamdb body read failed")?;

    if html.contains("Enable JavaScript and cookies to continue")
        || html.contains("cf_chl_opt")
        || html.contains("Just a moment")
    {
        return Err(anyhow!("steamdb returned Cloudflare challenge"));
    }

    let parsed = parse_steamdb_html(&html)?;
    Ok((parsed, "Direct SteamDB scrape.".to_string()))
}

fn parse_steamcharts(html: &str) -> Result<Vec<GameItem>> {
    let document = Html::parse_document(html);
    let row_selector = Selector::parse("#top-games tbody tr").unwrap();
    let name_selector = Selector::parse("td.game-name a").unwrap();
    let rank_selector = Selector::parse("td").unwrap();
    let num_selector = Selector::parse("td.num").unwrap();

    let mut items = Vec::new();
    for (index, row) in document.select(&row_selector).enumerate() {
        if items.len() >= TOP_N {
            break;
        }

        let name = row
            .select(&name_selector)
            .next()
            .map(|n| n.text().collect::<String>())
            .map(|n| normalize_name(&n))
            .unwrap_or_default();
        if name.is_empty() {
            continue;
        }

        let rank = row
            .select(&rank_selector)
            .next()
            .map(|n| n.text().collect::<String>())
            .map(|txt| txt.replace('.', ""))
            .and_then(|txt| txt.trim().parse::<usize>().ok())
            .or(Some(index + 1));

        let score = row
            .select(&num_selector)
            .next()
            .map(|n| n.text().collect::<String>())
            .map(|txt| txt.replace(',', ""))
            .and_then(|txt| txt.trim().parse::<u64>().ok());

        items.push(GameItem { name, rank, score });
    }

    Ok(dedupe_game_items(items))
}

fn parse_twitchmetrics(html: &str) -> Result<Vec<GameItem>> {
    let ignored = HashSet::<&'static str>::from([
        "Just Chatting",
        "Music",
        "Special Events",
        "IRL",
        "Pools, Hot Tubs, and Beaches",
        "ASMR",
        "Talk Shows & Podcasts",
        "Science & Technology",
        "Art",
        "Sports",
        "Makers & Crafting",
    ]);

    let document = Html::parse_document(html);
    let item_selector = Selector::parse("li.list-group-item").unwrap();
    let title_selector = Selector::parse("h5").unwrap();
    let score_selector = Selector::parse("samp").unwrap();

    let mut items = Vec::new();
    for item in document.select(&item_selector) {
        if items.len() >= TOP_N {
            break;
        }
        let name = item
            .select(&title_selector)
            .next()
            .map(|n| n.text().collect::<String>())
            .map(|n| normalize_name(&n))
            .unwrap_or_default();
        if name.is_empty() || ignored.contains(name.as_str()) {
            continue;
        }
        let score = item
            .select(&score_selector)
            .next()
            .map(|n| n.text().collect::<String>())
            .map(|txt| txt.replace(',', ""))
            .and_then(|txt| txt.trim().parse::<u64>().ok());
        let rank = Some(items.len() + 1);

        items.push(GameItem { name, rank, score });
    }

    Ok(dedupe_game_items(items))
}

fn parse_steamdb_html(html: &str) -> Result<Vec<GameItem>> {
    let document = Html::parse_document(html);
    let selectors = [
        "table.table-products tbody tr",
        "#table-apps tbody tr",
        "table tbody tr",
    ];
    let link_selector = Selector::parse("a[href*='/app/']").unwrap();
    let td_selector = Selector::parse("td").unwrap();

    let mut results = Vec::new();

    for selector in selectors {
        let row_selector = Selector::parse(selector).unwrap();
        for row in document.select(&row_selector) {
            if results.len() >= TOP_N {
                break;
            }
            let name = row
                .select(&link_selector)
                .next()
                .map(|n| n.text().collect::<String>())
                .map(|n| normalize_name(&n))
                .unwrap_or_default();
            if name.is_empty() {
                continue;
            }

            let score = row
                .select(&td_selector)
                .nth(3)
                .map(|n| n.text().collect::<String>())
                .map(|txt| txt.replace(',', ""))
                .and_then(|txt| txt.trim().parse::<u64>().ok());

            let rank = Some(results.len() + 1);
            results.push(GameItem { name, rank, score });
        }
        if !results.is_empty() {
            break;
        }
    }

    if results.is_empty() {
        return Err(anyhow!("steamdb parser found no rows"));
    }

    Ok(dedupe_game_items(results))
}

#[derive(Debug, Deserialize)]
struct SteamMostPlayedResponse {
    response: SteamMostPlayedInner,
}

#[derive(Debug, Deserialize)]
struct SteamMostPlayedInner {
    ranks: Vec<SteamRank>,
}

#[derive(Debug, Deserialize)]
struct SteamRank {
    rank: usize,
    appid: u32,
    peak_in_game: Option<u64>,
}

async fn fetch_steam_api_top(client: &Client) -> Result<Vec<GameItem>> {
    let data = client
        .get("https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/")
        .send()
        .await
        .context("steam api request failed")?
        .error_for_status()
        .context("steam api returned non-success status")?
        .json::<SteamMostPlayedResponse>()
        .await
        .context("steam api json parse failed")?;

    let top = data.response.ranks.into_iter().take(TOP_N).collect::<Vec<_>>();
    let mut items = Vec::new();

    for entry in top {
        let name = fetch_steam_app_name(client, entry.appid)
            .await
            .unwrap_or_else(|_| format!("App {}", entry.appid));
        items.push(GameItem {
            name,
            rank: Some(entry.rank),
            score: entry.peak_in_game,
        });
        sleep(Duration::from_millis(60)).await;
    }

    Ok(dedupe_game_items(items))
}

async fn fetch_steam_app_name(client: &Client, app_id: u32) -> Result<String> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={app_id}&filters=basic"
    );
    let json = client
        .get(url)
        .send()
        .await
        .context("appdetails request failed")?
        .error_for_status()
        .context("appdetails status failed")?
        .json::<Value>()
        .await
        .context("appdetails json parse failed")?;

    let key = app_id.to_string();
    let name = json
        .get(&key)
        .and_then(|item| item.get("success"))
        .and_then(|v| v.as_bool())
        .filter(|ok| *ok)
        .and_then(|_| json.get(&key))
        .and_then(|item| item.get("data"))
        .and_then(|data| data.get("name"))
        .and_then(|name| name.as_str())
        .map(normalize_name)
        .ok_or_else(|| anyhow!("appdetails had no name for app {}", app_id))?;

    Ok(name)
}

#[derive(Debug, Deserialize)]
struct SteamOwnedGamesResponse {
    response: SteamOwnedGamesInner,
}

#[derive(Debug, Deserialize, Default)]
struct SteamOwnedGamesInner {
    games: Option<Vec<SteamOwnedGame>>,
}

#[derive(Debug, Deserialize)]
struct SteamOwnedGame {
    appid: u32,
    name: String,
    playtime_forever: Option<u64>,
}

async fn fetch_steam_owned_games(api_key: &str, steam_id: &str) -> Result<Vec<GameItem>> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .context("failed to build steam import client")?;

    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key={api_key}&steamid={steam_id}&include_appinfo=1&include_played_free_games=1&format=json"
    );

    let response = client
        .get(url)
        .send()
        .await
        .context("steam owned-games request failed")?
        .error_for_status()
        .context("steam owned-games status was not successful")?
        .json::<SteamOwnedGamesResponse>()
        .await
        .context("steam owned-games parse failed")?;

    let mut items = Vec::new();
    for (index, game) in response.response.games.unwrap_or_default().into_iter().enumerate() {
        let name = normalize_name(&game.name);
        if name.is_empty() {
            continue;
        }
        items.push(GameItem {
            name,
            rank: Some(index + 1),
            score: game.playtime_forever,
        });
        let _ = game.appid;
    }

    Ok(dedupe_game_items(items))
}

fn normalize_name(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn dedupe_game_items(items: Vec<GameItem>) -> Vec<GameItem> {
    let mut seen = HashSet::<String>::new();
    let mut out = Vec::new();
    for item in items {
        let key = item.name.to_lowercase();
        if item.name.is_empty() || seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        out.push(item);
    }
    out
}

fn dedupe_and_sort(items: Vec<String>) -> Vec<String> {
    let mut set = BTreeSet::new();
    for item in items {
        let trimmed = normalize_name(&item);
        if !trimmed.is_empty() {
            set.insert(trimmed);
        }
    }
    set.into_iter().collect()
}

fn scan_installed_games() -> Vec<String> {
    let mut games = Vec::new();
    games.extend(scan_steam_manifests());
    games.extend(scan_epic_launcher_manifests());
    games.extend(scan_gog_install_dirs());
    games.extend(scan_ubisoft_install_dirs());
    games.extend(scan_xbox_install_dirs());
    games.extend(scan_common_install_dirs());
    #[cfg(feature = "deep-shortcut-scan")]
    games.extend(scan_shortcuts());
    dedupe_and_sort(games)
}

fn scan_steam_manifests() -> Vec<String> {
    let mut discovered = Vec::new();
    let mut steam_roots = steam_root_candidates();
    steam_roots.retain(|path| path.exists());

    let path_regex = Regex::new(r#""path"\s+"([^"]+)""#).unwrap();
    let name_regex = Regex::new(r#""name"\s+"([^"]+)""#).unwrap();
    let mut steamapps_dirs = Vec::<PathBuf>::new();

    for root in steam_roots {
        steamapps_dirs.push(root.join("steamapps"));
        let libfile = root.join("steamapps").join("libraryfolders.vdf");
        if !libfile.exists() {
            continue;
        }
        let text = match fs::read_to_string(&libfile) {
            Ok(content) => content,
            Err(_) => continue,
        };
        for cap in path_regex.captures_iter(&text) {
            let mut p = cap[1].replace("\\\\", "\\");
            if p.starts_with("\\\\?\\") {
                p = p.replacen("\\\\?\\", "", 1);
            }
            steamapps_dirs.push(PathBuf::from(p).join("steamapps"));
        }
    }

    for steamapps in steamapps_dirs {
        if !steamapps.exists() {
            continue;
        }
        let entries = match fs::read_dir(&steamapps) {
            Ok(read_dir) => read_dir,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
                continue;
            }
            let text = match fs::read_to_string(&path) {
                Ok(content) => content,
                Err(_) => continue,
            };
            if let Some(cap) = name_regex.captures(&text) {
                discovered.push(cap[1].to_string());
            }
        }
    }

    discovered
}

fn steam_root_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::<PathBuf>::new();
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        candidates.push(PathBuf::from(program_files_x86).join("Steam"));
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join("Steam"));
    }
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("AppData").join("Local").join("Steam"));
    }
    candidates
}

fn scan_epic_launcher_manifests() -> Vec<String> {
    let mut manifest_roots = Vec::<PathBuf>::new();
    if let Ok(program_data) = std::env::var("ProgramData") {
        manifest_roots.push(
            PathBuf::from(program_data)
                .join("Epic")
                .join("EpicGamesLauncher")
                .join("Data")
                .join("Manifests"),
        );
    }
    if let Ok(all_users_profile) = std::env::var("ALLUSERSPROFILE") {
        manifest_roots.push(
            PathBuf::from(all_users_profile)
                .join("Epic")
                .join("EpicGamesLauncher")
                .join("Data")
                .join("Manifests"),
        );
    }

    let mut discovered = Vec::new();
    for root in manifest_roots {
        if !root.exists() {
            continue;
        }
        let entries = match fs::read_dir(&root) {
            Ok(read_dir) => read_dir,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase())
                .unwrap_or_default();
            if ext != "item" && ext != "manifest" {
                continue;
            }
            let content = match fs::read_to_string(&path) {
                Ok(value) => value,
                Err(_) => continue,
            };
            let json = match serde_json::from_str::<Value>(&content) {
                Ok(value) => value,
                Err(_) => continue,
            };
            let name = json
                .get("DisplayName")
                .and_then(|value| value.as_str())
                .or_else(|| json.get("AppName").and_then(|value| value.as_str()))
                .or_else(|| json.get("CatalogItemId").and_then(|value| value.as_str()));
            if let Some(name) = name {
                let cleaned = normalize_name(name);
                if !cleaned.is_empty() {
                    discovered.push(cleaned);
                }
            }
        }
    }

    discovered
}

fn scan_gog_install_dirs() -> Vec<String> {
    let mut roots = Vec::<PathBuf>::new();
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(&program_files).join("GOG Galaxy").join("Games"));
        roots.push(PathBuf::from(&program_files).join("GOG Games"));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(&program_files_x86).join("GOG Galaxy").join("Games"));
        roots.push(PathBuf::from(&program_files_x86).join("GOG Games"));
    }

    scan_child_directories(roots)
}

fn scan_ubisoft_install_dirs() -> Vec<String> {
    let mut roots = Vec::<PathBuf>::new();
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        roots.push(
            PathBuf::from(&program_files_x86)
                .join("Ubisoft")
                .join("Ubisoft Game Launcher")
                .join("games"),
        );
        roots.push(PathBuf::from(&program_files_x86).join("Ubisoft").join("games"));
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        roots.push(
            PathBuf::from(&program_files)
                .join("Ubisoft")
                .join("Ubisoft Game Launcher")
                .join("games"),
        );
        roots.push(PathBuf::from(&program_files).join("Ubisoft").join("games"));
    }

    scan_child_directories(roots)
}

fn scan_xbox_install_dirs() -> Vec<String> {
    let mut roots = Vec::<PathBuf>::new();
    roots.push(PathBuf::from("C:\\XboxGames"));
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(program_files).join("ModifiableWindowsApps"));
    }
    if let Some(home) = dirs::home_dir() {
        roots.push(
            home.join("AppData")
                .join("Local")
                .join("Packages")
                .join("Microsoft.GamingApp_8wekyb3d8bbwe")
                .join("LocalCache")
                .join("Local")
                .join("Microsoft")
                .join("WritablePackageRoot"),
        );
    }

    scan_child_directories(roots)
}

fn scan_common_install_dirs() -> Vec<String> {
    let mut roots = Vec::<PathBuf>::new();
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(&program_files).join("Epic Games"));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(&program_files_x86).join("Epic Games"));
    }
    roots.push(PathBuf::from("C:\\Games"));

    scan_child_directories(roots)
}

fn scan_child_directories(roots: Vec<PathBuf>) -> Vec<String> {
    let mut names = Vec::new();
    for root in roots {
        if !root.exists() {
            continue;
        }
        let entries = match fs::read_dir(root) {
            Ok(read_dir) => read_dir,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            if let Some(stem) = path.file_name().and_then(|n| n.to_str()) {
                names.push(stem.to_string());
            }
        }
    }
    names
}

#[cfg(feature = "deep-shortcut-scan")]
fn scan_shortcuts() -> Vec<String> {
    let mut names = Vec::new();

    let mut roots = Vec::<PathBuf>::new();
    if let Some(desktop) = dirs::desktop_dir() {
        roots.push(desktop);
    }
    if let Some(data_dir) = dirs::data_dir() {
        roots.push(
            data_dir
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs"),
        );
    }

    for root in roots {
        if !root.exists() {
            continue;
        }
        for entry in walkdir::WalkDir::new(root).max_depth(2).into_iter().flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase())
                .unwrap_or_default();
            if ext != "lnk" && ext != "url" {
                continue;
            }
            if let Some(stem) = path.file_stem().and_then(|n| n.to_str()) {
                names.push(stem.to_string());
            }
        }
    }

    names
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

const DESKTOP_CSS: &str = include_str!("desktop.css");
