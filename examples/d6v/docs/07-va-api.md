# Validation Authority (VA) API Specification

*Status: Design — v0.1, 22 March 2026*

---

## Purpose

D6V performs cryptographic digest verification and raw PKI signature
verification (step 8, `crypto.subtle`) entirely in the browser.
What it **cannot** do client-side is:

- Verify that a signing certificate was issued by a trusted CA
- Build and validate a full X.509 certificate chain
- Check revocation status (OCSP / CRL)
- Enforce jurisdiction-specific trust policies (eIDAS QES/AES, GLEIF vLEI)

These responsibilities belong to a **Validation Authority (VA)** — a
lightweight, stateless HTTP service that D6V calls at runtime and whose
verdict is displayed alongside the local checks.

This document specifies the VA API contract that D6V implements against,
so that any conforming VA service can be plugged in via
`ixbrlviewer.config.json`.

---

## Trust Anchor Scope (Demo — Late May 2026)

The reference demo VA SHALL support two trust anchor families, both
relevant to an EU audience:

| Family | Standard | Certificate type | Issuer examples |
|---|---|---|---|
| **eIDAS** | EU Regulation 910/2014 (eIDAS), amended by eIDAS 2.0 (EU 2024/1183) | Qualified Electronic Signature (QES) or Advanced Electronic Signature (AES) certificate | Entrust QES, DocuSign EU QES, national TSP lists (EU Trusted List) |
| **vLEI** | GLEIF vLEI Ecosystem Governance Framework | Organizational Role vLEI credential (OOR) or Legal Entity vLEI (LE) | GLEIF-accredited Qualified vLEI Issuers (QVIs) |

For the demo, the VA is expected to be hosted by the project team
(e.g. on a minimal cloud function or VPS) and reachable at a URL
configured in `ixbrlviewer.config.json` → `d6.validationAuthorityUrl`.

---

## API Endpoint

```
POST {validationAuthorityUrl}/validate
Content-Type: application/json
Accept: application/json
```

There is no authentication for the demo deployment. Production
deployments MAY add an `Authorization` header (bearer token) which
D6V would source from `ixbrlviewer.config.json` → `d6.validationAuthorityToken`.

---

## Request Schema

```json
{
  "version": 1,
  "signatureId": "sig-1",
  "algorithm": "RSA-PSS/SHA-256",
  "publicKey": { "kty": "RSA", "n": "...", "e": "AQAB" },
  "signatureValue": "<base64url>",
  "signingInput": "<base64url or omitted>",
  "certificateChain": [
    "<base64-DER of leaf cert>",
    "<base64-DER of intermediate cert>"
  ],
  "reportUrl": "https://example.com/reports/2025/annual-report.html",
  "d6Url": "https://example.com/reports/2025/META-INF/d6.json",
  "requestedChecks": ["chain", "revocation", "trustAnchor"]
}
```

### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer | ✅ | Always `1` for this API version |
| `signatureId` | string | ✅ | `id` from the D6 signature record |
| `algorithm` | string | ✅ | `RSA-PSS/SHA-256`, `RSA-PSS/SHA-384`, `RSA-PSS/SHA-512`, `ECDSA/P-256`, `ECDSA/P-384` |
| `publicKey` | JWK object | ✅ | The public key from the signature file |
| `signatureValue` | string | ✅ | base64url-encoded raw signature bytes |
| `signingInput` | string | ❌ | base64url-encoded bytes that were signed; absent → VA uses UTF-8 of `targetDigest` |
| `certificateChain` | string[] | ❌ | Ordered array of base64-encoded DER certificates, leaf first. If absent, chain/revocation/trustAnchor checks are skipped |
| `reportUrl` | string | ❌ | URL of the iXBRL report page; used for audit logging |
| `d6Url` | string | ❌ | URL of the D6 manifest; used for audit logging |
| `requestedChecks` | string[] | ❌ | Subset of `["chain", "revocation", "trustAnchor"]`; absent → all checks attempted |

---

## Response Schema

```json
{
  "version": 1,
  "signatureId": "sig-1",
  "overallStatus": "valid",
  "checks": {
    "chain": {
      "status": "valid",
      "detail": "Chain of 2 certificates verified. Leaf → Intermediate → Root."
    },
    "revocation": {
      "status": "valid",
      "method": "ocsp",
      "detail": "OCSP response: good. Checked at 2026-05-28T14:32:00Z."
    },
    "trustAnchor": {
      "status": "valid",
      "family": "eIDAS",
      "level": "QES",
      "issuer": "Entrust Limited",
      "trustListCountry": "IE",
      "detail": "Root CA found on EU Trusted List (Ireland TSP)."
    }
  },
  "certInfo": {
    "subject": "CN=Jane Doe, O=Example Corp, C=IE",
    "issuer": "CN=Entrust QES CA, O=Entrust Limited, C=IE",
    "notBefore": "2025-01-01T00:00:00Z",
    "notAfter": "2027-01-01T00:00:00Z",
    "serialNumber": "3a:bc:12:...",
    "keyUsage": ["digitalSignature"],
    "subjectAltName": "jane.doe@example.com"
  },
  "vLeiInfo": null,
  "validatedAt": "2026-05-28T14:32:01Z",
  "vaVersion": "1.0.0"
}
```

### `overallStatus` Values

| Value | Meaning |
|---|---|
| `valid` | All requested checks passed |
| `invalid` | At least one check failed |
| `partial` | Some checks passed; others returned `unknown` (e.g. OCSP unreachable) |
| `skipped` | No `certificateChain` provided — no chain checks possible |
| `error` | VA encountered an internal error |

### Per-Check `status` Values

| Value | Meaning |
|---|---|
| `valid` | Check passed |
| `invalid` | Check failed (e.g. cert expired, chain broken, revoked) |
| `unknown` | Check could not be completed (e.g. OCSP timeout, CRL unavailable) |
| `skipped` | Check not applicable (e.g. no chain provided, check not requested) |

---

## vLEI Response Extension

When the leaf certificate is a GLEIF vLEI credential (identified by
OID or SAN), the VA SHALL populate `vLeiInfo` instead of (or alongside)
standard `certInfo`:

```json
{
  "vLeiInfo": {
    "credentialType": "OOR",
    "lei": "2549003W4ZY05Y3UOG45",
    "legalName": "Example Corp PLC",
    "role": "Chief Financial Officer",
    "qvi": "GLEIF-accredited QVI Name",
    "credentialStatus": "valid",
    "gleifRegistryUrl": "https://vlei.gleif.org/..."
  }
}
```

D6V SHALL display `legalName`, `role`, and `credentialStatus` in the
signature panel when `vLeiInfo` is present, giving EU regulators and
auditors immediate organisational context alongside the signature.

---

## Error Responses

```json
{
  "version": 1,
  "signatureId": "sig-1",
  "overallStatus": "error",
  "errorCode": "INVALID_REQUEST",
  "errorMessage": "Field 'publicKey' is missing or not a valid JWK."
}
```

| HTTP Status | `errorCode` | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed request body |
| 400 | `UNSUPPORTED_ALGORITHM` | `algorithm` value not supported by this VA |
| 422 | `CERT_PARSE_ERROR` | `certificateChain` entry is not valid base64-DER |
| 429 | `RATE_LIMITED` | Too many requests; D6V should back off and show `unknown` |
| 500 | `INTERNAL_ERROR` | VA internal error; D6V should show `unknown` |
| 503 | `SERVICE_UNAVAILABLE` | VA temporarily offline; D6V should show `unknown` |

---

## D6V Behaviour

### When VA URL is configured

1. After completing local digest + PKI sig checks, D6V POSTs to the VA.
2. Timeout: **8 seconds**. If no response, treat as `unknown`.
3. On `200 OK`: parse response and render `checks` in the verification
   trace and the signature detail panel.
4. On any non-200 or network error: render `chainStatus: "unknown"` with
   an explanatory message; **do not mark the signature as `invalid`**.
5. `overallStatus: "invalid"` from the VA **does** cause the signature
   to be marked `invalid` and triggers the tamper watermark.

### When VA URL is not configured

D6V SHALL display the following message in the signature detail panel,
in a clearly styled info box (not a warning or error):

> **Certificate chain validation is not available in this session.**
> The cryptographic signature has been verified against the embedded
> public key (step 8 above), but the signing certificate has not been
> checked against a trusted CA, revocation lists, or eIDAS / vLEI
> trust anchors.
> To perform full validation, a Validation Authority URL must be
> configured in `ixbrlviewer.config.json` → `d6.validationAuthorityUrl`.

The same message SHALL appear in the META-INF Inspector Conformance tab,
with a link to this specification document.

---

## Configuration

Add to `ixbrlviewer.config.json`:

```json
{
  "d6": {
    "signaturesUrl": "META-INF/d6.json",
    "hashVerifierUrl": "https://xbrl.org/verify-hash",
    "validationAuthorityUrl": "https://va.demo.xbrl.org",
    "validationAuthorityToken": ""
  }
}
```

| Key | Required | Description |
|---|---|---|
| `validationAuthorityUrl` | ❌ | Base URL of the VA service. When absent, chain validation is deferred with the UI message above. |
| `validationAuthorityToken` | ❌ | Optional bearer token for authenticated VA deployments. |

---

## Demo VA — Implementation Notes (Late May 2026)

The demo VA is intentionally minimal:

- **Runtime:** Node.js or Python (single file, deployable as a cloud function)
- **Chain verification:** `pkijs` + `asn1js` (Node) or `cryptography` (Python)
- **eIDAS trust list:** Fetch the EU Trusted List XML (`https://ec.europa.eu/tools/lotl/eu-lotl.xml`) at startup and cache for 24 hours. Extract CA fingerprints from `ServiceDigitalIdentity` elements.
- **vLEI trust:** Verify OOR/LE credential against GLEIF root of trust (GLEIF Root CA, publicly available). Optionally query the GLEIF vLEI registry for credential status.
- **OCSP:** Standard OCSP request using cert's `authorityInfoAccess` extension, timeout 5 seconds, fallback to `unknown`.
- **CRL:** Download from cert's `cRLDistributionPoints` extension, cache in-process, max 10 MB, fallback to `unknown`.
- **Hosting:** Single HTTPS endpoint. A small VPS or a serverless function (Cloudflare Workers, AWS Lambda) is sufficient for demo traffic.
- **CORS:** Must set `Access-Control-Allow-Origin: *` for browser-side D6V calls (or scope to the demo report domain).

---

## Related Documents

- `02-requirements.md` — FR-20, FR-21, FR-22, VR-13
- `03-test-cases.md` — TC-VA-01 through TC-VA-05
- `06-d6-conformance.md` — Certificate chain validation gap entry
- `ARCHITECTURE.md` — Data flow diagram
