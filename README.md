# Repo Flow Canvas

A source-backed code review skill and localhost behavior-diagram viewer. Built with Bun, Next.js, React Flow, and shadcn sidebar-07 using preset b7Br6guwa.

## Start development

```bash
bun run setup
bun run dev
```

The default view is a static login fixture. The application under review is never executed. The development server binds to 127.0.0.1 and chooses the first available port starting at 3000. Edit `assets/viewer` for immediate Next.js hot reload.

To view a reviewed repository snapshot:

```bash
bun run dev --report /absolute/path/to/report.json
```

## Repository layout

- `assets/viewer/`: Next.js viewer source, locked dependencies, unit tests, and browser checks.
- `SKILL.md` and `agents/`: reusable agent skill instructions and metadata.
- `scripts/`: source snapshots, demo generation, report validation, launch/install helpers, and development startup.
- `references/`: report contract.
- `.local/`: ignored development report generated on startup.

## Checks

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

Browser checks run against a live demo via `bun run test:e2e`. On macOS with installed Chrome, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`. Set `REPO_FLOW_URL` if the viewer is running on another port.

## Use the skill

In Codex: `Use $repo-flow-canvas to review /path/to/repo and diagram its login flow.` The globally installed skill remains available independently of this source project. This repository includes the complete editable package.

## Canvas controls

The sidebar starts as a compact icon rail; toggle it from the header or with Cmd/Ctrl+B. The 36px view row switches between Canvas, Findings, and Overview. Select a step or connection for source evidence, add notes in the inspector, and export the report with annotations. Snapshot details are in Overview.
