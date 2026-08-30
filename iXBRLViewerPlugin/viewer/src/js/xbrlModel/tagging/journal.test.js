// See COPYRIGHT.md for copyright information

import { TaggingJournal, VERDICT, normaliseForCompare, verdictFor } from "./journal.js";

describe("normaliseForCompare", () => {
    test("strips ordinary and non-breaking spacing", () => {
        // L'Oreal's PDF uses narrow/non-breaking spaces as thousands separators
        expect(normaliseForCompare("41 182,5")).toBe("41182.5");
        expect(normaliseForCompare("41 182,5")).toBe("41182.5");
        expect(normaliseForCompare("41 182,5")).toBe("41182.5");
    });

    test("folds the European decimal comma", () => {
        expect(normaliseForCompare("84,5")).toBe("84.5");
    });

    test("treats a comma before three digits as a thousands separator", () => {
        expect(normaliseForCompare("1,234")).toBe("1234");
        expect(normaliseForCompare("1,234,567")).toBe("1234567");
    });

    test("lifts parenthesised and trailing-minus negatives to a leading sign", () => {
        expect(normaliseForCompare("(84,5)")).toBe("-84.5");
        expect(normaliseForCompare("84,5-")).toBe("-84.5");
        expect(normaliseForCompare("-84.5")).toBe("-84.5");
    });

    test("does not double a sign already present", () => {
        expect(normaliseForCompare("(-84.5)")).toBe("-84.5");
    });

    test("strips currency and percent symbols", () => {
        expect(normaliseForCompare("€41 182,5")).toBe("41182.5");
        expect(normaliseForCompare("12.5%")).toBe("12.5");
    });

    test("ignores trailing zeros so 84.50 matches 84.5", () => {
        expect(normaliseForCompare("84.50")).toBe("84.5");
        expect(normaliseForCompare("84.500")).toBe("84.5");
        expect(normaliseForCompare("84.0")).toBe("84");
    });

    test("leaves integers alone", () => {
        // the trailing-zero rule must not turn 8450 into 845
        expect(normaliseForCompare("8450")).toBe("8450");
        expect(normaliseForCompare("100")).toBe("100");
    });

    test("normalises unicode minus and dashes", () => {
        expect(normaliseForCompare("−84.5")).toBe("-84.5");
    });

    test("is null-safe", () => {
        expect(normaliseForCompare(null)).toBe("");
        expect(normaliseForCompare(undefined)).toBe("");
    });
});

describe("verdictFor", () => {
    test("agrees across presentation differences", () => {
        expect(verdictFor("84.5", "84,5")).toBe(VERDICT.AGREE);
        expect(verdictFor("41182.5", "41 182,5")).toBe(VERDICT.AGREE);
        expect(verdictFor("-84.5", "(84,5)")).toBe(VERDICT.AGREE);
    });

    test("reports a run wider than the value as coarse", () => {
        // a whole table row captured instead of one cell
        expect(verdictFor("84.5", "Provisions pour risques 84,5 76,8 68,8"))
            .toBe(VERDICT.COARSE);
    });

    test("finds a space-separated value inside a wider run", () => {
        // the value itself contains thousands spaces, so it spans several tokens
        expect(verdictFor("41182.5", "TOTAL GROUPE 41 182,5 43 486,8 44 052,0"))
            .toBe(VERDICT.COARSE);
        expect(verdictFor("44052", "TOTAL GROUPE 41 182,5 43 486,8 44 052,0"))
            .toBe(VERDICT.COARSE);
    });

    test("does not manufacture a match by gluing adjacent numbers together", () => {
        // "84,5 76,8" must not normalise into a run containing 84576.8 etc;
        // a value that is not present has to come back DIFFER
        expect(verdictFor("84576.8", "Provisions 84,5 76,8")).toBe(VERDICT.DIFFER);
        expect(verdictFor("576.8", "Provisions 84,5 76,8")).toBe(VERDICT.DIFFER);
    });

    test("reports an unrelated capture as differ", () => {
        expect(verdictFor("84.5", "1 013,2")).toBe(VERDICT.DIFFER);
    });

    test("an empty fact value cannot agree or be coarse", () => {
        expect(verdictFor("", "84,5")).toBe(VERDICT.DIFFER);
        expect(verdictFor(null, "84,5")).toBe(VERDICT.DIFFER);
    });
});

describe("TaggingJournal", () => {
    const props = [
        { property: "xbrl:pdfPage", value: "292" },
        { property: "xbrl:pdfMcid", value: "418" },
    ];

    const bindArgs = (over = {}) => ({
        factId: "f-1",
        locatorType: "xbrl:pdfContentLocatorType",
        properties: props,
        capturedText: "84,5",
        factValue: "84.5",
        ...over,
    });

    test("records an entry as an ordered list of factValueSourceObjects", () => {
        const j = new TaggingJournal({ document: "lor.pdf", model: "loreal.json" });
        const e = j.bind(bindArgs());
        expect(e.op).toBe("bindValueSource");
        // a single properties bag is the one-fragment shorthand, and is wrapped
        expect(e.sources).toEqual([{ properties: props }]);
        expect(e.verdict).toBe(VERDICT.AGREE);
        expect(e.previous).toBeNull();
        expect(j.length).toBe(1);
    });

    test("names the fact as the model names it, not only as the viewer does", () => {
        // pf-3 is a position in build order, not an identity: it does not
        // survive re-rendering the document, which is the case the journal is
        // most wanted for
        const j = new TaggingJournal();
        const e = j.bind(bindArgs({
            factId: "pf-3",
            factName: "msft:fs_F_bc502677",
            factValueNames: ["msft:F_bc502677_val"],
        }));
        expect(e.factId).toBe("pf-3");
        expect(e.factName).toBe("msft:fs_F_bc502677");
        expect(e.factValueNames).toEqual(["msft:F_bc502677_val"]);
        expect(JSON.parse(j.serialise()).entries[0].factName).toBe("msft:fs_F_bc502677");
    });

    test("a fact occurring several times names every occurrence", () => {
        // Microsoft's total revenue is on pages 49, 84 (twice) and 85. The viewer
        // fact stands for all four, so naming one would assert a choice it did
        // not make; which occurrence the binding belongs to is the applier's.
        const e = new TaggingJournal().bind(bindArgs({
            factId: "pf-3",
            factName: "msft:fs_F_54f7ed46",
            factValueNames: ["msft:F_54f7ed46_val", "msft:F_f1293a51_val",
                             "msft:F_0e21da0e_val", "msft:F_0c259ef1_val"],
        }));
        expect(e.factValueNames).toHaveLength(4);
        expect(JSON.parse(new TaggingJournal().serialise()).entries).toEqual([]);
    });

    test("a report with no model behind it names what it can", () => {
        // the plain iXBRL path has no model fact to name; the entry is still
        // valid, and an applier is told there is no name rather than guessing
        const e = new TaggingJournal().bind(bindArgs());
        expect(e.factName).toBeNull();
        expect(e.factValueNames).toBeNull();
    });

    test("rejects entries missing their required parts", () => {
        const j = new TaggingJournal();
        expect(() => j.bind(bindArgs({ factId: null }))).toThrow(/factId/);
        expect(() => j.bind(bindArgs({ locatorType: null }))).toThrow(/locatorType/);
        expect(() => j.bind(bindArgs({ properties: [] }))).toThrow(/sources/);
        expect(j.length).toBe(0);
    });

    test("a rebind carries what it displaces, so it can be reversed", () => {
        const j = new TaggingJournal();
        const first = j.bind(bindArgs());
        const second = j.bind(bindArgs({
            properties: [{ property: "xbrl:pdfPage", value: "292" },
                         { property: "xbrl:pdfMcid", value: "419" }],
            previous: first.sources,
        }));
        expect(second.previous).toEqual([{ properties: props }]);
        expect(j.currentBinding("f-1")).toBe(second);
    });

    test("currentBinding returns the latest entry for a fact, ignoring others", () => {
        const j = new TaggingJournal();
        j.bind(bindArgs({ factId: "f-1" }));
        const other = j.bind(bindArgs({ factId: "f-2" }));
        expect(j.currentBinding("f-2")).toBe(other);
        expect(j.currentBinding("f-3")).toBeNull();
    });

    test("undo pops the last entry and restores the prior binding", () => {
        const j = new TaggingJournal();
        const first = j.bind(bindArgs());
        j.bind(bindArgs({ previous: first.properties }));
        j.undo();
        expect(j.length).toBe(1);
        expect(j.currentBinding("f-1")).toBe(first);
        j.undo();
        expect(j.currentBinding("f-1")).toBeNull();
        expect(j.undo()).toBeNull();
    });

    test("remove drops an entry other than the last", () => {
        const j = new TaggingJournal();
        j.bind(bindArgs({ factId: "f-1" }));
        j.bind(bindArgs({ factId: "f-2" }));
        j.remove(0);
        expect(j.length).toBe(1);
        expect(j.currentBinding("f-1")).toBeNull();
        expect(j.remove(9)).toBeNull();
    });

    test("notifies subscribers on change, and stops after unsubscribe", () => {
        const j = new TaggingJournal();
        let calls = 0;
        const off = j.onChange(() => { calls++; });
        j.bind(bindArgs());
        j.undo();
        expect(calls).toBe(2);
        off();
        j.bind(bindArgs());
        expect(calls).toBe(2);
    });

    test("round-trips through JSON", () => {
        const j = new TaggingJournal({ document: "lor.pdf", model: "loreal.json" });
        j.bind(bindArgs());
        const back = TaggingJournal.fromJSON(JSON.parse(j.serialise()));
        expect(back.toJSON()).toEqual(j.toJSON());
        expect(back.currentBinding("f-1").sources).toEqual([{ properties: props }]);
    });

    test("keeps several fragments as ordered sources", () => {
        const j = new TaggingJournal();
        const a = [{ property: "xbrl:pdfMcid", value: "41" }];
        const b = [{ property: "xbrl:pdfMcid", value: "42" }];
        const e = j.bind(bindArgs({ properties: undefined,
            sources: [{ properties: a }, { properties: b }],
            capturedText: "41 182,5", factValue: "41182.5" }));
        expect(e.sources).toEqual([{ properties: a }, { properties: b }]);
        expect(e.verdict).toBe(VERDICT.AGREE);
    });

    test("rejects a source without properties", () => {
        const j = new TaggingJournal();
        expect(() => j.bind(bindArgs({ properties: undefined, sources: [{}] })))
            .toThrow(/properties/);
    });

    test("carries a derivation when one was accepted with the bind", () => {
        const j = new TaggingJournal();
        const e = j.bind(bindArgs({ derivation: { scale: 6 } }));
        expect(e.derivation).toEqual({ scale: 6 });
    });

    test("entries() hands out a copy, so callers cannot mutate the journal", () => {
        const j = new TaggingJournal();
        j.bind(bindArgs());
        j.entries().pop();
        expect(j.length).toBe(1);
    });
});
