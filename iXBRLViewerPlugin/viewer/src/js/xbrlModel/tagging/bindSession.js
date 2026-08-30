// See COPYRIGHT.md for copyright information

import { verdictFor } from "./journal.js";
import { solveDerivation } from "./derive.js";

/*
 * One bind operation, from entering bind mode to accepting or cancelling.
 *
 * The session is surface-agnostic on purpose.  A PDF surface hit-tests a banded
 * index because its text is painted onto canvas; an HTML surface reads
 * event.target because the browser has already done the hit-testing.  Those have
 * almost nothing in common mechanically, so the shared contract is the *result*
 * -- a candidate -- rather than a shared hit-testing helper that would fit
 * neither well.
 *
 * A surface implements:
 *
 *   beginBind(session)  start reporting candidates via session.candidate(...)
 *   endBind()           stop, and clear any highlight
 *
 * and reports candidates shaped as:
 *
 *   { locatorType, properties: [{property, value}], text, widenTo? }
 *
 * `properties` is already factValueSourceObject form, so accepting a candidate
 * is an attach rather than a translation.  `widenTo` is an optional next rung of
 * the widen ladder -- the enclosing mcid on PDF, the parent element on HTML --
 * which the two surfaces compute differently but present identically.
 */

export const BIND_STATE = {
    IDLE: "idle",
    HOVERING: "hovering",     // in bind mode, nothing under the cursor
    CANDIDATE: "candidate",   // something under the cursor, not yet captured
    CAPTURED: "captured",     // clicked; awaiting accept or retry
};


/*
 * Locator properties declared as collections in core.json, which may therefore
 * hold an ordered list of fragments within one source.  Anything else is scalar
 * and must match for two fragments to share a source.
 */
const COLLECTION_PROPERTIES = new Set([
    "xbrl:htmlElementId",
    "xbrl:pdfMcid",
    "xbrlx:htmlElementPointer",
    // The refinement properties are collections too, and their arrays run
    // parallel to the pointer's: fragment i is pointer[i] / offset[i] /
    // quote[i].  Omitting them here does not fail loudly -- mergeSources keeps
    // vals[0] and silently drops every fragment after the first, so a value
    // split across elements would be journalled with its first piece only and a
    // locator that still resolves.
    "xbrlx:htmlTextOffset",
    "xbrlx:htmlTextQuote",
    "xbrlx:pdfTextOffset",
    "xbrlx:pdfTextQuote",
]);

function propMap(properties) {
    const m = new Map();
    for (const p of properties ?? []) {
        m.set(p.property, p.value);
    }
    return m;
}

/* The scalar properties of a fragment, as a comparable key. */
function scalarKey(properties) {
    return JSON.stringify([...propMap(properties)]
        .filter(([k]) => !COLLECTION_PROPERTIES.has(k))
        .sort(([a], [b]) => a.localeCompare(b)));
}

/*
 * Merge fragments into as few sources as their scalar properties allow,
 * preserving order, and gathering collection-typed values into arrays.
 */
export function mergeSources(parts) {
    const out = [];
    let group = null;
    for (const part of parts) {
        const key = scalarKey(part.properties);
        if (!group || group.key !== key) {
            group = { key, order: [], values: new Map() };
            out.push(group);
        }
        for (const p of part.properties ?? []) {
            if (!group.values.has(p.property)) {
                group.order.push(p.property);
                group.values.set(p.property, []);
            }
            const v = group.values.get(p.property);
            for (const one of Array.isArray(p.value) ? p.value : [p.value]) {
                v.push(one);
            }
        }
    }
    return out.map(g => ({
        properties: g.order.map(name => {
            const vals = g.values.get(name);
            // A collection property keeps every fragment's value in order; a
            // scalar one is the same across the group by construction, so it is
            // written once rather than as a one-element array.
            return { property: name,
                     value: COLLECTION_PROPERTIES.has(name) ? vals : vals[0] };
        }),
    }));
}

export class BindSession {

    /*
     * `fact` is the bind target and is never changed by the session -- the
     * panel needs to keep showing what is being located while the user hunts
     * for it, and a session that could retarget itself would make an accepted
     * journal entry ambiguous about which fact it was for.
     */
    constructor({ fact, surface, journal, transforms, dataTypes } = {}) {
        this.fact = fact ?? null;
        this.surface = surface ?? null;
        this.journal = journal ?? null;
        this._transforms = transforms;
        this._dataTypes = dataTypes;
        this.state = BIND_STATE.IDLE;
        this.current = null;      // the live candidate, or null
        this.captured = null;     // the clicked candidate, or null
        this.fragments = [];      // the runs joined into that capture, in order
        this._listeners = [];
    }

    onChange(fn) {
        this._listeners.push(fn);
        return () => {
            this._listeners = this._listeners.filter(l => l !== fn);
        };
    }

    _emit() {
        for (const fn of this._listeners) {
            fn(this);
        }
    }

    /* The value the model asserts for this fact, as a string, or "". */
    factValue() {
        return this.fact?.value ?? "";
    }

    begin() {
        if (this.state !== BIND_STATE.IDLE) {
            return;
        }
        this.state = BIND_STATE.HOVERING;
        this.current = null;
        this.captured = null;
        this.fragments = [];
        this.surface?.beginBind?.(this);
        this._emit();
    }

    /*
     * Called by the surface as the cursor moves.  Ignored once something has
     * been captured: after a click the panel is showing a decision to confirm,
     * and letting stray mouse movement overwrite it would lose the capture the
     * user just made.  `retry()` returns to hovering.
     */
    candidate(candidate) {
        if (this.state !== BIND_STATE.HOVERING && this.state !== BIND_STATE.CANDIDATE) {
            return;
        }
        this.current = candidate ? this._assess(candidate) : null;
        this.state = this.current ? BIND_STATE.CANDIDATE : BIND_STATE.HOVERING;
        this._emit();
    }

    /* Called by the surface on click. */
    capture(candidate) {
        const c = candidate ?? this.current;
        if (!c || this.state === BIND_STATE.IDLE) {
            return null;
        }
        this.fragments = [c];
        this.captured = this._assess(this._joined());
        this.state = BIND_STATE.CAPTURED;
        this._emit();
        return this.captured;
    }

    /*
     * Add a fragment to the capture rather than replacing it.
     *
     * A PDF that sets "41 182,5" with the thousands separator as a gap can put
     * "41" and "182,5" in separate marked-content runs, so one click can only
     * ever reach half the value.  The model already accommodates this -- a
     * factValue's valueSources are ordered and contribute by concatenation --
     * so joining fragments needs no new concept, only a gesture.
     *
     * Ordered by the order they were added, which is the order they concatenate
     * in; the surface is responsible for offering them left to right.
     */
    addFragment(candidate) {
        if (!candidate || this.state === BIND_STATE.IDLE) {
            return null;
        }
        if (!this.fragments?.length) {
            return this.capture(candidate);
        }
        // Adding the same run twice is a slip, not an instruction to double it
        const key = c => JSON.stringify(c.properties);
        if (this.fragments.some(f => key(f) === key(candidate))) {
            return this.captured;
        }
        this.fragments = [...this.fragments, candidate];
        this.captured = this._assess(this._joined());
        this.state = BIND_STATE.CAPTURED;
        this._emit();
        return this.captured;
    }

    /*
     * Remove one fragment by position; below one fragment this returns to
     * hovering.
     *
     * Any fragment, not only the last: joins are built left to right, so the
     * one that was wrong is often not the one added most recently, and making
     * the user unwind three good fragments to reach a bad one would be worse
     * than the mistake.
     */
    removeFragment(index) {
        if (!this.fragments?.length || index < 0 || index >= this.fragments.length) {
            return null;
        }
        this.fragments = this.fragments.filter((_, i) => i !== index);
        return this._afterFragmentChange();
    }

    /* Drop the last fragment; below one fragment this returns to hovering. */
    dropFragment() {
        if (!this.fragments?.length) {
            return null;
        }
        this.fragments = this.fragments.slice(0, -1);
        return this._afterFragmentChange();
    }

    _afterFragmentChange() {
        if (!this.fragments.length) {
            this.captured = null;
            this.state = this.current ? BIND_STATE.CANDIDATE : BIND_STATE.HOVERING;
            this._emit();
            return null;
        }
        this.captured = this._assess(this._joined());
        this._emit();
        return this.captured;
    }

    /*
     * The fragments as one candidate: text concatenated in order, and every
     * fragment's properties kept as its own source.
     */
    /*
     * The fragments as one candidate: text concatenated in order, and the
     * fragments' locators merged the way the rest of the pipeline expresses
     * multi-fragment content.
     *
     * That is NOT one source per fragment.  The locator properties that can
     * carry several fragments are declared as collections in core.json --
     * xbrl:htmlElementId and xbrl:pdfMcid are both xbrlr:stringCollection --
     * and both saveOIMFacts and the existing compiled models use them that way:
     * L'Oreal carries "xbrl:pdfMcid": [2,3,...,12], eleven marked-content runs
     * in a single valueSource, and an inline continuation chain arrives as
     * "xbrl:htmlElementId": ["F_...cd49", "F_...cd49_1"].  Emitting one source
     * per fragment would have produced journal entries no existing consumer
     * reads.
     *
     * Fragments merge into one source only while their scalar properties agree.
     * xbrl:pdfPage is xs:integer, so runs on two different pages cannot share a
     * source and correctly become two -- which is also the honest reading of
     * factValueSourceObject as "a single contiguous fragment".
     */
    _joined() {
        const parts = this.fragments ?? [];
        if (parts.length === 1) {
            return { ...parts[0], sources: [{ properties: parts[0].properties }] };
        }
        return {
            ...parts[0],
            /*
             * Concatenated with nothing between, matching Inline XBRL 1.1
             * continuations, which factValueSourceObject mirrors: Arelle's
             * reference implementation joins the continuation chain with
             * "".join (XmlUtil.innerText) over unstripped text
             * (ModelInstanceObject.rawValue, strip=False).
             *
             * Inventing a separator would be wrong for adjacent runs that differ
             * only in styling -- "Rev" + "enue" must not become "Rev enue" --
             * and unnecessary where the source really does have whitespace,
             * because the fragment's own text carries it.
             */
            text: parts.map(p => p.text).join(""),
            sources: mergeSources(parts),
            widenTo: undefined,
        };
    }

    /* Attach the verdict and any solvable derivation to a raw candidate. */
    _assess(candidate) {
        const factValue = this.factValue();
        return {
            ...candidate,
            verdict: verdictFor(factValue, candidate.text),
            derivation: solveDerivation({
                factValue,
                capturedText: candidate.text,
                dataType: this.fact?.dataType ?? null,
                transforms: this._transforms,
                dataTypes: this._dataTypes,
            }),
        };
    }

    /* Discard the capture and resume hovering. */
    retry() {
        if (this.state !== BIND_STATE.CAPTURED) {
            return;
        }
        this.captured = null;
        this.fragments = [];
        this.state = this.current ? BIND_STATE.CANDIDATE : BIND_STATE.HOVERING;
        this._emit();
    }

    /*
     * Move one rung up the widen ladder from the captured candidate -- run to
     * enclosing mcid on PDF, element to parent on HTML.  Widening re-assesses,
     * so the verdict follows the wider text: a capture that was COARSE at the
     * row level should say so rather than keep the narrower verdict.
     */
    widen() {
        const from = this.captured ?? this.current;
        if (!from?.widenTo) {
            return null;
        }
        const wider = this.surface?.widen?.(from);
        if (!wider) {
            return null;
        }
        const assessed = this._assess(wider);
        if (this.state === BIND_STATE.CAPTURED) {
            this.captured = assessed;
        }
        else {
            this.current = assessed;
        }
        this._emit();
        return assessed;
    }

    canAccept() {
        return this.state === BIND_STATE.CAPTURED && !!this.captured;
    }

    /*
     * Write the capture to the journal and leave bind mode.
     *
     * The verdict is recorded but never gates the write: a fact value may
     * legitimately differ from its presentation through scaling, sign or locale
     * formatting, and only the user can judge that.  Refusing a DIFFER capture
     * would block exactly the corrections a rebind exists to make.
     */
    accept({ derivation = null } = {}) {
        if (!this.canAccept()) {
            return null;
        }
        const c = this.captured;
        const entry = this.journal?.bind({
            factId: this.fact?.id,
            factName: this.fact?.name,
            factValueNames: this.fact?.valueNames,
            locatorType: c.locatorType,
            sources: c.sources ?? [{ properties: c.properties }],
            capturedText: c.text,
            factValue: this.factValue(),
            previous: this.fact?.currentProperties ?? null,
            ...(derivation ? { derivation } : {}),
        }) ?? null;
        this.end();
        return entry;
    }

    cancel() {
        this.end();
    }

    end() {
        if (this.state === BIND_STATE.IDLE) {
            return;
        }
        this.surface?.endBind?.();
        this.state = BIND_STATE.IDLE;
        this.current = null;
        this.captured = null;
        this.fragments = [];
        this._emit();
    }
}
