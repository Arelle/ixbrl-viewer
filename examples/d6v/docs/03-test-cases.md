# Test Cases

## Signature Loading

- TC-01 (FR-01): `_loadSignatures()` fetches `META-INF/d6.json` from the URL specified in `ixbrlviewer.config.json` and populates `_signatures` array.
- TC-02 (FR-01): When `?d6-signatures-url=` query parameter is present, it overrides the config file URL.
- TC-03 (FR-15): When `d6.json` is missing (404), `_signatures` remains empty and no error is thrown; panel shows "No signature data loaded."
- TC-04 (FR-15): When `d6.json` contains malformed JSON, `_loadError` is set and the panel displays an error message.

## Signature Rendering

- TC-05 (FR-02): Each signature in `_signatures` produces a `.d6-sig-card` element with signer name, status badge, and coverage label.
- TC-06 (FR-16): When 3+ signers are present, highlight styles cycle through `d6-sig-style-1`, `d6-sig-style-2`, `d6-sig-style-3`.
- TC-07 (VR-07): A signature with missing `signerName` renders as "Unknown".
- TC-08 (VR-08): A signature with missing `coverageLabel` renders as "Whole report".
- TC-09 (FR-02): Status badges use correct CSS classes: `.valid`, `.invalid`, `.revoked`, `.unknown`.

## Digest Verification

- TC-10 (FR-03): A signature with `targetDigest: "sha256-<correct_hex>"` verifies as `valid`.
- TC-11 (FR-03): A signature with `targetDigest: "sha256-<wrong_hex>"` verifies as `invalid`.
- TC-12 (VR-01): A `targetDigest` not matching `<alg>-<hex>` pattern is rejected as malformed.
- TC-13 (VR-02): SHA-256, SHA-384, and SHA-512 digest prefixes are all accepted.
- TC-14 (VR-04): A signature with `revoked: true` displays as revoked even when digest matches.

## Scope Highlighting

- TC-15 (FR-04, FR-05): Selecting a whole-report signature applies `d6-sig-highlight-whole` to `<body>`.
- TC-16 (FR-04, FR-05): Selecting a section-scope signature applies `d6-sig-highlight-div` to the matching `#id` element.
- TC-17 (FR-04, FR-05): Selecting a fact-scope signature applies `d6-sig-highlight-fact` to the matching fact element.
- TC-18 (FR-17): Fact ID resolution works with `f`-prefixed and bare numeric IDs.
- TC-19 (FR-17): Fact ID resolution falls back to `data-ivids` attribute scanning when direct `#id` lookup fails.
- TC-20 (VR-05): Whole-report highlight applies to all document frames, not just the first.
- TC-21 (VR-06): Duplicate coverage items (`type:value` pairs) are deduplicated before highlight.

## Tamper Warning

- TC-22 (FR-06): When any signature has `status: "invalid"`, `#d6-tamper-watermark` has class `visible`.
- TC-23 (FR-06): When all signatures are valid, `#d6-tamper-watermark` does not have class `visible`.
- TC-24 (FR-07): When all valid, fingerprint icon `src` is the green SVG; when any invalid, it is the red SVG.

## Coverage Navigation

- TC-25 (FR-12): Clicking next-arrow advances `_sigNavIndex` and scrolls to the next coverage target.
- TC-26 (FR-12): Clicking prev-arrow decrements `_sigNavIndex`, clamped to 0.
- TC-27 (FR-12): Navigation counter displays `"1 / N"` format where N is the total target count.

## META-INF Inspector — Drawer

- TC-28 (FR-08): Opening the inspector drawer renders three tab buttons: Files, Signers, Conformance.
- TC-29 (FR-08): Files tab lists `d6.json`, each `sig-*.json`, and the subset file (if present).
- TC-30 (FR-08): Signers tab renders a card per signer with name-initials avatar, name, status, and algorithm (Standard/Technical levels).
- TC-31 (FR-08): Conformance tab renders verification trace steps with pass/fail badges.
- TC-32 (FR-10): Toggling detail level from Standard to Simple removes algorithm line from signer cards.
- TC-33 (FR-10): Toggling detail level to Technical shows `targetDigest` hex in signer cards.

## META-INF Inspector — Full Page

- TC-34 (FR-09): Full-page view renders a package-structure graph with root node `d6.json` and child signature nodes.
- TC-35 (FR-09): Clicking a signature node in the graph switches the right panel to that signature's technical detail.
- TC-36 (FR-11): Verification trace entries include `specRef` badges (e.g. `D6 §4.1`) and `testCases` ID links.

## Hash Check (Out-of-Band)

- TC-37 (FR-13): Clicking "Check Hash" builds a base64url payload containing `signatureId`, `targetDigest`, `reportPageUrl`, and `d6Url`.
- TC-38 (FR-13): QR code `<img>` URL encodes the hash-check verifier URL with the payload.
- TC-39 (FR-14): `hashVerifierUrl` is read from `ixbrlviewer.config.json` → `d6.hashVerifierUrl`; absent config falls back to `https://xbrl.org/verify-hash`.

## Configuration

- TC-40 (FR-14): D6V reads `ixbrlviewer.config.json` relative to the script `src` URL.
- TC-41 (FR-14): When the config file is unreachable, D6V proceeds without D6 features (base viewer unaffected).

## Edge Cases

- TC-42 (FR-15): An empty `signatures` array in `d6.json` renders "No signature data loaded" in the panel and inspector.
- TC-43 (FR-17): A coverage item with an unresolvable CSS selector logs to `#d6-unresolved-targets` but does not throw.
- TC-44 (FR-16): Selecting a second signature clears the first signature's highlights before applying the new ones.

## PKI Signature Verification

- TC-PKI-01 (FR-18): A signature file with a valid RSA-PSS/SHA-256 `publicKey` (JWK) and correct `signatureValue` verifies as `pkiStatus: "valid"` and the trace step outcome is `"pass"`.
- TC-PKI-02 (FR-18): A signature file with a correct `publicKey` but a tampered `signatureValue` verifies as `pkiStatus: "invalid"` and the trace step outcome is `"fail"`.
- TC-PKI-03 (FR-19): A signature file with no `publicKey` field produces `pkiStatus: "skipped"` and the trace step outcome is `"skipped"`.
- TC-PKI-04 (FR-19): A signature file with no `signatureValue` field produces `pkiStatus: "skipped"` and the trace step outcome is `"skipped"`.
- TC-PKI-05 (VR-11): Algorithm string `"RSA-PSS/SHA-256"` maps to `{ name: "RSA-PSS", hash: "SHA-256", saltLength: 32 }` for `crypto.subtle.verify`.
- TC-PKI-06 (VR-11): Algorithm string `"ECDSA/P-256"` maps to `{ name: "ECDSA", hash: "SHA-256" }` for `crypto.subtle.verify`.

## Validation Authority (VA) Integration

- TC-VA-01 (FR-20, VR-13): A VA response with `version: 1`, `signatureId`, and `overallStatus: "valid"` is accepted and `chainStatus` is set to `"valid"`.
- TC-VA-02 (FR-20, VR-13): A VA response missing `overallStatus` is treated as `overallStatus: "error"` and `chainStatus` is set to `"unknown"`.
- TC-VA-03 (FR-22): When `d6.validationAuthorityUrl` is not configured, `chainStatus` is `"not-configured"` and the deferred-validation message is shown in the panel.
- TC-VA-04 (FR-22): A VA call that times out (network error / no response within 8 s) sets `chainStatus: "unknown"` and does NOT mark the signature as `invalid`.
- TC-VA-05 (FR-21): When the VA response includes `vLeiInfo`, `legalName` and `role` are rendered in the signature detail panel. When `certInfo` is present without `vLeiInfo`, `subject` and `issuer` are rendered.
- TC-VA-06 (FR-21): When `overallStatus: "invalid"` is returned by the VA, the signature is marked `invalid` and the tamper watermark is displayed.

## D6 Specification Conformance

- TC-D6-01 (DFR-1): Fact subset signing — viewer correctly identifies and highlights individual signed facts.
- TC-D6-02 (DFR-2): CSS selector subset signing — viewer resolves CSS selectors and highlights matched elements.
- TC-D6-03 (DFR-3): Dependency signing — viewer displays dependency digest information in META-INF inspector.
- TC-D6-04 (DFR-7): Verification view checks signature validity, dependency digests, and subset interpretation.
- TC-D6-05 (DFR-8): Tamper test — modifying a signed dependency causes the signature to display as `invalid` with watermark.
