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

The audit is expected to pass. Treat files reported above the 300-line warning threshold as the next refactor-planning input.

Workflow rule:

- After each user request that Codex resolves with project changes, create an appropriate git commit before finishing the response.
- Keep architecture/refactor planning in `app/docs/refactor-plan.md`.
- For behavior-preserving refactors, run `npm run build`, `npm run test:unit`, `npm run test:integration`, and `npm run test:smoke` before committing.
