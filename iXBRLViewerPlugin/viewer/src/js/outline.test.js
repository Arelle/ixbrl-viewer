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
    concepts: {
        "eg:Root1": {
            labels: {
                std: {
                    en: "Root 1"
                }
            }
        },
        "eg:Dimension1": {
            labels: {
                std: {
                    en: "Dimension 1"
                }
            },
            d: "e"
        },
        "eg:Dimension2": {
            labels: {
                std: {
                    en: "Dimension 2"
                }
            },
            d: "e"
        },
        "eg:LineItem1": {
            labels: {
                std: {
                    en: "Line Item 1"
                }
            }
        },
        "eg:LineItem2": {
            labels: {
                std: {
                    en: "Line Item 2"
                }
            }
        },
    },
    rels: {
        pres: {
            elr1: {
                "eg:Root1": [
                    { t: "eg:LineItem1" }
                ],
            },
            elr2: {

            },
            elr3: {
                "eg:Root1": [
                    { t: "eg:LineItem2" }
                ],
            }
        }
    }
};

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
