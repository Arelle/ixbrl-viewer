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

function testReportSet(facts) {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
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
