// See COPYRIGHT.md for copyright information

/*
 * The JavaScript half of the cross-language element-pointer corpus.
 *
 * The tagger generates pointers here; the fact aligner generates them in Python
 * (arelle/plugin/XbrlModel/HtmlElementPointer.py) for the SAME documents.  Every
 * way the two can disagree is silent -- both pointers resolve, to different
 * elements, and a fact ends up addressing a plausible value in the wrong place.
 * So both sides generate pointers for every element of the same fixtures and
 * compare against the same expected-pointers.json.
 *
 * corpus/ mirrors tests/resources/html-element-pointer/ in the Arelle
 * repository; see corpus/README.md.  CORPUS_SHA256 below is pinned identically
 * in test_html_element_pointer.py, so a copy updated on one side without the
 * other fails instead of drifting -- which would otherwise reintroduce, one
 * level up, exactly the undetected divergence this corpus exists to catch.
 *
 * Two fixture cases are live regressions rather than hypotheticals: an accented
 * id, and the first of a triply-duplicated id.  See corpus/adversarial.html.
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { elementPointer, resolvePointer } from "./elementPointer.js";

const CORPUS = path.join(__dirname, "corpus");

// pinned identically in the Arelle suite's test_html_element_pointer.py
const CORPUS_SHA256 = "190290cee0711622b62c003252be30dcc815cfd9fcc68eaafcd5e60ec6be8fac";

const expectedRaw = fs.readFileSync(path.join(CORPUS, "expected-pointers.json"));
const expected = JSON.parse(expectedRaw.toString("utf8")).documents;

function sha256(buffer) {
    return createHash("sha256").update(buffer).digest("hex");
}

/*
 * Parse a fixture the way its media type says it must be parsed.
 *
 * This is not a formality.  An XHTML document keeps the XML infoset; an HTML5
 * document is built by the HTML5 tree-construction algorithm, which synthesizes
 * tbody, foster-parents stray table content and implies head.  The trees differ
 * in both child indices and ancestry, so a pointer counted against the wrong one
 * addresses a real but different element.
 */
function docFor(document) {
    const raw = fs.readFileSync(path.join(CORPUS, document.name), "utf8");
    return new DOMParser().parseFromString(raw, document.mediaType);
}

function walk(doc) {
    const rows = [];
    const visit = (el) => {
        rows.push([rows.length, el.localName, elementPointer(el, doc)]);
        for (const child of el.children) {
            visit(child);
        }
    };
    visit(doc.documentElement);
    return rows;
}

describe("element pointer corpus", () => {
    test("the two repositories compare byte-identical expectations", () => {
        expect(sha256(expectedRaw)).toBe(CORPUS_SHA256);
    });

    test("covers one document of each parse mode, plus the adversarial cases", () => {
        expect(expected.map((d) => d.name)).toEqual(
            ["tiny.xhtml", "tiny-html5.html", "adversarial.html"]);
        expect(expected.map((d) => d.mediaType)).toEqual(
            ["application/xhtml+xml", "text/html", "text/html"]);
    });

    describe.each(expected.map((d) => [d.name, d]))("%s", (name, document) => {
        test("fixture is unmodified", () => {
            // a fixture edited without regenerating would compare stale pointers
            expect(sha256(fs.readFileSync(path.join(CORPUS, name)))).toBe(document.sha256);
        });

        test("pointers match the corpus element for element", () => {
            expect(walk(docFor(document))).toEqual(document.pointers);
        });

        test("every pointer resolves back to the element it came from", () => {
            const doc = docFor(document);
            const visit = (el) => {
                expect(resolvePointer(elementPointer(el, doc), doc)).toBe(el);
                for (const child of el.children) {
                    visit(child);
                }
            };
            visit(doc.documentElement);
        });
    });
});

describe("the cases the real documents do not contain", () => {
    /*
     * These two assert the JavaScript side of bugs that were live in both
     * implementations.  They are written against the fixture rather than an
     * inline string so that the two languages are provably testing the same
     * bytes -- an inline copy in each repository is what let them drift.
     */
    let doc;
    beforeAll(() => {
        doc = docFor(expected.find((d) => d.name === "adversarial.html"));
    });

    test("an accented id is not an anchor", () => {
        // Python's \w is Unicode-aware and JavaScript's is not, so the same
        // pattern text accepts this id there and rejects it here.  Both sides
        // must reject it, or they emit different pointers for one element.
        const el = doc.querySelector(`[id="résultat-net"]`);
        expect(elementPointer(el, doc)).toBe("/1/2/1");
    });

    test("the first of a duplicated id is not an anchor", () => {
        // the discriminating case: getElementById returns THIS one, so a guard
        // implemented as `getElementById(id) === el` anchors to an id that
        // addresses three elements.  The second and third prove nothing.
        const dups = Array.from(doc.querySelectorAll(`[id="dup"]`));
        expect(dups).toHaveLength(3);
        expect(dups.map((el) => elementPointer(el, doc)))
            .toEqual(["/1/2/2", "/1/2/3", "/1/2/10"]);
    });

    test("the media type is load-bearing, not decoration", () => {
        /*
         * tiny.xhtml writes <table><tr> too, so it parses to 25 elements as
         * XHTML and 26 as HTML5 -- the synthesized tbody -- and the pointers
         * below its table differ accordingly.  Reading a document under the
         * wrong parse mode therefore yields real but wrong pointers silently,
         * which is why the corpus records a media type per document and the
         * aligner refuses to sniff one.  On Microsoft's filed 10-K only 6.8%
         * of pointers survive the swap.
         */
        const document = expected.find((d) => d.name === "tiny.xhtml");
        const raw = fs.readFileSync(path.join(CORPUS, "tiny.xhtml"), "utf8");
        const asXml = new DOMParser().parseFromString(raw, "application/xhtml+xml");
        const asHtml = new DOMParser().parseFromString(raw, "text/html");
        expect(asXml.querySelectorAll("tbody")).toHaveLength(0);
        expect(asHtml.querySelectorAll("tbody")).toHaveLength(1);
        expect(walk(asXml)).toEqual(document.pointers);
        expect(walk(asHtml)).not.toEqual(document.pointers);
    });

    test("the html5 fixture exercises tbody synthesis", () => {
        // If this fails the fixture has been "tidied" and the corpus has quietly
        // stopped covering the divergence that makes the conformant parse
        // non-optional: libxml2 would put no tbody here, shifting every pointer
        // below the table.
        const html5 = docFor(expected.find((d) => d.name === "tiny-html5.html"));
        const tbodies = html5.querySelectorAll("tbody");
        expect(tbodies).toHaveLength(1);
        expect(elementPointer(tbodies[0], html5)).toBe("financial-highlights/4/1");
    });
});
