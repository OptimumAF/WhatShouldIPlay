use dioxus::prelude::*;

use crate::{
    data::{fetch_online_sources, fetch_steam_owned_games, refresh_scanned_games},
    merge_lines, on_off_label, tr, GameItem, UiLang,
};

#[allow(clippy::too_many_arguments)]
pub(crate) fn render_settings_sidebar(
    lang: UiLang,
    mut active_settings_section: Signal<String>,
    mut include_steamcharts: Signal<bool>,
    mut include_steamdb: Signal<bool>,
    mut include_twitch: Signal<bool>,
    mut include_steam_import: Signal<bool>,
    mut include_manual: Signal<bool>,
    mut include_scanned: Signal<bool>,
    mut weighted_mode: Signal<bool>,
    mut adaptive_recommendations: Signal<bool>,
    mut reduced_spin_animation: Signal<bool>,
    mut cooldown_spins: Signal<usize>,
    mut spin_speed_profile: Signal<String>,
    mut steamcharts_weight: Signal<f64>,
    mut steamdb_weight: Signal<f64>,
    mut twitch_weight: Signal<f64>,
    mut steam_import_weight: Signal<f64>,
    mut manual_weight: Signal<f64>,
    mut scanned_weight: Signal<f64>,
    steamcharts_games: Signal<Vec<GameItem>>,
    steamdb_games: Signal<Vec<GameItem>>,
    twitch_games: Signal<Vec<GameItem>>,
    mut steam_import_games: Signal<Vec<GameItem>>,
    scanned_games: Signal<Vec<String>>,
    mut manual_games: Signal<Vec<String>>,
    mut manual_text: Signal<String>,
    mut steam_api_key: Signal<String>,
    mut steam_id: Signal<String>,
    mut steam_import_status: Signal<String>,
    status: Signal<String>,
    steamdb_note: Signal<String>,
    ui_lang: Signal<UiLang>,
    weighted_mode_label: &'static str,
    adaptive_recommendations_label: &'static str,
    reduced_spin_animation_label: &'static str,
    profile_label: &'static str,
    behavior_signal_count: usize,
    behavior_signal_status_label: &'static str,
    spin_duration_label: String,
    steamcharts_weight_label: String,
    steamdb_weight_label: String,
    twitch_weight_label: String,
    steam_import_weight_label: String,
    manual_weight_label: String,
    scanned_weight_label: String,
    suggested_steamcharts_weight: f64,
    suggested_steamdb_weight: f64,
    suggested_twitch_weight: f64,
    suggested_steam_import_weight: f64,
    suggested_manual_weight: f64,
    suggested_scanned_weight: f64,
    suggested_steamcharts_weight_label: String,
    suggested_steamdb_weight_label: String,
    suggested_twitch_weight_label: String,
    suggested_steam_import_weight_label: String,
    suggested_manual_weight_label: String,
    suggested_scanned_weight_label: String,
) -> Element {
    rsx! {
        aside { class: "sidebar",
            section { class: "panel",
                h2 { "{tr(lang, \"Settings Workspace\", \"Espacio de ajustes\")}" }
                p { class: "muted", "{tr(lang, \"Move between sources, rules, and library tools without scanning one long stack.\", \"Muevete entre fuentes, reglas y herramientas de biblioteca sin recorrer una pila larga.\")}" }
                div { class: "settings-section-switcher",
                    button {
                        class: if active_settings_section() == "sources" { "ghost settings-section-trigger is-active" } else { "ghost settings-section-trigger" },
                        onclick: move |_| active_settings_section.set("sources".to_string()),
                        {tr(lang, "Sources", "Fuentes")}
                    }
                    button {
                        class: if active_settings_section() == "rules" { "ghost settings-section-trigger is-active" } else { "ghost settings-section-trigger" },
                        onclick: move |_| active_settings_section.set("rules".to_string()),
                        {tr(lang, "Rules", "Reglas")}
                    }
                    button {
                        class: if active_settings_section() == "library" { "ghost settings-section-trigger is-active" } else { "ghost settings-section-trigger" },
                        onclick: move |_| active_settings_section.set("library".to_string()),
                        {tr(lang, "Library", "Biblioteca")}
                    }
                }
            }
            if active_settings_section() == "rules" {
                section { class: "panel",
                    h2 { "{tr(lang, \"Mode Presets + Odds\", \"Modos predefinidos + probabilidades\")}" }
                    div { class: "button-row",
                        button {
                            class: "ghost",
                            onclick: move |_| {
                                include_steamcharts.set(true);
                                include_steamdb.set(true);
                                include_twitch.set(true);
                                include_steam_import.set(true);
                                include_manual.set(true);
                                include_scanned.set(true);
                                weighted_mode.set(true);
                                cooldown_spins.set(2);
                                steamcharts_weight.set(1.2);
                                steamdb_weight.set(1.15);
                                twitch_weight.set(1.0);
                                steam_import_weight.set(1.35);
                                manual_weight.set(0.9);
                                scanned_weight.set(1.0);
                            },
                            {tr(lang, "Balanced Mix", "Mezcla equilibrada")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| {
                                include_steamcharts.set(true);
                                include_steamdb.set(true);
                                include_twitch.set(true);
                                include_steam_import.set(true);
                                include_manual.set(true);
                                include_scanned.set(true);
                                weighted_mode.set(false);
                                cooldown_spins.set(0);
                            },
                            {tr(lang, "Quick Pick", "Eleccion rapida")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| {
                                include_steamcharts.set(true);
                                include_steamdb.set(true);
                                include_twitch.set(true);
                                include_steam_import.set(true);
                                include_manual.set(true);
                                include_scanned.set(true);
                                weighted_mode.set(true);
                                cooldown_spins.set(8);
                            },
                            {tr(lang, "No Repeats", "Sin repeticiones")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| {
                                include_steamcharts.set(false);
                                include_steamdb.set(false);
                                include_twitch.set(false);
                                include_steam_import.set(true);
                                include_manual.set(true);
                                include_scanned.set(true);
                                weighted_mode.set(true);
                                cooldown_spins.set(5);
                                steam_import_weight.set(1.8);
                                manual_weight.set(1.1);
                            },
                            {tr(lang, "Owned Focus", "Enfasis en biblioteca propia")}
                        }
                    }
                    div { class: "control-grid",
                        div { class: "control-row",
                            span { "{tr(lang, \"Weighted wheel\", \"Ruleta ponderada\")}" }
                            button {
                                class: "ghost",
                                onclick: move |_| weighted_mode.set(!weighted_mode()),
                                "{weighted_mode_label}"
                            }
                        }
                        div { class: "control-row",
                            span { "{tr(lang, \"Adaptive recommendations\", \"Recomendaciones adaptativas\")}" }
                            button {
                                class: "ghost",
                                onclick: move |_| adaptive_recommendations.set(!adaptive_recommendations()),
                                "{adaptive_recommendations_label}"
                            }
                            strong { "{behavior_signal_count} {tr(lang, \"signals\", \"senales\")}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"Cooldown spins\", \"Giros de enfriamiento\")}" }
                            input {
                                r#type: "range",
                                min: "0",
                                max: "20",
                                value: format!("{}", cooldown_spins()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<usize>() {
                                        cooldown_spins.set(value);
                                    }
                                }
                            }
                            strong { "{cooldown_spins}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"Spin speed profile\", \"Perfil de velocidad\")}" }
                            select {
                                value: "{spin_speed_profile}",
                                oninput: move |evt| spin_speed_profile.set(evt.value()),
                                option { value: "cinematic", "{tr(lang, \"Cinematic\", \"Cinematico\")}" }
                                option { value: "balanced", "{tr(lang, \"Balanced\", \"Equilibrado\")}" }
                                option { value: "rapid", "{tr(lang, \"Rapid\", \"Rapido\")}" }
                            }
                            strong { "{profile_label}" }
                        }
                        div { class: "control-row",
                            span { "{tr(lang, \"Reduced spin animation\", \"Animacion de giro reducida\")}" }
                            button {
                                class: "ghost",
                                onclick: move |_| reduced_spin_animation.set(!reduced_spin_animation()),
                                "{reduced_spin_animation_label}"
                            }
                            strong { "{spin_duration_label}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"SteamCharts weight\", \"Peso SteamCharts\")}" }
                            input {
                                r#type: "range",
                                min: "0.1",
                                max: "3",
                                step: "0.1",
                                value: format!("{:.1}", steamcharts_weight()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<f64>() {
                                        steamcharts_weight.set(value);
                                    }
                                }
                            }
                            strong { "{steamcharts_weight_label}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"SteamDB weight\", \"Peso SteamDB\")}" }
                            input {
                                r#type: "range",
                                min: "0.1",
                                max: "3",
                                step: "0.1",
                                value: format!("{:.1}", steamdb_weight()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<f64>() {
                                        steamdb_weight.set(value);
                                    }
                                }
                            }
                            strong { "{steamdb_weight_label}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"Twitch weight\", \"Peso Twitch\")}" }
                            input {
                                r#type: "range",
                                min: "0.1",
                                max: "3",
                                step: "0.1",
                                value: format!("{:.1}", twitch_weight()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<f64>() {
                                        twitch_weight.set(value);
                                    }
                                }
                            }
                            strong { "{twitch_weight_label}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"Steam import weight\", \"Peso importacion Steam\")}" }
                            input {
                                r#type: "range",
                                min: "0.1",
                                max: "3",
                                step: "0.1",
                                value: format!("{:.1}", steam_import_weight()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<f64>() {
                                        steam_import_weight.set(value);
                                    }
                                }
                            }
                            strong { "{steam_import_weight_label}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"Manual weight\", \"Peso manual\")}" }
                            input {
                                r#type: "range",
                                min: "0.1",
                                max: "3",
                                step: "0.1",
                                value: format!("{:.1}", manual_weight()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<f64>() {
                                        manual_weight.set(value);
                                    }
                                }
                            }
                            strong { "{manual_weight_label}" }
                        }
                        label { class: "control-row",
                            span { "{tr(lang, \"Scanned weight\", \"Peso escaneado\")}" }
                            input {
                                r#type: "range",
                                min: "0.1",
                                max: "3",
                                step: "0.1",
                                value: format!("{:.1}", scanned_weight()),
                                oninput: move |evt| {
                                    if let Ok(value) = evt.value().parse::<f64>() {
                                        scanned_weight.set(value);
                                    }
                                }
                            }
                            strong { "{scanned_weight_label}" }
                        }
                        div { class: "control-row",
                            span { "{tr(lang, \"Apply behavior suggestions\", \"Aplicar sugerencias de comportamiento\")}" }
                            button {
                                class: "ghost",
                                disabled: behavior_signal_count < 3,
                                onclick: move |_| {
                                    steamcharts_weight.set(suggested_steamcharts_weight);
                                    steamdb_weight.set(suggested_steamdb_weight);
                                    twitch_weight.set(suggested_twitch_weight);
                                    steam_import_weight.set(suggested_steam_import_weight);
                                    manual_weight.set(suggested_manual_weight);
                                    scanned_weight.set(suggested_scanned_weight);
                                    weighted_mode.set(true);
                                },
                                {tr(lang, "Apply", "Aplicar")}
                            }
                            strong { "{behavior_signal_status_label}" }
                        }
                        div { class: "control-row suggested-row",
                            span { "{tr(lang, \"SteamCharts suggested\", \"Sugerido SteamCharts\")}" }
                            div { class: "suggested-bar" }
                            strong { "{suggested_steamcharts_weight_label}" }
                        }
                        div { class: "control-row suggested-row",
                            span { "{tr(lang, \"SteamDB suggested\", \"Sugerido SteamDB\")}" }
                            div { class: "suggested-bar" }
                            strong { "{suggested_steamdb_weight_label}" }
                        }
                        div { class: "control-row suggested-row",
                            span { "{tr(lang, \"Twitch suggested\", \"Sugerido Twitch\")}" }
                            div { class: "suggested-bar" }
                            strong { "{suggested_twitch_weight_label}" }
                        }
                        div { class: "control-row suggested-row",
                            span { "{tr(lang, \"Steam import suggested\", \"Sugerido importacion Steam\")}" }
                            div { class: "suggested-bar" }
                            strong { "{suggested_steam_import_weight_label}" }
                        }
                        div { class: "control-row suggested-row",
                            span { "{tr(lang, \"Manual suggested\", \"Sugerido manual\")}" }
                            div { class: "suggested-bar" }
                            strong { "{suggested_manual_weight_label}" }
                        }
                        div { class: "control-row suggested-row",
                            span { "{tr(lang, \"Scanned suggested\", \"Sugerido escaneado\")}" }
                            div { class: "suggested-bar" }
                            strong { "{suggested_scanned_weight_label}" }
                        }
                    }
                    p { class: "muted", "{tr(lang, \"Adaptive mode uses recent spin history to bias sources you consistently land on. Apply suggested weights for a persistent baseline.\", \"El modo adaptativo usa historial reciente para sesgar fuentes en las que sueles caer. Aplica sugerencias para una base persistente.\")}" }
                }
            }
            if active_settings_section() == "sources" {
                section { class: "panel",
                    h2 { "{tr(lang, \"Online Sources\", \"Fuentes online\")}" }
                    div { class: "button-row",
                        button {
                            onclick: move |_| {
                                let mut steamcharts_games = steamcharts_games;
                                let mut steamdb_games = steamdb_games;
                                let mut twitch_games = twitch_games;
                                let mut status = status;
                                let mut steamdb_note = steamdb_note;
                                spawn(async move {
                                    status.set(tr(lang, "Loading online sources...", "Cargando fuentes online...").to_string());
                                    match fetch_online_sources().await {
                                        Ok(data) => {
                                            steamcharts_games.set(data.steamcharts);
                                            steamdb_games.set(data.steamdb);
                                            twitch_games.set(data.twitchmetrics);
                                            steamdb_note.set(data.steamdb_note);
                                            status.set(tr(lang, "Loaded online sources.", "Fuentes online cargadas.").to_string());
                                        }
                                        Err(err) => {
                                            status.set(format!(
                                                "{}: {err}",
                                                tr(lang, "Online load failed", "Fallo la carga online")
                                            ));
                                        }
                                    }
                                });
                            },
                            {tr(lang, "Load Online Sources", "Cargar fuentes online")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| include_steamcharts.set(!include_steamcharts()),
                            {format!("{}: {}", tr(lang, "SteamCharts", "SteamCharts"), on_off_label(lang, include_steamcharts()))}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| include_steamdb.set(!include_steamdb()),
                            {format!("{}: {}", tr(lang, "SteamDB", "SteamDB"), on_off_label(lang, include_steamdb()))}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| include_twitch.set(!include_twitch()),
                            {format!("{}: {}", tr(lang, "TwitchMetrics", "TwitchMetrics"), on_off_label(lang, include_twitch()))}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| include_steam_import.set(!include_steam_import()),
                            {format!("{}: {}", tr(lang, "Steam Import", "Importacion Steam"), on_off_label(lang, include_steam_import()))}
                        }
                    }
                    p { class: "muted", "{tr(lang, \"SteamCharts\", \"SteamCharts\")}: {steamcharts_games().len()} | {tr(lang, \"SteamDB\", \"SteamDB\")}: {steamdb_games().len()} | {tr(lang, \"TwitchMetrics\", \"TwitchMetrics\")}: {twitch_games().len()} | {tr(lang, \"Steam Import\", \"Importacion Steam\")}: {steam_import_games().len()}" }
                    if !steamdb_note().is_empty() {
                        p { class: "muted", "{steamdb_note}" }
                    }
                }

                section { class: "panel",
                    h2 { "{tr(lang, \"Steam Account Import\", \"Importar cuenta de Steam\")}" }
                    p { class: "muted", "{tr(lang, \"Import your owned games with Steam Web API key + SteamID64 (public profile/library required).\", \"Importa tus juegos propios con clave Steam Web API + SteamID64 (perfil/biblioteca publica requerida).\")}" }
                    div { class: "input-grid",
                        input {
                            r#type: "password",
                            value: "{steam_api_key}",
                            placeholder: "{tr(lang, \"Steam Web API Key\", \"Clave Steam Web API\")}",
                            oninput: move |evt| steam_api_key.set(evt.value())
                        }
                        input {
                            value: "{steam_id}",
                            placeholder: "{tr(lang, \"SteamID64\", \"SteamID64\")}",
                            oninput: move |evt| steam_id.set(evt.value())
                        }
                    }
                    div { class: "button-row",
                        button {
                            onclick: move |_| {
                                let api_key = steam_api_key().trim().to_string();
                                let steam_id = steam_id().trim().to_string();
                                if api_key.is_empty() || steam_id.is_empty() {
                                    steam_import_status.set(
                                        tr(lang, "Enter API key + SteamID64.", "Ingresa clave API + SteamID64.")
                                            .to_string(),
                                    );
                                    return;
                                }
                                let mut steam_import_games = steam_import_games;
                                let mut steam_import_status = steam_import_status;
                                let mut status = status;
                                spawn(async move {
                                    status.set(
                                        tr(lang, "Importing Steam library...", "Importando biblioteca de Steam...")
                                            .to_string(),
                                    );
                                    match fetch_steam_owned_games(&api_key, &steam_id).await {
                                        Ok(games) => {
                                            let total = games.len();
                                            steam_import_games.set(games);
                                            steam_import_status.set(format!(
                                                "{} {total} {}.",
                                                tr(lang, "Imported", "Importados"),
                                                tr(lang, "Steam games", "juegos de Steam")
                                            ));
                                            status.set(tr(lang, "Steam import complete.", "Importacion Steam completa.").to_string());
                                        }
                                        Err(err) => {
                                            steam_import_status.set(format!(
                                                "{}: {err}",
                                                tr(lang, "Steam import failed", "Fallo la importacion de Steam")
                                            ));
                                            status.set(
                                                tr(lang, "Steam import failed.", "Fallo la importacion de Steam.")
                                                    .to_string(),
                                            );
                                        }
                                    }
                                });
                            },
                            {tr(lang, "Import Steam Library", "Importar biblioteca de Steam")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| {
                                steam_import_games.set(Vec::new());
                                steam_import_status.set(String::new());
                            },
                            {tr(lang, "Clear Import", "Limpiar importacion")}
                        }
                    }
                    if !steam_import_status().is_empty() {
                        p { class: "muted", "{steam_import_status}" }
                    }
                }
            }
            if active_settings_section() == "library" {
                section { class: "panel",
                    h2 { "{tr(lang, \"Manual + Scan\", \"Manual + Escaneo\")}" }
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
                            {tr(lang, "Add Manual Games", "Agregar juegos manuales")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| include_manual.set(!include_manual()),
                            {format!("{}: {}", tr(lang, "Manual", "Manual"), on_off_label(lang, include_manual()))}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| {
                                spawn(refresh_scanned_games(scanned_games, status, ui_lang));
                            },
                            {tr(lang, "Scan Game Libraries", "Escanear bibliotecas de juegos")}
                        }
                        button {
                            class: "ghost",
                            onclick: move |_| include_scanned.set(!include_scanned()),
                            {format!("{}: {}", tr(lang, "Scanned", "Escaneado"), on_off_label(lang, include_scanned()))}
                        }
                    }
                    p { class: "muted", "{tr(lang, \"Manual games\", \"Juegos manuales\")}: {manual_games().len()} | {tr(lang, \"Scanned games\", \"Juegos escaneados\")}: {scanned_games().len()}" }
                    p { class: "muted", "{tr(lang, \"Desktop scan checks Steam manifests, Epic launcher manifests, and common install folders for GOG/Ubisoft/Xbox. Shortcut crawling is disabled by default.\", \"El escaneo desktop revisa manifiestos de Steam, Epic y carpetas comunes de GOG/Ubisoft/Xbox. El rastreo de accesos directos esta desactivado por defecto.\")}" }
                }
            }
        }
    }
}
