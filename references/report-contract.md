# Report contract, version 1

Use `assets/viewer/lib/report.ts` as the exact schema. Reports are JSON, not executable JavaScript.

- `schemaVersion`: 1.
- `repository`: metadata from `scripts/snapshot.py` (`name`, absolute `path`, nullable `revision`, `dirty`, `snapshotId`, `capturedAt`, `fingerprint`). Non-Git repos are supported. Fingerprints cover visible files except dependency/build directories and secret files.
- `overview`: `summary`, `stack`, and `entryPoints` (each with `label` and evidence).
- `flows`: one deeply analyzed flow per invocation, with `id`, `title`, `description`, `nodes`, and `edges`.
- Node: unique `id` within its flow, `title`, `description`, `kind` (`entry`, `action`, `decision`, `external`, `outcome`), `confidence` (`confirmed`, `inferred`, `unresolved`), `symbol`, and `evidence`.
- Edge: unique `id`, `source`, `target`, `label`, `branch` (`normal`, `true`, `false`, `error`), `confidence`, and `evidence`. Both endpoints must exist. Branch labels describe actual conditions.
- Evidence: repository-relative `file`, positive `startLine` and `endLine`, exact `excerpt` for that inclusive range, and whole-file SHA-256 `fileHash`. Do not cite outside-repo symlinks. Confirmed nodes and edges require at least one citation.
- `findings`: `id`, `flowId`, nonempty `nodeIds`, `title`, `severity` (`high`, `medium`, `low`), `trigger`, `impact`, `suggestion`, and nonempty `evidence`.
- `limitations`: explicit boundaries and missing information; an empty list is permitted.

Use stable IDs derived from behavior and source symbols. Keep JSON serializable; no callbacks or React Flow objects. Positions, notes, and the viewport are viewer annotations keyed by snapshot and flow ID.

`GET /api/report` reads only the report specified by the launcher's environment. It accepts no HTTP file-path parameter. Missing or invalid reports produce a useful error. Source excerpts are embedded; the browser never reads arbitrary repository files.

Reports are snapshots. If repo files change during analysis, regenerate. The UI shows revision, dirty status, and timestamp without claiming live execution.
