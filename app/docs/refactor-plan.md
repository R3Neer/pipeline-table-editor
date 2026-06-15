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
| `app/src/core/validation.ts` | Still manageable, but new validation rules will make it grow quickly. | Prepare rule-level modules before adding more rules. |

Recently resolved hotspot:

- `app/src/ui/dom.ts` no longer mixes DOM lookup with assembly highlighting. Assembly presentation now lives in `app/src/ui/assemblyHighlight.ts`.
- `app/tests/browser-smoke.ts` has been split into a smoke runner, browser app harness, editor driver, assertion helpers, and focused scenario files under `app/tests/smoke/`.
- `app/src/main.ts` no longer owns context-menu visibility/action dispatch or row-label modal state; those live in `app/src/app/contextMenuController.ts` and `app/src/app/labelModalController.ts`.
- `app/src/main.ts` no longer owns instruction-row add/remove/move/edit actions or row clipboard state; those live in `app/src/app/rowEditingController.ts`.
- `app/src/main.ts` no longer owns stage-cell handlers, keyboard navigation, autocomplete acceptance, simple cell actions, or cell clipboard state; those live in `app/src/app/cellEditingController.ts`.
- `app/src/app/cellEditingController.ts` no longer owns simple cell action implementation or clipboard state; those live in `app/src/app/cellActionController.ts`.
- `app/src/main.ts` no longer owns bulk table workflows, global event binding, textarea resize binding, or small table DOM helpers. Those live in `app/src/app/tableWorkflowController.ts`, `app/src/app/appEventBindings.ts`, `app/src/ui/instructionColumnWidth.ts`, and `app/src/ui/tableElements.ts`.
- `app/src/styles.css` has been split into visual-domain stylesheets under `app/src/styles/`, with the original file kept as the import entrypoint.
- `app/src/core/autocomplete.ts` is now a facade. Provider rules, ranking, context, history, row-number analysis, validation, and shared types live in focused `app/src/core/autocomplete*.ts` modules.
- `app/src/export/image.ts` is now a PNG export facade. Metrics, theme, primitives, text drawing, table drawing, and arrow drawing live in focused `app/src/export/image*.ts` modules.
- `app/src/main.ts` no longer renders the table directly or owns selection-to-DOM refresh logic. Table rendering lives in `app/src/app/tableRenderer.ts`; selection UI refresh coordination lives in `app/src/app/selectionUiController.ts`.
- `app/src/app/cellEditingController.ts` no longer owns keyboard navigation or autocomplete acceptance. Those live in `app/src/app/cellKeyboardController.ts`.
- `app/src/app/arrowAndExpansionController.ts` is now a facade over `app/src/app/arrowDraftController.ts` and `app/src/app/expansionDraftController.ts`.
- `app/src/app/tableRenderer.ts` no longer owns inline instruction editor rendering. That lives in `app/src/app/instructionEditorRenderer.ts`.
- `app/src/app/contextMenuController.ts` is now a facade over `app/src/app/cellContextMenuController.ts` and `app/src/app/rowContextMenuController.ts`.

## Current Audit Status

`npm run audit:file-sizes` is currently expected to pass, with warnings for files over 300 lines. Those warnings keep the largest remaining architecture debt visible while the refactor is underway.

Known `>500` files: none.
Known `>300` warnings: none.

## Refactor Phases

1. Done: create a clean checkpoint from the current controller extraction.
2. Done: add a file-size audit script so oversized files are visible during refactors.
3. Done for the current `>500` guardrail: keep thinning `main.ts`:
   - `cellEditingController`
   - `rowEditingController`
   - `contextMenuController`
   - `labelModalController`
   - `tableRenderer` or `tableView`
   - `eventWiring` or `appBootstrap`
4. Done: split `styles.css` into visual domains without changing visible behavior.
5. Done: split autocomplete into facade, provider, ranking, context, history, row-analysis, validation, and type modules.
6. Done: split PNG export into layout, theme, primitive drawing, text, table, arrow, and orchestration modules.
7. In progress: split tests by contract and scenario. The browser smoke test is now split; `core.test.ts`, `integration.test.ts`, and screenshot capture can still be reviewed later.
8. Update README, architecture docs, and release notes after each stable phase.

The recommended next phase is a qualitative review of the remaining files over 100 lines. Files in the 100-300 range are not automatically debt, but they should be checked for mixed responsibilities before the refactor loop is considered complete.

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
