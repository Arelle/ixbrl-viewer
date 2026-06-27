# D6V Demo

Demonstrates the d6v plugin using Workiva's January 2023 8-K filing
(already included in this repository under `examples/`). The generation
script copies the existing viewer, swaps the script tag to load d6v.js,
and adds D6 signature files.

Two variants are generated:

- **valid/** — all signatures verify correctly (green fingerprint)
- **tampered/** — signature has a wrong digest (red fingerprint + tamper watermark)

## Setup

From the `d6v` directory:

```bash
# 1. Build the d6v plugin
npm install
npm run build

# 2. Generate demo variants
node demo/generate-demo.js
```

## Viewing

The viewer requires HTTP — `file://` URLs will not work. Start a local
server from the `demo` directory:

```bash
python -m http.server 8090
```

Then open in a browser:

- **Valid signatures:** <http://localhost:8090/demo/valid/ixbrl-viewer.htm>
- **Tampered signatures:** <http://localhost:8090/demo/tampered/ixbrl-viewer.htm>

## What to look for

- **Valid demo:** The green fingerprint icon appears in the viewer header.
  Click it to open the signatures panel showing "Brandon Ziegler — Valid".
- **Tampered demo:** The red fingerprint icon and a striped
  "DOCUMENT MODIFIED SINCE SIGNING" watermark appear. The signature
  card shows "Invalid" because the digest in the signature file does
  not match the actual subset file.
