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

import { Fact } from "./fact.js";
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
            }
        }
    },
    "facts": {
    }
};

function testReport(facts) {
    // Deep copy of standing data
    var data = JSON.parse(JSON.stringify(testReportData));
    data.facts = facts;
    return new iXBRLReport(data);
}

function testFact(factData) {
    factData.a = factData.a || {};
    return new Fact(testReport({"f1": factData}), "f1");
}

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
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
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
        expect(f.conceptQName().prefix).toEqual("eg");
        expect(f.conceptQName().localname).toEqual("Concept1");
        expect(f.conceptQName().namespace).toEqual("http://www.example.com");
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
        }).readableAccuracy()).toBe("-6 (millions)");

        expect(testFact({
            "v": "1234",
            "d": 0,
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("0 (ones)");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "eg:unit" }
        }).readableAccuracy()).toBe("2 (hundredths)");

        expect(testFact({
            "v": "1234",
            "d": 4,
            "a": { "u": "eg:unit" }
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
        }).readableAccuracy()).toBe("-6 (millions)");

        expect(testFact({
            "v": "1234",
            "d": 0,
            "a": { "u": "iso4217:USD" }
        }).readableAccuracy()).toBe("0 (ones)");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:USD" }
        }).readableAccuracy()).toBe("2 (cents)");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:EUR" }
        }).readableAccuracy()).toBe("2 (cents)");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:YEN" }
        }).readableAccuracy()).toBe("2 (hundredths)");

        expect(testFact({
            "v": "1234",
            "d": 2,
            "a": { "u": "iso4217:GBP" }
        }).readableAccuracy()).toBe("2 (pence)");

    });
});


describe("Readable value", () => {

    test("Simple string", () => {

        expect(testFact({ "v": "abc" }).readableValue()).toBe("abc");

        expect(testFact({ "v": "abc <i>italic</i>" }).readableValue()).toBe("abc <i>italic</i>");
        expect(testFact({ "v": "a > b" }).readableValue()).toBe("a > b");

    });

    test("Detect and strip HTML tags", () => {

        expect(testFact({ "v": "<b>foo</b>" }).readableValue())
            .toBe("foo");

        expect(testFact({ "v": "    <b>foo</b>bar" }).readableValue())
            .toBe("foobar");

        expect(testFact({ "v": "\u00a0<b>foo</b>" }).readableValue())
            .toBe("foo");

        expect(testFact({ "v": ".<b>foo</b>" }).readableValue())
            .toBe(".<b>foo</b>");

    });

    test("Text in consecutive inline elements should be contiguous", () => {

        expect(testFact({ "v": "<b>foo</b><i>bar</i>" }).readableValue())
            .toBe("foobar");

    });

    test("Text in block/table elements should be separated.", () => {

        expect(testFact({ "v": "<p>foo</p><p>bar</p>" }).readableValue())
            .toBe("foo bar");

        expect(testFact({ "v": "<table><tr><td>cell1</td><td>cell2</td></tr></table>" })
            .readableValue())
            .toBe("cell1 cell2");

    });

    test("Whitespace normalisation", () => {

        expect(testFact({ "v": "<p>bar  foo</p> <p>bar</p>" }).readableValue())
            .toBe("bar foo bar");

    });
});
