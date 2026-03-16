# Component System Strategy

Last updated: 2026-03-05

## Decision

WhatShouldIPlay adopts **project design tokens + app-specific React feature components** as the current component system baseline for the web app.

## Chosen stack

- Visual language: tokenized CSS in [src/styles.css](c:/Users/Avery/Documents/PickAGame/src/styles.css)
- Composition style: app-specific feature components and controller hooks
- Accessibility model: semantic HTML, explicit ARIA wiring, focused utility components, and CI accessibility gates

## Why this was selected

- Keeps the existing visual identity without introducing a heavyweight UI framework.
- Supports incremental UX modernization while preserving current feature velocity.
- Reduces abstraction drift by documenting what the repo actually uses today.

## Initial adoption (implemented)

- Workspace navigation uses custom semantic tab buttons in the header.
- Advanced settings use project-owned disclosure/collapse patterns.
- `App.tsx` has been reduced to a thin shell that delegates to controller and feature modules.

## Next migration targets

- Shared form-field wrappers with consistent labels, help text, and status/error presentation.
- Stronger layout primitives for page stage, summary strips, and grouped settings sections.
- Better web/desktop parity through shared UI contracts and documented design tokens.

## Web/Desktop parity rules

- `Hero` remains the highest-contrast product surface in both targets and must contain brand kicker, current status, and primary utility actions.
- `Play stage` is the primary panel in both targets and uses elevated framing compared with surrounding panels.
- `Settings` default to hidden/collapsed so the first view is always content-first.
- `Settings sections` use the same three-way grouping model: `Sources`, `Rules`, `Advanced` on web; `Sources`, `Rules`, `Library` on desktop until advanced parity is completed.
- `Secondary panels` such as library/history should read quieter than the wheel stage through lower contrast and less decorative treatment.
- `Control language` should prefer segmented selectors, compact cards, and action rows over repeating pill buttons for every interaction.
- `Spacing rhythm` should preserve the same hierarchy: masthead spacing > panel spacing > control spacing.
- `Motion` should stay functional and celebratory, but never block input; reduced-motion handling is required on both targets.

## Reference examples

- Web masthead and workspace navigation: [src/features/layout/AppHeader.tsx](c:/Users/Avery/Documents/PickAGame/src/features/layout/AppHeader.tsx)
- Web play stage and winner flow: [src/features/play/PlayPanel.tsx](c:/Users/Avery/Documents/PickAGame/src/features/play/PlayPanel.tsx)
- Web token source of truth: [src/styles.css](c:/Users/Avery/Documents/PickAGame/src/styles.css)
- Desktop masthead, grouped settings, and wheel stage: [apps/desktop/src/main.rs](c:/Users/Avery/Documents/PickAGame/apps/desktop/src/main.rs)

## Non-goals for this phase

- No wholesale migration to Material UI or Tailwind component kits.
- No Storybook adoption.
- No visual redesign reset; tokens remain the source of truth.
