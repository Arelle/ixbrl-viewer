# Handover: derived content in the XbrlModel overlay

For the session that owns the viewer. Written 2026-08-30 by the session that
implemented derived content in the Arelle `XbrlModel` plugin, which is the
producer for everything below.

The short version: a compiled model the plugin saves now carries a
**`derivedContent`** object beside `documentInfo` and `xbrlModel`. It holds what
processing computed rather than what the filer reported — the resolved fact
values, which facts fall in which cube, and the calculation verdicts. The
adapter reads none of it yet.

Spec: `oim-taxonomy-derived.md` in the `oim` repo (branch `spec-dev-1`), with
`oim-taxonomy-derived-schema.json` beside it. Still a PWD; expect a few weeks of
working-group discussion before the shapes settle.

---

## 1. Why it is beside the model rather than in it

Processing a model produces content the filer did not report. Merging it into
the model makes it indistinguishable from what was reported; publishing it
separately breaks its binding to the model it describes. `derivedContent` is the
third option — same document, not part of the model.

The distinction that matters to a viewer is between two kinds:

* **Derivable content** — the model already implies it and any processor can
  compute it. Where it is absent, derive it. `cubeContents`, and a fact value
  with a `basis` of `resolved`.
* **Non-derivable content** — a record of something a processor did, which
  cannot be reproduced from the model. Where it is absent, a consumer **MUST
  NOT** present its own computation as though it were the absent content.
  `calculationResults`, and a fact value with a `basis` of `bound`.

That last rule is the one this handover exists to convey, and §4 below is what
it means in practice.

## 2. What the plugin emits today

```json
"derivedContent": {
  "derivation": {
    "derived": "2026-08-30T17:41:05Z",
    "processor": "Arelle 2.x / XbrlModel plugin",
    "ruleSets": ["oimte", "oimce", "oime", "oimtc"]
  },
  "factValues":  [ { "factValueName": "ex:F_bc50…_fv",
                     "basis": "resolved", "value": "FY" } ],
  "cubeContents":[ { "cubeName": "msft:group_…_Cube",
                     "facts": ["ex:F_7f96…"] } ],
  "calculationResults": [ {
      "cubeName": "msft:allFactsCube",
      "networkName": "msft:group_…Detail2_CalcNet",
      "total": "us-gaap:DeferredTaxAssetsLiabilitiesNet",
      "aspects": { "xbrl:period": "2025-07-01T00:00:00",
                   "xbrl:entity": "cik:0000789019",
                   "xbrl:unit": "iso4217:USD" },
      "consistent": false,
      "code": "oimtc:inconsistentCalculationUsingRounding",
      "calculated": "[-2835500000, -2834500000]",
      "reported":   "[26272500000, 26273500000]" } ]
}
```

Measured on Microsoft's FY2025 10-K: 1,827 derived fact values, 113 cube
contents over 4,569 (cube, fact) pairs, and **184 calculation results — 163
consistent, 21 not**. The 21 are exactly the inconsistencies the processor
reports as `oimtc:` errors; the 163 are the ones nothing reports today, and are
the reason to carry results rather than only errors.

## 3. One producer change that affects the adapter now

**In `full` and `prune` modes a fact no longer carries a `value` where the value
was derived.** A fact whose `factValues` have `valueSources` and no `value` is
stating that the document is the point of truth; validation resolves it, but the
resolved value is the processor's, so it is now published in
`derivedContent.factValues` and the fact stays in its faithful form.

**This is already handled** — the surfaces reconstruct from document text for a
Form A fact, which is the same path the `saveOIMFacts` factsets have always
taken. Verified on the Microsoft filing: identical binding before and after
(2,092 overlay elements, values rendering as `FY`, `false`, `0000789019`).

`report` mode is unchanged and still emits Form B (`value` + `valueAnchors`),
and deliberately omits `factValues` from derived content so the same value is
not stated twice. If the adapter starts reading `derivedContent.factValues`,
`report` mode's tailoring becomes redundant and can be retired — that is the
migration, not a requirement.

## Status, 2026-08-30 (viewer session)

4.1 and 4.2 are implemented; 4.3 is not started.

* `derivedContent.js` reads `calculationResults` and `cubeContents`.
  `Report.calculationVerdict()` and `ReportSet.cubeFactsIndex()` expose them;
  the inspector shows the carried verdict with its `derivation`.
* Verified against Microsoft's FY2025 10-K (183 results, 113 cube contents):
  every result is reachable from its own fact aspects, and the panel renders
  consistent, inconsistent and not-validated distinctly, with no local
  arithmetic in the not-validated case.
* **One correction to §4.1's matching rule.** Comparing on "the aspects the
  result states" is a subset test, and on a dimensional report several results
  describe one fact at once: Microsoft carries verdicts on the un-dimensioned
  total, the asset-class total and the fully dimensioned one. Taken as equal
  candidates, 11 of the 183 looked like disagreements when nothing disagreed.
  The rule needs a tiebreak — the viewer takes the most specific match, treating
  a result that constrains fewer aspects as a verdict on a different binding
  rather than a looser opinion on this one. Worth stating in the spec.

## 4. What to build, in the order I would do it

### 4.1 Read `calculationResults` instead of recomputing — the reason this exists

`HANDOVER-calculations.md` §2.4 decided to carry the processor's verdict rather
than recompute in JS, and this is the artifact that makes it possible. The
inspector should display what the model says validation concluded.

Three states must stay distinguishable to the reader, and the third is the one
that is easy to get wrong:

| state | how to tell | what to show |
|---|---|---|
| validated, consistent | a result with `consistent: true` | consistent, with its provenance |
| validated, inconsistent | a result with `consistent: false` and a `code` | the inconsistency and the code |
| **not validated** | **no result for that binding** | **say so — never a locally computed answer in the same place** |

A viewer that silently computes when the model carries no result puts its own
conclusion where the producer's would appear, and a reader cannot tell which
they are looking at. Showing nothing, or showing a local result plainly labelled
as local, both satisfy the requirement. The absence of a result for a binding
asserts neither consistency nor that anything was checked.

Match a binding on (`cubeName`, `networkName`, `total`, `aspects`). `aspects`
omits any aspect the binding does not constrain, so compare on the aspects
present rather than requiring equality of the whole set.

Show `derivation` wherever a verdict is shown. *This is what validation
concluded, then* is the whole claim; without when, by what, and under which rule
sets, a carried verdict is no more interpretable than a recomputed one.

### 4.2 Read `cubeContents` in place of deriving the fact-to-cube association

`adapter.js` `buildCubeFactIndex` (and its Arelle counterpart) derives this with
a dimensional match. Where `cubeContents` is present, use it; where absent,
derive as now — it is derivable content and carries no authority. This is the
one that most affects the Cubes panel on large filings.

### 4.3 Read `factValues` and retire the `report`-mode Form B tailoring

Lowest priority: the surfaces already reconstruct correctly without it. The gain
is that a value obtained by a transformation the viewer does not implement
(`ixt-sec:numwordsen`, and the fifteen others SEC defines) arrives already
resolved, instead of the surface falling back to raw document text.

## 5. What is not there yet

* **`basis: "bound"`** — a value bound to a location by hand, which is what the
  tagger produces. The plugin emits only `resolved`. Applying a tagging journal
  is the natural producer for `bound`, and is still unbuilt on the Arelle side
  (`HANDOVER-model-workflow.md` §4).
* **`sourceModelChecksum`** — specified, not emitted, because the compiled-model
  checksum mechanism it depends on is itself unsettled. Until it exists, derived
  content cannot be shown to be current for the model it accompanies; treat a
  mismatch you cannot detect as a known gap rather than a guarantee.
* **A schema the taxonomy schema admits.** `oim-taxonomy-schema.json` closes its
  document root, so a model carrying `derivedContent` fails it. Validate against
  `oim-taxonomy-derived-document-schema.json` instead, which re-declares the root
  and refers back to both schemas. Its relative `$ref`s follow the spec-repo
  layout and need adjusting wherever the files are bundled differently.
