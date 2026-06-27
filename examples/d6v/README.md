# D6V — D6 Verifier

**D6V** is an Arelle iXBRL Viewer plugin that adds D6 digital signature
verification and display to inline XBRL reports.

*Target specification: Digital Signatures in XBRL 1.0 (D6), Candidate
Recommendation 2025-01-28.*

## What it does

- Adds a **Signature pane** inside the iXBRL Viewer inspector area
- Shows signature status summary and per-signature cards (valid ✅ /
  invalid ❌ / revoked ⛔)
- Displays a red tamper watermark when any signature is invalid, revoked,
  or unknown
- Click a signature to highlight the covered facts/elements in the report
- Verifies D6 digest chains (hash coverage of report files, taxonomy, and
  dependencies)
- Provides a **META-INF Inspector** — drawer and full-page views with
  package-structure graph, per-field explanations at three detail levels
  (Simple / Standard / Technical), and a step-by-step conformance trace

## Quick start

```bash
npm install
npm run build       # → dist/d6v.js
npm test            # → runs 44 tests against D6 spec fixtures
```

## Use with Arelle

From the `d6v` directory:

```bash
npm install
npm run build
```

Then using Arelle:

```bash
python arelleCmdLine.py \
  --plugins=<PATH_TO>/iXBRLViewerPlugin/__init__.py \
  -f <FILING>.htm \
  --save-viewer <VIEWER>.html \
  --viewer-url <PATH_TO>/examples/d6v/dist/d6v.js
```

## Input format

D6V reads a D6 JSON manifest via one of:

- `ixbrlviewer.config.json`:
  ```json
  { "d6": { "signaturesUrl": "META-INF/d6.json" } }
  ```
- Query parameter: `?d6-signatures-url=https://…/d6.json`

## Documentation

All documentation follows Arelle project conventions:

| Document | Description |
|----------|-------------|
| [`docs/01-use-cases.md`](docs/01-use-cases.md) | Use case: D6 signature verification in iXBRL Viewer |
| [`docs/02-requirements.md`](docs/02-requirements.md) | Functional (FR-01…FR-17), validation (VR-01…VR-08), non-functional (NFR-01…NFR-05) |
| [`docs/03-test-cases.md`](docs/03-test-cases.md) | 44 test cases (TC-01…TC-44) + 5 D6 conformance tests (TC-D6-01…TC-D6-05) |
| [`docs/04-validation-rules.md`](docs/04-validation-rules.md) | Manifest, coverage, trace, and config validation rules (R01…R19) |
| [`docs/05-traceability.md`](docs/05-traceability.md) | Requirements traceability matrix — all requirements mapped to tests |
| [`docs/06-d6-conformance.md`](docs/06-d6-conformance.md) | D6 specification conformance mapping, verification steps, known gaps |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Plugin architecture, component structure, data flow, build, dependencies |

## Tests

```bash
npm test            # 44 tests, <1 second
npm run test:ci     # with coverage
```

The test suite validates the D6V viewer logic against the D6 specification
using JSON fixture files:

| Fixture | Scenario |
|---------|----------|
| `d6-valid-single.json` | Single valid signer with fact + section scope |
| `d6-valid-multi.json` | Three signers: whole-report, section, CSS selector |
| `d6-invalid-tampered.json` | Tampered report — digest mismatch |
| `d6-revoked.json` | Revoked signer certificate |
| `d6-empty.json` | Empty signatures array |
| `d6-missing-fields.json` | Minimal signature — missing optional fields |
| `d6-malformed.json` | Invalid JSON — parse error |

Tests are mapped to documented test case IDs (TC-01…TC-D6-05) and reference
D6 spec sections (§4.1, §4.3, §5.1, §5.3).

## Viewer assets

The `viewer-assets/` directory contains config files that should be served
alongside the viewer HTML. In particular, `ixbrlviewer.config.json` tells the
plugin where to find the D6 signature manifest.

## Minimal D6 JSON expected

```json
{
  "signatures": [
    {
      "id": "sig-1",
      "signerName": "Jane Doe",
      "verificationStatus": "valid",
      "revoked": false,
      "targetDigest": "sha256-e3b0c44…",
      "coverage": { "facts": ["f1"], "divs": ["auditSection"], "selectors": [] },
      "verificationTrace": [
        { "name": "Compare digests", "outcome": "pass", "specRef": "D6 §5.1" }
      ]
    }
  ]
}
```

## License

Apache-2.0 (see [LICENSE](LICENSE))
