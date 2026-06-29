# Requirements

## Functional

- FR-01: D6V SHALL load signature data from a D6 JSON manifest (`META-INF/d6.json`) referenced via `ixbrlviewer.config.json` or a query parameter (`?d6-signatures-url=…`).
- FR-02: D6V SHALL display a signature summary pane inside the iXBRL Viewer inspector area, listing each signer with name, role, status badge, and coverage label.
- FR-03: D6V SHALL verify each signature's `targetDigest` against the fetched subset/report file bytes and report `valid` or `invalid`.
- FR-04: D6V SHALL support three scope types: whole-report, section (div ID or CSS selector), and individual fact (by fact ID).
- FR-05: D6V SHALL highlight covered elements in the report when a signature card is selected (facts in amber, sections in blue, whole-report as a border pattern).
- FR-06: D6V SHALL display a red tamper watermark overlay when any signature status is `invalid` or `revoked`.
- FR-07: D6V SHALL switch the inspector fingerprint icon between green (all valid) and red (any invalid/revoked).
- FR-08: D6V SHALL provide a META-INF Inspector drawer with three tabs: Files, Signers, Conformance.
- FR-09: D6V SHALL provide a META-INF Inspector full-page view with a package-structure graph and per-signature technical detail.
- FR-10: D6V SHALL support three detail levels (Simple / Standard / Technical) in the inspector, toggled by the user.
- FR-11: D6V SHALL render a step-by-step verification trace per signature, showing spec references (e.g. `D6 §4.1`), pass/fail outcome, and linked test case IDs.
- FR-12: D6V SHALL support navigation within a signature's coverage targets (prev/next arrows, counter badge).
- FR-13: D6V SHALL provide an out-of-band hash-check feature: QR code + URL linking to a hash verifier page.
- FR-14: D6V SHALL load runtime configuration (`ixbrlviewer.config.json`) to resolve `d6.signaturesUrl` and `d6.hashVerifierUrl`.
- FR-15: D6V SHALL gracefully handle missing or malformed D6 manifests: display "No signature data loaded" and degrade to base viewer behaviour.
- FR-16: D6V SHALL support multiple signers with distinct highlight styles (style-1 solid, style-2 dashed, style-3 dotted) assigned round-robin.
- FR-17: D6V SHALL resolve fact IDs using both direct `#id` lookup and `data-ivids` attribute scanning, including the `f`-prefix/no-prefix alternation.
- FR-18: D6V SHALL verify PKI signatures (RSA-PSS and ECDSA) using the `publicKey` (JWK) and `signatureValue` (base64url) fields in the signature file via the browser WebCrypto API (`crypto.subtle`).
- FR-19: D6V SHALL report a `pkiStatus` of `valid`, `invalid`, or `skipped` per signature and include a PKI verification step in the verification trace. When `publicKey` or `signatureValue` is absent the step outcome SHALL be `skipped` (not a failure).
- FR-20: D6V SHALL POST signature artefacts to the Validation Authority URL (`d6.validationAuthorityUrl` from `ixbrlviewer.config.json`) after completing local checks, with an 8-second timeout. See `07-va-api.md` for the full request/response schema.
- FR-21: D6V SHALL display the VA response in the signature detail panel and verification trace, including `overallStatus`, per-check statuses (`chain`, `revocation`, `trustAnchor`), `certInfo`, and `vLeiInfo` when present. eIDAS trust level and vLEI legal name/role SHALL be prominently displayed when available.
- FR-22: When `d6.validationAuthorityUrl` is absent or the VA call fails (network error, timeout, non-200 response), D6V SHALL degrade gracefully: show `chainStatus: "not checked"` and display the standard deferred-validation message (see `07-va-api.md §D6V Behaviour`). A VA failure SHALL NOT mark the signature as `invalid` unless the VA explicitly returns `overallStatus: "invalid"`.

## Validation Rules

- VR-01: `targetDigest` format SHALL match `<algorithm>-<hex>` (e.g. `sha256-abc123…`).
- VR-02: Supported digest algorithms: SHA-256 (32-byte hex), SHA-384 (48-byte), SHA-512 (64-byte).
- VR-03: Signature status SHALL be one of: `valid`, `invalid`, `revoked`, `unknown`.
- VR-04: A signature with `revoked: true` SHALL display as revoked regardless of digest match.
- VR-05: Whole-report scope (`wholeReport: true`) SHALL apply highlights to `<body>` of all document frames.
- VR-06: Duplicate coverage items (same `type:value`) SHALL be deduplicated before rendering.
- VR-07: Missing `signerName` SHALL fall back to `"Unknown"`.
- VR-08: Missing `coverageLabel` SHALL fall back to `"Whole report"`.
- VR-09: `publicKey` (when present) SHALL be a valid JWK object with a `kty` property of `"RSA"` or `"EC"`.
- VR-10: `signatureValue` (when present) SHALL be a base64url-encoded byte string.
- VR-11: Supported PKI algorithms: RSA-PSS with SHA-256, SHA-384, or SHA-512; ECDSA with P-256 (SHA-256) or P-384 (SHA-384).
- VR-12: `signingInput` (when present) SHALL be a base64url-encoded byte string representing the data that was signed; when absent D6V SHALL sign the raw `targetDigest` string encoded as UTF-8.
- VR-13: A VA response body SHALL contain `version` (integer, `1`), `signatureId` (string), and `overallStatus` (one of `valid`, `invalid`, `partial`, `skipped`, `error`). A response missing any of these fields SHALL be treated as `overallStatus: "error"` by D6V.

## Non-Functional

- NFR-01: D6V SHALL build as a single JS bundle (`d6v.js`) via webpack, importable by the Arelle iXBRL Viewer plugin system.
- NFR-02: D6V SHALL have no server-side runtime dependency — all verification runs in the browser.
- NFR-03: D6V SHALL degrade gracefully if `ixbrlviewer.config.json` is unreachable (skip D6 features, do not break base viewer).
- NFR-04: D6V SHALL support all browsers supported by the Arelle iXBRL Viewer (Chrome, Firefox, Safari, Edge — current stable).
- NFR-05: Test suite SHALL run via `npm test` with no external service dependencies.
