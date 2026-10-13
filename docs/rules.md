# Stable findings

Severity and incompleteness come from one frozen catalog. Any incomplete rule forces exit 2; not-detected alone forces exit 1 on complete evidence. Unknown rule IDs are internal errors. A rule rename is breaking. Findings use fixed logical source roles and zero-based JSON Pointers; evidence uses one-based array ordinals. No private input strings are echoed.

| Rule ID | Severity | Incomplete | Observation |
| --- | --- | --- | --- |
| `input-unreadable` | warning | yes | The named input could not be read as a regular file. |
| `input-invalid` | warning | yes | The named input could not be decoded or parsed as supported strict JSON. |
| `limit-bytes-exceeded` | warning | yes | Limit bytes exceeded. |
| `limit-depth-exceeded` | warning | yes | Limit depth exceeded. |
| `limit-nodes-exceeded` | warning | yes | Limit nodes exceeded. |
| `dataset-invalid` | warning | yes | Dataset invalid. |
| `dataset-version-missing` | warning | yes | The supplied dataset has no usable content version. |
| `dataset-empty` | warning | yes | Dataset empty. |
| `limit-techniques-exceeded` | warning | yes | Limit techniques exceeded. |
| `dataset-id-duplicate` | warning | yes | Dataset id duplicate. |
| `dataset-parent-invalid` | warning | yes | Dataset parent invalid. |
| `activity-document-invalid` | warning | yes | Activity document invalid. |
| `limit-activities-exceeded` | warning | yes | Limit activities exceeded. |
| `limit-notes-exceeded` | warning | yes | Limit notes exceeded. |
| `no-activities` | warning | yes | No activities were supplied; this run checked no activity evidence. |
| `inventory-incomplete` | warning | yes | Inventory incomplete. |
| `note-evidence-incomplete` | warning | yes | The note declaration is missing, unusable, ambiguous, or unavailable. |
| `activity-invalid` | warning | yes | Activity invalid. |
| `technique-unknown` | warning | yes | Technique unknown. |
| `technique-revoked` | warning | yes | Technique revoked. |
| `technique-deprecated` | warning | yes | Technique deprecated. |
| `tactic-invalid` | warning | yes | Tactic invalid. |
| `detection-unknown` | warning | yes | Detection evidence for this activity is unknown. |
| `not-detected` | error | no | This supplied activity was reported not detected. |
| `no-mapped-activities` | warning | yes | No activity was mapped against usable technique and note evidence. |
| `analysis-timeout` | warning | yes | The injected five-second evaluation deadline was exceeded. |
| `analysis-clock-invalid` | warning | yes | The injected evaluation clock was invalid or moved backward. |
| `limit-export-bytes-exceeded` | warning | yes | Limit export bytes exceeded. |
| `output-unwritable` | warning | yes | Output unwritable. |
| `execution-failed` | warning | yes | Execution failed. |

Resolve input/limit/schema evidence at the located source field, supply analyst-confirmed IDs and available note declarations, and correct unsupported data before rerunning. Do not infer missing mappings. For not-detected, review the supplied detection observation. For output/clock/execution failures, correct the local operational condition and use a fresh output directory.
