// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { iXBRLReport } from "./report.js";
import { DocumentOutline } from "./outline.js";
import { IXNode } from "./ixnode.js";

const testReportData = {
    prefixes: {
        eg: "http://www.example.com",
        iso4217: "http://www.xbrl.org/2003/iso4217",
        e: "http://example.com/entity",
    },
    roles: {
        elr1: "http://www.example.com/elr1",
        elr2: "http://www.example.com/elr2",
        elr3: "http://www.example.com/elr3",
    },
    roleDefs: {
        elr1: {
            en: "001 Group 1"
        },
        elr2: {
            en: "002 Group 2"
        },
        elr3: {
            en: "003 Group 3"
        },
        elr4: {
            en: "004 Group 4"
        },
    },
    concepts: {},
    rels: {
        pres: {
            elr1: {
                "eg:Root1": [
                    { t: "eg:LineItem1" }
                ],
            },
            elr2: {
                "eg:Root1": [
                    { t: "eg:Dimension1" },
                    { t: "eg:LineItem1" }
                ],
                "eg:Dimension1": [
                    { t: "eg:Member1" },
                    { t: "eg:Member2" },
                ]
            },
            elr3: {
                "eg:Root1": [
                    { t: "eg:LineItem2" }
                ],
            },
            elr4: {
                "eg:Root1": [
                    { t: "eg:LineItem1" },
                    { t: "eg:TypedDimension1" }
                ],
            }
        }
    }
};

function addTestConcept(r, label) {
    r.concepts["eg:" + label.replace(/ /g, "")] = {
            labels: {
                std: {
                    en: label
                }
            }
        };
}

function addTestDimension(r, label, typed) {
    r.concepts["eg:" + label.replace(/ /g, "")] = {
            labels: {
                std: {
                    en: label
                }
            },
            "d": typed ? "t" : "e"
        };
}

addTestConcept(testReportData, "Root 1");
addTestConcept(testReportData, "Line Item 1");
addTestConcept(testReportData, "Line Item 2");
addTestConcept(testReportData, "Line Item Dim 1");
addTestConcept(testReportData, "Member 1");
addTestConcept(testReportData, "Member 2");
addTestDimension(testReportData, "Dimension 1");
addTestDimension(testReportData, "Dimension 2");
addTestDimension(testReportData, "Typed Dimension 1", true);

const testFacts =  {
        f1: {
            a: {
                c: "eg:LineItem1",
                p: "2019-01-01"
            }
        },
        f2: {
            a: {
                c: "eg:LineItem2",
                p: "2019-01-01"
            }
        },
        f3: {
            a: {
                c: "eg:LineItem1",
                p: "2019-01-01",
                "eg:Dimension1": "eg:Member1"
            }
        },
        f1a: {
            a: {
                c: "eg:LineItem1",
                p: "2020-01-01"
            }
        },
        f1b: {
            a: {
                c: "eg:LineItem1",
                p: "2021-01-01"
            }
        },
        f1c: {
            a: {
                c: "eg:LineItem1",
                p: "2022-01-01"
            }
        },
        f1d: {
            a: {
                c: "eg:LineItem1",
                p: "2023-01-01"
            }
        },
        f2a: {
            a: {
                c: "eg:LineItem2",
                p: "2020-01-01"
            }
        },
        f2b: {
            a: {
                c: "eg:LineItem2",
                p: "2021-01-01"
            }
        },
        f2c: {
            a: {
                c: "eg:LineItem2",
                p: "2022-01-01"
            }
        },
        ft: {
            a: {
                c: "eg:LineItem1",
                p: "2022-01-01",
                "eg:TypedDimension1": "1234"
            }
        },
    };

function testReport(factList) {
    // Deep copy of standing data
    var data = JSON.parse(JSON.stringify(testReportData));
    var ixNodeMap = {};
    var i = 0;
    data.facts = {};
    for (const f of factList) {
        data.facts[f] = testFacts[f];
        ixNodeMap[f] = new IXNode(f, $('<span></span>'), i++);
    }
    var report = new iXBRLReport(data);
    report.setIXNodeMap(ixNodeMap);
    return report;
}

describe("Section filtering", () => {
    // f1 has a line item from elr1, f2 has a line item from elr3
    test("Both groups", () => {
        var report = testReport(["f1", "f2"]);
        var outline = new DocumentOutline(report);
        expect(outline.factInGroup(report.getItemById("f1"), "elr1")).toBe(true);
        expect(outline.factInGroup(report.getItemById("f1"), "elr2")).toBe(false);
        expect(outline.factInGroup(report.getItemById("f1"), "elr3")).toBe(false);

        expect(outline.factInGroup(report.getItemById("f2"), "elr1")).toBe(false);
        expect(outline.factInGroup(report.getItemById("f2"), "elr2")).toBe(false);
        expect(outline.factInGroup(report.getItemById("f2"), "elr3")).toBe(true);

        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
    });

    test("First group", () => {
        var report = testReport(["f1"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1"]);
    });

    test("Last group", () => {
        var report = testReport(["f2"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr3"]);
    });
});

describe("Dimensional filtering", () => {
    test("Simple", () => {
        var report = testReport(["f3"]);
        var outline = new DocumentOutline(report);
        // ELR1 does not mention Dimension 1, so f3 is included.
        var f3 = report.getItemById("f3");
        expect(outline.factInGroup(f3, "elr1")).toBe(true);
        // ELR1 includes Dimension 2 with specified member, so included
        expect(outline.factInGroup(f3, "elr2")).toBe(true);
        expect(outline.factInGroup(f3, "elr3")).toBe(false);
        // Missing required TypedDimensions1
        expect(outline.factInGroup(f3, "elr4")).toBe(false);

        expect(outline.sortedSections()).toEqual(["elr1", "elr2"]);

        expect(outline.groupsForFact(f3)).toEqual(["elr1", "elr2"]);

        // Exclude Member1 from Dimension1 in ELR2
        report.data.rels.pres.elr2['eg:Dimension1'] = [
            { "t": "eg:Member2" }
        ];
        report._reverseRelationshipCache = {}; 

        outline = new DocumentOutline(report);

        // ELR1 does not mention Dimension 1, so f3 is included.
        expect(outline.factInGroup(f3, "elr1")).toBe(true);
        // ELR1 includes Dimension 1 but specified member is now removed
        expect(outline.factInGroup(f3, "elr2")).toBe(false);
        expect(outline.factInGroup(f3, "elr3")).toBe(false);
        // Missing required TypedDimensions1
        expect(outline.factInGroup(f3, "elr4")).toBe(false);

        expect(outline.sortedSections()).toEqual(["elr1"]);
        expect(outline.groupsForFact(f3)).toEqual(["elr1"]);

    });

    test("Typed Dimensions", () => {
        var report = testReport(["ft"]);
        var outline = new DocumentOutline(report);
        var ft = report.getItemById("ft");
        expect(outline.factInGroup(ft, "elr1")).toBe(true);
        // Missing required Dimension1
        expect(outline.factInGroup(ft, "elr2")).toBe(false);
        // Wrong concept
        expect(outline.factInGroup(ft, "elr3")).toBe(false);
        expect(outline.factInGroup(ft, "elr4")).toBe(true);
    });

    test("Defaults", () => {
        // Make Member1 the default for Dimension1
        var report = testReport(["f1", "f2", "f3"]);
        report.data.rels["d-d"] = { elr1: { 'eg:Dimension1': [ { t: 'eg:Member1' } ] } };

        var outline = new DocumentOutline(report);
        var f1 = report.getItemById("f1");
        expect(outline.factInGroup(f1, "elr1")).toBe(true);
        // f1 is now included in elr2 because the default member is in ELR2
        expect(outline.factInGroup(f1, "elr2")).toBe(true);
        expect(outline.factInGroup(f1, "elr3")).toBe(false);

        // This should be unchanged
        var f1 = report.getItemById("f2");
        expect(outline.factInGroup(report.getItemById("f2"), "elr1")).toBe(false);
        expect(outline.factInGroup(report.getItemById("f2"), "elr2")).toBe(false);
        expect(outline.factInGroup(report.getItemById("f2"), "elr3")).toBe(true);

        // f3 is now technically illegal because it includes the default value for a dimension
        var f3 = report.getItemById("f3");
        expect(outline.factInGroup(f3, "elr1")).toBe(true);
        // ELR2 now excludeds f3 because the default must be omitted
        expect(outline.factInGroup(f3, "elr2")).toBe(false);
        expect(outline.factInGroup(f3, "elr3")).toBe(false);

    });

});

describe("Section grouping", () => {
    // f1* in ELR1, f2* in ELR3
    test("Single group", () => {
        // All facts in a single group
        var report = testReport(["f1", "f1a"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1"]);
        expect(outline.sections["elr1"].id).toEqual("f1");
        expect(outline.sections["elr3"]).toBeUndefined();
    });

    test("Longest runs 1", () => {
        // ELR1 is the f1, f1a run
        // ELR3 is the f2a, f2b run
        var report = testReport(["f1", "f1a", "f2", "f1b", "f2a", "f2b"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].id).toEqual("f1");
        expect(outline.sections["elr3"].id).toEqual("f2a");
    });

    test("Longest runs 2", () => {
        // ELR1 is the f1a, f1b run
        // ELR3 is the f2, f2b run
        var report = testReport(["f1", "f2", "f2b", "f1a", "f1b", "f2a"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].id).toEqual("f1a");
        expect(outline.sections["elr3"].id).toEqual("f2");
    });

    test("Equal length runs", () => {
        // If multiple runs have the same length, we arbitrarily assign the ELR
        // to the first.
        var report = testReport(["f1", "f1a", "f2", "f1b", "f1c", "f2b" ]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].id).toEqual("f1");
        expect(outline.sections["elr3"].id).toEqual("f2");
    });

    test("Hidden facts", () => {
        // Start with ELR1*2 ELR3*1 ELR1*3
        var report = testReport(["f1a", "f1", "f2", "f1b", "f1c", "f1d"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].id).toEqual("f1b");
        expect(outline.sections["elr3"].id).toEqual("f2");

        // Make f1c hidden.  We now have ELR1*2 ELR3*1 ELR1*2
        // The first ELR1 run should be selected.
        report.getItemById("f1c").ixNode.isHidden = true;
        outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].id).toEqual("f1a");
        expect(outline.sections["elr3"].id).toEqual("f2");

        // Make f1a hidden.  f1b-[f1c]-f1d is now the longest run.
        report.getItemById("f1a").ixNode.isHidden = true;
        outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].id).toEqual("f1b");
        expect(outline.sections["elr3"].id).toEqual("f2");

        // Hide f2.  We now have a single run for ELR1
        report.getItemById("f2").ixNode.isHidden = true;
        outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1"]);
        expect(outline.sections["elr1"].id).toEqual("f1");

    });
});

describe("No presentation", () => {
    // f1 has a line item from elr1, f2 has a line item from elr3
    test("Remove presentation relationships", () => {
        var report = testReport(["f1", "f2"]);
        var outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual(["elr1", "elr3"]);
        expect(outline.hasOutline()).toEqual(true);

        delete report.data.rels.pres;
        outline = new DocumentOutline(report);
        expect(outline.sortedSections()).toEqual([]);
        expect(outline.hasOutline()).toEqual(false);
    });
});

