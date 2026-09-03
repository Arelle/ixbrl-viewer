// See COPYRIGHT.md for copyright information

/*
 * Solving the derivation chain for a bind.
 *
 * When binding a fact the model already asserts, both ends are known: the value
 * the model claims, and the text the user just clicked.  What sits between them
 * -- transformation, scale, sign -- is therefore the unknown in an equation
 * rather than something to guess at.  For numeric facts it can be solved
 * exactly; for the rest it can at least be narrowed to a shortlist.
 *
 * Two rules the callers depend on:
 *
 *   - Nothing here applies anything.  Solving assumes the asserted value is
 *     correct, and a rebind is often precisely the case where it is not, so a
 *     silently applied scale would bury a real tagging error.  These functions
 *     return candidates for a human to accept.
 *   - Where several derivations reproduce the value, all of them are returned.
 *     "01/02/2025" really is ambiguous between two date transforms, and that
 *     ambiguity is information the user needs rather than noise to hide.
 *
 * The transform table is injected rather than imported so this stays a pure
 * module, testable without a viewer or a loaded taxonomy.
 */

import { normaliseForCompare } from "./journal.js";

/* Scales worth considering: thousands through trillions, and the negative
 * powers a percentage or per-unit presentation implies. */
const SCALE_RANGE = [];
for (let s = -6; s <= 12; s++) {
    SCALE_RANGE.push(s);
}

/*
 * Compare with a tolerance proportional to magnitude: 84.5 * 10^6 is not
 * exactly 84500000 in binary floating point, and an absolute epsilon would
 * either reject large values or accept nonsense small ones.
 */
function closeEnough(a, b) {
    if (a === b) {
        return true;
    }
    const scale = Math.max(Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= scale * 1e-9;
}

/*
 * A single numeric presentation, and nothing more: an optional sign or opening
 * paren, a leading digit group, any number of separator-plus-exactly-three-digit
 * groups, then at most one decimal part.
 *
 * This structural check has to happen on the raw text, before normalisation.
 * Normalising strips the spaces that separate a row's numbers, so "84,5 76,8"
 * becomes "84,576,8", whereupon the thousands-separator rule reads those commas
 * as grouping and yields 845768 -- a number that appears nowhere in the
 * document.  The solver would then fit a scale to it and report a confident,
 * fabricated derivation.  Requiring the groups to be three digits distinguishes
 * a genuine "41 182,5" from two adjacent values.
 */
const SINGLE_NUMBER = /^[-−+(]?\s*(?:\d{1,3}(?:[\s,.]\d{3})+|\d+)(?:[.,]\d+)?\s*[-)]?$/u;

/* Parse a presentation into a number, reusing the verdict normaliser so that
 * what counts as a number here is what counts as a match there. */
export function parseNumeric(text) {
    if (text == null) {
        return null;
    }
    const raw = String(text).trim();
    if (raw === "" || !SINGLE_NUMBER.test(raw)) {
        return null;
    }
    const t = normaliseForCompare(raw);
    if (t === "" || !/^-?\d*\.?\d+$/.test(t)) {
        return null;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/*
 * Solve sign and scale for a numeric bind.  Returns null when either end is not
 * a number, and an empty solutions array when no power of ten relates them --
 * which is itself a useful answer, since it means the capture is probably wrong
 * rather than merely presented differently.
 */
export function solveNumeric(factValue, capturedText) {
    const value = parseNumeric(factValue);
    const captured = parseNumeric(capturedText);
    if (value === null || captured === null) {
        return null;
    }
    const solutions = [];

    // Zero relates to zero under every scale, so no scale is determinable.
    if (value === 0 && captured === 0) {
        return { value, captured, solutions: [{ scale: null, sign: null, note: "both zero; scale is not determinable" }] };
    }
    if (captured === 0 || value === 0) {
        return { value, captured, solutions: [] };
    }

    for (const negate of [false, true]) {
        const base = negate ? -captured : captured;
        // A sign flip only makes sense if it actually changes the relationship
        if (negate && Math.sign(captured) === Math.sign(value)) {
            continue;
        }
        for (const scale of SCALE_RANGE) {
            if (closeEnough(base * Math.pow(10, scale), value)) {
                solutions.push({
                    scale: scale === 0 ? null : scale,
                    sign: negate ? "-" : null,
                    note: describeNumeric(scale, negate),
                });
            }
        }
    }
    return { value, captured, solutions };
}

function describeNumeric(scale, negate) {
    const parts = [];
    if (scale !== 0) {
        parts.push(`scale ${scale}`);
    }
    if (negate) {
        parts.push("negated");
    }
    return parts.length ? parts.join(", ") : "no adjustment needed";
}

/*
 * Build a matcher for an XSD pattern.  XSD patterns are implicitly anchored to
 * the whole value, which JavaScript's RegExp is not, so they are wrapped -- an
 * unanchored test would let a date pattern match any string that merely
 * contained a date, and every transform would look like a candidate.
 */
function patternMatcher(patterns) {
    const compiled = [];
    for (const p of patterns ?? []) {
        try {
            compiled.push(new RegExp(`^(?:${p})$`, "u"));
        }
        catch {
            // A pattern JavaScript cannot compile must not silently exclude its
            // transform: fall back to accepting, and let the value check decide.
            return () => true;
        }
    }
    if (!compiled.length) {
        return () => true;
    }
    return (text) => compiled.some(re => re.test(text));
}

/*
 * Shortlist the transforms that could plausibly turn this text into a value of
 * this datatype.  Two filters, neither of which requires implementing a single
 * transform: the declared output datatype must be the concept's, and the
 * declared input datatype's pattern must accept the captured text.
 *
 *   transforms: [{ name, inputDataType, outputDataType }]
 *   dataTypes:  { name: { patterns: [...] } }
 *
 * A shortlist is as far as pattern matching can go, and deliberately so: a
 * pattern says the text is *shaped* like the transform's input, not that the
 * transform applied to it yields the asserted value.  Confirming that means
 * running the transforms, which Arelle already does -- FunctionIxt.py carries
 * the registry implementations, derived from the same registry schema these
 * patterns come from.  So the division is not a gap to be filled in JavaScript
 * by reimplementing 100 transforms: the browser narrows the candidates, and the
 * apply step verifies them, in the one place they are already implemented and
 * conformance-tested.  Callers must therefore present a shortlist as "could
 * apply", never as solved.
 */
export function candidateTransforms({ capturedText, dataType, transforms = [], dataTypes = {} }) {
    if (!capturedText || !dataType) {
        return [];
    }
    const text = String(capturedText).trim();
    const out = [];
    for (const t of transforms) {
        if (t.outputDataType !== dataType) {
            continue;
        }
        const inputType = dataTypes[t.inputDataType];
        const matches = patternMatcher(inputType?.patterns);
        if (matches(text)) {
            out.push({ transformation: t.name, inputDataType: t.inputDataType });
        }
    }
    return out;
}

/*
 * The whole derivation question for one capture.
 *
 * `kind` tells the caller how much to trust the result, which the UI needs in
 * order to word itself honestly:
 *   "none"      no adjustment needed -- text and value already agree
 *   "solved"    an exact arithmetic relationship (scale and/or sign)
 *   "shortlist" transforms that could apply, not verified to reproduce the value
 *   "unrelated" numeric on both ends, but no power of ten relates them
 *   "unknown"   nothing determinable
 */
export function solveDerivation({ factValue, capturedText, dataType, transforms, dataTypes }) {
    const numeric = solveNumeric(factValue, capturedText);
    if (numeric && numeric.solutions.length) {
        const trivial = numeric.solutions.length === 1
            && numeric.solutions[0].scale === null
            && numeric.solutions[0].sign === null;
        return {
            kind: trivial ? "none" : "solved",
            solutions: numeric.solutions,
            value: numeric.value,
            captured: numeric.captured,
        };
    }
    /*
     * Both ends are plain numbers but no power of ten relates them, so the
     * capture is on the wrong content.  Reported before the transform shortlist
     * and instead of it: no numeric transform reconciles 84.5 with 1013.2, and
     * offering one would dress up a bad bind as a formatting question.
     */
    if (numeric) {
        return { kind: "unrelated", solutions: [], value: numeric.value, captured: numeric.captured };
    }
    const shortlist = candidateTransforms({ capturedText, dataType, transforms, dataTypes });
    if (shortlist.length) {
        return { kind: "shortlist", solutions: shortlist };
    }
    return { kind: "unknown", solutions: [] };
}
