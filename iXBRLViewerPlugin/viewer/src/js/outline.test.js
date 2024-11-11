// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { ReportSet } from "./reportset.js";
import { DocumentOutline } from "./outline.js";
import { IXNode } from "./ixnode.js";
import { NAMESPACE_ISO4217, viewerUniqueId } from "./util.js";

const testReportData = {
    prefixes: {
        eg: "http://www.example.com",
        iso4217: NAMESPACE_ISO4217,
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

function testReportSet(factList) {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
    const ixNodeMap = {};
    let i = 0;
    data.facts = {};
    for (const f of factList) {
        data.facts[f] = testFacts[f];
        ixNodeMap[viewerUniqueId(0,f)] = new IXNode(f, $('<span></span>'), i++);
    }
    const reportSet = new ReportSet(data);
    reportSet.setIXNodeMap(ixNodeMap);
    return reportSet;
}

function getFact(rs, id) {
    return rs.getItemById(viewerUniqueId(0, id));
}

describe("Section filtering", () => {
    // f1 has a line item from elr1, f2 has a line item from elr3
    test("Both groups", () => {
        const reportSet = testReportSet(["f1", "f2"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.factInGroup(getFact(reportSet, "f1"), "elr1")).toBe(true);
        expect(outline.factInGroup(getFact(reportSet, "f1"), "elr2")).toBe(false);
        expect(outline.factInGroup(getFact(reportSet, "f1"), "elr3")).toBe(false);

        expect(outline.factInGroup(getFact(reportSet, "f2"), "elr1")).toBe(false);
        expect(outline.factInGroup(getFact(reportSet, "f2"), "elr2")).toBe(false);
        expect(outline.factInGroup(getFact(reportSet, "f2"), "elr3")).toBe(true);

        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
    });

    test("First group", () => {
        const reportSet = testReportSet(["f1"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1"]);
    });

    test("Last group", () => {
        const reportSet = testReportSet(["f2"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr3"]);
    });
});

describe("Dimensional filtering", () => {
    test("Simple", () => {
        const reportSet = testReportSet(["f3"]);
        let outline = new DocumentOutline(reportSet.reports[0]);
        // ELR1 does not mention Dimension 1, so f3 is included.
        const f3 = getFact(reportSet, "f3");
        expect(outline.factInGroup(f3, "elr1")).toBe(true);
        // ELR1 includes Dimension 2 with specified member, so included
        expect(outline.factInGroup(f3, "elr2")).toBe(true);
        expect(outline.factInGroup(f3, "elr3")).toBe(false);
        // Missing required TypedDimensions1
        expect(outline.factInGroup(f3, "elr4")).toBe(false);

        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr2"]);

        expect(outline.groupsForFact(f3).map(g => g.elr)).toEqual(["elr1", "elr2"]);

        // Exclude Member1 from Dimension1 in ELR2
        reportSet.reports[0]._reportData.rels.pres.elr2['eg:Dimension1'] = [
            { "t": "eg:Member2" }
        ];
        reportSet.reports[0]._reverseRelationshipCache = {}; 

        outline = new DocumentOutline(reportSet.reports[0]);

        // ELR1 does not mention Dimension 1, so f3 is included.
        expect(outline.factInGroup(f3, "elr1")).toBe(true);
        // ELR1 includes Dimension 1 but specified member is now removed
        expect(outline.factInGroup(f3, "elr2")).toBe(false);
        expect(outline.factInGroup(f3, "elr3")).toBe(false);
        // Missing required TypedDimensions1
        expect(outline.factInGroup(f3, "elr4")).toBe(false);

        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1"]);
        expect(outline.groupsForFact(f3).map(g => g.elr)).toEqual(["elr1"]);

    });

    test("Typed Dimensions", () => {
        const reportSet = testReportSet(["ft"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        const ft = getFact(reportSet, "ft");
        expect(outline.factInGroup(ft, "elr1")).toBe(true);
        // Missing required Dimension1
        expect(outline.factInGroup(ft, "elr2")).toBe(false);
        // Wrong concept
        expect(outline.factInGroup(ft, "elr3")).toBe(false);
        expect(outline.factInGroup(ft, "elr4")).toBe(true);
    });

    test("Defaults", () => {
        // Make Member1 the default for Dimension1
        const reportSet = testReportSet(["f1", "f2", "f3"]);
        const report = reportSet.reports[0];
        report._reportData.rels["d-d"] = { elr1: { 'eg:Dimension1': [ { t: 'eg:Member1' } ] } };

        const outline = new DocumentOutline(reportSet.reports[0]);
        const f1 = getFact(reportSet, "f1");
        expect(outline.factInGroup(f1, "elr1")).toBe(true);
        // f1 is now included in elr2 because the default member is in ELR2
        expect(outline.factInGroup(f1, "elr2")).toBe(true);
        expect(outline.factInGroup(f1, "elr3")).toBe(false);

        // This should be unchanged
        const f2 = getFact(reportSet, "f2");
        expect(outline.factInGroup(f2, "elr1")).toBe(false);
        expect(outline.factInGroup(f2, "elr2")).toBe(false);
        expect(outline.factInGroup(f2, "elr3")).toBe(true);

        // f3 is now technically illegal because it includes the default value for a dimension
        const f3 = getFact(reportSet, "f3");
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
        const reportSet = testReportSet(["f1", "f1a"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1");
        expect(outline.sections["elr3"]).toBeUndefined();
    });

    test("Longest runs 1", () => {
        // ELR1 is the f1, f1a run
        // ELR3 is the f2a, f2b run
        const reportSet = testReportSet(["f1", "f1a", "f2", "f1b", "f2a", "f2b"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1");
        expect(outline.sections["elr3"].localId()).toEqual("f2a");
    });

    test("Longest runs 2", () => {
        // ELR1 is the f1a, f1b run
        // ELR3 is the f2, f2b run
        const reportSet = testReportSet(["f1", "f2", "f2b", "f1a", "f1b", "f2a"]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1a");
        expect(outline.sections["elr3"].localId()).toEqual("f2");
    });

    test("Equal length runs", () => {
        // If multiple runs have the same length, we arbitrarily assign the ELR
        // to the first.
        const reportSet = testReportSet(["f1", "f1a", "f2", "f1b", "f1c", "f2b" ]);
        const outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1");
        expect(outline.sections["elr3"].localId()).toEqual("f2");
    });

    test("Hidden facts", () => {
        // Start with ELR1*2 ELR3*1 ELR1*3
        const reportSet = testReportSet(["f1a", "f1", "f2", "f1b", "f1c", "f1d"]);
        let outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1b");
        expect(outline.sections["elr3"].localId()).toEqual("f2");

        // Make f1c hidden.  We now have ELR1*2 ELR3*1 ELR1*2
        // The first ELR1 run should be selected.
        getFact(reportSet, "f1c").ixNode.isHidden = true;
        outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1a");
        expect(outline.sections["elr3"].localId()).toEqual("f2");

        // Make f1a hidden.  f1b-[f1c]-f1d is now the longest run.
        getFact(reportSet, "f1a").ixNode.isHidden = true;
        outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1b");
        expect(outline.sections["elr3"].localId()).toEqual("f2");

        // Hide f2.  We now have a single run for ELR1
        getFact(reportSet, "f2").ixNode.isHidden = true;
        outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1"]);
        expect(outline.sections["elr1"].localId()).toEqual("f1");

    });
});

describe("No presentation", () => {
    // f1 has a line item from elr1, f2 has a line item from elr3
    test("Remove presentation relationships", () => {
        const reportSet = testReportSet(["f1", "f2"]);
        let outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual(["elr1", "elr3"]);
        expect(outline.hasOutline()).toEqual(true);

        delete reportSet.reports[0]._reportData.rels.pres;
        outline = new DocumentOutline(reportSet.reports[0]);
        expect(outline.sortedSections().map(g => g.elr)).toEqual([]);
        expect(outline.hasOutline()).toEqual(false);
    });
});

