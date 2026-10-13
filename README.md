# ATT&CK Coverage Mapper

Edilec's offline CLI maps **analyst-confirmed** activity and detection observations to a JSON coverage report, CSV summary, and ATT&CK Navigator layer. It preserves separate detected, not-detected, and unknown counts with source ordinals. It never infers technique IDs from notes or treats unknown detection as successful monitoring.

Requires Node.js 22 or newer. Zero runtime and development dependencies. No installation, network access, telemetry, detection-system connection, or downloaded ATT&CK data is required.

```sh
node bin/attack-coverage-mapper.mjs --help
node bin/attack-coverage-mapper.mjs --dataset examples/dataset.json --activities examples/pass.json --out-dir /tmp/attack-coverage-pass-output
```

Use a fresh output directory on each run; an existing reserved artifact is refused. Output paths may contain spaces. The examples use independently authored **synthetic** IDs, statuses, version and source declarations; they are schema fixtures, not official ATT&CK releases. Supply your own correctly prepared local subset and activity evidence for real work.

Stdout carries one catalog JSON report and a final LF. Stderr carries fixed usage, diagnostics, and a short human summary. Generated names are `coverage.json`, `coverage.csv`, and `navigator-layer.json`. Coverage JSON equals stdout when writing completes. CSV contains only safe technique IDs, counts, and numeric source ordinals.

| Exit | Meaning |
| ---: | --- |
| 0 | At least one mapped activity, complete evidence, no not-detected observations |
| 1 | Complete evidence and at least one not-detected observation |
| 2 | Incomplete evidence or execution failure; invalid configuration also exits 2 |

Invalid configuration, unsupported CLI layer version, and unsafe/existing output destinations leave stdout empty. Unreadable, undecodable, malformed, unsupported or incomplete inputs emit an incomplete report. An empty explicitly complete inventory is incomplete. Unknown dominates known policy failure.

The CLI accepts only `--dataset FILE`, `--activities FILE`, `--out-dir DIR`, optional `--layer-version 4.4`, and `--help` alone. It rejects unknown/duplicate options, missing values, positional paths and equals syntax. There is no config file, stdin fallback, overwrite flag, raw STIX adapter, or automatic format detection. See [exact input contracts](docs/input-format.md).

Source-note references resolve against the inline note registry's unique `available:true` entries. Availability is **analyst-declared**: the tool does not read note files or verify an external evidence system. Private prose and reference strings never enter the outputs. Findings use logical source roles `@dataset`, `@activities`, and `@output` with JSON Pointers; these refer to the exact files named at invocation. Event and note ordinals are one-based array positions; pointers are zero-based.

Dataset provenance records the supplied source URL/content version and SHA-256 of exact file bytes. `validationScope:"supplied-subset"` means membership and parent/status/tactic checks are against the supplied subset, not a downloaded full ATT&CK domain or authenticated origin. An unusable dataset produces coverage JSON/CSV without a guessed Navigator layer. A usable dataset with incomplete activity evidence produces an explicitly incomplete layer with all scores omitted. [Layer semantics](docs/navigator-format.md) describe the four colors and observed-event fraction scores.

Limits are inclusive: 8 MiB per input, 5000 techniques/activities/notes, container depth 16, 250000 JSON nodes, 32 IDs per activity, 16 tactics per technique, 128 code units per ref, 4096 per optional note, 16 per version, 512 per source URL, 64 per tactic slug, and 32 MiB per artifact. The injected evaluation deadline is five seconds, inclusive at 5000 ms. It is cooperative; blocked I/O or synchronous JSON parsing is checked after control returns rather than forcibly preempted.

The two operator-named input files may resolve through symlinks and are tracked by real path and identity. There is no input-tree crawl or advertised input-root confinement. Outputs stay beneath the real selected directory; final output-directory symlinks and any input path/symlink/hard-link aliases are refused. A missing input target whose filename differs only by case from a reserved output in the same real directory is conservatively refused on every filesystem. Existing distinct files still use identity comparisons. Files are created exclusively with mode 0600 and never replace existing files. Preflight can create a safe empty output directory before refusal. Multi-file writes are not atomic: a later I/O/deadline failure can leave partial **new** outputs. Use the terminal report/exit result before trusting that export and retry in a fresh directory. [Security boundaries](docs/security.md) include the operator-controlled-directory assumption.

```js
import { readFile } from 'node:fs/promises'
import { analyze, createBudget, exitCodeFor } from 'attack-coverage-mapper'
const report = analyze({
  datasetBytes: await readFile('attack.json'),
  activityBytes: await readFile('activities.json'),
  budget: createBudget(() => performance.now())
})
console.log(report.status, exitCodeFor(report))
```

The pure library analyzes byte buffers and writes no files. The CLI uses a bounded regular-file reader before calling it. Public exports also include `TOOL_ID`, `serializeReport`, and `formatSummary`.

```sh
npm run lint
npm test
npm run check
```

Tests preload active network denial, including all CLI subprocesses; host-free controls verify that denial without opening a port. No package installation or network fixtures are used. [Rules](docs/rules.md) document stable findings; [verification](docs/verification.md) records measured local evidence.

Non-goals: automatic technique inference, red-team execution, attribution, live detection lookup, whole-domain coverage claims, and claims that a missing event proves a monitoring system cannot detect a technique. MIT licensed; source includes adapted local Edilec JSON and destination guards with retained provenance.
