// See COPYRIGHT.md for copyright information

/*
 * The tagger's edit journal.
 *
 * One entry per user decision, not per resulting model mutation: the journal is
 * what a reviewer reads, so it records what the user did and leaves the applier
 * to derive the model change.  Nothing here touches the DOM, the viewer or the
 * model -- the journal is a value, which is what makes it testable and what keeps
 * the browser free of any write path to the user's files.
 *
 * An entry's `properties` are already in `factValueSourceObject` form (a bag of
 * propertyObjects validated against a locator type's requiredProperties /
 * allowedProperties), so applying an entry is an attach, not a translation.
 */

export const JOURNAL_VERSION = 1;

/*
 * Verdicts compare what the model asserts against what was actually clicked.
 * They are provenance recorded at capture time, never a gate: a fact value may
 * legitimately differ from its presentation through scaling, sign or locale
 * formatting, and only the user can judge that.
 */
export const VERDICT = {
    AGREE: "agree",             // captured text matches the fact value
    DIFFER: "differ",           // it does not -- may still be correct
    COARSE: "coarse",           // the captured run contains the value plus more
    PARTIAL: "partial",         // the captured run is the start of the value
};

/*
 * Normalise for comparison the way the aligner's token strategy does, so that
 * "agree" here means what a hit would have meant there: strip currency and
 * spacing noise, fold the European decimal comma, and lift a trailing minus or
 * parenthesised negative to a leading sign.
 */
export function normaliseForCompare(s) {
    if (s == null) {
        return "";
    }
    let t = String(s).trim();
    // (1 234,5) and 1 234,5- are both negative presentations
    let negative = false;
    if (/^\(.*\)$/.test(t)) {
        negative = true;
        t = t.slice(1, -1);
    }
    if (/-$/.test(t)) {
        negative = true;
        t = t.slice(0, -1);
    }
    t = t
        // JS \s already covers NBSP and the figure/narrow no-break spaces that
        // the L'Oreal PDF uses as thousands separators
        .replace(/\s/g, "")
        .replace(/[$£€¥%]/g, "")
        .replace(/[−–—]/g, "-");  // minus sign, en/em dash -> hyphen
    // thousands separators, then the decimal comma
    if (/,\d{3}(\D|$)/.test(t)) {
        t = t.replace(/,/g, "");
    }
    else {
        t = t.replace(/,/g, ".");
    }
    t = t.replace(/^\+/, "");
    if (negative && !t.startsWith("-")) {
        t = "-" + t;
    }
    // trailing zeros carry no value for comparison: 84.50 === 84.5
    if (/^-?\d+\.\d*$/.test(t)) {
        t = t.replace(/0+$/, "").replace(/\.$/, "");
    }
    return t;
}

/*
 * Classify a capture.  COARSE is reported separately from DIFFER because it has
 * a different remedy: the user selected a run wider than the value (a whole table
 * row rather than one cell), which increment 2's multi-fragment capture would
 * address, whereas DIFFER usually means the wrong target entirely.
 */
export function verdictFor(factValue, capturedText) {
    const f = normaliseForCompare(factValue);
    if (f === "") {
        return VERDICT.DIFFER;
    }
    if (normaliseForCompare(capturedText) === f) {
        return VERDICT.AGREE;
    }
    /*
     * Look for the value among the captured run's tokens rather than as a
     * substring of the whole run.  Normalising a multi-value run as one string
     * strips the spaces that separate its numbers, gluing "84,5 76,8" into
     * "84,576,8" -- a substring test against that finds nothing, and worse, can
     * find a value that is not there.  Windows of up to MAX_SPAN tokens because
     * a single value may itself contain spaces as thousands separators
     * ("41 182,5", "1 234 567,8").
     */
    const MAX_SPAN = 4;
    const tokens = String(capturedText ?? "").split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
        for (let n = 1; n <= MAX_SPAN && i + n <= tokens.length; n++) {
            if (normaliseForCompare(tokens.slice(i, i + n).join(" ")) === f) {
                return VERDICT.COARSE;
            }
        }
    }
    /*
     * The capture is the start of the value rather than the whole of it.  This
     * is the split-number case: a PDF that sets "41 182,5" with the thousands
     * separator as a gap can put "41" and "182,5" in separate marked-content
     * runs, so one click can only ever reach half the value.  It is the mirror
     * of COARSE -- there the run held more than the value, here it holds less --
     * and it needs the opposite remedy: joining another fragment rather than
     * narrowing.  Tested as a prefix, not a substring, to keep single digits
     * from matching most of the values on a page.
     */
    const c = normaliseForCompare(capturedText);
    if (c !== "" && f.startsWith(c)) {
        return VERDICT.PARTIAL;
    }
    return VERDICT.DIFFER;
}

export class TaggingJournal {

    constructor({ document: documentName, model: modelName } = {}) {
        this._document = documentName ?? null;
        this._model = modelName ?? null;
        this._entries = [];
        this._listeners = [];
    }

    /* Subscribe to journal changes; returns an unsubscribe function. */
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

    get length() {
        return this._entries.length;
    }

    entries() {
        return this._entries.slice();
    }

    /* The binding currently in force for a fact, or null. Later entries win. */
    currentBinding(factId) {
        for (let i = this._entries.length - 1; i >= 0; i--) {
            if (this._entries[i].factId === factId) {
                return this._entries[i];
            }
        }
        return null;
    }

    /*
     * Record a bind or rebind.  `previous` is what this displaces -- null for a
     * first bind, the displaced properties for a rebind -- which is what makes
     * an entry reversible without consulting the model.
     */
    bind({ factId, factName = null, factValueNames = null, locatorType, sources, properties,
           capturedText, factValue, previous = null, derivation = null }) {
        if (!factId) {
            throw new Error("journal: factId is required");
        }
        if (!locatorType) {
            throw new Error("journal: locatorType is required");
        }
        /*
         * Sources are an ordered list, because a fact value can be assembled
         * from several fragments of the document -- the spec has valueSources
         * contribute "by concatenation" -- and a split number needs exactly
         * that.  A single `properties` bag is accepted as the one-fragment
         * shorthand and wrapped, so the common case stays terse.
         *
         * Each element is shaped as a factValueSourceObject, so applying an
         * entry is an attach rather than a translation.
         */
        // An empty properties array is absent, not a source: [] is truthy, so a
        // bare `properties ? ...` would wrap it into a source with nothing in it
        // and fail later with a message about the wrong thing.
        const list = sources
            ?? (Array.isArray(properties) && properties.length ? [{ properties }] : null);
        if (!Array.isArray(list) || list.length === 0) {
            throw new Error("journal: sources must be a non-empty array");
        }
        for (const s of list) {
            if (!Array.isArray(s?.properties) || s.properties.length === 0) {
                throw new Error("journal: each source needs a non-empty properties array");
            }
        }
        const entry = {
            op: "bindValueSource",
            factId,
            /*
             * The model's name for the fact, which is what an applier resolves
             * against.  `factId` is the viewer's: a document element id for a
             * located fact, and for one the viewer could not locate or placed on
             * a PDF, a position in build order rather than an identity.  That is
             * exactly the case a journal is most wanted for -- re-rendering a
             * document, where every fact starts unlocated -- so an entry that
             * named only the viewer id would not survive it.
             *
             * factValueNames lists every factValue the model's fact carries, in
             * model order.  A factValue is one occurrence of the fact in the
             * document rather than one value of it -- Microsoft's total revenue
             * has four, agreeing on the value while differing in presentation --
             * and a viewer fact stands for all of them at once, so naming one
             * would assert a choice the viewer did not make.  Which occurrence a
             * binding belongs to is therefore the applier's to decide, on
             * evidence this entry does not carry.  Both are null for a report
             * with no model behind it (the plain iXBRL path).
             */
            factName,
            factValueNames,
            previous,
            locatorType,
            sources: list,
            capturedText: capturedText ?? null,
            factValue: factValue ?? null,
            verdict: verdictFor(factValue, capturedText),
            ...(derivation ? { derivation } : {}),
        };
        this._entries.push(entry);
        this._emit();
        return entry;
    }

    /* Pop the most recent entry (the Tag panel's undo). */
    undo() {
        if (!this._entries.length) {
            return null;
        }
        const entry = this._entries.pop();
        this._emit();
        return entry;
    }

    /* Drop an entry by index, for undoing something other than the last. */
    remove(index) {
        if (index < 0 || index >= this._entries.length) {
            return null;
        }
        const [entry] = this._entries.splice(index, 1);
        this._emit();
        return entry;
    }

    clear() {
        this._entries = [];
        this._emit();
    }

    toJSON() {
        return {
            journalVersion: JOURNAL_VERSION,
            document: this._document,
            model: this._model,
            entries: this.entries(),
        };
    }

    serialise() {
        return JSON.stringify(this.toJSON(), null, 2);
    }

    static fromJSON(obj) {
        const j = new TaggingJournal({ document: obj?.document, model: obj?.model });
        j._entries = Array.isArray(obj?.entries) ? obj.entries.slice() : [];
        return j;
    }
}
