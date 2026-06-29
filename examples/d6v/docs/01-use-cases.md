# Use Case: D6 Signature Verification in iXBRL Viewer

## Context

An XBRL report package has been signed by one or more parties under the
D6 (Digital Signatures in XBRL 1.0) specification. The viewer must
present verification results to end users — auditors, regulators,
preparers — who open the report in a web browser.

## Business Objective

Demonstrate that a D6-signed report can be opened in an Arelle iXBRL
Viewer and that signature status, signer identity, scope coverage, and
digest integrity are clearly communicated without requiring specialist
XBRL or cryptographic knowledge.

## Actors

- **Report Consumer**: opens a signed report in a browser; expects a
  clear valid/invalid indication.
- **Controller / Preparer**: uses the META-INF inspector to examine
  package structure and per-field explanations.
- **Auditor**: verifies that management signatures are present and that
  the coverage scope matches expectations before signing.

## Main Scenario

1. Report consumer opens an iXBRL Viewer HTML file that includes D6V.
2. D6V fetches `ixbrlviewer.config.json` to locate the D6 manifest.
3. D6V fetches `META-INF/d6.json` and each referenced signature file.
4. D6V verifies target digests against fetched subset/report bytes.
5. Signature pane renders a summary card per signer with status badge.
6. Consumer clicks a card to highlight covered facts/sections in the
   report.
7. Consumer (optionally) opens the META-INF Inspector for structural
   and field-level detail.
8. If any signature is invalid, a tamper watermark overlays the report
   and the fingerprint icon turns red.
