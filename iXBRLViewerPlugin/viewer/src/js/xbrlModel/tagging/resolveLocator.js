// See COPYRIGHT.md for copyright information

import { resolvePointer } from "./elementPointer.js";

/*
 * Resolving a *stored* locator to something the viewer can show.
 *
 * elementPointer.js answers "where is this element", and until now that was
 * only ever asked at capture time, by verifiedPointer.  Nothing read a locator
 * back, so a model carrying pointer locators could be written but not viewed.
 * This is the other half.
 *
 * A pointer alone is not enough on HTML5.  27% of the numbers in the Microsoft
 * annual report share an element with another number -- one <p> holds fourteen
 * -- so the locator carries an offset and a quote as well, and the three arrays
 * run in parallel: fragment i is pointer[i] / offset[i] / quote[i].
 *
 * The convention, which the Arelle emitter and this resolver have to agree on
 * exactly:
 *
 *   pointer  addresses the text node's IMMEDIATE PARENT element
 *   offset   0-based character offset into that element's textContent
 *   quote    the exact source text, unstripped and uncollapsed
 *
 * textContent means what the DOM means: every descendant text node in document
 * order, comments contributing nothing.  The value ends at offset + quote.length.
 *
 * Two rules from HTML5-LOCATORS.md are honoured here rather than left to
 * callers:
 *
 *   - resolution walks children[i] (in resolvePointer) and never builds a CSS
 *     selector -- 0.78 microseconds against 43.8 seconds on a 1.08M-element
 *     document, because a trailing *:nth-child has no selectivity and the
 *     engine tests every element in the document;
 *   - the caller must resolve against the pristine tree, before any decoration
 *     that inserts elements.  Overlaying, as pdfDocumentSurface.js does, keeps
 *     child lists intact; wrapping does not.  resolveAll() exists so a surface
 *     can do the whole model in one pass up front.
 */

export const RESOLUTION = {
    OK: "ok",                       // located, and the quote matched
    NO_ELEMENT: "no-element",       // the pointer named nothing
    OUT_OF_RANGE: "out-of-range",   // the offset is past the element's text
    QUOTE_MISMATCH: "quote-mismatch", // located, but the text has changed
};

/*
 * The element's descendant text nodes in document order, which is the sequence
 * textContent concatenates.  A TreeWalker rather than a recursive descent: the
 * documents this runs on reach 1.08M elements, and one L'Oreal table has 1,156
 * element children.
 */
function textNodesOf(el) {
    const doc = el.ownerDocument;
    const walker = doc.createTreeWalker(el, 0x04 /* NodeFilter.SHOW_TEXT */);
    const out = [];
    let n = walker.nextNode();
    while (n) {
        out.push(n);
        n = walker.nextNode();
    }
    return out;
}

/*
 * Map a character offset in an element's textContent onto (text node, offset
 * within it).  Returns null when the offset is past the end.
 *
 * An offset landing exactly on a boundary belongs to the START of the following
 * node, not the end of the preceding one -- otherwise a range beginning at a
 * node boundary would start in the wrong node and select nothing.
 */
function locateOffset(nodes, offset) {
    let seen = 0;
    for (const node of nodes) {
        const len = node.nodeValue.length;
        if (offset < seen + len) {
            return { node, offset: offset - seen };
        }
        seen += len;
    }
    // The very end of the text is a legal start only for an empty selection
    if (offset === seen && nodes.length) {
        const last = nodes[nodes.length - 1];
        return { node: last, offset: last.nodeValue.length };
    }
    return null;
}

/*
 * Resolve one fragment to a DOM Range.
 *
 * `quote` is checked against what the range actually covers, and a mismatch
 * refuses rather than highlights.  That check is the point of storing the quote:
 * a document regenerated since the model was written still resolves the pointer
 * to a real element, and highlighting it would assert a fact sits somewhere it
 * does not.  Silence is the failure mode this whole design keeps guarding
 * against, so the mismatch is reported with both texts for a caller to show.
 */
export function resolveFragment(doc, { pointer, offset, quote } = {}) {
    const element = resolvePointer(pointer, doc);
    if (!element) {
        return { status: RESOLUTION.NO_ELEMENT, pointer };
    }
    // No offset: the whole element is the fragment, which is the legacy inline
    // case where every fact has its own ix: element.
    if (offset === undefined || offset === null) {
        const range = doc.createRange();
        range.selectNodeContents(element);
        return { status: RESOLUTION.OK, element, range, text: element.textContent };
    }
    const nodes = textNodesOf(element);
    const start = locateOffset(nodes, offset);
    const length = quote?.length ?? 0;
    const end = locateOffset(nodes, offset + length);
    if (!start || !end) {
        return { status: RESOLUTION.OUT_OF_RANGE, element, pointer, offset };
    }
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const text = range.toString();
    if (quote !== undefined && quote !== null && text !== quote) {
        return { status: RESOLUTION.QUOTE_MISMATCH, element, range, text, expected: quote };
    }
    return { status: RESOLUTION.OK, element, range, text };
}

/*
 * Resolve a whole valueSource: its parallel arrays become one fragment each, in
 * order, and the fragments' texts concatenate into the located value.
 *
 * Concatenated with nothing between them, matching Inline XBRL 1.1
 * continuations -- Arelle joins a continuation chain with "".join over
 * unstripped text.  Inventing a separator would be wrong for adjacent runs that
 * differ only in styling: "Rev" + "enue" must not become "Rev enue".
 */
export function resolveValueSource(doc, source) {
    const props = new Map();
    for (const p of source?.properties ?? []) {
        props.set(p.property, p.value);
    }
    const asArray = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
    const pointers = asArray(props.get("xbrlx:htmlElementPointer"));
    const offsets = asArray(props.get("xbrlx:htmlTextOffset"));
    const quotes = asArray(props.get("xbrlx:htmlTextQuote"));
    if (!pointers.length) {
        return { status: RESOLUTION.NO_ELEMENT, fragments: [] };
    }
    const fragments = pointers.map((pointer, i) => resolveFragment(doc, {
        pointer,
        // An absent offset array means whole-element fragments, which is legal;
        // a shorter one than the pointer array is a malformed locator, and the
        // fragment is resolved without an offset rather than silently paired
        // with another fragment's.
        offset: offsets.length ? offsets[i] : undefined,
        quote: quotes.length ? quotes[i] : undefined,
    }));
    const bad = fragments.find(f => f.status !== RESOLUTION.OK);
    return {
        status: bad ? bad.status : RESOLUTION.OK,
        fragments,
        text: fragments.map(f => f.text ?? "").join(""),
    };
}

/*
 * Resolve every locator in a facts map in one pass, before the caller decorates
 * the document.
 *
 * Returns a Map keyed the same way the facts map is, so a surface can walk it
 * and overlay without re-resolving -- and so that all resolution happens while
 * the tree is still pristine, which is rule 2.
 */
export function resolveAll(doc, facts) {
    const out = new Map();
    for (const [key, factData] of Object.entries(facts ?? {})) {
        const sources = factData?.valueSources ?? factData?.sources;
        if (!sources?.length) {
            continue;
        }
        out.set(key, sources.map(s => resolveValueSource(doc, s)));
    }
    return out;
}

/*
 * The inverse of locateOffset: where a (text node, offset) sits in an ancestor
 * element's textContent.
 *
 * Capture needs this because the browser hands back a Range in terms of text
 * nodes, while the locator is expressed against the element's textContent -- the
 * form the Arelle emitter produces, which derived it from a token alignment
 * instead.  Keeping both directions in one file is deliberate: they are one
 * convention, and a round-trip test can hold them together.
 *
 * Returns null if the node is not within the element, rather than a plausible
 * number.
 */
export function offsetInElement(element, node, nodeOffset = 0) {
    if (!element || !node) {
        return null;
    }
    let seen = 0;
    for (const t of textNodesOf(element)) {
        if (t === node) {
            return seen + Math.min(nodeOffset, t.nodeValue.length);
        }
        seen += t.nodeValue.length;
    }
    return null;
}

/*
 * Describe a DOM Range as a locator fragment: the pointer target, the offset
 * into its textContent, and the quote.
 *
 * The pointer names the start text node's IMMEDIATE PARENT, per the convention
 * the Arelle emitter follows.  A range spanning several elements still reports
 * that parent, and the quote then straddles a boundary -- which resolveFragment
 * handles, because both sides count textContent rather than nodes.
 */
export function describeRange(range) {
    if (!range || range.collapsed) {
        return null;
    }
    const startNode = range.startContainer;
    const element = startNode.nodeType === 3 ? startNode.parentElement : startNode;
    if (!element) {
        return null;
    }
    const offset = startNode.nodeType === 3
        ? offsetInElement(element, startNode, range.startOffset)
        : 0;
    if (offset === null) {
        return null;
    }
    return { element, offset, quote: range.toString() };
}
