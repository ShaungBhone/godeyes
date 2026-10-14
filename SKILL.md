---
name: godeyes
description: Trace and review JavaScript/TypeScript application behavior, including PHP backends, from repository code, then open source-backed flow diagrams in a localhost canvas. Use for visual code walkthroughs and feature-flow reviews; not for live execution tracing or changing application behavior.
---

# GodEyes

Produce a code-grounded app overview and one detailed feature flow, with review findings attached to the behavior they affect. The included Next.js viewer uses Dacoo-inspired cards and a vertical canvas.

## Input and discovery

Accept the repository path and requested feature. Use the current repository when it is clear; resolve its root and read applicable AGENTS.md instructions. If no repository is available, request its path. If no feature is named, inspect manifests and routes first, then offer concrete choices such as login, checkout, or an upload handler. Do not silently map an arbitrary feature.

Inspect source and existing tests with targeted searches. Prioritize actual entry points, imported functions, route handlers, service calls, and error handling. Do not execute the analyzed application or modify it. Exclude generated code, dependency directories, environment files, credentials, and unrelated private data from reports. Inspect a test as evidence of intended behavior, not proof that the application currently behaves that way.

## Trace and review

1. Summarize the app's purpose, framework, main entry points, and analysis boundaries.
2. Trace the chosen feature across UI, server, and service boundaries. Include conditions, asynchronous actions, merges, early returns, failure outcomes, and loops when present. Use short behavior-oriented labels rather than a diagram of every function.
3. Cite exact source ranges and excerpts for nodes and edges. Confirmed edges must cite code establishing the transition or branch, not merely both endpoint function names. State what remains inferred or unresolved; external systems whose source is unavailable are unresolved boundaries. Confidence means source support, not a runtime guarantee.
4. Review the traced code for concrete incorrect behavior or missing handling. For each finding include severity, trigger, impact, source evidence, and a suggested fix. Do not invent findings to fill a quota or label uncertainty itself as a bug. Empty findings are valid.
5. Keep the graph as reported behavior. Proposed fixes belong in findings; do not turn them into existing steps.

Read [the report contract](references/report-contract.md) before generating JSON. Use the report schema in `assets/viewer/lib/report.ts` as the exact wire format.

## Snapshot, validate, and open

Keep output and runtime outside the analyzed repository. Choose an existing writable workspace outside it; otherwise use a task-specific temporary directory. Never put reports in the target repo merely because it is the current directory.

Create snapshot metadata before reading the feature with:

```bash
python3 <skill-dir>/scripts/snapshot.py <repo-path> --output <output-dir>/snapshot.json
```

Use that metadata in `report.json`; store excerpts and their SHA-256 file hashes. Before launch, validate schema, graph references, excerpts, hashes, and snapshot freshness:

```bash
python3 <skill-dir>/scripts/validate_report.py <output-dir>/report.json
python3 <skill-dir>/scripts/launch.py <output-dir>/report.json --runtime <output-dir>/viewer
```

The launcher validates again, copies the reusable viewer without caches, installs locked dependencies, chooses an available loopback port starting at 3000, and serves the snapshot. Run it in a persistent terminal process and return the localhost URL. Use an available browser tool to inspect the result. Explain any unresolved analysis boundary and summarize meaningful findings.

The viewer cannot rerun an agent review. Refresh by invoking this skill again. It saves node positions and notes separately in browser storage and exports them with the immutable analysis report.

## Validation fixtures

For a local demonstration, run `scripts/make_demo.py --output <output-dir>/report.json`, then launch that report. The fixture is explicitly labeled as a demo and includes validation failure, credential rejection, service failure, and an unresolved external identity provider. It is source material only; do not execute it.
