# Contributing to WhatShouldIPlay

Thank you for contributing.

## Quick Start

1. Fork the repository.
2. Create a feature branch from `master`.
3. Make focused changes with tests/verification where applicable.
4. Run local checks.
5. Open a pull request using the provided template.

## Development Setup

### Web

```bash
npm install
npm run fetch:data
npm run ci:web
```

### Desktop

```bash
cd apps/desktop
cargo build
```

## Branch and Commit Guidelines

- Branch names: `feature/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- Keep pull requests small and single-purpose.
- Use imperative commit messages:
  - `feat: add winner overlay animation`
  - `fix: handle steamdb cloudflare fallback`

## Pull Request Expectations

- Explain what changed and why.
- Note user-visible behavior changes.
- Include screenshots or short recordings for UI changes.
- Mention any risks or follow-up work.
- Ensure CI checks pass.

## Coding Standards

- Follow existing project style and file structure.
- Prefer explicit names over clever shorthand.
- Keep logic testable and resilient to upstream data source changes.
- Avoid introducing breaking behavior without discussion.

## Reporting Bugs

Use the Bug Report issue template and include:

- Environment (OS, browser, Rust version if desktop)
- Reproduction steps
- Expected and actual behavior
- Logs or screenshots when relevant

## Feature Requests

Use the Feature Request template and include:

- Problem statement
- Proposed solution
- Alternatives considered
- Scope and impact

## Security

Please do not file public issues for vulnerabilities.
See [SECURITY.md](SECURITY.md) for disclosure guidance.

