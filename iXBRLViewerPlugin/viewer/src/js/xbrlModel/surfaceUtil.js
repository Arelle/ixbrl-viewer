// See COPYRIGHT.md for copyright information

import Decimal from 'decimal.js';

// Reconstruct a fact's numeric value from the text shown in the document plus
// the OIM numeric metadata (scale/sign/transformation), so the viewer can format
// it and show its accuracy/scale like an iXBRL fact.  Returns a plain decimal
// string (no grouping) or null if the text can't be interpreted as a number
// (in which case the caller should fall back to treating the fact as textual).
//
// The document shows the *scaled* presentation value (e.g. revenue "391,035" in
// millions); the reported value is that times 10^scale, matching iXBRL, where
// the stored value is the full value and scale is a display hint.
export function parseNumericValue(text, meta = {}) {
    // An explicit OIM value always wins.
    if (meta.explicitValue !== null && meta.explicitValue !== undefined && meta.explicitValue !== "") {
        try {
            return new Decimal(meta.explicitValue).toFixed();
        }
        catch (e) {
            // fall through to text parsing
        }
    }
    if (text === null || text === undefined) {
        return null;
    }
    let s = String(text).trim();
    if (!s) {
        return null;
    }

    // Negativity can come from the OIM sign, parentheses, or a leading minus.
    let negative = meta.sign === "-";
    if (/^\(.*\)$/.test(s)) {
        negative = true;
        s = s.slice(1, -1);
    }
    // Normalise separators according to the transform's decimal separator.
    if (/comma-decimal/i.test(meta.transformation || "")) {
        s = s.replace(/[.  ]/g, "").replace(",", ".");
    }
    else {
        s = s.replace(/,/g, "");
    }
    if (s.includes("-")) {
        negative = true;
    }
    // Keep magnitude digits and a decimal point only.
    s = s.replace(/[^\d.]/g, "");
    if (s === "" || s === ".") {
        return null;
    }

    let num;
    try {
        num = new Decimal(s);
    }
    catch (e) {
        return null;
    }
    if (negative && !num.isZero()) {
        num = num.negated();
    }
    if (meta.scale) {
        num = num.times(new Decimal(10).pow(meta.scale));
    }
    return num.toFixed();
}

// Set a bound fact's value (and its IXNode scale) from the text shown in the
// document.  Numeric facts get their reconstructed numeric value; if the text
// can't be parsed as a number the fact falls back to textual display so the
// viewer doesn't try to format non-numeric text.  Shared by both surfaces.
export function applyFactValue(factData, ixNode, docText) {
    const text = docText === null || docText === undefined
        ? null
        : String(docText).replace(/\s+/g, " ").trim();

    if (factData.num) {
        const numeric = parseNumericValue(text, factData.num);
        if (numeric !== null) {
            factData.v = numeric;
            if (factData.num.scale) {
                ixNode.scale = factData.num.scale;
            }
            return;
        }
        // Not interpretable as a number - show the text instead.
        delete factData.a.u;
        delete factData.num;
    }

    if (factData.v === null || factData.v === undefined) {
        factData.v = text ?? "";
    }
}

// Resolve once an iframe's document has finished loading and has body content.
// There is no single reliable load event for a document written via
// document.write, so we poll (matching the approach used for the iXBRL path).
export function iframeReady(iframe) {
    return new Promise((resolve) => {
        const timer = setInterval(() => {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if ((doc.readyState === "complete" || doc.readyState === "interactive")
                    && doc.body && doc.body.children.length > 0) {
                clearInterval(timer);
                resolve();
            }
        }, 100);
    });
}
