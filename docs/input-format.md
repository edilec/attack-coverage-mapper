# Closed input contracts, version 1

Both documents are strict UTF-8 JSON with unique keys. Unknown keys, unsupported roots, wrong primitive types, inherited-key substitutes, and bounds violations are incomplete evidence. No coercion, trimming, case folding, prose inference, schema guessing, or live lookup occurs. Sample JSON is under `examples/`; it is explicitly synthetic.

Dataset required own root fields: `schemaVersion:"1"`, `domain:"enterprise"|"mobile"|"ics"`, `version` (digits with optional dot/digits, at most 16 code units), `sourceUrl`, and `techniques` (1–5000 records). Each technique requires exactly `id`, `parentId`, `revoked`, `deprecated`, and `tactics`.

IDs match `^T[0-9]{4}(?:\.[0-9]{3})?$`. Parent IDs have `parentId:null`; a subtechnique must name its own prefix before the dot and that prefix must exist as a parent. Duplicate IDs and any unusable member/relationship invalidate the entire comparison index. Retired records can exist unused in the dataset; mapping to a revoked or deprecated record is incomplete.

Technique `tactics` contains 1–16 distinct slugs, each matching `^[a-z][a-z0-9-]{0,63}$`. Status fields are booleans. The operator supplies correct status/tactic facts: the mapper validates their structure and relations against the supplied subset, without independently authenticating the release.

Source URL is at most 512 code units, HTTPS, with no userinfo, query, fragment, encoded delimiters, control/format characters, or non-ASCII path syntax. Accepted source hosts/prefixes: `attack.mitre.org`, `raw.githubusercontent.com/mitre-attack/attack-stix-data/`, `github.com/mitre-attack/attack-stix-data/`. Prefix checks use exact host/path boundaries. URLs are recorded declarations and never fetched. SHA-256 hashes exact bounded source bytes, including whitespace; unknown bytes have a null digest. Unsupported/missing provenance remains incomplete.

Activities root requires exactly `schemaVersion:"1"`, boolean `inventoryComplete`, `sourceNotes`, and `activities`. False inventory completeness is incomplete; true with zero activity rows is also incomplete.

The note registry has at most 5000 records with required `ref` and boolean `available`; optional `note` is private prose of at most 4096 code units. References are exact nonblank strings, at most 128 code units, with no surrounding whitespace, control/C1/separator/bidi/format characters. Duplicate refs are ambiguous; none of their occurrences can resolve evidence. Availability means analyst-declared usable evidence, not a file-system or provider verification. Note prose and reference strings never leave the private compiled input.

Each of at most 5000 activity rows requires `sourceNoteRef`, `techniqueIds` (1–32 distinct IDs), and `detection:"detected"|"not-detected"|"unknown"`; optional `tactic` is one supported supplied tactic for every ID in that row. A reference must resolve uniquely to an available note. Validate every ID/status/tactic before mapping any ID in the row; a bad member skips the entire row's mapping and keeps the run incomplete. Parent and child are distinct declared mappings; neither infers the other.

Every row has its original one-based activity ordinal. Duplicate rows are separate declared events, not silently deduplicated. Global activity totals count a valid mapped row once; technique totals count each distinct declared ID once for that row. An omitted tactic expands only the display breakdown to each supplied tactic. All three detection counts and source ordinals survive aggregation.

Input bytes: 8,388,608 each. Container depth: 16 (root container is 1, scalars do not add depth). Nodes: 250000 (containers/scalars, root one, keys excluded). Other field/record limits above are inclusive; N is legal and N+1 is incomplete. Artifact bytes: 33,554,432 each. Injected monotonic deadline: 5000 ms inclusive, 5001 exceeded; backward/nonfinite/throwing clocks are incomplete. These fixed contracts have no CLI overrides or unknown config keys.
