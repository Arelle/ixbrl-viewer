# Handover: calculations in the XbrlModel overlay

For the session that owns the viewer. Written 2026-08-29 by the session that
implemented summation-item calculations in the Arelle `XbrlModel` plugin, which
is the producer for everything below.

The short version: **basic calculation display already works** — this is not a
build-from-scratch task. The adapter maps summation-item networks onto the
viewer's existing `calc11` relationships, so the calculation inspector renders
them today. What is missing is that the viewer still applies plain
Calculations 1.1 semantics, and the XBRL Model calculation facility has since
grown four refinements it knows nothing about.

---

## 1. What already agrees — do not "fix" these

`xbrlModel/adapter.js` `buildNetworks()` already:

* classifies a network as calculation vs presentation and emits `arcrole`
  `"calc11"`, which matches `CALC11_ARCROLE` in `util.js`;
* carries `xbrl:weight` through as `rel.w` (defaulting to `1`);
* registers the network name as the ELR, with `roles` / `roleDefs` entries, so a
  calculation appears as its own group in the inspector.

`calculation.js` and `calculationInspector.js` are unmodified upstream code and
need no XbrlModel-specific changes to display a total and its contributions.

Measured on the demo taxonomy `demo-xbrl-model/aapl-10K-20250927.json`:
**96 networks, of which 23 are `xbrl:summation-item`, referenced by 5 cubes.**

## 2. What does not agree yet

### 2.1 Calculation networks are detected by heuristic, not by type

`buildNetworks()` decides a network is a calculation if *any* relationship
carries an `xbrl:weight` property:

```js
const isCalc = relationships.some(r =>
    (r.properties ?? []).some(p => p.property === "xbrl:weight"));
```

The model states this directly: `net.relationshipTypeName === "xbrl:summation-item"`.
On the demo taxonomy the two agree exactly (23 either way), so this is a
correctness tidy rather than a live bug — but the heuristic misclassifies a
summation-item network as *presentation* if its relationships lose their weights,
which is exactly what a taxonomy under repair looks like.

Prefer `relationshipTypeName`, falling back to the weight heuristic only if a
network omits it.

### 2.2 The viewer binds report-wide; the model scopes to a cube

This is the one that changes displayed results.

Under the XBRL Model proposal a calculation is checked **only against the facts
of a cube that lists its network in `cubeNetworks`**, which prevents a
calculation binding against facts in an unrelated part of the report. The viewer
has no notion of that: `calculationFacts()` calls
`report.getAlignedFacts(fact, ...)` over the whole report.

The conformance suite has a pair built precisely on this difference
(`CALCULATION-ValidSummationMultiEntityValue` and its `Invalid` twin): both
report the same wrong total for a second entity, and differ only in that the
Valid one puts that entity's facts in a cube carrying just the presentation
network. A report-wide viewer will show an inconsistency on the case the
processor calls valid.

The cube association is available in the model — `cube.cubeNetworks` names the
calculation networks — so the adapter can carry it; the viewer's binding then
needs to respect it.

### 2.3 Four control properties are not read

The proposal makes the parameters of a check properties of the model or network
rather than processor settings (§3). None reach the viewer:

| property | effect if ignored |
|---|---|
| `xbrl:roundingMode` (`roundToNearest` \| `truncation`) | truncated reports show spurious inconsistencies; the viewer always assumes round-to-nearest |
| `xbrl:tolerance` | a report whose framework allows slack shows inconsistencies the processor does not |
| `xbrl:summationRelation` (`equal` \| `atMost` \| `atLeast`) | an "of which" breakdown shows an inconsistency on **every** report |
| `xbrla:reconciliation` | display only — marks a relationship that deliberately crosses the debit/credit divide |

`xbrl:summationRelation` of `atMost` is the most visible: it is the of-which
case, where a total is followed by components known to be only part of it.

Precedence is relationship, then network, then model object, then the
specification default.

### 2.4 Recompute, or show the processor's verdict? — DECIDED: carry it

**Decided 2026-08-29: carry the processor's verdict.** The reasoning is not the
one this section originally offered.

The argument that settles it is temporal, and comes from how EDGAR works.
Validation happens **on receipt**; disseminated artifacts are then viewed without
revalidating. A viewer that recomputes is not producing a second opinion on the
same question — it is answering a *different* question, because standards, rules
and implementations change between the moment a filing was received and any later
moment it is read. The same report would show different results over time, with
nothing to say which reading was authoritative or when the difference appeared.

Duplication in a second language is the lesser reason, though it is real: adding
`summationRelation` alone meant re-deciding, in JS, interval-bound semantics that
`ValidateCalculations.py` had already settled and had conformance-tested against
66 of 68 suite variations. Tolerance, rounding mode and cube scoping are three
more of the same.

What this needs, which does not exist yet:

- **`SaveModel` emits per-binding results** — which binding, consistent or not,
  and the `oimtc:` code where not.
- **Provenance travels with them.** A carried verdict without a record of when it
  was produced, by what processor version, and against which rule set is no more
  interpretable than a recomputed one; the point of carrying it is to be able to
  say *this is what validation concluded, then*.
- **A fallback for a model that carries no results at all** — a locally built or
  hand-edited model. Showing nothing is honest; silently recomputing is not,
  because it would look identical to a carried verdict.

Consequence for §2.2: **cube scoping becomes a producer change, not a viewer
change.** The viewer stops deciding what binds and displays what the processor
decided, so §2.2's semantic gap closes on the Arelle side.

The remaining viewer work is display: render a carried verdict, distinguish
"validated, consistent", "validated, inconsistent — code", and "not validated",
and never present the third as either of the first two.

Where the workflow has to offer this as a step, see
`arelle/plugin/XbrlModel/HANDOVER-model-workflow.md` §5.

`calculation.js` reimplements Calculations 1.1 interval arithmetic in JS
(`interval.js`, `decimal.js`). The plugin now computes the same thing and reports
`oimtc:` codes. Two options:

1. **Keep recomputing**, and teach the JS the four properties plus cube scoping.
   Keeps the viewer standalone; duplicates semantics in a second language, which
   is where the two will drift.
2. **Carry the processor's result** into the model the viewer loads, and display
   it. No duplication, and the viewer then shows exactly what validation reported
   — but it needs the producer to emit per-binding results, which `SaveModel`
   does not do today.

The producer side has no opinion yet. Option 2 is less code in the viewer and
more in the plugin.

## 3. Producer-side state, for reference

Implemented in `arelle/plugin/XbrlModel/` on branch `hf-load-xbrl-model`:

| file | role |
|---|---|
| `ValidateNetworkObjects.py` | definition-time checks (proposal §5) |
| `ValidateCalculations.py` | binding and consistency checking (§6.2, §7) |
| `LoadLegacyTaxonomy.py` | legacy calculation linkbase → networks + all-facts cube (appendix B) |
| `resources/oimtc.json` | the 13 calculation error codes |

Its `README.md` §7 documents what is checked, the `--calcRoundingMode` run-time
override, and how to run the Calculations 1.1 conformance suite.

Status: the OIM taxonomy suite's 28 `CALCULATION-*` tests pass, and 66 of the 68
variations of the XBRL International Calculations 1.1 suite produce the specified
codes in both rounding modes.

Spec: `specifications/oim-taxonomy/summation-item-relationship-proposal.md` in
the `oim` repo, branch `spec-dev-1`. It is a **proposal**, not ratified — the
control properties and the `oimtc` namespace are declared in `core.json` /
`types.json` / `oimtc.json` on that branch but could still change. Its appendix C
lists what the working group has yet to settle, including how the tolerance
scales, which is why no tolerance boundary tests exist yet.

## 4. Suggested order

1. **§2.1**, five minutes, no behaviour change — switch to `relationshipTypeName`.
2. **§2.3 `summationRelation`**, because an of-which breakdown currently shows a
   false inconsistency on every report, and it is a pure adapter + display change.
3. **§2.4**, decide before doing §2.2 — the answer determines whether §2.2 is a
   viewer change or a producer change.
4. **§2.2**, the real semantic gap.
5. The remaining control properties.
