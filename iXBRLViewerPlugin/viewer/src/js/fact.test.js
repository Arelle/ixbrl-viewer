// See COPYRIGHT.md for copyright information

import { Fact } from "./fact.js";
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

describe("Simple fact properties", () => {
    test("Monetary", () => {
        var f = testFact({
                "d": -3,
                "v": 1000,
                "a": {
                    "c": "eg:Concept1",
                    "u": "iso4217:USD", 
                    "p": "2018-01-01/2019-01-01",
                }});
        expect(f.value()).toEqual(1000);
        expect(f.decimals()).toEqual(-3);
        expect(f.isNumeric()).toBeTruthy();
        expect(f.isMonetaryValue()).toBeTruthy();
        expect(f.readableValue()).toEqual("US $ 1,000");
        expect(f.unit().value()).toEqual("iso4217:USD");
        expect(f.measure()).toEqual("iso4217:USD");
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
        expect(f.isInvalidIXValue()).toBeFalsy();
    });

    test("Numeric (non-monetary)", () => {
        var f = testFact({
                "d": -3,
                "v": 1000,
                "a": {
                    "c": "eg:Concept1",
                    "u": "eg:USD", 
                    "p": "2018-01-01/2019-01-01",
                }});
        expect(f.value()).toEqual(1000);
        expect(f.isNumeric()).toBeTruthy();
        expect(f.decimals()).toEqual(-3);
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("1,000 eg:USD");
        expect(f.unit().value()).toEqual("eg:USD");
        expect(f.measure()).toEqual("eg:USD");
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
        expect(f.isInvalidIXValue()).toBeFalsy();
    });

    test("Numeric (infinite precision)", () => {
        var f = testFact({
                "v": 1000000.0125,
                "a": {
                    "c": "eg:Concept1",
                    "u": "eg:USD", 
                    "p": "2018-01-01/2019-01-01",
                }});
        expect(f.value()).toEqual(1000000.0125);
        expect(f.decimals()).toBeUndefined();
        expect(f.isNumeric()).toBeTruthy();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("1,000,000.0125 eg:USD");
        expect(f.unit().value()).toEqual("eg:USD");
        expect(f.measure()).toEqual("eg:USD");
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
        expect(f.isInvalidIXValue()).toBeFalsy();
    });

    test("String", () => {
        var f = testFact({
                "v": "abcdef",
                "a": {
                    "c": "eg:Concept1",
                    "p": "2018-01-01/2019-01-01",
                }});
        expect(f.value()).toEqual("abcdef");
        expect(f.isNumeric()).toBeFalsy();
        expect(f.decimals()).toBeUndefined();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("abcdef");
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
        expect(f.isInvalidIXValue()).toBeFalsy();
    });

    test("Enumeration", () => {
        var f = testFact({
            "v": "eg:Member1",
            "a": {
                "c": "eg:EnumConcept",
                "p": "2018-01-01/2019-01-01",
            }});
        expect(f.value()).toEqual("eg:Member1");
        expect(f.isNumeric()).toBeFalsy();
        expect(f.decimals()).toBeUndefined();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("Member One");
        expect(f.isInvalidIXValue()).toBeFalsy();

        f.f.v = "eg:Member1 eg:Member2";
        expect(f.value()).toEqual("eg:Member1 eg:Member2");
        expect(f.isNumeric()).toBeFalsy();
        expect(f.decimals()).toBeUndefined();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("Member One, Member Two");
        expect(f.isInvalidIXValue()).toBeFalsy();

        f.f.v = "eg:Member1 eg:NotDefined";
        expect(f.value()).toEqual("eg:Member1 eg:NotDefined");
        expect(f.isNumeric()).toBeFalsy();
        expect(f.decimals()).toBeUndefined();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("Member One, <no label>");
        expect(f.isInvalidIXValue()).toBeFalsy();

        f.f.v = "eg:Member1 eg:UnlabelledMember";
        expect(f.value()).toEqual("eg:Member1 eg:UnlabelledMember");
        expect(f.isNumeric()).toBeFalsy();
        expect(f.decimals()).toBeUndefined();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("Member One, eg:UnlabelledMember");
        expect(f.isInvalidIXValue()).toBeFalsy();

        // Switch to a non-enumeration concept.
        // Values should be treated as strings
        f.f.a.c = "eg:Concept1";
        f.f.v = "eg:Member1 eg:NotDefined";
        expect(f.value()).toEqual("eg:Member1 eg:NotDefined");
        expect(f.isNumeric()).toBeFalsy();
        expect(f.decimals()).toBeUndefined();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.readableValue()).toEqual("eg:Member1 eg:NotDefined");
        expect(f.isInvalidIXValue()).toBeFalsy();
    });

});

describe("Aligned facts", () => {
    var fact1 = testFact({
        "v": "1234",
        "a": {
            "c": "eg:Concept1",
            "e": "e:1234",
            "p": "2018-01-01/2019-01-01",
        }
    });
    var fact2 = testFact( {
        "v": "1234",
        "a": {
            "c": "eg:Concept1",
            "e": "e:1234",
            "p": "2018-01-01/2019-01-01",
        }
    });
    var fact3 = testFact({
        "v": "1234",
        "a": {
            "c": "eg:Concept2",
            "e": "e:1234",
            "p": "2018-01-01/2019-01-01",
        }
    });

    var fact4 = testFact({
        "v": "1234",
        "a": {
            "c": "eg:Concept2",
            "e": "e:1234",
            "p": "2017-01-01/2018-01-01",
        }
    });

    var fact5 = testFact({
        "v": "1234",
        "a": {
            "c": "eg:Concept2",
            "e": "e:1234",
            "p": "2017-01-01/2018-01-01",
            "u": "iso4217:USD"
        }
    });

    var fact6 = testFact({
        "v": "1234",
        "a": {
            "c": "eg:Concept3",
            "e": "e:1234",
            "p": "2018-01-01/2019-01-01",
        }
    });

    test("Complete duplicates", () => {
        /* No covered aspects, only complete duplicates match */
        expect(fact1.isAligned(fact2, {})).toBeTruthy();
        expect(fact1.isAligned(fact3, {})).toBeFalsy();
        expect(fact1.isAligned(fact4, {})).toBeFalsy();
        expect(fact1.isAligned(fact5, {})).toBeFalsy();
    });

    test("Single fully covered aspect (period)", () => {
        /* Facts 3 and 4 differ only in period */
        expect(fact3.isAligned(fact1, {"p":null})).toBeFalsy();
        expect(fact3.isAligned(fact2, {"p":null})).toBeFalsy();
        expect(fact3.isAligned(fact4, {"p":null})).toBeTruthy();
        expect(fact3.isAligned(fact5, {"p":null})).toBeFalsy();
    });

    test("Different number of aspects", () => {
        /* Facts 4 and 5 and the same apart from the addition of a unit aspect - not duplicates */
        expect(fact4.isAligned(fact5, {})).toBeFalsy();

        /* Covering the missing aspect isn't sufficient (is this really correct?) */
        expect(fact4.isAligned(fact5, {"u": null})).toBeFalsy();
    });

    test("Covering aspect with an array", () => {
        /* Facts 1, 2, 3 and 6 different only in concept */
        expect(fact1.isAligned(fact2, {"c": null})).toBeTruthy();
        expect(fact1.isAligned(fact3, {"c": null})).toBeTruthy();
        expect(fact1.isAligned(fact4, {"c": null})).toBeFalsy();
        expect(fact1.isAligned(fact5, {"c": null})).toBeFalsy();
        expect(fact1.isAligned(fact6, {"c": null})).toBeTruthy();

        expect(fact1.isAligned(fact6, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeTruthy();
        expect(fact1.isAligned(fact2, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeTruthy();
        expect(fact1.isAligned(fact3, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeTruthy();
        expect(fact1.isAligned(fact4, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeFalsy();
        expect(fact1.isAligned(fact5, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeFalsy();
        /* fact1 has concept1 so is aligned  */
        expect(fact1.isAligned(fact6, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeTruthy();
        /* fact6 has concept3 so is not aligned */
        expect(fact6.isAligned(fact1, {"c": ["eg:Concept1", "eg:Concept2"]})).toBeFalsy();

    });

    test("Covering aspect with a single value", () => {
        expect(fact1.isAligned(fact6, {"c": "eg:Concept1"})).toBeTruthy();
        /* Not aligned, as fact1 does not have the specified value */
        expect(fact1.isAligned(fact6, {"c": "eg:Concept2"})).toBeFalsy();
        /* fact1 and fact2 have the same value for the concept aspect
         * (Concept1), but this is overridden by the explicit request for
         * Concept2 */
        expect(fact1.isAligned(fact2, {"c": "eg:Concept2"})).toBeFalsy();
 

    });

});

describe("Readable accuracy", () => {
    test("Non-numeric", () => {    
        expect(testFact({
            "v": "1234",
            "a": {  }
        }).readableAccuracy()).toBe("n/a");
    });
    test("Numeric, non-monetary", () => {    
        expect(testFact({
            "v": "1234",
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("Infinite precision");

        expect(testFact({
            "v": "1234",
            "d": -6,
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("millions");

        expect(testFact({
            "v": "1234",
            "d": 0,
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("ones");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("hundredths");

        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("4");

        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": { "u": null }
        }).readableAccuracy()).toBe("4");

    });
    test("Numeric, monetary", () => {    
        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:USD" }
        }).readableAccuracy()).toBe("Infinite precision");

        expect(testFact({
            "v": "1234",
            "d": -6,
            "a": { "u": "iso4217:USD" }
        }).readableAccuracy()).toBe("millions");

        expect(testFact({
            "v": "1234",
            "d": 0,
            "a": { "u": "iso4217:USD" }
        }).readableAccuracy()).toBe("ones");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:USD" }
        }).readableAccuracy()).toBe("cents");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:EUR" }
        }).readableAccuracy()).toBe("cents");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:YEN" }
        }).readableAccuracy()).toBe("hundredths");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:GBP" }
        }).readableAccuracy()).toBe("pence");

    });
});

describe("Readable accuracy", () => {
    test("With units", () => {
        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": { "u": "iso4217:GBP" }
        }).getScaleLabel(-2)).toBe("pence");
        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": { "u": "iso4217:GBP" }
        }).getScaleLabel(-4)).toBe(null);
    });
    test("Without units", () => {
        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": {}
        }).getScaleLabel(-2)).toBe("hundredths");
        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": {}
        }).getScaleLabel(-4)).toBe(null);
    });
});


describe("Readable scale", () => {
    test("Non-numeric", () => {
        expect(testFact({
            "v": "1234",
            "a": {  }
        }, { "scale": 6 }).readableScale()).toBe("n/a");
    });
    test("Numeric, non-monetary", () => {
        expect(testFact({
            "v": "1234",
            "a": { "u": "eg:unit" }
        }).readableScale()).toBe("Unscaled");

        expect(testFact({
            "v": "1234",
            "a": { "u": "eg:unit" }
        }, { "scale": 6 }).readableScale()).toBe("millions");

        expect(testFact({
            "v": "1234",
            "a": { "u": "eg:unit" }
        }, { "scale": -2 }).readableScale()).toBe("hundredths");

        expect(testFact({
            "v": "1234",
            "a": { "u": "eg:unit" }
        }, { "scale": -4 }).readableScale()).toBe("-4");

    });
    test("Numeric, monetary", () => {
        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:USD" }
        }).readableScale()).toBe("Unscaled");

        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:USD" }
        }, { "scale": 6 }).readableScale()).toBe("millions");

        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:EUR" }
        }, { "scale": -2 }).readableScale()).toBe("cents");

        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:USD" }
        }, { "scale": -2 }).readableScale()).toBe("cents");

        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:YEN" }
        }, { "scale": -2 }).readableScale()).toBe("hundredths");

        expect(testFact({
            "v": "1234",
            "a": { "u": "iso4217:GBP" }
        }, { "scale": -2 }).readableScale()).toBe("pence");

    });
});


describe("Readable value", () => {

    test("Monetary value", () => {

        expect(testFact({ "v": "10", a: { u: "iso4217:USD" } }).readableValue())
            .toBe("US $ 10");

        expect(testFact({ "v": "10", a: { u: "iso4217:GBP" } }).readableValue())
            .toBe("£ 10");

        expect(testFact({ "v": "10000", d: 2, a: { u: "iso4217:GBP" } }).readableValue())
            .toBe("£ 10,000.00");

    });

    test("Other numeric", () => {

        expect(testFact({ "v": "10", d: -2, a: { u: "xbrli:foo" } }).readableValue())
            .toBe("10 xbrli:foo");

    });

    test("Simple string", () => {

        expect(testFact({ "v": "abc" }).readableValue()).toBe("abc");

        expect(testFact({ "v": "abc <i>italic</i>" }).readableValue()).toBe("abc <i>italic</i>");
        expect(testFact({ "v": "a > b" }).readableValue()).toBe("a > b");

    });

    test("Strip HTML tags and normalise whitespace", () => {

        expect(testFact({ "v": "<b>foo</b>" }, {"escaped": true }).readableValue())
            .toBe("foo");

        expect(testFact({ "v": "    <b>foo</b>bar" }, {"escaped": true }).readableValue())
            .toBe("foobar");

        expect(testFact({ "v": "\u00a0<b>foo</b>" }, {"escaped": true }).readableValue())
            .toBe("foo");

    });

    test("Don't strip non-escaped facts", () => {

        expect(testFact({ "v": "\u00a0<b>foo</b>" }, {"escaped": false }).readableValue())
            .toBe("\u00a0<b>foo</b>");
        
        expect(testFact({ "v": "\u00a0<b>foo</b>" }, {  }).readableValue())
            .toBe("\u00a0<b>foo</b>");

    });

    test("Detect and strip HTML tags - XHTML tags and attributes", () => {
        expect(testFact({ "v": "<xhtml:b>foo</xhtml:b>" }, {"escaped": true }).readableValue())
            .toBe("foo");

        expect(testFact({ "v": '<xhtml:span style="font-weight: bold">foo</xhtml:span>' }, {"escaped": true }).readableValue())
            .toBe("foo");
    });

    test("Detect and strip HTML tags - check behaviour with invalid HTML", () => {
        /* Invalid HTML  */
        expect(testFact({ "v": "<b:b:b>foo</b:b:b>" }, {"escaped": true }).readableValue())
            .toBe("foo");

        expect(testFact({ "v": "<foo<bar>baz</bar>" }, {"escaped": true }).readableValue())
            .toBe("baz");
    });

    test("Text in consecutive inline elements should be contiguous", () => {

        expect(testFact({ "v": "<b>foo</b><i>bar</i>" }, {"escaped":true }).readableValue())
            .toBe("foobar");

    });

    test("Text in block/table elements should be separated.", () => {

        expect(testFact({ "v": "<p>foo</p><p>bar</p>" }, {"escaped":true }).readableValue())
            .toBe("foo bar");

        /* This should really return "foo bar", but we don't correctly detect
         * block tags in prefixed XHTML */
        expect(testFact({ "v": '<xhtml:p xmlns:xhtml="https://www.w3.org/1999/xhtml/">foo</xhtml:p><xhtml:p>bar</xhtml:p>' }, {"escaped":true }).readableValue())
            .toBe("foobar");

        expect(testFact({ "v": "<table><tr><td>cell1</td><td>cell2</td></tr></table>" }, {"escaped":true })
            .readableValue())
            .toBe("cell1 cell2");

    });

    test("Whitespace normalisation", () => {

        expect(testFact({ "v": "<p>bar  foo</p> <p>bar</p>" }, {"escaped":true }).readableValue())
            .toBe("bar foo bar");

    });
});

describe("Unit aspect handling", () => {

    test("Numeric, missing unit", () => {    
        var f = testFact({
            "v": "1234",
            "a": {  
                "u": null
            }
        });
        expect(f.isNumeric()).toBeTruthy();
        expect(f.isMonetaryValue()).toBeFalsy();
        expect(f.unit()).toBeUndefined();
        expect(f.measure()).toBeUndefined();
        expect(f.measureLabel()).toBe("<NOUNIT>");
    });

    test("Non-numeric, no unit", () => {    
        var f = testFact({
            "v": "1234",
            "a": {  
            }
        });
        expect(f.isNumeric()).toBeFalsy();
        expect(f.unit()).toBeUndefined();
        expect(f.measure()).toBeUndefined();
    });
});

describe("Get Label", () => {
    var f = testFact({
            "d": -3,
            "v": 1000,
            "a": {
                "c": "eg:Concept1",
                "u": "iso4217:USD", 
                "p": "2018-01-01/2019-01-01",
            }});

    test("Get standard label", () => {
        expect(f.getLabel("std")).toEqual("English label")
    });

    test("Get non-existent label", () => {
        expect(f.getLabel("doc")).toBeUndefined();
    });

});

describe("Aspect methods", () => {
    var f = testFact({
            "d": -3,
            "v": 1000,
            "a": {
                "c": "eg:Concept1",
                "u": "iso4217:USD", 
                "p": "2018-01-01/2019-01-01",
                "eg:Dimension1": "eg:Member1"
            }});
    test("Get aspects", () => {
        expect(f.aspects().length).toEqual(4);
        expect(f.aspects().filter(a => a.isTaxonomyDefined()).length).toEqual(1);
        expect(f.aspects().filter(a => a.isTaxonomyDefined())[0].label()).toEqual("Dimension One");
        expect(f.aspects().filter(a => a.isTaxonomyDefined())[0].valueLabel()).toEqual("Member One");
        expect(f.aspect("eg:Dimension1").value()).toEqual("eg:Member1");
    });
});

describe("Fact errors", () => {
    test("iXBRL Invalid", () => {
        var f = testFact({
                "d": -3,
                "v": "abcd",
                "err": "INVALID_IX_VALUE",
                "a": {
                    "c": "eg:Concept1",
                    "u": "iso4217:USD", 
                    "p": "2018-01-01/2019-01-01",
                }});
        expect(f.value()).toEqual("abcd");
        expect(f.decimals()).toEqual(-3);
        expect(f.isNumeric()).toBeTruthy();
        expect(f.isMonetaryValue()).toBeTruthy();
        expect(f.readableValue()).toEqual("Invalid value");
        expect(f.unit().value()).toEqual("iso4217:USD");
        expect(f.measure()).toEqual("iso4217:USD");
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
        expect(f.isInvalidIXValue()).toBeTruthy();
    });
});
