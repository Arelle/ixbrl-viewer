// See COPYRIGHT.md for copyright information

import fs from "fs";
import path from "path";
import { resolveFragment, resolveValueSource, resolveAll, offsetInElement, describeRange,
         RESOLUTION } from "./resolveLocator.js";
import { elementPointer } from "./elementPointer.js";

const CORPUS = path.join(__dirname, "corpus");

function docFrom(html, type = "text/html") {
    return new DOMParser().parseFromString(html, type);
}

/*
 * The corpus documents are the shared fixture -- the same bytes the Arelle suite
 * parses.  Only their *pointers* are pinned in expected-pointers.json, which is
 * a mirror of the canonical Arelle copy and must not be edited here; the offset
 * cases below are derived from the documents themselves rather than added to it,
 * so the two suites cannot drift apart over data this side invented.
 */
function corpusDoc(name, type) {
    return docFrom(fs.readFileSync(path.join(CORPUS, name), "utf8"), type);
}

describe("resolveFragment", () => {
    const doc = docFrom(
        `<body><section id="s"><p>Revenue was 41 182,5 million in 2025.</p></section></body>`);
    const p = doc.querySelector("p");

    test("a pointer with no offset selects the whole element", () => {
        const r = resolveFragment(doc, { pointer: elementPointer(p, doc) });
        expect(r.status).toBe(RESOLUTION.OK);
        expect(r.text).toBe("Revenue was 41 182,5 million in 2025.");
    });

    test("offset and quote select the number inside the prose", () => {
        const text = p.textContent;
        const offset = text.indexOf("41 182,5");
        const r = resolveFragment(doc, { pointer: elementPointer(p, doc), offset, quote: "41 182,5" });
        expect(r.status).toBe(RESOLUTION.OK);
        expect(r.text).toBe("41 182,5");
        expect(r.range.toString()).toBe("41 182,5");
    });

    test("a quote that no longer matches refuses rather than highlights", () => {
        // the document has been regenerated since the model was written: the
        // pointer still resolves, and highlighting would assert the fact sits
        // somewhere it does not
        const r = resolveFragment(doc, { pointer: elementPointer(p, doc), offset: 0, quote: "Profit" });
        expect(r.status).toBe(RESOLUTION.QUOTE_MISMATCH);
        expect(r.text).toBe("Revenu");
        expect(r.expected).toBe("Profit");
    });

    test("an offset past the end of the text is reported, not clamped", () => {
        const r = resolveFragment(doc, { pointer: elementPointer(p, doc), offset: 9999, quote: "x" });
        expect(r.status).toBe(RESOLUTION.OUT_OF_RANGE);
    });

    test("a pointer naming nothing is reported", () => {
        expect(resolveFragment(doc, { pointer: "nosuch" }).status).toBe(RESOLUTION.NO_ELEMENT);
        expect(resolveFragment(doc, { pointer: "/1/2/99" }).status).toBe(RESOLUTION.NO_ELEMENT);
    });
});

describe("offsets across the element's descendants", () => {
    /*
     * textContent spans descendants, so an offset can land in a nested element
     * and a quote can straddle the boundary between them.  This is the ordinary
     * case in a real report, where a figure is wrapped in <b> or <span> inside
     * the sentence that introduces it.
     */
    const doc = docFrom(
        `<body><p id="t">Total <b>41 182</b>,5 million</p></body>`);
    const el = doc.getElementById("t");

    test("textContent is what the offsets count", () => {
        expect(el.textContent).toBe("Total 41 182,5 million");
    });

    test("an offset landing inside a child element resolves", () => {
        const r = resolveFragment(doc, { pointer: "t", offset: 6, quote: "41 182" });
        expect(r.status).toBe(RESOLUTION.OK);
        expect(r.range.startContainer.nodeValue).toBe("41 182");
    });

    test("a quote straddling an element boundary resolves", () => {
        const r = resolveFragment(doc, { pointer: "t", offset: 6, quote: "41 182,5" });
        expect(r.status).toBe(RESOLUTION.OK);
        expect(r.text).toBe("41 182,5");
    });

    test("comments contribute nothing, matching textContent", () => {
        const d = docFrom(`<body><p id="c">ab<!--XXXX-->cd</p></body>`);
        expect(d.getElementById("c").textContent).toBe("abcd");
        const r = resolveFragment(d, { pointer: "c", offset: 2, quote: "cd" });
        expect(r.status).toBe(RESOLUTION.OK);
    });
});

describe("resolveValueSource", () => {
    const doc = docFrom(
        `<body><p id="a">Revenue 41</p><p id="b">182,5 million</p></body>`);

    test("parallel arrays are read fragment-wise and concatenated", () => {
        const r = resolveValueSource(doc, { properties: [
            { property: "xbrlx:htmlElementPointer", value: ["a", "b"] },
            { property: "xbrlx:htmlTextOffset", value: [8, 0] },
            { property: "xbrlx:htmlTextQuote", value: ["41", "182,5"] },
        ] });
        expect(r.status).toBe(RESOLUTION.OK);
        // concatenated with nothing between, as continuations are
        expect(r.text).toBe("41182,5");
        expect(r.fragments).toHaveLength(2);
    });

    test("one bad fragment makes the whole source bad", () => {
        const r = resolveValueSource(doc, { properties: [
            { property: "xbrlx:htmlElementPointer", value: ["a", "nosuch"] },
            { property: "xbrlx:htmlTextOffset", value: [8, 0] },
            { property: "xbrlx:htmlTextQuote", value: ["41", "182,5"] },
        ] });
        expect(r.status).toBe(RESOLUTION.NO_ELEMENT);
    });

    test("a scalar property value is accepted as a one-fragment source", () => {
        const r = resolveValueSource(doc, { properties: [
            { property: "xbrlx:htmlElementPointer", value: "a" },
        ] });
        expect(r.status).toBe(RESOLUTION.OK);
        expect(r.text).toBe("Revenue 41");
    });

    test("no pointer at all is reported rather than throwing", () => {
        expect(resolveValueSource(doc, { properties: [] }).status).toBe(RESOLUTION.NO_ELEMENT);
        expect(resolveValueSource(doc, undefined).status).toBe(RESOLUTION.NO_ELEMENT);
    });
});

describe("against the shared corpus documents", () => {
    /*
     * Uses the corpus documents as inputs without adding to
     * expected-pointers.json: the pointers come from that pinned file via
     * elementPointer, and what is asserted here is that resolution round-trips
     * them, which is this side's concern only.
     */
    const cases = [["tiny.xhtml", "application/xhtml+xml"],
                   ["tiny-html5.html", "text/html"],
                   ["adversarial.html", "text/html"]];

    for (const [name, type] of cases) {
        test(`${name}: every element's pointer resolves to a range over its own text`, () => {
            const doc = corpusDoc(name, type);
            const all = doc.querySelectorAll("*");
            expect(all.length).toBeGreaterThan(10);
            let checked = 0;
            for (const el of all) {
                const pointer = elementPointer(el, doc);
                if (pointer === null) {
                    continue;
                }
                const r = resolveFragment(doc, { pointer });
                expect(`${name} ${pointer}: ${r.status}`).toBe(`${name} ${pointer}: ${RESOLUTION.OK}`);
                expect(r.element).toBe(el);
                checked++;
            }
            expect(checked).toBe(all.length);
        });

        test(`${name}: an offset into each text-bearing element selects its own text`, () => {
            const doc = corpusDoc(name, type);
            let checked = 0;
            for (const el of doc.querySelectorAll("*")) {
                const text = el.textContent;
                if (!text || text.length < 2 || el.children.length) {
                    continue;   // leaf text only, so the quote is unambiguous
                }
                const pointer = elementPointer(el, doc);
                const quote = text.slice(1);
                const r = resolveFragment(doc, { pointer, offset: 1, quote });
                expect(`${pointer}: ${r.status}`).toBe(`${pointer}: ${RESOLUTION.OK}`);
                checked++;
            }
            expect(checked).toBeGreaterThan(3);
        });
    }
});

describe("resolveAll", () => {
    test("resolves a facts map in one pass, keyed as it was given", () => {
        const doc = docFrom(`<body><p id="a">41</p><p id="b">182,5</p></body>`);
        const facts = {
            "f-1": { valueSources: [{ properties: [
                { property: "xbrlx:htmlElementPointer", value: ["a"] }] }] },
            "f-2": { valueSources: [{ properties: [
                { property: "xbrlx:htmlElementPointer", value: ["b"] }] }] },
            "f-3": { },   // unlocated: carries no sources at all
        };
        const out = resolveAll(doc, facts);
        expect([...out.keys()].sort()).toEqual(["f-1", "f-2"]);
        expect(out.get("f-1")[0].text).toBe("41");
    });
});

describe("offsetInElement / describeRange", () => {
    const doc = docFrom(`<body><p id="t">Total <b>41 182</b>,5 million</p></body>`);
    const el = doc.getElementById("t");

    test("round-trips with the resolver over every offset in the element", () => {
        // the two directions are one convention; this holds them together
        const text = el.textContent;
        for (let i = 0; i < text.length; i++) {
            const r = resolveFragment(doc, { pointer: "t", offset: i, quote: text.slice(i, i + 1) });
            expect(`${i}: ${r.status}`).toBe(`${i}: ${RESOLUTION.OK}`);
            const back = offsetInElement(el, r.range.startContainer, r.range.startOffset);
            expect(`${i} -> ${back}`).toBe(`${i} -> ${i}`);
        }
    });

    test("is null for a node outside the element", () => {
        const other = doc.createTextNode("x");
        expect(offsetInElement(el, other, 0)).toBeNull();
        expect(offsetInElement(null, null)).toBeNull();
    });

    test("describeRange reports the immediate parent, offset and quote", () => {
        const r = resolveFragment(doc, { pointer: "t", offset: 6, quote: "41 182" });
        const d = describeRange(r.range);
        // the start text node's parent is the <b>, not the <p>
        expect(d.element.tagName.toLowerCase()).toBe("b");
        expect(d.offset).toBe(0);
        expect(d.quote).toBe("41 182");
    });

    test("describeRange declines a collapsed range", () => {
        const range = doc.createRange();
        range.setStart(el.firstChild, 2);
        range.collapse(true);
        expect(describeRange(range)).toBeNull();
        expect(describeRange(null)).toBeNull();
    });
});
