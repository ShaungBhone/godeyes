# GodEyes

See how your code works.

GodEyes turns repository code into interactive flow diagrams, with source evidence, confidence labels, and review findings. It supports JavaScript/TypeScript applications, including PHP backends, and runs the viewer on localhost. Built with Bun, Next.js, React Flow, and shadcn.

## Install and use

Install Python 3.9+ and Bun, then clone this repository and install the skill:

```bash
git clone https://github.com/ShaungBhone/godeyes.git
cd godeyes
python3 scripts/install.py
```

The installer copies the skill and viewer template into `~/.agents/skills/godeyes`, the [personal skills location used by Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). Use `--destination` to choose another location. It excludes dependencies, local reports, caches, and development-only skill files, and leaves an existing installation untouched.

In a Codex chat opened on the repository you want to review, ask:

```text
Use $godeyes to trace and review this repository's login flow.
```

Replace `login flow` with the feature you want to understand. The skill reads the source, creates a report with evidence and findings, and opens a localhost canvas. It resolves its own bundled scripts and viewer; users do not need to reference a developer's filesystem path or find `SKILL.md` themselves.

The analyzed application is never executed or modified. After changing its code, invoke the skill again for a fresh snapshot.

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

## Canvas controls

The sidebar starts as a compact icon rail; toggle it from the header or with Cmd/Ctrl+B. The 36px view row switches between Canvas, Findings, and Overview. Select a step or connection for source evidence, add notes in the inspector, and export the report with annotations. Snapshot details are in Overview.

## License

GodEyes is released under the [MIT License](LICENSE).
