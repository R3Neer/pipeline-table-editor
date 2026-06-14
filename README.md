# Pipeline Table Editor

A static web editor for instruction-time pipeline tables.

The app helps draw and document pipeline tables: fast cell editing, visual stage validation, crossed-out cells, row labels, visual row separators, forwarding arrows, JSON import/export, Markdown/plain-text export, and local persistence with `localStorage`.

It is not a pipeline simulator: it does not calculate hazards, CPI, conflicts, or insert stalls automatically.

## Screenshot

<p align="center">
  <img src="./app/docs/screenshots/editor-overview.png" alt="Pipeline Table Editor overview">
</p>

Additional screenshots:

- [Context menu](./app/docs/screenshots/context-menu.png)
- [Export menu](./app/docs/screenshots/export-menu.png)
- [Validation and autocomplete](./app/docs/screenshots/validation-and-autocomplete.png)

## Local Usage

On Windows, open the app with a double click:

```text
OPEN_PIPELINE_EDITOR.bat
```

That file installs dependencies if needed, starts Vite, and opens `http://127.0.0.1:5173/` in the browser.

Manual usage:

```bash
cd app
npm install
npm run dev
```

To create a deployable static build:

```bash
npm run build
```

The output is written to `dist/` and can be published to GitHub Pages.

## Structure

- `OPEN_PIPELINE_EDITOR.bat`: launcher for opening the app with a double click on Windows.
- `app/`: web app source code, Vite configuration, and tests.
  - `app/src/main.ts`: application entry point and event wiring.
  - `app/src/core/`: data model, state normalization, labels, stage parsing, validation, autocomplete, arrow, row, selection, and expansion rules.
  - `app/src/ui/`: DOM helpers, split-table scrolling/layout, autocomplete menu rendering, floating positioning, arrow drawing, and download helpers.
  - `app/src/export/`: Markdown/text/JSON and PNG export code.
  - `app/src/styles.css`: application styles.
  - `app/tests/`: browser smoke tests.
- `codex/`: auxiliary notes for Codex work.
- `README.md` and `LICENSE`: public project documentation.

See [`app/docs/architecture.md`](./app/docs/architecture.md) for module diagrams, class diagrams, and sequence diagrams.

## Scripts

- `npm run dev`: local Vite server.
- `npm run build`: TypeScript check and static build.
- `npm run preview`: previews `dist/`.
- `npm run screenshots`: regenerates documentation screenshots.
- `npm run test:unit`: fast unit tests for domain rules.
- `npm run test:smoke`: browser smoke test.

## Cell Format

Valid stage roots are `IF`, `ID`, `EX`, `MEM`, and `WB`.

Accepted formats:

- `ROOT`
- `ROOTp`
- `ROOTn`, where `n` is a positive integer
- `ROOTnp`, when allowed by the previous numbered stage

Invalid cells are marked visually, but the app does not block editing.

## Row Notes

Right-click an instruction row to add or remove a row label, toggle a visual separator above the row, or use the `Edit` submenu for `Clear`, `Copy`, `Cut`, and `Paste` on the instruction text.

Instruction rows support multi-selection with `Shift` and `Ctrl`/`Cmd`. Row move and delete buttons apply to the selected block. Cell selections and instruction-row selections are mutually exclusive.

Labels and separators are manual annotations. They are exported in JSON, Markdown, plain text, and PNG, but they do not add control-flow simulation or branch validation.

## Release

Initial GitHub-ready version: `v0.1.0`.

GitHub Pages is deployed automatically when a GitHub release is published. The
workflow builds `app/dist/` and publishes it as the Pages site. In the
repository settings, set **Pages > Build and deployment > Source** to
**GitHub Actions**.
