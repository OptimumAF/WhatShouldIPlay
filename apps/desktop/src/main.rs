#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use dioxus::prelude::*;
use std::collections::{BTreeSet, HashSet};

mod contracts;
mod data;
mod engine;
mod ui;
use contracts::TopGamesPayloadContract;
use data::refresh_scanned_games;
use engine::{build_weighted_pool, derive_wheel_data};
use ui::settings::render_settings_sidebar;
use ui::{render_hero_masthead, render_spin_history_panel, render_wheel_panel, render_winner_overlay};

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

#[derive(Clone, Debug)]
struct WeightLabels {
    steamcharts: String,
    steamdb: String,
    twitch: String,
    steam_import: String,
    manual: String,
    scanned: String,
}

#[derive(Clone, Debug)]
struct UiCopy {
    profile_label: &'static str,
    spin_button_label: &'static str,
    weighted_mode_label: &'static str,
    adaptive_recommendations_label: &'static str,
    reduced_spin_animation_label: &'static str,
    behavior_signal_status_label: &'static str,
    you_should_play_label: &'static str,
    sidebar_toggle_label: &'static str,
    spin_duration_label: String,
}

#[derive(Clone, Copy)]
struct DesktopDataState {
    ui_lang: Signal<UiLang>,
    steamcharts_games: Signal<Vec<GameItem>>,
    steamdb_games: Signal<Vec<GameItem>>,
    twitch_games: Signal<Vec<GameItem>>,
    steam_import_games: Signal<Vec<GameItem>>,
    scanned_games: Signal<Vec<String>>,
    manual_games: Signal<Vec<String>>,
    manual_text: Signal<String>,
    steam_api_key: Signal<String>,
    steam_id: Signal<String>,
    steam_import_status: Signal<String>,
    status: Signal<String>,
    steamdb_note: Signal<String>,
}

#[derive(Clone, Copy)]
struct DesktopSettingsState {
    include_steamcharts: Signal<bool>,
    include_steamdb: Signal<bool>,
    include_twitch: Signal<bool>,
    include_steam_import: Signal<bool>,
    include_manual: Signal<bool>,
    include_scanned: Signal<bool>,
    weighted_mode: Signal<bool>,
    adaptive_recommendations: Signal<bool>,
    cooldown_spins: Signal<usize>,
    steamcharts_weight: Signal<f64>,
    steamdb_weight: Signal<f64>,
    twitch_weight: Signal<f64>,
    steam_import_weight: Signal<f64>,
    manual_weight: Signal<f64>,
    scanned_weight: Signal<f64>,
    spin_speed_profile: Signal<String>,
    reduced_spin_animation: Signal<bool>,
}

#[derive(Clone, Copy)]
struct DesktopSpinState {
    spinning: Signal<bool>,
    wheel_rotation: Signal<f64>,
    winner: Signal<String>,
    winner_sources: Signal<String>,
    winner_odds: Signal<f64>,
    pending_winner: Signal<String>,
    pending_winner_sources: Signal<String>,
    pending_winner_odds: Signal<f64>,
    spin_history: Signal<Vec<SpinHistoryItem>>,
    show_winner_popup: Signal<bool>,
}

#[derive(Clone, Copy)]
struct DesktopLayoutState {
    show_sidebar: Signal<bool>,
    active_settings_section: Signal<String>,
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

#[component]
fn App() -> Element {
    let data = DesktopDataState {
        ui_lang: use_signal(|| UiLang::En),
        steamcharts_games: use_signal(Vec::<GameItem>::new),
        steamdb_games: use_signal(Vec::<GameItem>::new),
        twitch_games: use_signal(Vec::<GameItem>::new),
        steam_import_games: use_signal(Vec::<GameItem>::new),
        scanned_games: use_signal(Vec::<String>::new),
        manual_games: use_signal(Vec::<String>::new),
        manual_text: use_signal(String::new),
        steam_api_key: use_signal(String::new),
        steam_id: use_signal(String::new),
        steam_import_status: use_signal(String::new),
        status: use_signal(|| tr(UiLang::En, "Idle", "En espera").to_string()),
        steamdb_note: use_signal(String::new),
    };

    let settings = DesktopSettingsState {
        include_steamcharts: use_signal(|| true),
        include_steamdb: use_signal(|| true),
        include_twitch: use_signal(|| true),
        include_steam_import: use_signal(|| true),
        include_manual: use_signal(|| true),
        include_scanned: use_signal(|| true),
        weighted_mode: use_signal(|| true),
        adaptive_recommendations: use_signal(|| false),
        cooldown_spins: use_signal(|| 2_usize),
        steamcharts_weight: use_signal(|| 1.2_f64),
        steamdb_weight: use_signal(|| 1.15_f64),
        twitch_weight: use_signal(|| 1.0_f64),
        steam_import_weight: use_signal(|| 1.35_f64),
        manual_weight: use_signal(|| 0.9_f64),
        scanned_weight: use_signal(|| 1.0_f64),
        spin_speed_profile: use_signal(|| "balanced".to_string()),
        reduced_spin_animation: use_signal(|| false),
    };

    let spin = DesktopSpinState {
        spinning: use_signal(|| false),
        wheel_rotation: use_signal(|| 0.0_f64),
        winner: use_signal(String::new),
        winner_sources: use_signal(String::new),
        winner_odds: use_signal(|| 0.0_f64),
        pending_winner: use_signal(String::new),
        pending_winner_sources: use_signal(String::new),
        pending_winner_odds: use_signal(|| 0.0_f64),
        spin_history: use_signal(Vec::<SpinHistoryItem>::new),
        show_winner_popup: use_signal(|| false),
    };

    let layout = DesktopLayoutState {
        show_sidebar: use_signal(|| false),
        active_settings_section: use_signal(|| "sources".to_string()),
    };

    use_future({
        let scanned_games = data.scanned_games;
        let status = data.status;
        let ui_lang = data.ui_lang;
        move || refresh_scanned_games(scanned_games, status, ui_lang)
    });

    let full_pool = build_weighted_pool(
        (settings.include_steamcharts)(),
        (settings.include_steamdb)(),
        (settings.include_twitch)(),
        (settings.include_steam_import)(),
        (settings.include_manual)(),
        (settings.include_scanned)(),
        (settings.weighted_mode)(),
        (settings.steamcharts_weight)(),
        (settings.steamdb_weight)(),
        (settings.twitch_weight)(),
        (settings.steam_import_weight)(),
        (settings.manual_weight)(),
        (settings.scanned_weight)(),
        &(data.steamcharts_games)(),
        &(data.steamdb_games)(),
        &(data.twitch_games)(),
        &(data.steam_import_games)(),
        &(data.manual_games)(),
        &(data.scanned_games)(),
    );

    let derived_wheel = derive_wheel_data(
        &full_pool,
        &(spin.spin_history)(),
        (settings.cooldown_spins)(),
        (settings.adaptive_recommendations)(),
    );
    let weight_labels = make_weight_labels(
        (settings.steamcharts_weight)(),
        (settings.steamdb_weight)(),
        (settings.twitch_weight)(),
        (settings.steam_import_weight)(),
        (settings.manual_weight)(),
        (settings.scanned_weight)(),
    );
    let behavior_signal_count = derived_wheel.behavior_signal_count;
    let suggested_weights = derived_wheel.suggested_weights.clone();
    let suggested_weight_labels = make_weight_labels(
        suggested_weights.steamcharts,
        suggested_weights.steamdb,
        suggested_weights.twitch,
        suggested_weights.steam_import,
        suggested_weights.manual,
        suggested_weights.scanned,
    );
    let lang = (data.ui_lang)();
    let (profile_label, profile_duration_ms, profile_revolutions, profile_jitter_ratio) =
        match (settings.spin_speed_profile)().as_str() {
            "cinematic" => (tr(lang, "Cinematic", "Cinematico"), 6200.0, 10.5, 0.28),
            "rapid" => (tr(lang, "Rapid", "Rapido"), 3200.0, 6.4, 0.20),
            _ => (tr(lang, "Balanced", "Equilibrado"), 4800.0, 8.0, 0.24),
        };
    let (spin_duration_ms, spin_revolutions, spin_jitter_ratio) = if (settings.reduced_spin_animation)() {
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
    let ui_copy = make_ui_copy(
        lang,
        (spin.spinning)(),
        (settings.weighted_mode)(),
        (settings.adaptive_recommendations)(),
        (settings.reduced_spin_animation)(),
        behavior_signal_count,
        (layout.show_sidebar)(),
        profile_label,
        spin_duration_ms,
    );

    rsx! {
        style { "{DESKTOP_CSS}" }
        main { class: format!("layout {}", platform_class),
            {render_hero_masthead(lang, platform_label, &(data.status)(), data.ui_lang, layout.show_sidebar, ui_copy.sidebar_toggle_label)}

            div { class: if (layout.show_sidebar)() { "workspace" } else { "workspace sidebar-collapsed" },
                if (layout.show_sidebar)() {
                    {render_settings_sidebar(
                        lang,
                        layout.active_settings_section,
                        settings.include_steamcharts,
                        settings.include_steamdb,
                        settings.include_twitch,
                        settings.include_steam_import,
                        settings.include_manual,
                        settings.include_scanned,
                        settings.weighted_mode,
                        settings.adaptive_recommendations,
                        settings.reduced_spin_animation,
                        settings.cooldown_spins,
                        settings.spin_speed_profile,
                        settings.steamcharts_weight,
                        settings.steamdb_weight,
                        settings.twitch_weight,
                        settings.steam_import_weight,
                        settings.manual_weight,
                        settings.scanned_weight,
                        data.steamcharts_games,
                        data.steamdb_games,
                        data.twitch_games,
                        data.steam_import_games,
                        data.scanned_games,
                        data.manual_games,
                        data.manual_text,
                        data.steam_api_key,
                        data.steam_id,
                        data.steam_import_status,
                        data.status,
                        data.steamdb_note,
                        data.ui_lang,
                        ui_copy.weighted_mode_label,
                        ui_copy.adaptive_recommendations_label,
                        ui_copy.reduced_spin_animation_label,
                        ui_copy.profile_label,
                        behavior_signal_count,
                        ui_copy.behavior_signal_status_label,
                        ui_copy.spin_duration_label.clone(),
                        weight_labels.steamcharts.clone(),
                        weight_labels.steamdb.clone(),
                        weight_labels.twitch.clone(),
                        weight_labels.steam_import.clone(),
                        weight_labels.manual.clone(),
                        weight_labels.scanned.clone(),
                        suggested_weights.steamcharts,
                        suggested_weights.steamdb,
                        suggested_weights.twitch,
                        suggested_weights.steam_import,
                        suggested_weights.manual,
                        suggested_weights.scanned,
                        suggested_weight_labels.steamcharts.clone(),
                        suggested_weight_labels.steamdb.clone(),
                        suggested_weight_labels.twitch.clone(),
                        suggested_weight_labels.steam_import.clone(),
                        suggested_weight_labels.manual.clone(),
                        suggested_weight_labels.scanned.clone(),
                    )}
                }

                div { class: "content-stack",
                    {render_wheel_panel(
                        lang,
                        derived_wheel.spin_pool.clone(),
                        derived_wheel.cooldown_exhausted,
                        derived_wheel.wheel_labels.clone(),
                        spin.wheel_rotation,
                        spin.spinning,
                        &spin_transition,
                        &derived_wheel.wheel_background,
                        settings.weighted_mode,
                        settings.adaptive_recommendations,
                        derived_wheel.adaptive_spin_weights.clone(),
                        derived_wheel.segment_angle,
                        spin_jitter_ratio,
                        spin_revolutions,
                        spin.pending_winner,
                        spin.pending_winner_sources,
                        spin.pending_winner_odds,
                        spin.winner,
                        spin.winner_sources,
                        spin.winner_odds,
                        spin.spin_history,
                        spin.show_winner_popup,
                        ui_copy.spin_button_label,
                        ui_copy.you_should_play_label,
                    )}

                    {render_spin_history_panel(lang, &(spin.spin_history)())}
                }
            }
        }
        {render_winner_overlay(lang, spin.show_winner_popup, &(spin.winner)(), &(spin.winner_sources)(), (spin.winner_odds)())}
    }
}

fn make_weight_labels(
    steamcharts_weight: f64,
    steamdb_weight: f64,
    twitch_weight: f64,
    steam_import_weight: f64,
    manual_weight: f64,
    scanned_weight: f64,
) -> WeightLabels {
    WeightLabels {
        steamcharts: format!("{steamcharts_weight:.1}x"),
        steamdb: format!("{steamdb_weight:.1}x"),
        twitch: format!("{twitch_weight:.1}x"),
        steam_import: format!("{steam_import_weight:.1}x"),
        manual: format!("{manual_weight:.1}x"),
        scanned: format!("{scanned_weight:.1}x"),
    }
}

fn make_ui_copy(
    lang: UiLang,
    spinning: bool,
    weighted_mode: bool,
    adaptive_recommendations: bool,
    reduced_spin_animation: bool,
    behavior_signal_count: usize,
    show_sidebar: bool,
    profile_label: &'static str,
    spin_duration_ms: f64,
) -> UiCopy {
    UiCopy {
        profile_label,
        spin_button_label: if spinning {
            tr(lang, "Spinning...", "Girando...")
        } else {
            tr(lang, "Spin Wheel", "Girar ruleta")
        },
        weighted_mode_label: on_off_label(lang, weighted_mode),
        adaptive_recommendations_label: on_off_label(lang, adaptive_recommendations),
        reduced_spin_animation_label: on_off_label(lang, reduced_spin_animation),
        behavior_signal_status_label: if behavior_signal_count < 3 {
            tr(lang, "Need 3+", "Necesita 3+")
        } else {
            tr(lang, "Ready", "Listo")
        },
        you_should_play_label: tr(lang, "You should play:", "Deberias jugar:"),
        sidebar_toggle_label: if show_sidebar {
            tr(lang, "Hide Settings", "Ocultar ajustes")
        } else {
            tr(lang, "Show Settings", "Mostrar ajustes")
        },
        spin_duration_label: format!("{:.1}s", spin_duration_ms / 1000.0),
    }
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

const DESKTOP_CSS: &str = include_str!("desktop.css");
