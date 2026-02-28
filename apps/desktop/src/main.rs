#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use anyhow::{anyhow, Context, Result};
use dioxus::prelude::*;
use rand::Rng;
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::path::PathBuf;
use tokio::time::{sleep, Duration};

const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const TOP_N: usize = 30;

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

fn main() {
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    let mut steamcharts_games = use_signal(Vec::<GameItem>::new);
    let mut steamdb_games = use_signal(Vec::<GameItem>::new);
    let mut twitch_games = use_signal(Vec::<GameItem>::new);
    let mut scanned_games = use_signal(Vec::<String>::new);
    let mut manual_games = use_signal(Vec::<String>::new);
    let mut manual_text = use_signal(String::new);
    let mut status = use_signal(|| "Idle".to_string());
    let mut steamdb_note = use_signal(String::new);

    let mut include_steamcharts = use_signal(|| true);
    let mut include_steamdb = use_signal(|| true);
    let mut include_twitch = use_signal(|| true);
    let mut include_manual = use_signal(|| true);
    let mut include_scanned = use_signal(|| true);

    let mut spinning = use_signal(|| false);
    let mut wheel_rotation = use_signal(|| 0.0_f64);
    let mut winner = use_signal(String::new);
    let mut pending_winner = use_signal(String::new);
    let mut show_winner_popup = use_signal(|| false);

    let pool = build_pool(
        include_steamcharts(),
        include_steamdb(),
        include_twitch(),
        include_manual(),
        include_scanned(),
        &steamcharts_games(),
        &steamdb_games(),
        &twitch_games(),
        &manual_games(),
        &scanned_games(),
    );

    let segment_count = pool.len().max(1);
    let segment_angle = 360.0 / segment_count as f64;
    let wheel_background = if pool.is_empty() {
        "#f4f0e6".to_string()
    } else {
        wheel_gradient(pool.len())
    };
    let wheel_labels = pool
        .iter()
        .enumerate()
        .map(|(index, game)| {
            let angle = index as f64 * segment_angle + (segment_angle / 2.0);
            let flip = if angle > 90.0 && angle < 270.0 {
                180.0
            } else {
                0.0
            };
            (angle, flip, game.clone())
        })
        .collect::<Vec<_>>();

    rsx! {
        style { "{DESKTOP_CSS}" }
        main { class: "layout",
            section { class: "hero",
                p { class: "kicker", "PickAGame Desktop" }
                h1 { "Spin For Your Next Game" }
                p { "Load top games from SteamCharts, SteamDB/Steam API, TwitchMetrics, add manual entries, or scan your PC for installed games." }
                p { class: "status", "Status: {status}" }
            }

            section { class: "panel",
                h2 { "Online Sources" }
                div { class: "button-row",
                    button {
                        onclick: move |_| {
                            let mut steamcharts_games = steamcharts_games;
                            let mut steamdb_games = steamdb_games;
                            let mut twitch_games = twitch_games;
                            let mut status = status;
                            let mut steamdb_note = steamdb_note;
                            spawn(async move {
                                status.set("Loading online sources...".to_string());
                                match fetch_online_sources().await {
                                    Ok(data) => {
                                        steamcharts_games.set(data.steamcharts);
                                        steamdb_games.set(data.steamdb);
                                        twitch_games.set(data.twitchmetrics);
                                        steamdb_note.set(data.steamdb_note);
                                        status.set("Loaded online sources.".to_string());
                                    }
                                    Err(err) => {
                                        status.set(format!("Online load failed: {err}"));
                                    }
                                }
                            });
                        },
                        "Load Online Sources"
                    }
                    button {
                        class: "ghost",
                        onclick: move |_| include_steamcharts.set(!include_steamcharts()),
                        {format!("SteamCharts: {}", if include_steamcharts() { "ON" } else { "OFF" })}
                    }
                    button {
                        class: "ghost",
                        onclick: move |_| include_steamdb.set(!include_steamdb()),
                        {format!("SteamDB: {}", if include_steamdb() { "ON" } else { "OFF" })}
                    }
                    button {
                        class: "ghost",
                        onclick: move |_| include_twitch.set(!include_twitch()),
                        {format!("TwitchMetrics: {}", if include_twitch() { "ON" } else { "OFF" })}
                    }
                }
                p { class: "muted", "SteamCharts: {steamcharts_games().len()} | SteamDB: {steamdb_games().len()} | TwitchMetrics: {twitch_games().len()}" }
                if !steamdb_note().is_empty() {
                    p { class: "muted", "{steamdb_note}" }
                }
            }

            section { class: "panel",
                h2 { "Manual + Scan" }
                textarea {
                    value: "{manual_text}",
                    rows: "4",
                    oninput: move |evt| manual_text.set(evt.value()),
                    placeholder: "Hades II\nHelldivers 2\nMonster Hunter Wilds"
                }
                div { class: "button-row",
                    button {
                        onclick: move |_| {
                            let merged = merge_lines(&manual_games(), &manual_text());
                            manual_games.set(merged);
                            manual_text.set(String::new());
                        },
                        "Add Manual Games"
                    }
                    button {
                        class: "ghost",
                        onclick: move |_| include_manual.set(!include_manual()),
                        {format!("Manual: {}", if include_manual() { "ON" } else { "OFF" })}
                    }
                    button {
                        class: "ghost",
                        onclick: move |_| {
                            let games = scan_installed_games();
                            scanned_games.set(games);
                        },
                        "Scan PC for Games"
                    }
                    button {
                        class: "ghost",
                        onclick: move |_| include_scanned.set(!include_scanned()),
                        {format!("Scanned: {}", if include_scanned() { "ON" } else { "OFF" })}
                    }
                }
                p { class: "muted", "Manual games: {manual_games().len()} | Scanned games: {scanned_games().len()}" }
            }

            section { class: "panel",
                h2 { "Wheel" }
                p { class: "muted", "Current pool: {pool.len()} unique games" }
                div { class: "wheel-shell",
                    div { class: "wheel-pointer" }
                    div {
                        class: "wheel",
                        style: format!(
                            "--rotation:{}deg;--transition:{};--wheel-bg:{};",
                            wheel_rotation(),
                            if spinning() { "transform 4.8s cubic-bezier(.17,.67,.11,.99)" } else { "none" },
                            wheel_background
                        ),
                        ontransitionend: move |_| {
                            if spinning() {
                                spinning.set(false);
                                winner.set(pending_winner());
                                show_winner_popup.set(true);
                                let mut show_winner_popup = show_winner_popup;
                                spawn(async move {
                                    sleep(Duration::from_millis(3600)).await;
                                    show_winner_popup.set(false);
                                });
                            }
                        },
                        div { class: "wheel-hub" }
                        if pool.is_empty() {
                            div { class: "wheel-empty", "Add or load games first" }
                        } else {
                            for (label_angle, label_flip, game) in wheel_labels.iter() {
                                div {
                                    class: "wheel-label",
                                    style: format!(
                                        "--label-angle:{}deg;--label-flip:{}deg;",
                                        label_angle,
                                        label_flip
                                    ),
                                    span { "{game}" }
                                }
                            }
                        }
                    }
                }
                div { class: "button-row",
                    button {
                        disabled: spinning() || pool.is_empty(),
                        onclick: move |_| {
                            if spinning() || pool.is_empty() {
                                return;
                            }
                            let mut rng = rand::rng();
                            let winner_index = rng.random_range(0..pool.len());
                            let winner_center = winner_index as f64 * segment_angle + (segment_angle / 2.0);
                            let jitter = rng.random_range(-(segment_angle * 0.30)..(segment_angle * 0.30));
                            let next = wheel_rotation() + 360.0 * 8.0 + (360.0 - winner_center) + jitter;
                            pending_winner.set(pool[winner_index].clone());
                            winner.set(String::new());
                            spinning.set(true);
                            wheel_rotation.set(next);
                        },
                        if spinning() { "Spinning..." } else { "Spin Wheel" }
                    }
                }
                if !winner().is_empty() {
                    div { class: "winner",
                        p { "You should play:" }
                        strong { "{winner}" }
                    }
                }
            }
        }
        if show_winner_popup() && !winner().is_empty() {
            div {
                class: "winner-overlay",
                onclick: move |_| show_winner_popup.set(false),
                div {
                    class: "winner-popup",
                    onclick: move |event| event.stop_propagation(),
                    div { class: "winner-glow" }
                    p { class: "winner-tag", "Winner" }
                    h3 { "{winner}" }
                    p { "Launch it. No second guessing." }
                    button {
                        onclick: move |_| show_winner_popup.set(false),
                        "Nice"
                    }
                }
            }
        }
    }
}

fn build_pool(
    include_steamcharts: bool,
    include_steamdb: bool,
    include_twitch: bool,
    include_manual: bool,
    include_scanned: bool,
    steamcharts: &[GameItem],
    steamdb: &[GameItem],
    twitch: &[GameItem],
    manual: &[String],
    scanned: &[String],
) -> Vec<String> {
    let mut seen = HashSet::<String>::new();
    let mut pool = Vec::new();

    let mut insert = |name: &str| {
        let trimmed = normalize_name(name);
        if trimmed.is_empty() {
            return;
        }
        let key = trimmed.to_lowercase();
        if seen.insert(key) {
            pool.push(trimmed);
        }
    };

    if include_steamcharts {
        for game in steamcharts {
            insert(&game.name);
        }
    }
    if include_steamdb {
        for game in steamdb {
            insert(&game.name);
        }
    }
    if include_twitch {
        for game in twitch {
            insert(&game.name);
        }
    }
    if include_manual {
        for game in manual {
            insert(game);
        }
    }
    if include_scanned {
        for game in scanned {
            insert(game);
        }
    }

    pool
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

async fn fetch_online_sources() -> Result<OnlineData> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .context("failed to build HTTP client")?;

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
    games.extend(scan_common_install_dirs());
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

fn scan_common_install_dirs() -> Vec<String> {
    let mut roots = Vec::<PathBuf>::new();
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(&program_files).join("Epic Games"));
        roots.push(PathBuf::from(&program_files).join("GOG Galaxy").join("Games"));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(&program_files_x86).join("Epic Games"));
        roots.push(PathBuf::from(&program_files_x86).join("GOG Galaxy").join("Games"));
    }
    roots.push(PathBuf::from("C:\\XboxGames"));
    roots.push(PathBuf::from("C:\\Games"));

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

const DESKTOP_CSS: &str = r#"
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Segoe UI", "Helvetica Neue", sans-serif;
  color: #0f2032;
  background:
    radial-gradient(circle at 8% 14%, #ffe066 0%, transparent 34%),
    radial-gradient(circle at 90% 20%, #70c1b3 0%, transparent 34%),
    radial-gradient(circle at 52% 98%, #ff9f1c 0%, transparent 38%),
    linear-gradient(150deg, #f7f3e8 0%, #dbe8f6 100%);
}

.layout {
  max-width: 1080px;
  margin: 0 auto;
  padding: 18px 14px 28px;
  display: grid;
  gap: 12px;
}

.hero,
.panel {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 32, 50, 0.16);
  border-radius: 18px;
  padding: 14px;
}

.hero h1 {
  margin: 0;
  font-size: 2.1rem;
}

.hero p {
  margin: 6px 0 0;
}

.kicker {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
  color: #1f3f5b;
}

h2 {
  margin: 0 0 8px;
}

.muted,
.status {
  margin: 8px 0 0;
  color: #3c556f;
}

textarea {
  width: 100%;
  border: 1px solid rgba(15, 32, 50, 0.2);
  border-radius: 10px;
  margin-top: 8px;
  padding: 10px;
  font: inherit;
  resize: vertical;
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

button {
  border: 0;
  border-radius: 999px;
  padding: 9px 14px;
  font-weight: 700;
  cursor: pointer;
  background: #f25f5c;
  color: white;
}

button.ghost {
  background: #dbe9f2;
  color: #10314c;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.wheel-shell {
  margin: 14px auto 0;
  width: min(74vw, 460px);
  aspect-ratio: 1;
  position: relative;
}

.wheel-pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-top: 22px solid #10263a;
  z-index: 3;
}

.wheel {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 10px solid #10263a;
  background: var(--wheel-bg, #f4f0e6);
  position: relative;
  overflow: hidden;
  transform: rotate(var(--rotation));
  transition: var(--transition);
}

.wheel-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #10263a;
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.72);
  z-index: 2;
}

.wheel-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #39526f;
  font-weight: 700;
}

.wheel-label {
  position: absolute;
  inset: 0;
  transform: rotate(var(--label-angle));
  transform-origin: center;
  z-index: 1;
}

.wheel-label span {
  position: absolute;
  left: 50%;
  top: 20%;
  transform: translateX(-50%) rotate(calc(90deg + var(--label-flip, 0deg)));
  transform-origin: center;
  max-width: 38%;
  line-height: 1.05;
  font-size: clamp(0.56rem, 1.15vw, 0.82rem);
  font-weight: 700;
  text-align: center;
  text-wrap: balance;
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.8),
    0 0 6px rgba(255, 255, 255, 0.35);
}

.winner {
  margin-top: 10px;
  border: 1px solid rgba(15, 32, 50, 0.2);
  background: #f9f3df;
  border-radius: 12px;
  padding: 10px;
}

.winner p {
  margin: 0;
  color: #39526f;
}

.winner strong {
  margin-top: 4px;
  display: inline-block;
  font-size: 1.35rem;
}

.winner-overlay {
  position: fixed;
  inset: 0;
  background: rgba(13, 26, 41, 0.55);
  backdrop-filter: blur(3px);
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 12px;
}

.winner-popup {
  position: relative;
  width: min(90vw, 520px);
  border-radius: 20px;
  border: 1px solid rgba(16, 38, 58, 0.2);
  background:
    radial-gradient(circle at 20% 10%, rgba(255, 224, 102, 0.56) 0%, transparent 40%),
    radial-gradient(circle at 88% 20%, rgba(112, 193, 179, 0.44) 0%, transparent 45%),
    linear-gradient(145deg, #fdf7e8 0%, #e7f0f8 100%);
  padding: 16px;
  animation: winner-pop 420ms cubic-bezier(.12,.87,.24,1.07);
}

.winner-glow {
  position: absolute;
  inset: -20px;
  border-radius: 24px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  animation: winner-ring 1.8s ease-out infinite;
  pointer-events: none;
}

.winner-tag {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #24415c;
}

.winner-popup h3 {
  margin: 6px 0;
  font-size: clamp(1.9rem, 6vw, 3rem);
}

.winner-popup p {
  margin: 0;
  color: #2d4d69;
}

.winner-popup button {
  margin-top: 12px;
}

@keyframes winner-pop {
  0% {
    opacity: 0;
    transform: scale(0.65) rotate(-4deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes winner-ring {
  0% {
    opacity: 0.9;
    transform: scale(0.92);
  }
  100% {
    opacity: 0;
    transform: scale(1.06);
  }
}
"#;
