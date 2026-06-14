# Large Refactor Plan

This document is the working plan for the next architecture refactor of Pipeline Table Editor.

The goal is not to reduce line counts for their own sake. The goal is to use size as an early warning that a file may be mixing responsibilities, hiding domain rules in presentation code, or making future validation/autocomplete/UI changes harder than they should be.

## File Size Policy

- Files over 100 lines should be reviewed for responsibility boundaries.
- Files over 300 lines should have a clear reason to stay large or a planned split.
- Files over 500 lines are considered priority architecture debt unless they are generated files, data fixtures, or another documented exception.

The automated audit applies to code, style, and test files under `src/`, `tests/`, and `scripts/`. Documentation can be long when it is acting as reference material; it should still be organized with clear sections.

Allowed code exceptions must explain why the file is large and what would make it safe to split later.

## Current Hotspots

| File | Current concern | Direction |
| --- | --- | --- |
| `app/src/main.ts` | Application coordinator still owns rendering, editing flows, menus, labels, and event wiring. | Continue extracting cohesive `app/` controllers and view helpers. |
| `app/src/styles.css` | Global stylesheet mixes table, layout, menus, modals, export panel, and visual states. | Split by visual domain while preserving selectors and UX. |
| `app/tests/browser-smoke.ts` | One large scenario file mixes browser setup, helpers, and many behavioral scenarios. | Split into smoke runner, app driver, fixtures, and scenarios. |
| `app/src/core/autocomplete.ts` | Autocomplete mixes providers, ranking, stage progression, history, and numbering rules. | Introduce small providers and ranking functions. |
| `app/src/export/image.ts` | PNG export mixes metrics, rendering, theme, text drawing, cells, and arrows. | Split into layout, drawing, theme, and orchestration modules. |
| `app/src/core/validation.ts` | Still manageable, but new validation rules will make it grow quickly. | Prepare rule-level modules before adding more rules. |
| `app/src/ui/dom.ts` | DOM lookup and assembly highlighting were mixed. | Keep DOM lookup separate from presentation helpers. |

## Refactor Phases

1. Create a clean checkpoint from the current controller extraction.
2. Add a file-size audit script so oversized files are visible during refactors.
3. Keep thinning `main.ts`:
   - `cellEditingController`
   - `rowEditingController`
   - `contextMenuController`
   - `labelModalController`
   - `tableRenderer` or `tableView`
   - `eventWiring` or `appBootstrap`
4. Split `styles.css` into visual domains without changing visible behavior.
5. Split autocomplete into provider/ranking modules.
6. Split PNG export into layout/render/theme/orchestration modules.
7. Split tests by contract and scenario.
8. Update README, architecture docs, and release notes after each stable phase.

## Multi-Agent Team

Use agents only with explicit ownership boundaries. Each agent should work on a narrow path set and avoid broad drive-by edits.

| Agent | Responsibility | Write scope |
| --- | --- | --- |
| Lead integrator | Keeps contracts coherent, merges work, runs full verification, owns commits. | Any touched file during final integration. |
| Architect reviewer | Reviews SOLID boundaries, circular dependencies, and useful patterns. | Docs or review notes only unless asked otherwise. |
| App coordinator agent | Extracts controllers and reduces `main.ts`. | `app/src/main.ts`, `app/src/app/`, app-controller tests. |
| UI agent | Splits presentation helpers and styles. | `app/src/ui/`, `app/src/styles*.css`, UI-focused tests. |
| Core agent | Splits autocomplete and validation rules. | `app/src/core/`, core tests. |
| Export agent | Splits JSON/text/Markdown/PNG export internals. | `app/src/export/`, export tests. |
| Test agent | Splits and strengthens unit, integration, and smoke coverage. | `app/tests/`, test utilities. |
| Docs/release agent | Updates public docs and prepares release notes. | `README.md`, `app/docs/`, release notes. |

## Commit Policy

Commit small, reviewable slices. A commit should usually fit one of these categories:

- `docs: ...` for planning, architecture notes, and release notes.
- `test: ...` for coverage changes that do not alter production code.
- `refactor(app): ...` for controller and coordinator changes with no behavior change.
- `refactor(core): ...` for domain-rule decomposition with no behavior change.
- `refactor(ui): ...` for presentation/helper/style decomposition with no behavior change.
- `refactor(export): ...` for export internals with unchanged output formats.
- `chore: ...` for scripts, tooling, and repository maintenance.

Every non-doc commit should preserve:

- No persisted `AppState` model changes unless explicitly planned.
- No import/export JSON format changes.
- No visible UX or text changes unless explicitly documented.
- No `core/` dependency on DOM, `ui/`, `integration/`, `export/`, or `app/`.
- Passing `npm run build`, `npm run test:unit`, `npm run test:integration`, and `npm run test:smoke` before merging a phase.

When a phase is large, prefer this sequence:

1. Add or adjust tests around the current behavior.
2. Extract one responsibility.
3. Run the nearest tests.
4. Update docs if the architecture boundary changed.
5. Commit.
