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

## Non-goals for this phase

- No wholesale migration to Material UI or Tailwind component kits.
- No Storybook adoption.
- No visual redesign reset; tokens remain the source of truth.
