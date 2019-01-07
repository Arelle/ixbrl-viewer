import { Fact } from "./fact.js";
import { iXBRLReport } from "./report.js";

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

