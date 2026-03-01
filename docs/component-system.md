# Component System Strategy

Last updated: 2026-03-01

## Decision

WhatShouldIPlay adopts **Radix UI primitives + project design tokens** as the component system baseline for the web app.

## Chosen stack

- Accessibility-first behavior primitives: `@radix-ui/react-*`
- Visual language: existing tokenized CSS (`src/styles.css`)
- Composition style: app-specific wrapper patterns and feature components

## Why this was selected

- Keeps current brand/look intact without forcing a full visual framework rewrite.
- Improves accessibility semantics and interaction reliability for complex controls.
- Works incrementally inside the current codebase while `App.tsx` is being componentized.

## Initial adoption (implemented)

- Workspace navigation now uses Radix Tabs.
- Advanced options disclosure now uses Radix Accordion.

## Next migration targets

- Dialog and popover primitives (winner modal/help interactions).
- Form controls with shared wrappers (consistent labels/help/errors).
- Extracted feature modules (`Play`, `Library`, `History`, `Settings`) consuming a shared component layer.

## Non-goals for this phase

- No wholesale migration to Material UI or Tailwind component kits.
- No visual redesign reset; tokens remain the source of truth.
