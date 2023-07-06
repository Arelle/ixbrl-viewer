// See COPYRIGHT.md for copyright information

import { Fact } from "./fact.js";
import { IXBRLChart } from "./chart.js";
import { iXBRLReport } from "./report.js";
import { TestInspector } from "./test-utils.js";

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
            }
        },
        "eg:EnumConcept": {
            "labels": {
                "std": {
                    "en": "Enumeration concept"
                }
            },
            "e": true
        },
        "eg:Dimension1": {
            "labels": {
                "std": {
                    "en": "Dimension One"
                }
            },
            "d": "e"
        },
        "eg:Member1": {
            "labels": {
                "std": {
                    "en": "Member One"
                }
            }
        },
        "eg:Member2": {
            "labels": {
                "std": {
                    "en": "Member Two"
                }
            }
        },
        "eg:UnlabelledMember": {
            "labels": {
            }
        }
    },
    "facts": {
    }
};

function testReport(facts, ixData) {
    // Deep copy of standing data
    var data = JSON.parse(JSON.stringify(testReportData));
    data.facts = facts;
    var report = new iXBRLReport(data);
    report.setIXNodeMap(ixData);
    return report;
}

function testFact(factData, ixData) {
    factData.a = factData.a || {};
    factData.a.c = factData.a.c || 'eg:Concept1';
    ixData = ixData || {};
    return new Fact(testReport({"f1": factData}, {"f1": ixData }), "f1");
}

var insp = new TestInspector();
beforeAll(() => {
    return insp.i18nInit();
});

describe("Scale multiplier", () => {
    const chart = new IXBRLChart();
    test("Single fact", () => {
        let facts = [
            testFact({v:1000})
        ];
        expect(chart._chooseMultiplier(facts)).toEqual(3);
        facts = [
            testFact({v:999})
        ];
        expect(chart._chooseMultiplier(facts)).toEqual(0);
        facts = [
            testFact({v:1000000})
        ];
        expect(chart._chooseMultiplier(facts)).toEqual(6);
        facts = [
            testFact({v:-1000})
        ];
        expect(chart._chooseMultiplier(facts)).toEqual(3);
    });
    test("No facts", () => {
        expect(chart._chooseMultiplier([])).toEqual(0);
    });
    test("Multiple facts", () => {
        let facts = [
            testFact({v:1000}),
            testFact({v:-1000})
        ];
        expect(chart._chooseMultiplier(facts)).toEqual(3);
        facts = [
            testFact({v:1000}),
            testFact({v:-10000000})
        ];
        expect(chart._chooseMultiplier(facts)).toEqual(6);
    });

});
