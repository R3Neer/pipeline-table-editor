# Codex Notes

This folder keeps auxiliary Codex information separate from the publishable app.

The actual application lives in `../app/`.

Common commands:

```bash
cd app
npm install
npm run build
npm run test:unit
npm run test:integration
npm run test:smoke
```

Architecture guardrail:

```bash
cd app
npm run audit:file-sizes
```

The audit currently fails by design while `src/main.ts` and `src/styles.css` remain above the 500-line threshold. Keep that failure visible until those files are split or explicitly documented as exceptions.

Workflow rule:

- After each user request that Codex resolves with project changes, create an appropriate git commit before finishing the response.
- Keep architecture/refactor planning in `app/docs/refactor-plan.md`.
- For behavior-preserving refactors, run `npm run build`, `npm run test:unit`, `npm run test:integration`, and `npm run test:smoke` before committing.
