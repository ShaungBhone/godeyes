# GodEyes viewer

The localhost viewer for [GodEyes](https://github.com/ShaungBhone/godeyes), built with Next.js, React Flow, and shadcn/ui using preset b7Br6guwa.

From the repository root:

```bash
bun run setup
bun run dev
```

The development server opens a static login demonstration. To display a reviewed source snapshot, run `bun run dev --report /absolute/path/to/report.json` from the repository root. Reports and runtime files stay in ignored `.local/` or an external task directory.

Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build` from the repository root. Browser tests require a live demo and run with `bun run test:e2e`.

For installation and skill usage, see the [project README](../../README.md).
