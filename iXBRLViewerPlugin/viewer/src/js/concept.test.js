// See COPYRIGHT.md for copyright information

import { ReportSet } from "./reportset.js";
import { NAMESPACE_ISO4217 } from "./util";
import { TestInspector } from "./test-utils.js";

const insp = new TestInspector();
beforeAll(() => {
    insp.i18nInit();
});

const testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217,
        "e": "http://example.com/entity",
    },
    "concepts": {
        "eg:Concept1": {
            "labels": {
                "std": {
                    "en": "English label"
                }
            },
            "b": "debit"
        },
        "eg:Concept2": {
            "labels": {
                "std": {
                    "en": "English label for concept two"
                }
            },
            "b": "credit"
        },
        "eg:Concept3": {
            "labels": {
                "std": {
                    "en": "English label for concept three"
                }
            },
            "r": [ [ [ "Part1", "Value1" ], ["Part2", "Value2"] ] ]
        },
        "eg:Concept4": {
            "labels": {
                "std": {
                    "en": "English label for concept three"
                }
            },
            "r": [ 
                [ [ "Part1", "Value1" ], ["Part2", "Value2"] ],
                [ [ "Part3", "Value3" ], ["Part4", "Value4"] ]
            ]
        }
    },
    "facts": {
    }
};

describe("Concept references", () => {
    const rs = new ReportSet(testReportData);
    rs._initialize();
    const r = rs.reports[0];
    test("Absent reference", () => {
        var c1 = r.getConcept("eg:Concept1");
        expect(c1.referenceValuesAsString()).toEqual("");
        expect(c1.references()).toEqual([]);
    });

    test("Simple reference", () => {
        var c1 = r.getConcept("eg:Concept3");
        expect(c1.referenceValuesAsString()).toEqual("Value1 Value2");
        expect(c1.references()).toEqual(
            [
                [
                    { part: "Part1", value: "Value1" },
                    { part: "Part2", value: "Value2" }
                ]
            ]);
    });

    test("Concept with two references", () => {
        var c1 = r.getConcept("eg:Concept4");
        expect(c1.referenceValuesAsString()).toEqual("Value1 Value2 Value3 Value4");
        expect(c1.references()).toEqual(
            [
                [
                    { part: "Part1", value: "Value1" },
                    { part: "Part2", value: "Value2" }
                ],
                [
                    { part: "Part3", value: "Value3" },
                    { part: "Part4", value: "Value4" }
                ]
            ]);
    });
});

describe("Balance types", () => {
    test("Debit/Credit", () => {
        const rs = new ReportSet(testReportData);
        rs._initialize();
        const r = rs.reports[0];
        expect(r.getConcept("eg:Concept1").balance().balance).toBe("debit");
        expect(r.getConcept("eg:Concept1").balance().label()).toBe("Debit");
        expect(r.getConcept("eg:Concept2").balance().balance).toBe("credit");
        expect(r.getConcept("eg:Concept2").balance().label()).toBe("Credit");
        expect(r.getConcept("eg:Concept3").balance()).toBeUndefined();
    });
});
