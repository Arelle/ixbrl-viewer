# D6V Architecture

## Overview

D6V is an Arelle iXBRL Viewer plugin. It extends the base viewer with
D6 digital signature verification and display. D6V is a pure
client-side JavaScript module — no server component.

## Plugin Registration

```
index.js
  └─ creates iXBRLViewer instance
  └─ registers D6ExtendedViewer plugin
  └─ iv.load()
```

The plugin hooks into the viewer lifecycle via:
- `preProcessiXBRL(body, docIndex)` — called once on first document load
- `updateViewerStyleElements(styleElts)` — injects highlight CSS into report frames
- `extendDisplayOptionsMenu(menu)` — adds "Show D6 signatures pane" toggle

## Component Structure

```
D6ExtendedViewer
├── Signature Loading
│   ├── _loadSignatures()        ← fetches d6.json, parses signatures
│   └── _resolveSignaturesUrl()  ← config.json or query parameter
├── Signature Panel
│   ├── _renderSignatures()      ← card list with filters
│   ├── _selectSignature()       ← highlight + detail
│   └── _refreshWarningState()   ← tamper watermark + icon
├── Scope Highlighting
│   ├── _applyHighlights()       ← fact/div/whole classes on frames
│   ├── _findTargetElement()     ← id/selector/ivids resolution
│   ├── _jumpToTarget()          ← scroll + flash animation
│   └── _navigateSignatureTarget() ← prev/next within coverage
├── META-INF Inspector (Drawer)
│   ├── _renderDrawerFiles()     ← package structure tree
│   ├── _renderDrawerSigners()   ← signer cards with detail levels
│   └── _renderDrawerConformance() ← verification trace steps
├── META-INF Inspector (Full Page)
│   ├── _renderFpGraph()         ← package node graph
│   ├── _buildFpOverview()       ← summary cards
│   ├── _buildFpTechnical()      ← per-sig verification trace
│   ├── _buildFpConformance()    ← all-signers conformance
│   └── _buildFpFields()         ← field-level JSON key explanations
└── Hash Check
    ├── _buildHashCheckPayload() ← base64url payload
    ├── _buildHashCheckUrl()     ← verifier URL construction
    └── _renderHashCheck()       ← QR code display
```

## Data Flow

```
ixbrlviewer.config.json
        │
        ▼
   d6.signaturesUrl ──→ META-INF/d6.json
                              │
                              ▼
                      signatures[]
                         │    │
                         │    └──→ sig.signatureFile ──→ sig-N.json
                         │
                         └──→ sig.subsetFile ──→ subset.json
                                                      │
                                                      ▼
                                             targetDigest verification
                                             (SHA-256/384/512 check)
```

## Build

```bash
npm run build          # → dist/d6v.js
```

webpack bundles `src/index.js` + `src/d6-plugin.js` + assets (SVGs inlined
as base64 via `base64-inline-loader`) into a single JS file that the
iXBRL Viewer loads as a script tag.

PKI signature verification uses the browser's built-in `crypto.subtle` API
(WebCrypto) — no additional library is required. The `_verifyPkiSignature()`
method supports RSA-PSS (SHA-256/384/512) and ECDSA (P-256/P-384).

## Dependencies

| Package | Role |
|---|---|
| `ixbrl-viewer` | Base viewer — provides `iXBRLViewer` class and plugin API |
| `jquery` | DOM manipulation within the viewer and report frames |

## Viewer Assets

`viewer-assets/` contains files that must be served alongside the viewer HTML:

- `img/` — XII logos, cover images, signatures
- `styles.css` — additional viewer CSS
- `ixbrlviewer.config.json` — default D6 configuration
- `*.svg` — hashed fingerprint/icon SVGs

## Related Projects

- **SXO** (Signing.XBRL.Org) — the signing orchestrator that produces D6 packages
- **Arelle iXBRL Viewer** — the base viewer that D6V extends
