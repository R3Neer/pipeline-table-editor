# Codex Notes

This folder keeps auxiliary Codex information separate from the publishable app.

The actual application lives in `../app/`.

Common commands:

```bash
cd app
npm install
npm run build
npm run test:smoke
```

Workflow rule:

- After each user request that Codex resolves with project changes, create an appropriate git commit before finishing the response.
