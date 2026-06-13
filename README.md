# Pipeline Table Editor

A static web editor for instruction-time pipeline tables.

The app helps draw and document pipeline tables: fast cell editing, visual stage validation, crossed-out cells, forwarding arrows, JSON import/export, Markdown/plain-text export, and local persistence with `localStorage`.

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
  - `app/src/core/`: data model, state normalization, stage parsing, validation, selection, and expansion rules.
  - `app/src/ui/`: DOM helpers, autocomplete UI, arrow drawing, and download helpers.
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
- `npm run test:smoke`: browser smoke test.

## Cell Format

Valid stage roots are `IF`, `ID`, `EX`, `MEM`, and `WB`.

Accepted formats:

- `ROOT`
- `ROOTp`
- `ROOTn`, where `n` is a positive integer
- `ROOTnp`, when allowed by the previous numbered stage

Invalid cells are marked visually, but the app does not block editing.

## Release

Initial GitHub-ready version: `v0.1.0`.
