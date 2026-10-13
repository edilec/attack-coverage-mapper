# Local verification

Development and verification occurred on 2026-10-13 with Node v24.14.0 and npm 11.9.0. Node >=22 is the declared requirement; a Node 22 run is not claimed. Commits are current-dated local work. No push, PR, tag, release, registry publication, catalog edit or website edit was performed.

Product source is frozen at local commit `68997cf`. Its SHA-256 is `ba3b808d40a79e83096dbdce0c4af128748e17119406b2269154c533e734e398`: sort `src/*.mjs`, `bin/*.mjs` and `package.json` by relative path, then hash each UTF-8 path, NUL, exact file bytes, NUL. Later evidence/documentation changes do not alter these 13 files. [Check receipts](verification/checks.json) record the source fingerprint and actual gates.

| Executed gate | Result |
| --- | --- |
| `npm run check` with npm offline/update-notification settings | 169 passed, 0 failed, 0 skipped; syntax and complete suite |
| Affected contract/mapping/report/export/CLI checks after review fix | 86 passed, 0 failed, 0 skipped |
| JSON/report checks after adding quoted-prefix depth assertions | 18 passed, 0 failed, 0 skipped; product source unchanged |
| Offline `npm pack --ignore-scripts --offline --json` and extracted example/library smoke | Initial 27-entry package passed; final documentation-inclusive receipt is in checkout-only `tools/package-inspection.json` |

Tests preload active network denial, including every real CLI subprocess. Host-free controls verify the denial without opening a port. Product capability checks inspect all shipped source for network/process imports, fetch, dynamic import and code evaluation. No dependency installation, lockfile, node_modules, network fixture or product telemetry is used.

Package inspection compares every tar entry with the allowlist, checks bin/library/license/docs/examples and dependency/install-hook absence, then runs extracted examples under denial. Pass, fail and incomplete examples returned 0, 1 and 2 with matching report status; each coverage JSON equaled stdout. Parsed layers pinned the emitted 4.4 subset, Navigator 4.8.2 declaration and supplied synthetic 17.0 content version. Incomplete layers had no scores. The extracted library smoke passed. Owned archives, extractions and outputs were removed. The tarball receipt lives outside the package allowlist so its exact hash does not change the inspected artifact.

## Test-first development and review

Test-first cycles covered schemas, mapping, report status, exports, filesystem guards and the actual CLI. Observed regressions included overwritten collection findings, a detached default clock receiver, wrong deadline source role, dangling case-variant input materialization on this Mac, and empty stdout for a cyclic unreadable input. Each received a failing regression and a green affected run.

One fresh-context, read-only review covered `a48e502..7c6104d`. It found no Critical or Minor findings and one Important bug: malformed duplicate note declarations could leave the earlier reference resolvable, contaminating detection counts. Contract and CLI/artifact regressions failed first. The fix tracks safe own references before validating each note's remainder, makes all repeated references unusable, and preserves unrelated notes. Both declaration orders and malformed availability, prose and unknown keys are covered. The full 169-test check passed after the fix. There was one fix pass and no second review.

The review did not claim general STIX import, authenticated provenance, external note verification, forced timeout preemption, ancestor-race immunity, atomic exports, live Navigator compatibility or publication readiness. These are explicit scope choices and documented limitations.

## Mutation inventory and actual outcomes

`node tools/mutation-inventory.mjs` emits exact file, line, source span, original text and replacement. It enumerates literal severity/incomplete entries, balanced whole `if` conditions, throw/continue keywords, maximum-like comparisons in both directions, comparator sites and named semantic edits. This is a lexical inventory, not an AST-complete enumeration of every Boolean term. Comment-leading matches are excluded. A harness regression proves compound OR guards are neutralized as a whole. Initial partial sweeps and the earlier weaker guard operator are superseded and excluded below.

| Receipt | Scope | Outcomes |
| --- | --- | --- |
| [Frozen baseline](verification/mutation-baseline.json) | 330 mutations at `7c6104d` | 242 killed by owning selectors, 1 killed by compact selectors, 87 survived |
| [Contract retests](verification/mutation-contracts-retests.json) | All 47 mutations in the changed contract module | 46 killed, 1 survived |
| [Survivor retests](verification/mutation-survivor-retests.json) | All 80 other baseline survivors after gap tests | 29 killed, 51 survived |
| [Quoted-depth retests](verification/mutation-quoted-depth-retests.json) | Two string/depth mutations after targeted assertions | Both killed |
| [Final line-indexed inventory](verification/mutation-inventory.json) and [combined outcomes](verification/mutation-outcomes.json) | 331 current entries, source-identical already-killed receipts carried forward | 281 caught, 50 unproven; no invalid mutations or timeouts |

The combined record is not a new full 331-mutant execution. Every unchanged source file retained its exact baseline fingerprint. Changed contract source was fully retested; every prior survivor elsewhere was rerun. Each mutation used an owned disposable copy, restored source between cases, and preloaded network denial. Owning selectors ran first; silent candidates then ran all ten in-process behavior selectors. Real CLI subprocess and denial controls ran in the broad candidate check. A timeout would remain a timeout, never a kill.

Meaningful gap tests now cover malformed note/technique continuation, all unknown ID locations, evidence ordinal ordering, single-event mixed colors, wrong parser argument types/limits, quoted-prefix nesting, cooperative lexical checkpoints, unexpected error propagation, invalid artifact batches and exclusive creation after a regular file is planted following preflight.

All 50 survivors remain **unproven test gaps**; none is labeled equivalent without a proof. Their exact substitutions are in the combined table. Counts by file: contracts 1, exports 1, JSON 16, mapping 3, output 13, report 6, text 1, write guard 9. They include redundant/secondary checks, constrained-alphabet sort substitutions, defensive helper/fault paths, resource cleanup, read-growth and filesystem inspection/race paths. Passing fixtures does not prove these mutations harmless. No mutation percentage claims exhaustive coverage.

To reproduce the optional developer audit from a source checkout with Node on PATH and Python 3 available:

```sh
node tools/mutation-inventory.mjs > /tmp/coverage-mutations.json
python3 tools/run-mutation-audit.py --inventory /tmp/coverage-mutations.json --output /tmp/coverage-mutation-results.json
```

Python uses only its standard library and is not a product dependency. The developer runner and exact tarball receipt are intentionally absent from the distributed package.

## Implementation decisions and limits

The exact requested new repository on local `main` supplied isolation; no extra worktree was created. `analyzeReadResults` was implemented with mapping orchestration rather than postponed to the CLI task; this is an internal scheduling change. Missing/uninspectable case-variant target names are conservatively refused on all filesystems, at the cost of refusing a distinct missing case variant on a case-sensitive filesystem. Existing distinct files still use identity comparisons.

The `a-b/a0/aa` tactic fixtures are legal lexical controls, not English-collation discriminators: measured collation produced the same order. Real general comparator/metadata counterexamples use mixed case and underscore. Surviving constrained-alphabet sort mutations remain unproven.

Audit scope uses compact in-process selectors per mutant, with real subprocess checks on the candidate. Residual mutations are reported rather than represented as exhaustive assurance. The optional audit driver and machine-readable evidence were retained as developer materials. Broader fault/race assurance remains for a later audit.

Verification is local and offline. The normalized supplied subset, analyst-declared availability, unauthenticated supplied provenance, supplied-event coverage, unscored/omitted incomplete layers, cooperative deadline, no-overwrite behavior, non-atomic writes and operator-controlled-directory assumptions remain in force. No live Navigator UI, hosted CI, managed security-scan, registry or deployment result is claimed. MIT text and adapted JSON/destination-guard provenance retain Edilec attribution; fixtures are independently authored synthetic data.
