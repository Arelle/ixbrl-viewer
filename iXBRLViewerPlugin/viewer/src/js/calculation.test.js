// See COPYRIGHT.md for copyright information

import Decimal from 'decimal.js';
import { FactSet } from "./factset.js";
import { Fact  } from "./fact.js";
import { Interval  } from "./interval.js";
import { NAMESPACE_ISO4217, viewerUniqueId } from "./util.js";
import { ReportSet } from "./reportset.js";
import { Calculation } from "./calculation.js";
import './test-utils.js';

const testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217,
        "e": "http://example.com/entity",
        "group": "http://example.com/group",
    },
    "concepts": {
        "eg:Total": {
            "labels": {
                "std": {
                    "en": "Total"
                }
            }
        },
        "eg:Item1": {
            "labels": {
                "std": {
                    "en": "Item 1"
                }
            }
        },
        "eg:Item2": {
            "labels": {
                "std": {
                    "en": "Item 2"
                }
            }
        },
        "eg:Total2": {
            "labels": {
                "std": {
                    "en": "Total 2"
                }
            }
        },
    },
    "facts": {
    },
    "rels": {
        "calc": {
            "group": {
                "eg:Total": [
                    {"t": "eg:Item1", "w": 1},
                    {"t": "eg:Item2", "w": -1}
                ],
                "eg:Total2": [
                    {"t": "eg:Item1", "w": 2},
                    {"t": "eg:Item2", "w": -2}
                ]
            }
        }
    }
};

function testReportSet(facts, reportData) {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(reportData ?? testReportData));
    data.facts = facts;
    const reportset = new ReportSet(data);
    reportset._initialize();
    return reportset;
}

function testFact(aspectData, value, decimals) {
    const factData = { "a": aspectData, "v": value, "d": decimals};
    return factData;
}

function getFact(reportSet, id) {
  return reportSet.getItemById(viewerUniqueId(0, id));
}

describe("isCalculationSummation / isCalculationContributor - calc 1.0", () => {
    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 10000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 12000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 2000, -3),
    });

    test("calc 1.0 - summation", () => {
        const f1 =  getFact(reportSet, "f1");
        expect(f1.isCalculationSummation()).toBe(true);
        expect(f1.isCalculationContributor()).toBe(false);
    });

    test("calc 1.0 - contributor", () => {
        const f2 =  getFact(reportSet, "f2");
        expect(f2.isCalculationSummation()).toBe(false);
        expect(f2.isCalculationContributor()).toBe(true);
    });
});

describe("isCalculationSummation / isCalculationContributor - calc 1.1", () => {

    const calc11ReportData = JSON.parse(JSON.stringify(testReportData));
    calc11ReportData.rels.calc11 = calc11ReportData.rels.calc;
    delete calc11ReportData.rels.calc;

    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 10000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 12000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 2000, -3),
    }, calc11ReportData);

    test("calc 1.1 - summation", () => {
        const f1 =  getFact(reportSet, "f1");
        expect(f1.isCalculationSummation()).toBe(true);
        expect(f1.isCalculationContributor()).toBe(false);
    });

    test("calc 1.1 - contributor", () => {
        const f2 =  getFact(reportSet, "f2");
        expect(f2.isCalculationSummation()).toBe(false);
        expect(f2.isCalculationContributor()).toBe(true);
    });
});

describe("isCalculationSummation / isCalculationContributor - unknown calc version", () => {

    const calcXReportData = JSON.parse(JSON.stringify(testReportData));
    calcXReportData.rels.calc9 = calcXReportData.rels.calc;
    delete calcXReportData.rels.calc;

    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 10000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 12000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 2000, -3),
    }, calcXReportData);

    test("calc 1.1 - summation", () => {
        const f1 =  getFact(reportSet, "f1");
        expect(f1.isCalculationSummation()).toBe(false);
        expect(f1.isCalculationContributor()).toBe(false);
    });

    test("calc 1.1 - contributor", () => {
        const f2 =  getFact(reportSet, "f2");
        expect(f2.isCalculationSummation()).toBe(false);
        expect(f2.isCalculationContributor()).toBe(false);
    });
});

describe("Simple consistent calculation", () => {
    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 10000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 12000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 2000, -3),
    });

    test("Calc 1.1 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), true);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotalInterval()).toEqual(new Interval(9000, 11000));
        expect(Interval.fromFact(rCalc.totalFact)).toEqual(new Interval(9500, 10500));
        expect(rCalc.isConsistent()).toBe(true);

    });

    test("Calc contributor", () => {
        const calc11 = new Calculation(getFact(reportSet, "f2"), true);
        expect(calc11.hasCalculations()).toBe(false);
        const calc10 = new Calculation(getFact(reportSet, "f2"), false);
        expect(calc10.hasCalculations()).toBe(false);
    });

    test("Calc 1.0 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), false);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotal()).toEqual(new Decimal(10000));
        expect(rCalc.unchecked()).toBe(false);
        expect(rCalc.isConsistent()).toBe(true);
    });
});

describe("Consistent only under 1.1", () => {
    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 11000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 12000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 2000, -3),
    });

    test("Calc 1.1 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), true);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotalInterval()).toEqual(new Interval(9000, 11000));
        expect(Interval.fromFact(rCalc.totalFact)).toEqual(new Interval(10500, 11500));
        expect(rCalc.isConsistent()).toBe(true);

        expect(rCalc.rows[0].concept.name).toBe("eg:Item1");
        expect(rCalc.rows[0].weight).toBe(1);
        expect(rCalc.rows[0].weightSign).toBe("+");
        expect(rCalc.rows[0].facts.size()).toBe(1);

        expect(rCalc.rows[1].concept.name).toBe("eg:Item2");
        expect(rCalc.rows[1].weight).toBe(-1);
        expect(rCalc.rows[1].weightSign).toBe("-");
        expect(rCalc.rows[1].facts.size()).toBe(1);

    });

    test("Calc contributor", () => {
        const calc11 = new Calculation(getFact(reportSet, "f2"), true);
        expect(calc11.hasCalculations()).toBe(false);
        const calc10 = new Calculation(getFact(reportSet, "f2"), false);
        expect(calc10.hasCalculations()).toBe(false);
    });

    test("Calc 1.0 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), false);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotal()).toEqual(new Decimal(10000));
        expect(rCalc.unchecked()).toBe(false);
        expect(rCalc.isConsistent()).toBe(false);
    });

});

describe("Consistent duplicate contributor", () => {
    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 10000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 12000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 2000, -3),
        "f4": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 1990, -1),
    });

    test("Calc 1.1 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), true);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotalInterval()).toEqual(new Interval(9505, 10515));
        expect(Interval.fromFact(rCalc.totalFact)).toEqual(new Interval(9500, 10500));
        expect(rCalc.isConsistent()).toBe(true);

        expect(rCalc.rows[0].concept.name).toBe("eg:Item1");
        expect(rCalc.rows[0].weight).toBe(1);
        expect(rCalc.rows[0].weightSign).toBe("+");
        expect(rCalc.rows[0].facts.size()).toBe(1);

        expect(rCalc.rows[1].concept.name).toBe("eg:Item2");
        expect(rCalc.rows[1].weight).toBe(-1);
        expect(rCalc.rows[1].weightSign).toBe("-");
        expect(rCalc.rows[1].facts.size()).toBe(2);

    });

    test("Calc contributor", () => {
        const calc11 = new Calculation(getFact(reportSet, "f2"), true);
        expect(calc11.hasCalculations()).toBe(false);
        const calc10 = new Calculation(getFact(reportSet, "f2"), false);
        expect(calc10.hasCalculations()).toBe(false);
    });

    test("Calc 1.0 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), false);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotal()).toEqual(new Decimal(10000));
        expect(rCalc.unchecked()).toBe(true);
    });

});


describe("Single contributor", () => {
    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total", "u": "iso2417:GBP"}, 10000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 9990, -1),
    });

    test("Calc 1.1 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), true);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotalInterval()).toEqual(new Interval(9985, 9995));
        expect(Interval.fromFact(rCalc.totalFact)).toEqual(new Interval(9500, 10500));
        expect(rCalc.isConsistent()).toBe(true);

    });

    test("Calc 1.0 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), false);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotal()).toEqual(new Decimal(9990));
        expect(rCalc.unchecked()).toBe(false);
        expect(rCalc.isConsistent()).toBe(false);
    });
});

describe("Weights", () => {
    const reportSet = testReportSet({
        "f1": testFact({"c": "eg:Total2", "u": "iso2417:GBP"}, 4000, -3),
        "f2": testFact({"c": "eg:Item1", "u": "iso2417:GBP"}, 3000, -3),
        "f3": testFact({"c": "eg:Item2", "u": "iso2417:GBP"}, 1000, -3),
    });

    test("Calc 1.1 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), true);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotalInterval()).toEqual(new Interval(2000, 6000));
        expect(Interval.fromFact(rCalc.totalFact)).toEqual(new Interval(3500, 4500));
        expect(rCalc.isConsistent()).toBe(true);

        expect(rCalc.rows[0].concept.name).toBe("eg:Item1");
        expect(rCalc.rows[0].weight).toBe(2);
        expect(rCalc.rows[0].weightSign).toBe("2");

        expect(rCalc.rows[1].concept.name).toBe("eg:Item2");
        expect(rCalc.rows[1].weight).toBe(-2);
        expect(rCalc.rows[1].weightSign).toBe("-2");

    });

    test("Calc contributor", () => {
        const calc11 = new Calculation(getFact(reportSet, "f2"), true);
        expect(calc11.hasCalculations()).toBe(false);
        const calc10 = new Calculation(getFact(reportSet, "f2"), false);
        expect(calc10.hasCalculations()).toBe(false);
    });

    test("Calc 1.0 total", () => {
        const calc = new Calculation(getFact(reportSet, "f1"), false);
        expect(calc.hasCalculations()).toBe(true);
        const rCalcs = calc.resolvedCalculations();
        expect(rCalcs.length).toBe(1);
        const rCalc = rCalcs[0];
        expect(rCalc.elr).toBe("group");
        expect(rCalc.calculatedTotal()).toEqual(new Decimal(4000));
        expect(rCalc.unchecked()).toBe(false);
        expect(rCalc.isConsistent()).toBe(true);
    });
});

/*
 * xbrl:summationRelation — the XBRL Model summation-item proposal's answer to
 * "what are the contributions to the total?".  Calculations 1.1 can only say
 * "equal"; the of-which pattern needs "atMost", where the components are known
 * to be only part of the total.
 */
describe("summationRelation", () => {
    const relationData = (sr) => {
        const d = JSON.parse(JSON.stringify(testReportData));
        d.rels.calc11 = {
            "group": {
                "eg:Total": [
                    {"t": "eg:Item1", "w": 1, ...(sr ? {"sr": sr} : {})},
                    {"t": "eg:Item2", "w": 1, ...(sr ? {"sr": sr} : {})},
                ],
            },
        };
        delete d.rels.calc;
        return d;
    };

    // components sum to 30; the reported total is 100, so the components are
    // only part of it -- an of-which breakdown
    const ofWhich = {
        "f1": testFact({"c": "eg:Total", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "100", 0),
        "f2": testFact({"c": "eg:Item1", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "10", 0),
        "f3": testFact({"c": "eg:Item2", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "20", 0),
    };

    function consistency(facts, sr) {
        const rs = testReportSet(facts, relationData(sr));
        const calcs = new Calculation(getFact(rs, "f1"), true).resolvedCalculations();
        expect(calcs.length).toBe(1);
        return calcs[0];
    }

    test("without the property, an of-which breakdown is inconsistent — the 1.1 answer", () => {
        expect(consistency(ofWhich, undefined).isConsistent()).toBe(false);
    });

    test("atMost makes it consistent, because the components may be part of the total", () => {
        expect(consistency(ofWhich, "atMost").isConsistent()).toBe(true);
        expect(consistency(ofWhich, "atMost").summationRelation()).toBe("atMost");
    });

    test("atMost is still inconsistent when the components EXCEED the total", () => {
        // 10 + 20 = 30 against a reported 5: no pair of values satisfies <=
        const over = {...ofWhich,
            "f1": testFact({"c": "eg:Total", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "5", 0)};
        expect(consistency(over, "atMost").isConsistent()).toBe(false);
    });

    test("atLeast is the mirror", () => {
        expect(consistency(ofWhich, "atLeast").isConsistent()).toBe(false);
        const under = {...ofWhich,
            "f1": testFact({"c": "eg:Total", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "5", 0)};
        expect(consistency(under, "atLeast").isConsistent()).toBe(true);
    });

    test("an exact sum is consistent under every relation", () => {
        const exact = {...ofWhich,
            "f1": testFact({"c": "eg:Total", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "30", 0)};
        for (const sr of [undefined, "equal", "atMost", "atLeast"]) {
            expect(`${sr}: ${consistency(exact, sr).isConsistent()}`).toBe(`${sr}: true`);
        }
    });

    test("the relation is compared on interval bounds, not midpoints", () => {
        /*
         * Rounded values are intervals, so "atMost" asks whether SOME pair of
         * values satisfies the relation.  10 and 20 at decimals 0 span
         * [9.5,10.5] and [19.5,20.5], summing to [29,31]; a total reported as 29
         * spans [28.5,29.5], whose high end 29.5 is not below the sum's low end
         * 29 -- so it is possible and must not be called inconsistent.
         */
        const boundary = {...ofWhich,
            "f1": testFact({"c": "eg:Total", "u": "iso4217:USD", "p": "2018-01-01/2019-01-01"}, "29", 0)};
        expect(consistency(boundary, "atMost").isConsistent()).toBe(true);
    });

    test("defaults to equal when nothing says otherwise", () => {
        expect(consistency(ofWhich, undefined).summationRelation()).toBe("equal");
    });
});
