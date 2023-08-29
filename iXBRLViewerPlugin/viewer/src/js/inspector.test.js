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
        }
    },
    "facts": {},
    "languages": {},
    "roles": {},
    "roleDefs": {},
    "rels": {},
    "units": {},
};

function testReport(facts, ixData) {
    // Deep copy of standing data
    var data = JSON.parse(JSON.stringify(testReportData));
    data.facts = facts;
    var report = new iXBRLReport(data);
    report.setIXNodeMap(ixData);
    return report;
}

function fromFact(value) {
    var factData = {
                "v": value,
                "a": {
                    "c": "eg:Concept1",
                    "u": "iso4217:USD", 
                    "p": "2017-01-01/2018-01-01",
                }};
    return new Fact(testReport({"f1": factData}, {"f1": {} }), "f1");
}

function toFact(value) {
    var factData = {
                "v": value,
                "a": {
                    "c": "eg:Concept1",
                    "u": "iso4217:USD", 
                    "p": "2018-01-01/2019-01-01",
                }};
    return new Fact(testReport({"f1": factData}, {"f1": {} }), "f1");
}

describe("Describe changes", () => {
    var insp = new TestInspector();
    beforeAll(() => {
        return insp.i18nInit();
    });

    test("Simple changes", () => {
        expect(insp.describeChange(fromFact(1000), toFact(2000))).toBe("100.0% increase on ");
        expect(insp.describeChange(fromFact(2000), toFact(1000))).toBe("50.0% decrease on ");
        expect(insp.describeChange(fromFact(1000), toFact(1000))).toBe("0.0% increase on ");
    });

    test("Sign changes", () => {
        expect(insp.describeChange(fromFact(1000), toFact(-1000))).toBe("From US $ 1,000 in ");
        expect(insp.describeChange(fromFact(-1000000), toFact(1000))).toBe("From US $ -1,000,000 in ");
    });

    test("From/to zero", () => {
        expect(insp.describeChange(fromFact(0), toFact(1000))).toBe("From US $ 0 in ");
        expect(insp.describeChange(fromFact(0), toFact(0))).toBe("From US $ 0 in ");
        expect(insp.describeChange(fromFact(1000), toFact(0))).toBe("From US $ 1,000 in ");
    });
});

describe("Scales filter options", () => {
    const createTestFact = function(isMonetary) {
        return {
            "v": 1,
            "a": {
                "c": "eg:Concept1",
                "u": isMonetary ? "iso4217:USD" : "test:shares",
                "p": "2018-01-01/2019-01-01",
            },
        };
    }
    const ixData = {};
    const monetaryFactData = {};
    for (let scale = -4; scale < 11; scale++) {
        const id = `itemM${scale}`;
        monetaryFactData[id] = createTestFact(true);
        const ixNode = {}
        if (scale !== 0) {
            ixNode["scale"] = scale;
        }
        ixData[id] = ixNode;
    }
    const nonMonetaryFactData = {};
    for (let scale = -4; scale < 11; scale++) {
        const id = `item${scale}`;
        nonMonetaryFactData[id] = createTestFact(false);
        const ixNode = {}
        if (scale !== 0) {
            ixNode["scale"] = scale;
        }
        ixData[id] = ixNode;
    }

    test("Scales filter options with monetary and non-monetary facts", () => {
        var insp = new TestInspector();
        const report = testReport({
            ...monetaryFactData,
            ...nonMonetaryFactData,
        }, ixData);
        insp.initialize(report)
        insp.i18nInit();
        const scalesOptions = insp._getScalesOptions();
        expect(scalesOptions).toEqual({
            "1": "Tens",
            "2": "Hundreds",
            "3": "Thousands",
            "4": "Ten Thousands",
            "5": "Hundred Thousands",
            "6": "Millions",
            "7": "Ten Millions",
            "8": "Hundred Millions",
            "9": "Billions",
            "10": "10",
            "-1": "Tenths",
            "-2": "Cents, Hundredths",
            "-3": "Thousandths",
            "-4": "-4",
        });
    })

    test("Scales filter options with only monetary facts", () => {
        var insp = new TestInspector();
        const report = testReport({
            ...monetaryFactData,
        }, ixData);
        insp.initialize(report)
        insp.i18nInit();
        const scalesOptions = insp._getScalesOptions();
        expect(scalesOptions).toEqual({
            "1": "Tens",
            "2": "Hundreds",
            "3": "Thousands",
            "4": "Ten Thousands",
            "5": "Hundred Thousands",
            "6": "Millions",
            "7": "Ten Millions",
            "8": "Hundred Millions",
            "9": "Billions",
            "10": "10",
            "-1": "Tenths",
            "-2": "Cents",
            "-3": "Thousandths",
            "-4": "-4",
        });
    })

    test("Scales filter options with only non-monetary facts", () => {
        var insp = new TestInspector();
        const report = testReport({
            ...nonMonetaryFactData,
        }, ixData);
        insp.initialize(report)
        insp.i18nInit();
        const scalesOptions = insp._getScalesOptions();
        expect(scalesOptions).toEqual({
            "1": "Tens",
            "2": "Hundreds",
            "3": "Thousands",
            "4": "Ten Thousands",
            "5": "Hundred Thousands",
            "6": "Millions",
            "7": "Ten Millions",
            "8": "Hundred Millions",
            "9": "Billions",
            "10": "10",
            "-1": "Tenths",
            "-2": "Hundredths",
            "-3": "Thousandths",
            "-4": "-4",
        });
    })
});
