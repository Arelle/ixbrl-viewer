// See COPYRIGHT.md for copyright information

import { Aspect, AspectSet } from "./aspect.js";
import { iXBRLReport } from "./report.js";
import { TestInspector } from "./test-utils.js";

var testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": "http://www.xbrl.org/2003/iso4217"
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
        "eg:ExplicitDimension": {
            "labels": {
                "std": {
                    "en": "Explicit dimension"
                }
            },
            "d": "e"
        },
        "eg:TypedDimension": {
            "labels": {
                "std": {
                    "en": "Typed dimension"
                }
            },
            "d": "t"
        }
    }
};

var insp = new TestInspector();
beforeAll(() => {
    return insp.i18nInit();
});

var testReport = new iXBRLReport(testReportData);

test("Concept aspect labels", () => {
    var conceptAspect = new Aspect("c", "eg:Concept1", testReport);
    expect(conceptAspect.label()).toBe("Concept");  
    expect(conceptAspect.valueLabel()).toBe("English label");  
});

test("Period aspect labels", () => {
    var periodAspect = new Aspect("p", "2018-01-01/2019-01-01", testReport);
    expect(periodAspect.label()).toBe("Period");  
    expect(periodAspect.valueLabel()).toBe("1 Jan 2018 to 31 Dec 2018");  
});

test("Unit aspects label - known currency", () => {
    var unitAspect = new Aspect("u", "iso4217:GBP", testReport);
    expect(unitAspect.label()).toBe("Unit");  
    expect(unitAspect.valueLabel()).toBe("£");  
});

test("Unit aspects label - known currency (EUR)", () => {
    var unitAspect = new Aspect("u", "iso4217:EUR", testReport);
    expect(unitAspect.label()).toBe("Unit");  
    expect(unitAspect.valueLabel()).toBe("€");  
});

test("Unit aspects label - unknown currency", () => {
    var unitAspect = new Aspect("u", "iso4217:ZAR", testReport);
    expect(unitAspect.label()).toBe("Unit");
    expect(unitAspect.valueLabel()).toBe("ZAR");
});

test("Entity aspect labels - unknown scheme", () => {
    var tda = new Aspect("e", "eg:1234567", testReport);
    expect(tda.label()).toBe("Entity");  
    expect(tda.valueLabel()).toBe("eg:1234567");  
});

test("Taxonomy defined dimension labels", () => {
    var tda = new Aspect("eg:ExplicitDimension", "eg:Concept2", testReport);
    expect(tda.label()).toBe("Explicit dimension");
    expect(tda.valueLabel()).toBe("English label for concept two");

    tda = new Aspect("eg:TypedDimension", "eg:Concept2", testReport);
    expect(tda.label()).toBe("Typed dimension");
    // "eg:Concept2" should be treated as a string, not a member name
    expect(tda.valueLabel()).toBe("eg:Concept2");

    tda = new Aspect("eg:TypedDimension", "1 2 3 4", testReport);
    expect(tda.label()).toBe("Typed dimension");
    expect(tda.valueLabel()).toBe("1 2 3 4");

    tda = new Aspect("eg:TypedDimension", null, testReport);
    expect(tda.label()).toBe("Typed dimension");
    expect(tda.valueLabel()).toBe("nil");
});

describe("AspectSet", () => {
    test("Unique values", () => {
        var as = new AspectSet()
        as.add(new Aspect("c", "eg:Concept1", testReport));
        as.add(new Aspect("c", "eg:Concept2", testReport));
        as.add(new Aspect("c", "eg:Concept1", testReport));
        var uv = as.uniqueValues()
        expect(uv).toHaveLength(2);
        expect(uv.map(x => x.value())).toEqual(expect.arrayContaining(["eg:Concept1", "eg:Concept2"]));
    });
});


