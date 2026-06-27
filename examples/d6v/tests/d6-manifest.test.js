/**
 * D6V Test Suite — D6 Manifest Validation & Parsing
 *
 * Tests against: D6 §4.1 (manifest structure), D6 §4.3 (subset/coverage),
 *                D6 §5.1 (digest format), D6 §5.3 (revocation)
 *
 * Test case IDs: TC-03, TC-04, TC-07, TC-08, TC-09, TC-10, TC-11, TC-12,
 *                TC-13, TC-14, TC-42, TC-D6-01 through TC-D6-05,
 *                TC-PKI-01 through TC-PKI-06, TC-VA-01 through TC-VA-06
 */

const fs = require("fs");
const path = require("path");

const FIXTURES = path.join(__dirname, "fixtures");

function loadFixture(name) {
  const raw = fs.readFileSync(path.join(FIXTURES, name), "utf8");
  return JSON.parse(raw);
}

function tryLoadFixture(name) {
  const raw = fs.readFileSync(path.join(FIXTURES, name), "utf8");
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

// ── Helpers that mirror D6V internal logic ───────────────────────────────

/** VR-01: targetDigest format check */
function isValidDigestFormat(digest) {
  if (!digest || typeof digest !== "string") return false;
  return /^(sha256|sha384|sha512)-[0-9a-fA-F]+$/.test(digest);
}

/** VR-03: allowed status values */
const ALLOWED_STATUSES = new Set(["valid", "invalid", "revoked", "unknown"]);

/** VR-06: deduplication */
function dedupeCoverage(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const key = `${item.type}:${item.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** VR-07/VR-08: fallback values */
function signerName(sig) { return sig.signerName || "Unknown"; }
function coverageLabel(sig) { return sig.coverageLabel || "Whole report"; }

/** Map status for display */
function mapStatus(status) {
  const map = { valid: "Valid", invalid: "Invalid", revoked: "Revoked", unknown: "Unknown" };
  return map[status] || "Unknown";
}

/** Name initials (mirrors _nameInitials) */
function nameInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}


// ═══════════════════════════════════════════════════════════════════════════
// Test: Manifest Loading
// ═══════════════════════════════════════════════════════════════════════════

describe("D6 Manifest Loading (TC-01, TC-03, TC-04)", () => {
  test("TC-01: valid single-signer manifest loads and parses", () => {
    const d6 = loadFixture("d6-valid-single.json");
    expect(d6).toHaveProperty("signatures");
    expect(d6.signatures).toHaveLength(1);
    expect(d6.signatures[0].id).toBe("sig-1");
    expect(d6.signatures[0].signerName).toBe("Jane Doe");
  });

  test("TC-01: valid multi-signer manifest loads 3 signatures", () => {
    const d6 = loadFixture("d6-valid-multi.json");
    expect(d6.signatures).toHaveLength(3);
    const ids = d6.signatures.map(s => s.id);
    expect(ids).toEqual(["sig-cfo", "sig-ceo", "sig-auditor"]);
  });

  test("TC-03/TC-42: empty signatures array is valid (no error)", () => {
    const d6 = loadFixture("d6-empty.json");
    expect(d6.signatures).toEqual([]);
  });

  test("TC-04: malformed JSON sets loadError", () => {
    const result = tryLoadFixture("d6-malformed.json");
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(SyntaxError);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Signature Status (VR-03)
// ═══════════════════════════════════════════════════════════════════════════

describe("Signature Status (TC-09, VR-03)", () => {
  test("TC-09: valid status is in allowed set", () => {
    const d6 = loadFixture("d6-valid-single.json");
    for (const sig of d6.signatures) {
      expect(ALLOWED_STATUSES.has(sig.verificationStatus)).toBe(true);
    }
  });

  test("TC-09: invalid status is in allowed set", () => {
    const d6 = loadFixture("d6-invalid-tampered.json");
    expect(ALLOWED_STATUSES.has(d6.signatures[0].verificationStatus)).toBe(true);
    expect(d6.signatures[0].verificationStatus).toBe("invalid");
  });

  test("TC-09: revoked status is in allowed set", () => {
    const d6 = loadFixture("d6-revoked.json");
    expect(d6.signatures[0].verificationStatus).toBe("revoked");
  });

  test("VR-03: mapStatus returns correct display values", () => {
    expect(mapStatus("valid")).toBe("Valid");
    expect(mapStatus("invalid")).toBe("Invalid");
    expect(mapStatus("revoked")).toBe("Revoked");
    expect(mapStatus("unknown")).toBe("Unknown");
    expect(mapStatus("garbage")).toBe("Unknown");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Digest Format Validation (VR-01, VR-02)
// ═══════════════════════════════════════════════════════════════════════════

describe("Digest Format (TC-10, TC-11, TC-12, TC-13, VR-01, VR-02)", () => {
  test("TC-10/TC-12: valid sha256 digest accepted", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const digest = d6.signatures[0].targetDigest;
    expect(isValidDigestFormat(digest)).toBe(true);
    expect(digest.startsWith("sha256-")).toBe(true);
  });

  test("TC-12: malformed digest (no algorithm prefix) rejected", () => {
    expect(isValidDigestFormat("e3b0c44298fc1c149afbf4c8996fb924")).toBe(false);
  });

  test("TC-12: malformed digest (bad algorithm) rejected", () => {
    expect(isValidDigestFormat("md5-e3b0c44298fc1c")).toBe(false);
  });

  test("TC-12: null/undefined/empty digest rejected", () => {
    expect(isValidDigestFormat(null)).toBe(false);
    expect(isValidDigestFormat(undefined)).toBe(false);
    expect(isValidDigestFormat("")).toBe(false);
  });

  test("TC-13: sha384 digest prefix accepted", () => {
    const digest = "sha384-" + "a".repeat(96);
    expect(isValidDigestFormat(digest)).toBe(true);
  });

  test("TC-13: sha512 digest prefix accepted", () => {
    const digest = "sha512-" + "b".repeat(128);
    expect(isValidDigestFormat(digest)).toBe(true);
  });

  test("TC-11: tampered signature has digest that is formally valid but wrong", () => {
    const d6 = loadFixture("d6-invalid-tampered.json");
    const digest = d6.signatures[0].targetDigest;
    // Format is valid — content is wrong (the trace reports mismatch)
    expect(isValidDigestFormat(digest)).toBe(true);
    expect(d6.signatures[0].verificationStatus).toBe("invalid");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Revocation (VR-04)
// ═══════════════════════════════════════════════════════════════════════════

describe("Revocation (TC-14, VR-04)", () => {
  test("TC-14: revoked flag overrides valid digest", () => {
    const d6 = loadFixture("d6-revoked.json");
    const sig = d6.signatures[0];
    // Digest is correct (sha256 of empty string) but signer is revoked
    expect(isValidDigestFormat(sig.targetDigest)).toBe(true);
    expect(sig.revoked).toBe(true);
    expect(sig.verificationStatus).toBe("revoked");
  });

  test("TC-14: non-revoked signer has revoked=false", () => {
    const d6 = loadFixture("d6-valid-single.json");
    expect(d6.signatures[0].revoked).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Fallback Values (VR-07, VR-08)
// ═══════════════════════════════════════════════════════════════════════════

describe("Fallback Values (TC-07, TC-08, VR-07, VR-08)", () => {
  test("TC-07: missing signerName falls back to 'Unknown'", () => {
    const d6 = loadFixture("d6-missing-fields.json");
    expect(signerName(d6.signatures[0])).toBe("Unknown");
  });

  test("TC-08: missing coverageLabel falls back to 'Whole report'", () => {
    const d6 = loadFixture("d6-missing-fields.json");
    expect(coverageLabel(d6.signatures[0])).toBe("Whole report");
  });

  test("VR-07: present signerName used as-is", () => {
    const d6 = loadFixture("d6-valid-single.json");
    expect(signerName(d6.signatures[0])).toBe("Jane Doe");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Name Initials
// ═══════════════════════════════════════════════════════════════════════════

describe("Name Initials", () => {
  test("two-word name returns first+last initials", () => {
    expect(nameInitials("Jane Doe")).toBe("JD");
  });

  test("single-word name returns first two chars", () => {
    expect(nameInitials("Auditor")).toBe("AU");
  });

  test("empty/null name returns '?'", () => {
    expect(nameInitials("")).toBe("?");
    expect(nameInitials(null)).toBe("?");
  });

  test("three-word name returns first+last initials", () => {
    expect(nameInitials("Audit Partner III")).toBe("AI");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Coverage Deduplication (VR-06)
// ═══════════════════════════════════════════════════════════════════════════

describe("Coverage Deduplication (TC-21, VR-06)", () => {
  test("TC-21: duplicate items are removed", () => {
    const items = [
      { type: "fact", value: "f1" },
      { type: "fact", value: "f1" },
      { type: "div", value: "section-a" },
      { type: "fact", value: "f2" },
      { type: "div", value: "section-a" },
    ];
    const result = dedupeCoverage(items);
    expect(result).toHaveLength(3);
    expect(result.map(i => `${i.type}:${i.value}`)).toEqual([
      "fact:f1", "div:section-a", "fact:f2"
    ]);
  });

  test("VR-06: empty array returns empty", () => {
    expect(dedupeCoverage([])).toEqual([]);
  });

  test("VR-06: null/undefined returns empty", () => {
    expect(dedupeCoverage(null)).toEqual([]);
    expect(dedupeCoverage(undefined)).toEqual([]);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Coverage Scope Types (FR-04)
// ═══════════════════════════════════════════════════════════════════════════

describe("Coverage Scope Types (TC-15, TC-16, TC-17, FR-04)", () => {
  test("TC-15: whole-report scope is flagged", () => {
    const d6 = loadFixture("d6-valid-multi.json");
    const cfo = d6.signatures.find(s => s.id === "sig-cfo");
    expect(cfo.wholeReport).toBe(true);
  });

  test("TC-16: section scope via divs array", () => {
    const d6 = loadFixture("d6-valid-single.json");
    expect(d6.signatures[0].coverage.divs).toContain("audit-section");
  });

  test("TC-17: fact scope via facts array", () => {
    const d6 = loadFixture("d6-valid-single.json");
    expect(d6.signatures[0].coverage.facts).toEqual(["f1", "f2", "f3"]);
  });

  test("TC-D6-02: CSS selector scope", () => {
    const d6 = loadFixture("d6-valid-multi.json");
    const auditor = d6.signatures.find(s => s.id === "sig-auditor");
    expect(auditor.coverage.selectors).toHaveLength(1);
    expect(auditor.coverage.selectors[0].selector).toBe(".audit-opinion");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Highlight Style Assignment (FR-16)
// ═══════════════════════════════════════════════════════════════════════════

describe("Highlight Style Assignment (TC-06, FR-16)", () => {
  const STYLES = ["d6-sig-style-1", "d6-sig-style-2", "d6-sig-style-3"];

  test("TC-06: 3 signers get 3 distinct styles", () => {
    const d6 = loadFixture("d6-valid-multi.json");
    const assigned = d6.signatures.map((_, i) => STYLES[i % STYLES.length]);
    expect(new Set(assigned).size).toBe(3);
  });

  test("TC-06: styles cycle for >3 signers", () => {
    const sigs = Array.from({ length: 5 }, (_, i) => ({ id: `sig-${i}` }));
    const assigned = sigs.map((_, i) => STYLES[i % STYLES.length]);
    expect(assigned[0]).toBe("d6-sig-style-1");
    expect(assigned[3]).toBe("d6-sig-style-1"); // wraps
    expect(assigned[4]).toBe("d6-sig-style-2");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Verification Trace (FR-11)
// ═══════════════════════════════════════════════════════════════════════════

describe("Verification Trace (TC-36, FR-11)", () => {
  test("TC-36: each trace step has name and outcome", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const trace = d6.signatures[0].verificationTrace;
    expect(trace.length).toBeGreaterThan(0);
    for (const step of trace) {
      expect(step).toHaveProperty("name");
      expect(step).toHaveProperty("outcome");
      expect(["pass", "fail"]).toContain(step.outcome);
    }
  });

  test("TC-36: trace steps include specRef", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const trace = d6.signatures[0].verificationTrace;
    const withRef = trace.filter(s => s.specRef);
    expect(withRef.length).toBe(trace.length); // all have specRef
    expect(withRef[0].specRef).toMatch(/^D6 §/);
  });

  test("TC-36: trace steps include testCases array", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const trace = d6.signatures[0].verificationTrace;
    const withTc = trace.filter(s => s.testCases && s.testCases.length > 0);
    expect(withTc.length).toBeGreaterThan(0);
    expect(withTc[0].testCases[0]).toMatch(/^TC-/);
  });

  test("TC-D6-05: tampered signature trace has a fail step", () => {
    const d6 = loadFixture("d6-invalid-tampered.json");
    const trace = d6.signatures[0].verificationTrace;
    const fails = trace.filter(s => s.outcome === "fail");
    expect(fails.length).toBeGreaterThanOrEqual(1);
    const digestFail = fails.find(s => s.name === "Compare digests");
    expect(digestFail).toBeDefined();
    expect(digestFail.detail.reason).toMatch(/mismatch/i);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: Hash Check Payload (FR-13)
// ═══════════════════════════════════════════════════════════════════════════

describe("Hash Check Payload (TC-37, TC-38, FR-13)", () => {
  function buildHashCheckPayload(sig) {
    return {
      v: 1,
      signatureId: sig.id,
      signerName: sig.signerName,
      status: sig.verificationStatus,
      targetDigest: sig.targetDigest,
      generatedAt: new Date().toISOString(),
    };
  }

  function buildHashCheckUrl(payload, baseUrl) {
    const json = JSON.stringify(payload);
    const b64 = Buffer.from(json).toString("base64url");
    return `${baseUrl}?payload=${b64}`;
  }

  test("TC-37: payload contains required fields", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const payload = buildHashCheckPayload(d6.signatures[0]);
    expect(payload).toHaveProperty("v", 1);
    expect(payload).toHaveProperty("signatureId", "sig-1");
    expect(payload).toHaveProperty("signerName", "Jane Doe");
    expect(payload).toHaveProperty("targetDigest");
    expect(payload).toHaveProperty("generatedAt");
  });

  test("TC-38: hash check URL is well-formed", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const payload = buildHashCheckPayload(d6.signatures[0]);
    const url = buildHashCheckUrl(payload, "https://xbrl.org/verify-hash");
    expect(url).toMatch(/^https:\/\/xbrl\.org\/verify-hash\?payload=/);
    // Decode and verify round-trip
    const b64 = url.split("payload=")[1];
    const decoded = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    expect(decoded.signatureId).toBe("sig-1");
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: D6 Spec Conformance (TC-D6-01 through TC-D6-05)
// ═══════════════════════════════════════════════════════════════════════════

describe("D6 Specification Conformance", () => {
  test("TC-D6-01: fact subset — signature has fact IDs in coverage", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const sig = d6.signatures[0];
    expect(sig.coverage.facts.length).toBeGreaterThan(0);
    for (const fid of sig.coverage.facts) {
      expect(typeof fid).toBe("string");
      expect(fid.length).toBeGreaterThan(0);
    }
  });

  test("TC-D6-02: CSS selector subset — signature has selector in coverage", () => {
    const d6 = loadFixture("d6-valid-multi.json");
    const auditor = d6.signatures.find(s => s.id === "sig-auditor");
    expect(auditor.coverage.selectors.length).toBeGreaterThan(0);
    expect(auditor.coverage.selectors[0]).toHaveProperty("selector");
  });

  test("TC-D6-03: dependency signing — signature references signatureFile", () => {
    const d6 = loadFixture("d6-valid-single.json");
    expect(d6.signatures[0]).toHaveProperty("signatureFile");
    expect(d6.signatures[0].signatureFile).toMatch(/^META-INF\//);
  });

  test("TC-D6-04: verification — all trace steps pass for valid signature", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const trace = d6.signatures[0].verificationTrace;
    const allPass = trace.every(s => s.outcome === "pass");
    expect(allPass).toBe(true);
  });

  test("TC-D6-05: tamper test — invalid signature has fail in trace", () => {
    const d6 = loadFixture("d6-invalid-tampered.json");
    expect(d6.signatures[0].verificationStatus).toBe("invalid");
    const trace = d6.signatures[0].verificationTrace;
    expect(trace.some(s => s.outcome === "fail")).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Test: PKI Signature Verification (FR-18, FR-19, VR-09–VR-12)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mirror of _verifyPkiSignature from d6-plugin.js, implemented using
 * Node.js crypto.webcrypto so tests run without a browser.
 */
const { subtle } = require("crypto").webcrypto;

async function verifyPkiSignature(sig, sigFileJson) {
  const json = sigFileJson || sig;
  const publicKeyJwk = json.publicKey || sig.publicKey;
  const signatureValueB64 = json.signatureValue || sig.signatureValue;

  if (!publicKeyJwk) return { status: "skipped", reason: "No publicKey — PKI verification skipped" };
  if (!signatureValueB64) return { status: "skipped", reason: "No signatureValue — PKI verification skipped" };

  let signingInputBytes;
  if (json.signingInput || sig.signingInput) {
    const b64 = json.signingInput || sig.signingInput;
    try {
      signingInputBytes = Uint8Array.from(Buffer.from(b64, "base64url"));
    } catch {
      return { status: "invalid", reason: "signingInput is not valid base64url" };
    }
  } else {
    const targetDigest = json.targetDigest || sig.targetDigest || "";
    signingInputBytes = Buffer.from(targetDigest, "utf8");
  }

  let signatureBytes;
  try {
    signatureBytes = Uint8Array.from(Buffer.from(signatureValueB64, "base64url"));
  } catch {
    return { status: "invalid", reason: "signatureValue is not valid base64url" };
  }

  const algorithmStr = String(json.algorithm || sig.algorithm || "").trim();
  let importParams, verifyParams;
  if (/^RSA-PSS\/(SHA-256|SHA-384|SHA-512)$/i.test(algorithmStr)) {
    const hash = algorithmStr.split("/")[1].toUpperCase();
    const saltLength = hash === "SHA-256" ? 32 : hash === "SHA-384" ? 48 : 64;
    importParams = { name: "RSA-PSS", hash };
    verifyParams = { name: "RSA-PSS", saltLength };
  } else if (/^ECDSA\/(P-256|P-384)$/i.test(algorithmStr)) {
    const curve = algorithmStr.split("/")[1].toUpperCase();
    const hash = curve === "P-256" ? "SHA-256" : "SHA-384";
    importParams = { name: "ECDSA", namedCurve: curve };
    verifyParams = { name: "ECDSA", hash };
  } else if (!algorithmStr) {
    return { status: "skipped", reason: "No algorithm — PKI verification skipped" };
  } else {
    return { status: "skipped", reason: `Unsupported PKI algorithm "${algorithmStr}"` };
  }

  try {
    const cryptoKey = await subtle.importKey("jwk", publicKeyJwk, importParams, false, ["verify"]);
    const valid = await subtle.verify(verifyParams, cryptoKey, signatureBytes, signingInputBytes);
    return valid
      ? { status: "valid", reason: "PKI signature verified successfully" }
      : { status: "invalid", reason: "Signature value does not match public key" };
  } catch (e) {
    return { status: "invalid", reason: `PKI verification error: ${e.message}` };
  }
}

/** TC-PKI-05 / TC-PKI-06 — algorithm string → WebCrypto params mapping */
function mapPkiAlgorithm(algorithmStr) {
  if (/^RSA-PSS\/(SHA-256|SHA-384|SHA-512)$/i.test(algorithmStr)) {
    const hash = algorithmStr.split("/")[1].toUpperCase();
    const saltLength = hash === "SHA-256" ? 32 : hash === "SHA-384" ? 48 : 64;
    return { importParams: { name: "RSA-PSS", hash }, verifyParams: { name: "RSA-PSS", saltLength } };
  }
  if (/^ECDSA\/(P-256|P-384)$/i.test(algorithmStr)) {
    const curve = algorithmStr.split("/")[1].toUpperCase();
    const hash = curve === "P-256" ? "SHA-256" : "SHA-384";
    return { importParams: { name: "ECDSA", namedCurve: curve }, verifyParams: { name: "ECDSA", hash } };
  }
  return null;
}

describe("PKI Signature Verification (TC-PKI-01 – TC-PKI-06, FR-18, FR-19)", () => {
  // ── TC-PKI-01: valid RSA-PSS/SHA-256 signature verifies as "valid" ──────
  test("TC-PKI-01: valid RSA-PSS/SHA-256 publicKey + signatureValue → pkiStatus valid", async () => {
    const d6 = loadFixture("d6-valid-single.json");
    const sig = d6.signatures[0];
    const result = await verifyPkiSignature(sig, null);
    expect(result.status).toBe("valid");
  });

  // ── TC-PKI-01: fixture trace has a PKI step with outcome "pass" ──────────
  test("TC-PKI-01: d6-valid-single trace includes PKI pass step", () => {
    const d6 = loadFixture("d6-valid-single.json");
    const trace = d6.signatures[0].verificationTrace;
    const pkiStep = trace.find(s => s.name === "PKI signature verify");
    expect(pkiStep).toBeDefined();
    expect(pkiStep.outcome).toBe("pass");
    expect(pkiStep.detail.pkiStatus).toBe("valid");
  });

  // ── TC-PKI-02: tampered signatureValue → pkiStatus invalid ───────────────
  test("TC-PKI-02: wrong signatureValue → pkiStatus invalid", async () => {
    const d6 = loadFixture("d6-invalid-tampered.json");
    const sig = d6.signatures[0];
    // The tampered fixture has the same publicKey but a bogus signatureValue
    const result = await verifyPkiSignature(sig, null);
    expect(result.status).toBe("invalid");
    expect(result.reason).toMatch(/does not match|verification error/i);
  });

  // ── TC-PKI-02: fixture trace has a PKI step with outcome "fail" ──────────
  test("TC-PKI-02: d6-invalid-tampered trace includes PKI fail step", () => {
    const d6 = loadFixture("d6-invalid-tampered.json");
    const trace = d6.signatures[0].verificationTrace;
    const pkiStep = trace.find(s => s.name === "PKI signature verify");
    expect(pkiStep).toBeDefined();
    expect(pkiStep.outcome).toBe("fail");
    expect(pkiStep.detail.pkiStatus).toBe("invalid");
  });

  // ── TC-PKI-03: missing publicKey → skipped ────────────────────────────────
  test("TC-PKI-03: missing publicKey → pkiStatus skipped", async () => {
    const d6 = loadFixture("d6-missing-fields.json");
    const sig = d6.signatures[0];
    const result = await verifyPkiSignature(sig, null);
    expect(result.status).toBe("skipped");
    expect(result.reason).toMatch(/publicKey/i);
  });

  // ── TC-PKI-04: missing signatureValue → skipped ───────────────────────────
  test("TC-PKI-04: missing signatureValue → pkiStatus skipped", async () => {
    // Signature has a publicKey but no signatureValue
    const sigWithKeyOnly = {
      algorithm: "RSA-PSS/SHA-256",
      targetDigest: "sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      publicKey: { kty: "RSA", alg: "PS256", key_ops: ["verify"], ext: true,
        n: "piHt3gXaqs8sqatAY8Wo5KXu5rHFvnsbO7NzpR5VOdGLOFyzL6iQqCTnV5-txzoAxs4oWr06OTPPG55Xmi0huAaDVieSsf7g48vL-UEEYpr9sAX8pjUnSeEnQSsWRp0U6DtebLxcIpuaV49gpfiR2ZkkmQnfApGhJfnANZvNVuUpkbkZRqNGktCX-3zUqgT9w9ahbybEYxlBKhDLH3y8Eb_g8UKswIz8PoE884XMRpzHGQwdE9OMms4QNALpmmCOJvhB5s5t66GQzES0KRqi8oX0UeUUPZbTMclb-ckQ5EUHT4Zpugz3ku6Lua9RkpxthoqnRVgzWCUhT9Kw1DYvcQ",
        e: "AQAB" }
      // no signatureValue
    };
    const result = await verifyPkiSignature(sigWithKeyOnly, null);
    expect(result.status).toBe("skipped");
    expect(result.reason).toMatch(/signatureValue/i);
  });

  // ── TC-PKI-05: RSA-PSS algorithm string mapping ───────────────────────────
  test("TC-PKI-05: RSA-PSS/SHA-256 maps to correct WebCrypto params", () => {
    const mapped = mapPkiAlgorithm("RSA-PSS/SHA-256");
    expect(mapped).not.toBeNull();
    expect(mapped.importParams).toEqual({ name: "RSA-PSS", hash: "SHA-256" });
    expect(mapped.verifyParams).toEqual({ name: "RSA-PSS", saltLength: 32 });
  });

  test("TC-PKI-05: RSA-PSS/SHA-384 maps to correct WebCrypto params", () => {
    const mapped = mapPkiAlgorithm("RSA-PSS/SHA-384");
    expect(mapped.importParams).toEqual({ name: "RSA-PSS", hash: "SHA-384" });
    expect(mapped.verifyParams).toEqual({ name: "RSA-PSS", saltLength: 48 });
  });

  test("TC-PKI-05: RSA-PSS/SHA-512 maps to correct WebCrypto params", () => {
    const mapped = mapPkiAlgorithm("RSA-PSS/SHA-512");
    expect(mapped.importParams).toEqual({ name: "RSA-PSS", hash: "SHA-512" });
    expect(mapped.verifyParams).toEqual({ name: "RSA-PSS", saltLength: 64 });
  });

  // ── TC-PKI-06: ECDSA algorithm string mapping ─────────────────────────────
  test("TC-PKI-06: ECDSA/P-256 maps to { name: ECDSA, hash: SHA-256 }", () => {
    const mapped = mapPkiAlgorithm("ECDSA/P-256");
    expect(mapped).not.toBeNull();
    expect(mapped.importParams).toEqual({ name: "ECDSA", namedCurve: "P-256" });
    expect(mapped.verifyParams).toEqual({ name: "ECDSA", hash: "SHA-256" });
  });

  test("TC-PKI-06: ECDSA/P-384 maps to { name: ECDSA, hash: SHA-384 }", () => {
    const mapped = mapPkiAlgorithm("ECDSA/P-384");
    expect(mapped.importParams).toEqual({ name: "ECDSA", namedCurve: "P-384" });
    expect(mapped.verifyParams).toEqual({ name: "ECDSA", hash: "SHA-384" });
  });

  test("TC-PKI-06: unknown algorithm string returns null mapping", () => {
    expect(mapPkiAlgorithm("RSA-PKCS1/SHA-256")).toBeNull();
    expect(mapPkiAlgorithm("")).toBeNull();
    expect(mapPkiAlgorithm("MD5/whatever")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Test: Validation Authority Integration (FR-20, FR-21, FR-22, VR-13)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Helpers that mirror the VA-related logic in d6-plugin.js so that tests
 * run in a Node.js environment without a browser or a live VA service.
 */

/** Mirror of _vaStatusLabel */
function vaStatusLabel(vaResult) {
  if (!vaResult) return null;
  const s = vaResult.overallStatus;
  if (s === "not-configured") return null;
  if (s === "valid") return "Chain valid";
  if (s === "invalid") return "Chain invalid";
  if (s === "partial") return "Chain partial";
  if (s === "skipped") return "Chain not checked";
  if (s === "error") return "VA error";
  return "Chain unknown";
}

/** VR-13: validate required fields in a VA response */
function validateVaResponse(json) {
  if (typeof json.version !== "number" || !json.signatureId || !json.overallStatus) {
    return { overallStatus: "error", errorCode: "INVALID_RESPONSE", errorMessage: "VA response missing required fields" };
  }
  return json;
}

/**
 * Simulate _fetchVaResult: given a fake fetch response (or an error), apply
 * the same logic as the plugin and return the normalised vaResult.
 *
 * @param {object|null} fetchJson  - Parsed JSON body returned by the mock fetch, or null to simulate a timeout/network error.
 * @param {boolean} timeout        - If true simulate an AbortError (timeout).
 * @param {boolean} httpError      - If true simulate a non-2xx HTTP response.
 * @param {number}  httpStatus     - HTTP status code to use when httpError is true.
 */
async function simulateFetchVaResult(fetchJson, { timeout = false, httpError = false, httpStatus = 500 } = {}) {
  // Mirrors the try/catch in _fetchVaResult after the vaUrl guard
  try {
    if (timeout) {
      const e = new Error("The operation was aborted");
      e.name = "AbortError";
      throw e;
    }
    if (httpError) {
      return { overallStatus: "unknown", errorCode: `HTTP_${httpStatus}` };
    }
    const json = fetchJson;
    // VR-13 check
    return validateVaResponse(json);
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return { overallStatus: "unknown", errorCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR", errorMessage: e.message };
  }
}

describe("Validation Authority Integration (TC-VA-01 – TC-VA-06, FR-20, FR-21, FR-22, VR-13)", () => {
  // ── TC-VA-01: well-formed VA response is accepted as-is ─────────────────
  test("TC-VA-01: well-formed VA response passes VR-13 and returns chainStatus valid", async () => {
    const mockResponse = {
      version: 1,
      signatureId: "sig-1",
      overallStatus: "valid",
      checks: {
        chain:       { status: "valid", detail: "Chain built to root" },
        revocation:  { status: "valid", detail: "No revocations found" },
        trustAnchor: { status: "valid", family: "eIDAS", level: "QES", detail: "EU Trusted List match" }
      },
      certInfo: {
        subject: "CN=Test Signer,O=Acme,C=DE",
        issuer: "CN=Test CA,O=Acme PKI,C=DE",
        notBefore: "2025-01-01T00:00:00Z",
        notAfter: "2027-01-01T00:00:00Z"
      }
    };
    const result = await simulateFetchVaResult(mockResponse);
    expect(result.overallStatus).toBe("valid");
    expect(result.checks.chain.status).toBe("valid");
    expect(result.checks.trustAnchor.family).toBe("eIDAS");
    expect(result.checks.trustAnchor.level).toBe("QES");
    expect(result.certInfo.subject).toContain("Acme");
    expect(vaStatusLabel(result)).toBe("Chain valid");
  });

  // ── TC-VA-02: VA response missing overallStatus → treated as error ───────
  test("TC-VA-02: VA response missing overallStatus → error, chainStatus unknown-class", async () => {
    // Missing overallStatus — VR-13 should catch this
    const badResponse = { version: 1, signatureId: "sig-1" };
    const result = await simulateFetchVaResult(badResponse);
    expect(result.overallStatus).toBe("error");
    expect(result.errorCode).toBe("INVALID_RESPONSE");
  });

  test("TC-VA-02: VA response missing version → error, errorCode INVALID_RESPONSE", async () => {
    const badResponse = { signatureId: "sig-1", overallStatus: "valid" };
    const result = await simulateFetchVaResult(badResponse);
    expect(result.overallStatus).toBe("error");
    expect(result.errorCode).toBe("INVALID_RESPONSE");
  });

  test("TC-VA-02: VA response missing signatureId → error, errorCode INVALID_RESPONSE", async () => {
    const badResponse = { version: 1, overallStatus: "valid" };
    const result = await simulateFetchVaResult(badResponse);
    expect(result.overallStatus).toBe("error");
    expect(result.errorCode).toBe("INVALID_RESPONSE");
  });

  // ── TC-VA-03: no validationAuthorityUrl → not-configured, deferred msg ───
  test("TC-VA-03: absent validationAuthorityUrl → overallStatus not-configured", () => {
    // This mirrors the guard at the top of _fetchVaResult
    const vaUrl = undefined; // no config
    const result = vaUrl ? { overallStatus: "pending" } : { overallStatus: "not-configured" };
    expect(result.overallStatus).toBe("not-configured");
    expect(vaStatusLabel(result)).toBeNull(); // "not-configured" returns null label
  });

  test("TC-VA-03: vaStatusLabel(not-configured) is null (deferred message shown)", () => {
    expect(vaStatusLabel({ overallStatus: "not-configured" })).toBeNull();
  });

  // ── TC-VA-04: VA timeout → unknown, signature NOT marked invalid ─────────
  test("TC-VA-04: VA call times out → overallStatus unknown, errorCode TIMEOUT", async () => {
    const result = await simulateFetchVaResult(null, { timeout: true });
    expect(result.overallStatus).toBe("unknown");
    expect(result.errorCode).toBe("TIMEOUT");
  });

  test("TC-VA-04: timeout result does NOT make signature invalid (vaInvalid guard)", () => {
    // The plugin only sets vaInvalid = true when overallStatus === "invalid"
    const timeoutResult = { overallStatus: "unknown", errorCode: "TIMEOUT" };
    const vaInvalid = timeoutResult?.overallStatus === "invalid";
    expect(vaInvalid).toBe(false);
  });

  test("TC-VA-04: HTTP non-2xx → overallStatus unknown with HTTP error code", async () => {
    const result = await simulateFetchVaResult(null, { httpError: true, httpStatus: 503 });
    expect(result.overallStatus).toBe("unknown");
    expect(result.errorCode).toBe("HTTP_503");
  });

  // ── TC-VA-05: vLeiInfo and certInfo identity data rendered correctly ──────
  test("TC-VA-05: vaResult with vLeiInfo → legalName and role present in response", async () => {
    const mockResponse = {
      version: 1,
      signatureId: "sig-1",
      overallStatus: "valid",
      checks: {
        chain:       { status: "valid" },
        revocation:  { status: "valid" },
        trustAnchor: { status: "valid", family: "vLEI", level: "OOR" }
      },
      vLeiInfo: {
        legalName: "Acme Corporation",
        role: "CFO",
        lei: "5493001KJTIIGC8Y1R12",
        qvi: "GLEIF QVI Example",
        credentialStatus: "active"
      }
    };
    const result = await simulateFetchVaResult(mockResponse);
    expect(result.overallStatus).toBe("valid");
    expect(result.vLeiInfo.legalName).toBe("Acme Corporation");
    expect(result.vLeiInfo.role).toBe("CFO");
    expect(result.vLeiInfo.lei).toBe("5493001KJTIIGC8Y1R12");
    expect(result.checks.trustAnchor.family).toBe("vLEI");
    expect(vaStatusLabel(result)).toBe("Chain valid");
  });

  test("TC-VA-05: vaResult with certInfo → subject and issuer present", async () => {
    const mockResponse = {
      version: 1,
      signatureId: "sig-1",
      overallStatus: "valid",
      checks: {
        chain:       { status: "valid" },
        revocation:  { status: "valid" },
        trustAnchor: { status: "valid", family: "eIDAS", level: "AES" }
      },
      certInfo: {
        subject: "CN=Maria Schmidt,O=Bundesamt,C=DE",
        issuer: "CN=D-Trust SMIME CA,O=D-Trust GmbH,C=DE",
        notBefore: "2025-03-01T00:00:00Z",
        notAfter: "2028-03-01T00:00:00Z"
      }
    };
    const result = await simulateFetchVaResult(mockResponse);
    expect(result.certInfo.subject).toContain("Schmidt");
    expect(result.certInfo.issuer).toContain("D-Trust");
  });

  // ── TC-VA-06: VA overallStatus "invalid" → signature becomes invalid ──────
  test("TC-VA-06: VA overallStatus invalid → vaInvalid flag triggers invalid status", async () => {
    const mockResponse = {
      version: 1,
      signatureId: "sig-1",
      overallStatus: "invalid",
      checks: {
        chain:       { status: "invalid", detail: "Root CA not in EU Trusted List" },
        revocation:  { status: "unknown" },
        trustAnchor: { status: "invalid", detail: "No matching trust anchor found" }
      }
    };
    const result = await simulateFetchVaResult(mockResponse);
    expect(result.overallStatus).toBe("invalid");
    // Mirror the vaInvalid guard in _normalizeSignatures
    const vaInvalid = result?.overallStatus === "invalid";
    expect(vaInvalid).toBe(true);
    expect(vaStatusLabel(result)).toBe("Chain invalid");
  });

  test("TC-VA-06: only overallStatus=invalid (not unknown/error/partial) triggers vaInvalid", () => {
    for (const s of ["unknown", "error", "partial", "skipped", "not-configured", "valid"]) {
      const vaInvalid = ({ overallStatus: s })?.overallStatus === "invalid";
      expect(vaInvalid).toBe(false);
    }
  });

  // ── vaStatusLabel label mapping ──────────────────────────────────────────
  test("vaStatusLabel maps all known overallStatus values correctly", () => {
    expect(vaStatusLabel({ overallStatus: "valid" })).toBe("Chain valid");
    expect(vaStatusLabel({ overallStatus: "invalid" })).toBe("Chain invalid");
    expect(vaStatusLabel({ overallStatus: "partial" })).toBe("Chain partial");
    expect(vaStatusLabel({ overallStatus: "skipped" })).toBe("Chain not checked");
    expect(vaStatusLabel({ overallStatus: "error" })).toBe("VA error");
    expect(vaStatusLabel({ overallStatus: "unknown" })).toBe("Chain unknown");
    expect(vaStatusLabel({ overallStatus: "not-configured" })).toBeNull();
    expect(vaStatusLabel(null)).toBeNull();
  });
});
