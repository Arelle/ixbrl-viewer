// See COPYRIGHT.md for copyright information

import { iXBRLReport } from "./report.js";

var testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": "http://www.xbrl.org/2003/iso4217",
        "e": "http://example.com/entity",
    },
    "concepts": {
        "eg:Concept1": {
            "labels": {
                "std": {
                    "en": "English label"
                }
            }
        },
        "eg:Concept2": {
            "labels": {
                "std": {
                    "en": "English label for concept two"
                }
            }
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
    var r = new iXBRLReport(testReportData);
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
