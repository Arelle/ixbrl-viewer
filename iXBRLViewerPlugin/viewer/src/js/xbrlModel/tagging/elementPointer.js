// See COPYRIGHT.md for copyright information

/*
 * XPointer element() scheme child sequences, for locating facts in HTML that
 * cannot be modified.
 *
 * The two HTML locator types in core.json both require the document to carry an
 * attribute on the target -- an id, or a data attribute.  Most elements in a
 * real report have neither, and the usual workaround is to inject ids, which
 * means rewriting the source.  That is unavailable when the document is signed,
 * checksummed, owned by someone else, or simply must stay byte-identical to the
 * filed artifact.  A child sequence addresses any element without the document
 * having to say anything about it.
 *
 * Values are written WITHOUT the element(...) wrapper -- "f1", "/1/14",
 * "currentAssets/2/1".  In XBRL 2.1 the wrapper is needed because the fragment
 * identifier after "#" is a slot shared by several pointer schemes, so a scheme
 * has to name itself; a dedicated property is not a shared slot, and the
 * wrapper would carry no information the property name does not.  See
 * documentation/proposal-html-element-pointer.md in the OIM repository.
 *
 * Integers are 1-based and count ELEMENT children only, so text nodes and
 * comments are skipped -- matching the XPointer element() scheme, and matching
 * what a browser's `children` collection yields.
 */

/*
 * An id is only usable as an anchor if it actually addresses one element.
 * Duplicate ids are invalid but occur in real filings, and getElementById would
 * silently pick the first -- pointing a fact at the wrong place with no error.
 * Anchoring is skipped in that case and the sequence continues upward.
 */
function isUsableAnchor(el, doc) {
    const id = el.getAttribute?.("id");
    if (!id) {
        return false;
    }
    if (!/^[A-Za-z_][\w.\-]*$/.test(id)) {
        return false;   // not an NCName; not expressible as a shorthand pointer
    }
    try {
        return doc.querySelectorAll(`[id="${CSS.escape(id)}"]`).length === 1;
    }
    catch {
        return doc.getElementById(id) === el;
    }
}

function childIndex(el) {
    let n = 0;
    let sib = el;
    while (sib) {
        n++;
        sib = sib.previousElementSibling;
    }
    return n;
}

/*
 * Build the pointer for an element.
 *
 * Prefers the shortest robust form: the element's own id, else a sequence from
 * the nearest usable ancestor id, else a full sequence from the document
 * element.  The hybrid form is worth preferring where it exists -- it is
 * unaffected by structural change anywhere outside its anchor, which is the
 * failure a bare sequence handles worst.
 */
export function elementPointer(el, doc = el?.ownerDocument) {
    if (!el || el.nodeType !== 1 || !doc) {
        return null;
    }
    if (isUsableAnchor(el, doc)) {
        return el.getAttribute("id");
    }
    const steps = [];
    let cur = el;
    const root = doc.documentElement;
    while (cur && cur !== root) {
        if (isUsableAnchor(cur, doc)) {
            return cur.getAttribute("id") + "/" + steps.join("/");
        }
        steps.unshift(childIndex(cur));
        cur = cur.parentElement;
    }
    if (cur !== root) {
        return null;   // element is not in this document
    }
    // The document element is /1 -- the sequence is rooted at the document, not
    // at the root element, so its own position is the leading step.
    return "/1" + (steps.length ? "/" + steps.join("/") : "");
}

/*
 * Resolve a pointer back to an element, or null.
 *
 * Failure is silent by design in the element() scheme -- "failure to identify
 * an element results simply in no subresource being identified" -- so callers
 * should treat null as a finding to report rather than as an absent value.
 */
export function resolvePointer(pointer, doc) {
    if (typeof pointer !== "string" || !doc) {
        return null;
    }
    const text = pointer.trim();
    if (text === "") {
        return null;
    }
    let cur;
    let steps;
    if (text.startsWith("/")) {
        steps = text.slice(1).split("/");
        // the leading step selects among the document's element children
        const first = Number(steps.shift());
        if (!Number.isInteger(first) || first < 1) {
            return null;
        }
        const roots = Array.from(doc.children ?? []);
        cur = roots[first - 1];
    }
    else {
        const slash = text.indexOf("/");
        const id = slash === -1 ? text : text.slice(0, slash);
        steps = slash === -1 ? [] : text.slice(slash + 1).split("/");
        cur = doc.getElementById(id);
    }
    for (const step of steps) {
        if (!cur) {
            return null;
        }
        const n = Number(step);
        if (!Number.isInteger(n) || n < 1) {
            return null;
        }
        cur = cur.children[n - 1];
    }
    return cur ?? null;
}

/*
 * Generate a pointer and check it resolves back to the element it came from.
 *
 * The proposal requires a tagging tool to do this at capture time, because the
 * ways a pointer can go wrong are all silent: it resolves to a real but
 * different element and yields a plausible value from the wrong place.  Within
 * one DOM this catches generation bugs; the stronger check -- resolving through
 * a different parser -- needs the backend, since HTML5 tree construction and
 * libxml2 disagree on documents that omit tbody or that foster-parent.
 */
export function verifiedPointer(el, doc = el?.ownerDocument) {
    const pointer = elementPointer(el, doc);
    if (pointer === null) {
        return { pointer: null, verified: false, reason: "could not generate a pointer" };
    }
    const back = resolvePointer(pointer, doc);
    if (back === el) {
        return { pointer, verified: true };
    }
    return {
        pointer,
        verified: false,
        reason: back ? "pointer resolves to a different element" : "pointer does not resolve",
    };
}
