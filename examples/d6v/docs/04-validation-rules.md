# Validation Rules

## D6 Manifest Rules

- R01: `d6.json` root object SHALL contain a `signatures` array.
- R02: Each signature object SHALL contain `id` (string, unique within manifest).
- R03: Each signature object SHALL contain `signerName` (string; absent → fallback "Unknown").
- R04: Each signature object SHALL contain `verificationStatus` (one of: `valid`, `invalid`, `revoked`, `unknown`).
- R05: `targetDigest` (if present) SHALL match pattern `<algorithm>-<hex_string>`.
- R06: `algorithm` prefix SHALL be one of: `sha256`, `sha384`, `sha512`.

## Coverage Rules

- R07: `coverage.facts` SHALL be an array of string fact IDs.
- R08: `coverage.divs` SHALL be an array of string element IDs.
- R09: `coverage.selectors` SHALL be an array of objects with `{ selector: "<css>" }`.
- R10: `wholeReport: true` on a signature means the entire report body is covered.
- R11: A signature MAY have multiple coverage types simultaneously (e.g. facts + divs).
- R12: Duplicate `type:value` coverage items SHALL be deduplicated by the viewer.

## Verification Trace Rules

- R13: `verificationTrace` SHALL be an array of step objects.
- R14: Each step SHALL contain `name` (string), `outcome` (`"pass"` or `"fail"`).
- R15: Each step MAY contain `specRef` (string, e.g. `"D6 §4.1"`) and `testCases` (string array).
- R16: Each step MAY contain `detail` (object with optional `reason` string).

## Config Rules

- R17: `ixbrlviewer.config.json` → `d6.signaturesUrl` SHALL be a relative or absolute URL to the D6 manifest.
- R18: `ixbrlviewer.config.json` → `d6.hashVerifierUrl` (optional) SHALL be an absolute URL.
- R19: Query parameter `?d6-signatures-url=` SHALL override `d6.signaturesUrl` from config.
