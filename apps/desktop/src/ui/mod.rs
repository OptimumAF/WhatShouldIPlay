use dioxus::prelude::*;
use rand::RngExt;
use tokio::time::{sleep, Duration};

pub(crate) mod settings;

use crate::{
    data::refresh_scanned_games,
    engine::{pick_weighted_index, spin_target_rotation, take_spin_result, SpinOperation},
    format_odds, localize_source_chain,
    manual_store::save_desktop_state,
    parse_ui_lang,
    provenance::{
        observe_sources, InstallationStatus, LauncherId, OwnershipStatus, ScanEvidence,
        ScanEvidenceKind, SourceId,
    },
    tr, DesktopLocalState, ManualGameRecord, SpinHistoryItem, UiLang, WeightedPoolGame,
};

fn evidence_label(lang: UiLang, evidence: ScanEvidence) -> String {
    let kind = match evidence.kind {
        ScanEvidenceKind::Manifest => tr(lang, "manifest", "manifiesto"),
        ScanEvidenceKind::DirectoryName => tr(lang, "directory name", "nombre de carpeta"),
        #[cfg(feature = "deep-shortcut-scan")]
        ScanEvidenceKind::ShortcutName => tr(lang, "shortcut name", "nombre de acceso directo"),
    };
    let launcher = match evidence.launcher {
        LauncherId::Steam => Some("Steam"),
        LauncherId::Epic => Some("Epic"),
        LauncherId::Gog => Some("GOG"),
        LauncherId::Ubisoft => Some("Ubisoft"),
        LauncherId::Xbox => Some("Xbox"),
        LauncherId::Generic => None,
    };
    match (launcher, lang) {
        (Some(launcher), UiLang::En) => format!("{launcher} {kind}"),
        (Some(launcher), UiLang::Es) => format!("{kind} ({launcher})"),
        (None, _) => kind.to_string(),
    }
}

fn availability_summary(
    lang: UiLang,
    source_ids: &[SourceId],
    scan_evidence: &[ScanEvidence],
) -> String {
    let observations = observe_sources(source_ids, scan_evidence);
    let ownership = match observations.ownership {
        OwnershipStatus::Unknown => tr(lang, "Ownership unknown", "Propiedad desconocida"),
        OwnershipStatus::ObservedSteamImport => tr(
            lang,
            "Steam ownership reported by import",
            "Propiedad en Steam indicada por la importacion",
        ),
    };
    let installation = match observations.installation {
        InstallationStatus::Unknown => {
            tr(lang, "Installation unknown", "Instalacion desconocida").to_string()
        }
        InstallationStatus::Candidate if observations.scan_evidence.is_empty() => tr(
            lang,
            "Local installation candidate (unverified)",
            "Posible instalacion local (sin verificar)",
        )
        .to_string(),
        InstallationStatus::Candidate => format!(
            "{}: {} ({})",
            tr(
                lang,
                "Local installation candidate",
                "Posible instalacion local"
            ),
            observations
                .scan_evidence
                .into_iter()
                .map(|evidence| evidence_label(lang, evidence))
                .collect::<Vec<_>>()
                .join(", "),
            tr(lang, "unverified", "sin verificar"),
        ),
    };
    if observations.trend_sources.is_empty() {
        format!("{ownership} · {installation}")
    } else {
        format!(
            "{} · {ownership} · {installation}",
            tr(lang, "Trend listing", "En lista de tendencias")
        )
    }
}

fn winner_availability(lang: UiLang, winner: &str, display: Option<&SpinOperation>) -> String {
    display
        .filter(|operation| operation.winner.display_name == winner)
        .map(|operation| {
            let evidence = operation
                .eligible
                .get(operation.winner_index)
                .map_or(&[][..], |game| game.scan_evidence.as_slice());
            availability_summary(lang, &operation.winner.source_ids, evidence)
        })
        .unwrap_or_else(|| availability_summary(lang, &[], &[]))
}

#[cfg(test)]
mod availability_tests {
    use super::{availability_summary, winner_availability};
    use crate::{
        engine::SpinOperation,
        provenance::{LauncherId, ScanEvidence, ScanEvidenceKind, SourceId},
        UiLang, WeightedPoolGame,
    };

    #[test]
    fn copy_keeps_trends_imports_and_uncertain_scan_results_distinct() {
        assert_eq!(
            availability_summary(UiLang::En, &[SourceId::Steamcharts], &[]),
            "Trend listing · Ownership unknown · Installation unknown"
        );
        assert_eq!(
            availability_summary(UiLang::En, &[SourceId::SteamImport], &[]),
            "Steam ownership reported by import · Installation unknown"
        );
        assert_eq!(
            availability_summary(
                UiLang::En,
                &[SourceId::Steamcharts, SourceId::SteamImport],
                &[]
            ),
            "Trend listing · Steam ownership reported by import · Installation unknown"
        );
        let evidence = ScanEvidence {
            launcher: LauncherId::Generic,
            kind: ScanEvidenceKind::DirectoryName,
        };
        assert_eq!(
            availability_summary(UiLang::En, &[SourceId::Scan], &[evidence]),
            "Ownership unknown · Local installation candidate: directory name (unverified)"
        );
        assert_eq!(
            availability_summary(UiLang::En, &[SourceId::Scan], &[]),
            "Ownership unknown · Local installation candidate (unverified)"
        );
        assert_eq!(
            availability_summary(UiLang::Es, &[SourceId::Scan], &[evidence]),
            "Propiedad desconocida · Posible instalacion local: nombre de carpeta (sin verificar)"
        );
        assert_eq!(
            availability_summary(UiLang::En, &[], &[]),
            "Ownership unknown · Installation unknown"
        );
    }

    #[test]
    fn winner_copy_uses_frozen_spin_evidence_only_for_that_winner() {
        let pool = [WeightedPoolGame {
            id: "source:scan:echo harbor".into(),
            name: "Echo Harbor".into(),
            display_name: "Echo Harbor".into(),
            sources: vec!["Scanned".into()],
            source_ids: vec![SourceId::Scan],
            scan_evidence: vec![ScanEvidence {
                launcher: LauncherId::Steam,
                kind: ScanEvidenceKind::Manifest,
            }],
            weight: 1.0,
        }];
        let spin = SpinOperation::new(1, &pool, &[1.0], 0, &[], "", "");
        assert!(winner_availability(UiLang::En, "Echo Harbor", Some(&spin))
            .contains("Steam manifest (unverified)"));
        assert_eq!(
            winner_availability(UiLang::En, "Other Game", Some(&spin)),
            "Ownership unknown · Installation unknown"
        );
    }
}

pub(crate) fn render_hero_masthead(
    lang: UiLang,
    platform_label: &'static str,
    status: &str,
    mut ui_lang: Signal<UiLang>,
    mut show_sidebar: Signal<bool>,
    sidebar_toggle_label: &'static str,
) -> Element {
    rsx! {
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
    }
}

pub(crate) fn render_wheel_panel(
    lang: UiLang,
    spin_pool: Vec<WeightedPoolGame>,
    cooldown_exhausted: bool,
    wheel_labels: Vec<(f64, f64, String)>,
    wheel_rotation: Signal<f64>,
    spinning: Signal<bool>,
    spin_transition: &str,
    spin_duration_ms: f64,
    wheel_background: &str,
    weighted_mode: Signal<bool>,
    adaptive_recommendations: Signal<bool>,
    adaptive_spin_weights: Vec<f64>,
    spin_jitter_ratio: f64,
    spin_revolutions: f64,
    display_spin: Signal<Option<SpinOperation>>,
    pending_spin: Signal<Option<SpinOperation>>,
    next_spin_id: Signal<u64>,
    winner: Signal<String>,
    winner_sources: Signal<String>,
    winner_odds: Signal<f64>,
    mut spin_history: Signal<Vec<SpinHistoryItem>>,
    manual_games: Signal<Vec<ManualGameRecord>>,
    played_ids: Signal<Vec<String>>,
    completed_ids: Signal<Vec<String>>,
    mut local_storage_error: Signal<Option<String>>,
    local_storage_blocked: Signal<bool>,
    show_winner_popup: Signal<bool>,
    mut show_sidebar: Signal<bool>,
    mut active_settings_section: Signal<String>,
    scanned_games: Signal<Vec<crate::provenance::ScanCandidate>>,
    status: Signal<String>,
    ui_lang: Signal<UiLang>,
    spin_button_label: &'static str,
    you_should_play_label: &'static str,
) -> Element {
    let display = display_spin();
    let visible_count = display
        .as_ref()
        .map_or(spin_pool.len(), |operation| operation.eligible.len());
    let visible_labels = display.as_ref().map_or_else(
        || wheel_labels.clone(),
        |operation| operation.wheel_labels.clone(),
    );
    let visible_background = display.as_ref().map_or_else(
        || wheel_background.to_string(),
        |operation| operation.wheel_background.clone(),
    );
    let visible_transition = display.as_ref().map_or_else(
        || spin_transition.to_string(),
        |operation| operation.transition.clone(),
    );
    let winner_name = winner();
    let winner_availability = winner_availability(lang, &winner_name, display.as_ref());
    let start_background = wheel_background.to_string();
    let start_transition = spin_transition.to_string();
    rsx! {
        section { class: "panel panel-primary",
            h2 { "{tr(lang, \"Wheel\", \"Ruleta\")}" }
            p { class: "muted", "{tr(lang, \"Current pool\", \"Pool actual\")}: {visible_count} {tr(lang, \"unique games\", \"juegos unicos\")}" }
            if cooldown_exhausted {
                p { class: "muted", "{tr(lang, \"Cooldown saturated the pool, so all entries were temporarily re-enabled.\", \"El enfriamiento agoto el pool, asi que todas las entradas se reactivaron temporalmente.\")}" }
            }
            if spin_pool.is_empty() {
                section { class: "import-empty-state",
                    div { class: "import-empty-state-copy",
                        p { class: "kicker", "{tr(lang, \"Quick Start\", \"Inicio rapido\")}" }
                        h3 { "{tr(lang, \"Start by building a pool\", \"Empieza creando un pool\")}" }
                        p { class: "muted", "{tr(lang, \"No games are ready to spin yet. Add manual picks, import Steam ownership, or scan local libraries from here.\", \"Todavia no hay juegos listos para girar. Agrega picks manuales, importa tu biblioteca de Steam o escanea bibliotecas locales desde aqui.\")}" }
                    }
                    div { class: "import-empty-grid",
                        button {
                            class: "ghost import-empty-card",
                            onclick: move |_| {
                                show_sidebar.set(true);
                                active_settings_section.set("library".to_string());
                            },
                            strong { "{tr(lang, \"Add manual games\", \"Agregar juegos manuales\")}" }
                            span { "{tr(lang, \"Open Library tools and paste your shortlist.\", \"Abre las herramientas de Biblioteca y pega tu lista corta.\")}" }
                        }
                        button {
                            class: "ghost import-empty-card",
                            onclick: move |_| {
                                show_sidebar.set(true);
                                active_settings_section.set("sources".to_string());
                            },
                            strong { "{tr(lang, \"Import Steam account\", \"Importar cuenta de Steam\")}" }
                            span { "{tr(lang, \"Open Sources and pull owned games with your Steam Web API credentials.\", \"Abre Fuentes y trae juegos propios con tus credenciales de Steam Web API.\")}" }
                        }
                        button {
                            class: "ghost import-empty-card",
                            onclick: move |_| {
                                show_sidebar.set(true);
                                active_settings_section.set("library".to_string());
                                spawn(refresh_scanned_games(scanned_games, status, ui_lang));
                            },
                            strong { "{tr(lang, \"Scan local libraries\", \"Escanear bibliotecas locales\")}" }
                            span { "{tr(lang, \"Run another local scan now for Steam, Epic, GOG, Ubisoft, and Xbox paths.\", \"Ejecuta otro escaneo local ahora para rutas de Steam, Epic, GOG, Ubisoft y Xbox.\")}" }
                        }
                    }
                }
            }
            div { class: "wheel-stage",
                div { class: "wheel-stage-glow" }
                div { class: "wheel-stage-ring" }
                div { class: "wheel-shell",
                    div { class: "wheel-pointer" }
                    div {
                        class: "wheel",
                        style: format!(
                            "--rotation:{}deg;--transition:{};--wheel-bg:{};",
                            wheel_rotation(),
                            if spinning() { &visible_transition } else { "none" },
                            visible_background
                        ),
                        ontransitionend: move |_| {
                            if let Some(operation) = pending_spin() {
                                finalize_spin_result(
                                    operation.id,
                                    spinning,
                                    pending_spin,
                                    winner,
                                    winner_sources,
                                    winner_odds,
                                    spin_history,
                                    manual_games,
                                    played_ids,
                                    completed_ids,
                                    local_storage_error,
                                    local_storage_blocked,
                                    show_winner_popup,
                                    next_spin_id,
                                );
                            }
                        },
                        div { class: "wheel-hub", ontransitionend: move |event| event.stop_propagation() }
                        if visible_count == 0 {
                            div { class: "wheel-empty", "{tr(lang, \"Add or load games first\", \"Agrega o carga juegos primero\")}" }
                        } else {
                            for (label_angle, label_flip, game_name) in visible_labels.iter() {
                                div {
                                    class: "wheel-label",
                                    ontransitionend: move |event| event.stop_propagation(),
                                    style: format!(
                                        "--label-angle:{}deg;--label-flip:{}deg;",
                                        label_angle,
                                        label_flip
                                    ),
                                    span { "{game_name}" }
                                }
                            }
                        }
                    }
                }
                p { class: "wheel-caption", "{tr(lang, \"Focus the wheel, then keep settings out of the way until you need them.\", \"Enfoca la ruleta y deja los ajustes fuera del camino hasta necesitarlos.\")}" }
            }
            div { class: "button-row",
                button {
                    disabled: spinning() || spin_pool.is_empty(),
                    onclick: move |_| {
                        start_spin(
                            &spin_pool,
                            weighted_mode(),
                            adaptive_recommendations(),
                            &adaptive_spin_weights,
                            &wheel_labels,
                            &start_background,
                            &start_transition,
                            spin_duration_ms,
                            spin_jitter_ratio,
                            spin_revolutions,
                            wheel_rotation,
                            spinning,
                            display_spin,
                            pending_spin,
                            next_spin_id,
                            winner,
                            winner_sources,
                            winner_odds,
                            spin_history,
                            manual_games,
                            played_ids,
                            completed_ids,
                            local_storage_error,
                            local_storage_blocked,
                            show_winner_popup,
                        );
                    },
                    "{spin_button_label}"
                }
                button {
                    class: "ghost",
                    onclick: move |_| {
                        if local_storage_blocked() {
                            return;
                        }
                        let next = DesktopLocalState {
                            manual_records: manual_games(),
                            history: Vec::new(),
                            played_ids: played_ids(),
                            completed_ids: completed_ids(),
                        };
                        match save_desktop_state(&next) {
                            Ok(()) => {
                                spin_history.set(Vec::new());
                                local_storage_error.set(None);
                            }
                            Err(error) => local_storage_error.set(Some(format!(
                                "History could not be cleared ({error})."
                            ))),
                        }
                    },
                    {tr(lang, "Clear History", "Limpiar historial")}
                }
            }
            if let Some(error) = local_storage_error() {
                p { role: "alert", "{error}" }
            }
            if !winner().is_empty() {
                div { class: "winner winner-rich",
                    p { "{you_should_play_label}" }
                    strong { "{winner}" }
                    p { "{tr(lang, \"Sources\", \"Fuentes\")}" }
                    div { class: "source-chip-row",
                        for source in winner_sources().split('+') {
                            span {
                                class: "source-chip",
                                "data-source": source_chip_attr(source),
                                "{source_label_for_display(lang, source)}"
                            }
                        }
                    }
                    p { class: "muted", "{winner_availability}" }
                    p { "{tr(lang, \"Odds this spin\", \"Probabilidad en este giro\")}: {format_odds(winner_odds())}" }
                }
            }
        }
    }
}

pub(crate) fn render_spin_history_panel(lang: UiLang, history: &[SpinHistoryItem]) -> Element {
    rsx! {
        section { class: "panel",
            h2 { "{tr(lang, \"Spin History\", \"Historial de giros\")}" }
            if history.is_empty() {
                p { class: "muted", "{tr(lang, \"No spins yet.\", \"Aun no hay giros.\")}" }
            } else {
                ul { class: "history-list",
                    for entry in history.iter().take(10) {
                        li {
                            div {
                                strong { "{entry.display_name}" }
                                small { "{localize_source_chain(lang, &entry.sources)}" }
                                small { "{availability_summary(lang, &entry.source_ids, &[])}" }
                            }
                            span { "{format_odds(entry.odds)}" }
                        }
                    }
                }
            }
        }
    }
}

pub(crate) fn render_winner_overlay(
    lang: UiLang,
    mut show_winner_popup: Signal<bool>,
    display_spin: Signal<Option<SpinOperation>>,
    winner: &str,
    winner_sources: &str,
    winner_odds: f64,
) -> Element {
    let operation = display_spin();
    let availability = winner_availability(lang, winner, operation.as_ref());
    rsx! {
        if show_winner_popup() && !winner.is_empty() {
            div {
                class: "winner-overlay",
                onclick: move |_| show_winner_popup.set(false),
                div {
                    class: "winner-popup",
                    onclick: move |event| event.stop_propagation(),
                    div { class: "winner-glow" }
                    div { class: "winner-burst winner-burst-a" }
                    div { class: "winner-burst winner-burst-b" }
                    p { class: "winner-tag", "{tr(lang, \"Winner\", \"Ganador\")}" }
                    h3 { "{winner}" }
                    div { class: "source-chip-row",
                        for source in winner_sources.split('+') {
                            span {
                                class: "source-chip",
                                "data-source": source_chip_attr(source),
                                "{source_label_for_display(lang, source)}"
                            }
                        }
                    }
                    p { "{tr(lang, \"Sources\", \"Fuentes\")}: {localize_source_chain(lang, winner_sources)}" }
                    p { class: "muted", "{availability}" }
                    p { "{tr(lang, \"Odds this spin\", \"Probabilidad en este giro\")}: {format_odds(winner_odds)}" }
                    p { "{tr(lang, \"If it is available, give it a try.\", \"Si esta disponible, pruebalo.\")}" }
                    button {
                        onclick: move |_| show_winner_popup.set(false),
                        {tr(lang, "Nice", "Genial")}
                    }
                }
            }
        }
    }
}

fn source_chip_attr(source: &str) -> &'static str {
    match source.trim() {
        "SteamCharts" => "steamcharts",
        "SteamDB" => "steamdb",
        "TwitchMetrics" => "twitchmetrics",
        "Steam Import" => "steamImport",
        "Manual" => "manual",
        "Scanned" => "scan",
        _ => "unknown",
    }
}

fn source_label_for_display(lang: UiLang, source: &str) -> &'static str {
    match source.trim() {
        "SteamCharts" => tr(lang, "SteamCharts", "SteamCharts"),
        "SteamDB" => tr(lang, "SteamDB", "SteamDB"),
        "TwitchMetrics" => tr(lang, "TwitchMetrics", "TwitchMetrics"),
        "Steam Import" => tr(lang, "Steam Import", "Importacion Steam"),
        "Manual" => tr(lang, "Manual", "Manual"),
        "Scanned" => tr(lang, "Scanned", "Escaneado"),
        _ => tr(lang, "Unknown", "Desconocido"),
    }
}

fn start_spin(
    spin_pool: &[WeightedPoolGame],
    weighted_mode: bool,
    adaptive_recommendations: bool,
    adaptive_spin_weights: &[f64],
    wheel_labels: &[(f64, f64, String)],
    wheel_background: &str,
    spin_transition: &str,
    spin_duration_ms: f64,
    spin_jitter_ratio: f64,
    spin_revolutions: f64,
    mut wheel_rotation: Signal<f64>,
    mut spinning: Signal<bool>,
    mut display_spin: Signal<Option<SpinOperation>>,
    mut pending_spin: Signal<Option<SpinOperation>>,
    mut next_spin_id: Signal<u64>,
    mut winner: Signal<String>,
    mut winner_sources: Signal<String>,
    mut winner_odds: Signal<f64>,
    spin_history: Signal<Vec<SpinHistoryItem>>,
    manual_games: Signal<Vec<ManualGameRecord>>,
    played_ids: Signal<Vec<String>>,
    completed_ids: Signal<Vec<String>>,
    local_storage_error: Signal<Option<String>>,
    local_storage_blocked: Signal<bool>,
    show_winner_popup: Signal<bool>,
) {
    if spinning() || spin_pool.is_empty() {
        return;
    }

    let mut rng = rand::rng();
    let behavior_weighted = weighted_mode || adaptive_recommendations;
    let candidate_weights = if behavior_weighted && adaptive_spin_weights.len() == spin_pool.len() {
        adaptive_spin_weights
            .iter()
            .map(|weight| {
                if weight.is_finite() {
                    weight.max(0.0)
                } else {
                    0.0
                }
            })
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    let effective_weights = if candidate_weights.iter().sum::<f64>() > 0.0 {
        candidate_weights
    } else {
        vec![1.0; spin_pool.len()]
    };
    let winner_index = if behavior_weighted {
        pick_weighted_index(&effective_weights, &mut rng)
    } else {
        rng.random_range(0..spin_pool.len())
    };
    let next = spin_target_rotation(
        spin_pool.len(),
        winner_index,
        wheel_rotation(),
        spin_revolutions,
        spin_jitter_ratio,
        rng.random_range(0.0..1.0),
    );
    let operation_id = next_spin_id().wrapping_add(1);
    next_spin_id.set(operation_id);
    let operation = SpinOperation::new(
        operation_id,
        spin_pool,
        &effective_weights,
        winner_index,
        wheel_labels,
        wheel_background,
        spin_transition,
    );
    pending_spin.set(Some(operation.clone()));
    display_spin.set(Some(operation));
    winner.set(String::new());
    winner_sources.set(String::new());
    winner_odds.set(0.0);
    spinning.set(true);
    wheel_rotation.set(next);
    spawn(async move {
        let delay = spin_duration_ms.max(1200.0) as u64 + 450;
        sleep(Duration::from_millis(delay)).await;
        finalize_spin_result(
            operation_id,
            spinning,
            pending_spin,
            winner,
            winner_sources,
            winner_odds,
            spin_history,
            manual_games,
            played_ids,
            completed_ids,
            local_storage_error,
            local_storage_blocked,
            show_winner_popup,
            next_spin_id,
        );
    });
}

fn finalize_spin_result(
    expected_id: u64,
    mut spinning: Signal<bool>,
    mut pending_spin: Signal<Option<SpinOperation>>,
    mut winner: Signal<String>,
    mut winner_sources: Signal<String>,
    mut winner_odds: Signal<f64>,
    mut spin_history: Signal<Vec<SpinHistoryItem>>,
    manual_games: Signal<Vec<ManualGameRecord>>,
    played_ids: Signal<Vec<String>>,
    completed_ids: Signal<Vec<String>>,
    mut local_storage_error: Signal<Option<String>>,
    local_storage_blocked: Signal<bool>,
    mut show_winner_popup: Signal<bool>,
    next_spin_id: Signal<u64>,
) {
    let operation = {
        let mut pending = pending_spin.write();
        take_spin_result(&mut pending, expected_id)
    };
    let Some(operation) = operation else {
        return;
    };
    debug_assert!(operation.winner_index < operation.eligible.len());
    debug_assert_eq!(operation.effective_weights.len(), operation.eligible.len());
    let selected = operation.winner;

    spinning.set(false);
    winner.set(selected.display_name.clone());
    winner_sources.set(selected.sources.clone());
    winner_odds.set(selected.odds);

    let mut history = spin_history();
    history.insert(0, selected);
    if history.len() > 30 {
        history.truncate(30);
    }
    if !local_storage_blocked() {
        let next = DesktopLocalState {
            manual_records: manual_games(),
            history: history.clone(),
            played_ids: played_ids(),
            completed_ids: completed_ids(),
        };
        match save_desktop_state(&next) {
            Ok(()) => local_storage_error.set(None),
            Err(error) => local_storage_error.set(Some(format!(
                "Spin history could not be saved ({error}). The result is available until the app closes."
            ))),
        }
    }
    spin_history.set(history);

    show_winner_popup.set(true);
    spawn(async move {
        sleep(Duration::from_millis(3600)).await;
        if next_spin_id() == expected_id {
            show_winner_popup.set(false);
        }
    });
}
