// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

function addTestDimension(r, label) {
    r.concepts["eg:" + label.replace(/ /g, "")] = {
            labels: {
                std: {
                    en: label
                }
            },
            "d": "e"
        };
}

addTestConcept(testReportData, "Root 1");
addTestConcept(testReportData, "Line Item 1");
addTestConcept(testReportData, "Line Item 2");
addTestConcept(testReportData, "Line Item Dim 1");
addTestConcept(testReportData, "Member 1");
addTestDimension(testReportData, "Dimension 1");
addTestDimension(testReportData, "Dimension 2");

const testFacts =  {
        f1: {
            a: {
                c: "eg:LineItem1"
            }
        },
        f2: {
            a: {
                c: "eg:LineItem2"
            }
        },
        f3: {
            a: {
                c: "eg:LineItem1",
                "eg:Dimension1": "eg:Member1"
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
        expect(outline.factInGroup(report.getItemById("f3"), "elr1")).toBe(true);
        // ELR1 includes Dimension 1 with specified member, so included
        expect(outline.factInGroup(report.getItemById("f3"), "elr2")).toBe(true);
        expect(outline.factInGroup(report.getItemById("f3"), "elr3")).toBe(false);

        expect(outline.sortedSections()).toEqual(["elr1", "elr2"]);

        report.data.rels.pres.elr2['eg:Dimension1'] = [
            { "t": "eg:Member2" }
        ];
        report._reverseRelationshipCache = {}; 

        outline = new DocumentOutline(report);

        // ELR1 does not mention Dimension 1, so f3 is included.
        expect(outline.factInGroup(report.getItemById("f3"), "elr1")).toBe(true);
        // ELR1 includes Dimension 1 but specified member is now removed
        expect(outline.factInGroup(report.getItemById("f3"), "elr2")).toBe(false);
        expect(outline.factInGroup(report.getItemById("f3"), "elr3")).toBe(false);

        expect(outline.sortedSections()).toEqual(["elr1"]);

    });

});
