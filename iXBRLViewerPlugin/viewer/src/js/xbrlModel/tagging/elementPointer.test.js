// See COPYRIGHT.md for copyright information

import { elementPointer, resolvePointer, verifiedPointer } from "./elementPointer.js";

function docFrom(html) {
    return new DOMParser().parseFromString(html, "text/html");
}

describe("elementPointer", () => {
    test("uses a unique id as a shorthand pointer", () => {
        const doc = docFrom(`<body><div id="currentAssets">x</div></body>`);
        expect(elementPointer(doc.getElementById("currentAssets"), doc)).toBe("currentAssets");
    });

    test("uses a full child sequence when nothing has an id", () => {
        const doc = docFrom(`<body><p>a</p><p>b</p><p>c</p></body>`);
        const third = doc.querySelectorAll("p")[2];
        // /1 html, /2 body, /3 the third paragraph
        expect(elementPointer(third, doc)).toBe("/1/2/3");
    });

    test("counts element children only, skipping text and comments", () => {
        const doc = docFrom(`<body><div id="a">text<!--c--><span>one</span>more<span>two</span></div></body>`);
        const second = doc.querySelectorAll("#a span")[1];
        expect(elementPointer(second, doc)).toBe("a/2");
    });

    test("prefers the nearest ancestor id, giving the hybrid form", () => {
        const doc = docFrom(
            `<body><div><section id="notes"><p>x</p><table><tr><td>hit</td></tr></table></section></div></body>`);
        const td = doc.querySelector("td");
        const p = elementPointer(td, doc);
        expect(p.startsWith("notes/")).toBe(true);
        expect(resolvePointer(p, doc)).toBe(td);
    });

    test("does not anchor on a duplicated id, which would address the wrong element", () => {
        // invalid but real: getElementById would silently pick the first
        const doc = docFrom(`<body><div id="dup"><span>first</span></div><div id="dup"><span>second</span></div></body>`);
        const second = doc.querySelectorAll("#dup")[1].querySelector("span");
        const p = elementPointer(second, doc);
        expect(p.startsWith("dup/")).toBe(false);
        expect(resolvePointer(p, doc)).toBe(second);
    });

    test("does not anchor on the FIRST element carrying a duplicated id", () => {
        /*
         * The sibling test above asserts on the SECOND duplicate, which is
         * rejected by any implementation -- getElementById does not return it.
         * The first is the discriminating case: an implementation that asks
         * "is getElementById(id) === el?" answers yes and anchors to an id
         * that addresses three elements.  That is what this file's fixture
         * ran for real until the CSS.escape fallback was removed, because
         * jsdom implements no CSS, so every jest run took the catch branch
         * while browsers took the querySelectorAll one -- the suite green,
         * the shipped behaviour different, and the Python port disagreeing.
         */
        const doc = docFrom(
            `<body><div id="dup">first</div><div id="dup">second</div><p id="dup">third</p></body>`);
        const first = doc.querySelectorAll(`[id="dup"]`)[0];
        expect(elementPointer(first, doc)).toBe("/1/2/1");
        expect(resolvePointer("/1/2/1", doc)).toBe(first);
    });

    test("does not anchor on an id that is not an NCName", () => {
        const doc = docFrom(`<body><div id="3:bad"><span>x</span></div></body>`);
        const span = doc.querySelector("span");
        const p = elementPointer(span, doc);
        expect(p.startsWith("3:bad")).toBe(false);
        expect(resolvePointer(p, doc)).toBe(span);
    });

    test("addresses the document element itself", () => {
        const doc = docFrom(`<body><p>x</p></body>`);
        expect(elementPointer(doc.documentElement, doc)).toBe("/1");
    });

    test("is null for a detached element or a non-element", () => {
        const doc = docFrom(`<body><p>x</p></body>`);
        const orphan = doc.createElement("div");
        expect(elementPointer(orphan, doc)).toBeNull();
        expect(elementPointer(null, doc)).toBeNull();
        expect(elementPointer(doc.createTextNode("t"), doc)).toBeNull();
    });
});

describe("resolvePointer", () => {
    const doc = docFrom(
        `<body><section id="notes"><p>one</p><p>two</p></section><div><span>x</span></div></body>`);

    test("resolves each of the three forms", () => {
        expect(resolvePointer("notes", doc).tagName.toLowerCase()).toBe("section");
        expect(resolvePointer("notes/2", doc).textContent).toBe("two");
        expect(resolvePointer("/1/2/1/1", doc).textContent).toBe("one");
    });

    test("returns null rather than throwing on a step past the end", () => {
        expect(resolvePointer("notes/9", doc)).toBeNull();
        expect(resolvePointer("/1/2/99/1", doc)).toBeNull();
    });

    test("rejects malformed pointers", () => {
        expect(resolvePointer("notes/0", doc)).toBeNull();
        expect(resolvePointer("notes/-1", doc)).toBeNull();
        expect(resolvePointer("notes/x", doc)).toBeNull();
        expect(resolvePointer("", doc)).toBeNull();
        expect(resolvePointer(null, doc)).toBeNull();
        expect(resolvePointer("/0/1", doc)).toBeNull();
    });

    test("returns null for an unknown id", () => {
        expect(resolvePointer("nosuch", doc)).toBeNull();
        expect(resolvePointer("nosuch/1", doc)).toBeNull();
    });
});

describe("round trip", () => {
    test("every element in a document round-trips", () => {
        const doc = docFrom(`
            <body>
              <h1>Report</h1>
              <section id="fin">
                <table>
                  <thead><tr><th>Item</th><th>2025</th></tr></thead>
                  <tbody>
                    <tr><td>Revenue</td><td>41 182,5</td></tr>
                    <tr><td>Cost</td><td>12 345,6</td></tr>
                  </tbody>
                </table>
              </section>
              <div><p>note <span>inline</span> text</p></div>
            </body>`);
        const all = doc.querySelectorAll("*");
        expect(all.length).toBeGreaterThan(15);
        for (const el of all) {
            const { pointer, verified, reason } = verifiedPointer(el, doc);
            expect(`${el.tagName}: ${verified} ${reason ?? ""} (${pointer})`)
                .toBe(`${el.tagName}: true  (${pointer})`);
        }
    });

    test("round-trips where ids are duplicated throughout", () => {
        const doc = docFrom(
            `<body><div id="d"><span>a</span></div><div id="d"><span>b</span></div><div id="d"><span>c</span></div></body>`);
        for (const el of doc.querySelectorAll("span")) {
            expect(verifiedPointer(el, doc).verified).toBe(true);
        }
        // and the three resolve to different elements
        const ptrs = [...doc.querySelectorAll("span")].map(e => elementPointer(e, doc));
        expect(new Set(ptrs).size).toBe(3);
    });
});

describe("verifiedPointer", () => {
    test("reports the failure rather than returning a plausible wrong element", () => {
        const doc = docFrom(`<body><p>x</p></body>`);
        const orphan = doc.createElement("div");
        const r = verifiedPointer(orphan, doc);
        expect(r.verified).toBe(false);
        expect(r.pointer).toBeNull();
        expect(r.reason).toMatch(/could not generate/);
    });

    test("verifies a good pointer", () => {
        const doc = docFrom(`<body><section id="s"><p>x</p></section></body>`);
        const r = verifiedPointer(doc.querySelector("p"), doc);
        expect(r).toEqual({ pointer: "s/1", verified: true });
    });
});
