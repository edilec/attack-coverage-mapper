# Navigator export

The emitted subset follows the [official layer format 4.4](https://github.com/mitre-attack/attack-navigator/blob/master/layers/spec/v4.4/layerformat.md). Layers declare format 4.4, compatible Navigator 4.8.2, the supplied ATT&CK content version, and one supported domain. Tests parse generated layers and check every field the tool emits; they do not validate every possible third-party layer or claim live Navigator UI testing.

Each technique/tactic entry retains detected, not-detected, and unknown counts plus numeric activity and note ordinals. Omitted activity tactics expand to the supplied technique's tactics without changing global event totals. Parent/subtechnique events are never inferred from each other.

| Events | Color | Complete-run score |
| --- | --- | --- |
| Detected only | Green `#2e7d32` | 100 |
| Not-detected only | Red `#c62828` | 0 |
| Both known results | Purple `#6a1b9a` | Detected fraction, two decimals |
| Any unknown | Amber `#f9a825` | Omitted |

Score is `100 * detected / (detected + not-detected)`. All scores are omitted whenever the overall report is incomplete, even for rows containing only known events. Metadata states these definitions and report status. Unknown never contributes successful monitoring. A layer describes the supplied events, not all organizational detection capability.

An unusable dataset yields no layer: no version or domain is guessed. Valid dataset with incomplete activity evidence yields an explicitly incomplete unscored layer. No private prose/references, external links, custom data URL, or automatic parent aggregate score is emitted. The tool never downloads data or installs Navigator.
