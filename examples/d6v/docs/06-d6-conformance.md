# D6 Specification Conformance

*Target specification: Digital Signatures in XBRL 1.0, Candidate Recommendation 2025-01-28*

## Scope

D6V implements the **viewer/verifier** role of the D6 specification.
It does not produce signatures — that is the role of the signing
orchestrator (SXO). D6V consumes D6 artefacts and verifies them
client-side.

## Conformance Level

| Level | Description | D6V Status |
|---|---|---|
| Digest verification | SHA-256/384/512 targetDigest check against fetched bytes | ✅ Implemented |
| Manifest parsing | `META-INF/d6.json` structure per D6 §4.1 | ✅ Implemented |
| Subset interpretation | Fact/section/selector/whole-report scopes per D6 §4.3 | ✅ Implemented |
| PKI signature validation | RSA-PSS / ECDSA signature verification via WebCrypto | ✅ Implemented |
| Certificate chain validation | X.509 chain + revocation + eIDAS/vLEI trust anchors via VA service | 🔲 Planned (VA service — see `07-va-api.md`) |
| Timestamp verification | RFC 3161 timestamp tokens | 🔲 Future |

## D6 Demo Functional Requirements (DFR) Mapping

| DFR | D6 Spec Section | D6V Coverage | Test Cases |
|---|---|---|---|
| DFR-1: Fact subset signing | §4.3 subset selection | Fact ID highlighting | TC-D6-01 |
| DFR-2: CSS selector subset signing | §4.3 subset selection | CSS selector resolution + highlight | TC-D6-02 |
| DFR-3: Dependency signing | §4.2 dependency digests | Inspector displays dependency digest info | TC-D6-03 |
| DFR-7: Verification view | §5.1 verification process | Digest check + status display + inspector | TC-D6-04 |
| DFR-8: Tamper test | §5.2 integrity failure | Watermark + red icon on digest mismatch | TC-D6-05 |

## Verification Steps (as rendered in D6V trace)

The viewer performs the following verification steps per signature:

1. **Fetch manifest** — `META-INF/d6.json` reachable and parseable. Spec ref: D6 §4.1.
2. **Parse signature record** — All required fields present. Spec ref: D6 §4.1.
3. **Fetch subset file** — Subset/report file reachable. Spec ref: D6 §4.3.
4. **Compute digest** — SHA-256/384/512 over fetched bytes. Spec ref: D6 §5.1.
5. **Compare digests** — Computed digest matches `targetDigest`. Spec ref: D6 §5.1.
6. **Check revocation** — `revoked` flag is `false`. Spec ref: D6 §5.3.
7. **Resolve coverage** — All `facts`, `divs`, `selectors` resolve to DOM elements. Spec ref: D6 §4.3.
8. **PKI signature verify** — `signatureValue` verified against `publicKey` (JWK) using `crypto.subtle.verify`. Skipped when either field is absent. Spec ref: D6 §5.1.
9. **Certificate chain + trust anchor** — Delegated to Validation Authority service (POST to `d6.validationAuthorityUrl`). Checks: chain structure, revocation (OCSP/CRL), eIDAS trust level or vLEI credential status. Skipped when VA URL not configured; `unknown` when VA unreachable. Spec ref: D6 §5.1, eIDAS Reg. 910/2014, GLEIF vLEI EGF.

## Known Gaps

| Gap | Severity | Notes |
|---|---|---|
| Certificate chain validation delegated to VA | HIGH | VA service spec in `07-va-api.md`. Demo VA (eIDAS + vLEI) planned for late May 2026. D6V displays clear deferred-validation message when VA not configured. |
| No timestamp verification | MEDIUM | RFC 3161 not yet supported; planned using pkijs/asn1js in a future VA release |
| Digest re-computation relies on fetched bytes, not original package bytes | LOW | Acceptable for demo/prototype; production requires package-level verification |

## Prototype Caveat

D6V performs **digest-based verification** and **PKI signature verification** (RSA-PSS / ECDSA via WebCrypto).
Certificate chain validation (X.509 trust anchors, revocation, eIDAS / vLEI) is delegated to a
**Validation Authority (VA) service** — see `07-va-api.md`.

When a VA URL is configured, D6V calls it and displays the result (chain status, revocation,
trust anchor family, eIDAS level, vLEI legal name/role) in the signature panel.

When no VA URL is configured, D6V displays the following message:

> **Certificate chain validation is not available in this session.**
> The cryptographic signature has been verified against the embedded public key, but the
> signing certificate has not been checked against a trusted CA, revocation lists, or
> eIDAS / vLEI trust anchors. Configure `d6.validationAuthorityUrl` in
> `ixbrlviewer.config.json` to enable full validation.

The "valid/invalid" status without a VA is determined by:

1. The `verificationStatus` field in the D6 manifest, AND
2. The `targetDigest` match against fetched file bytes, AND
3. The `signatureValue` verification against `publicKey` (JWK) via `crypto.subtle`.

With a VA, a returned `overallStatus: "invalid"` also triggers the `invalid` state and tamper watermark.
