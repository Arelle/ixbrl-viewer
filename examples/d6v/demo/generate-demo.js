/**
 * generate-demo.js — creates D6 demo variants from the existing Workiva
 * 8-K example viewer in this repository.
 *
 * Generates two directories:
 *   valid/    — viewer + valid D6 signatures   (green fingerprint)
 *   tampered/ — viewer + tampered D6 signatures (red fingerprint + watermark)
 *
 * No Arelle required — the existing pre-built viewer HTML is reused with
 * the script tag swapped to load d6v.js instead of the stock viewer.
 *
 * Usage (from the d6v directory):
 *   npm run build
 *   node demo/generate-demo.js
 *
 * Then:
 *   python -m http.server 8090
 *   open http://localhost:8090/demo/valid/ixbrl-viewer.htm
 *   open http://localhost:8090/demo/tampered/ixbrl-viewer.htm
 */

const { subtle } = require("crypto").webcrypto;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEMO_DIR = __dirname;
const WORKIVA_DIR = path.join(DEMO_DIR, "..", "..", "workiva-january-2023-8-k-ixbrl-viewer");

async function main() {
  if (!fs.existsSync(WORKIVA_DIR)) {
    console.error("Cannot find Workiva example at", WORKIVA_DIR);
    process.exit(1);
  }

  const keyPair = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await subtle.exportKey("jwk", keyPair.publicKey);
  delete publicKeyJwk.key_ops;
  delete publicKeyJwk.ext;

  // Read the fact IDs from the existing viewer JSON
  const viewerHtml = fs.readFileSync(path.join(WORKIVA_DIR, "ixbrl-viewer.htm"), "utf8");
  const jsonMatch = viewerHtml.match(/application\/x\.ixbrl-viewer\+json['"]\s*>(.*?)<\/script>/s);
  const viewerData = JSON.parse(jsonMatch[1]);
  const factIds = Object.keys(viewerData.facts).slice(0, 6);

  // Copy ixbrlviewer.config.json next to d6v.js (index.js resolves it
  // relative to the script URL).
  const configSrc = path.join(DEMO_DIR, "..", "viewer-assets", "ixbrlviewer.config.json");
  const distDir = path.join(DEMO_DIR, "..", "dist");
  if (fs.existsSync(configSrc) && fs.existsSync(distDir)) {
    fs.copyFileSync(configSrc, path.join(distDir, "ixbrlviewer.config.json"));
  }

  // Copy the icon font — the bundled CSS references ../fonts/viewer-icons-min.woff
  // relative to the viewer HTML, so it needs to be at demo/fonts/.
  const fontSrc = path.join(DEMO_DIR, "..", "..", "..", "iXBRLViewerPlugin", "viewer", "src", "fonts", "viewer-icons-min.woff");
  const fontsDir = path.join(DEMO_DIR, "fonts");
  if (fs.existsSync(fontSrc)) {
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.copyFileSync(fontSrc, path.join(fontsDir, "viewer-icons-min.woff"));
  }

  await generateVariant("valid", keyPair, publicKeyJwk, viewerHtml, factIds, false);
  await generateVariant("tampered", keyPair, publicKeyJwk, viewerHtml, factIds, true);

  console.log("\nDone. Serve with:\n");
  console.log("  python -m http.server 8090\n");
  console.log("  Valid:    http://localhost:8090/demo/valid/ixbrl-viewer.htm");
  console.log("  Tampered: http://localhost:8090/demo/tampered/ixbrl-viewer.htm");
}

async function generateVariant(name, keyPair, publicKeyJwk, viewerHtml, factIds, tampered) {
  const dir = path.join(DEMO_DIR, name);
  const sigsDir = path.join(dir, "META-INF", "signatures");
  fs.mkdirSync(sigsDir, { recursive: true });

  // Copy viewer HTML, swapping the stock viewer JS for d6v.js
  const html = viewerHtml.replace(
    /(<script[^>]*src=")[^"]*ixbrlviewer\.js(")/,
    "$1../../dist/d6v.js$2"
  );
  fs.writeFileSync(path.join(dir, "ixbrl-viewer.htm"), html);

  // Copy supporting taxonomy files needed by the viewer
  for (const f of fs.readdirSync(WORKIVA_DIR)) {
    if (f !== "ixbrl-viewer.htm") {
      fs.copyFileSync(path.join(WORKIVA_DIR, f), path.join(dir, f));
    }
  }

  // Report root JSON — the D6 entry point descriptor (must be JSON, not HTML)
  const reportRoot = {
    "d6:report": "ixbrl-viewer.htm",
    "d6:resources": { documents: {} },
  };
  fs.writeFileSync(
    path.join(dir, "META-INF", "report-root.json"),
    JSON.stringify(reportRoot, null, 2)
  );

  // Subset file — CFO signs a selection of facts (whole report)
  const subset = {
    report: "../report-root.json",
    selection: {
      wholeReport: true,
      facts: factIds,
    },
  };
  const subsetJson = JSON.stringify(subset, null, 2);
  fs.writeFileSync(path.join(sigsDir, "subset-cfo.json"), subsetJson);

  // Compute the real SHA-256 of the subset file
  const subsetBytes = Buffer.from(subsetJson, "utf8");
  const realHash = crypto.createHash("sha256").update(subsetBytes).digest("hex");

  const targetDigest = tampered
    ? "sha256-0000000000000000000000000000000000000000000000000000000000000000"
    : `sha256-${realHash}`;

  // Sign the targetDigest string with ECDSA P-256
  const signingInput = Buffer.from(targetDigest, "utf8");
  const signatureBytes = Buffer.from(
    await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      signingInput
    )
  );

  const sigFile = {
    targetDigest,
    signatureTarget: "subset-cfo.json",
    algorithm: "ECDSA/P-256",
    publicKey: publicKeyJwk,
    signatureValue: signatureBytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""),
  };
  fs.writeFileSync(
    path.join(sigsDir, "sig-cfo.json"),
    JSON.stringify(sigFile, null, 2)
  );

  const manifest = {
    signatures: [
      {
        id: "sig-cfo",
        filename: "sig-cfo.json",
        type: "http://xbrl.org/d6/conformance/sha256",
        signerName: "Brandon Ziegler",
        role: "EVP, Chief Legal Officer and Secretary",
        signedAt: "2023-01-10T09:00:00Z",
      },
    ],
  };
  fs.writeFileSync(
    path.join(dir, "META-INF", "d6.json"),
    JSON.stringify(manifest, null, 2)
  );

  const status = tampered ? "TAMPERED (red fingerprint)" : "VALID (green fingerprint)";
  console.log(`  ${name}/  ${status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
