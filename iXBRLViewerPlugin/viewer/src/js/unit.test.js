// See COPYRIGHT.md for copyright information

import { Unit } from "./unit.js";
import { iXBRLReport } from "./report.js";
import { TestInspector } from "./test-utils.js";

var testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": "http://www.xbrl.org/2003/iso4217",
        "e": "http://example.com/entity",
    }
};

function testReport() {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
    const report = new iXBRLReport(data);
    report.setIXNodeMap({});
    return report;
}

var insp = new TestInspector();
beforeAll(() => {
    return insp.i18nInit();
});

describe("Unit label", () => {
    test("Unit label for simple unit", () => {
        var unit = new Unit(testReport(), 'iso4217:USD');
        expect(unit.label()).toEqual('USD');
    });

    test("Unit label for complex unit", () => {
        var unit = new Unit(testReport(), 'iso4217:USD/eg:share');
        expect(unit.label()).toEqual('USD/Share');
    });

    test("Unit label for complex unit with numerator parentheses", () => {
        var unit = new Unit(testReport(), '(iso4217:USD*eg:share)/eg:shareholder');
        expect(unit.label()).toEqual('(USD*Share)/Shareholder');
    });

    test("Unit label for complex unit with denominator parentheses", () => {
        var unit = new Unit(testReport(), 'iso4217:USD/(eg:share*eg:shareholder)');
        expect(unit.label()).toEqual('USD/(Share*Shareholder)');
    });
});

describe("Unit measure", () => {
    test("Unit measure is simple unit", () => {
        var unit = new Unit(testReport(), 'iso4217:USD');
        expect(unit.measure()).toEqual('iso4217:USD');
    });

    test("Unit measure is first numerator of complex unit", () => {
        var unit = new Unit(testReport(), '(iso4217:USD*eg:share)/eg:shareholder');
        expect(unit.measure()).toEqual('iso4217:USD');
    });
});

describe("Unit measure label", () => {
    test("Unit measure label - known currency", () => {
        var unit = new Unit(testReport(), 'eg:share');
        expect(unit.measureLabel()).toEqual('eg:share');
    });

    test("Unit measure label - known currency", () => {
        var unit = new Unit(testReport(), 'iso4217:USD');
        expect(unit.measureLabel()).toEqual('US $');
    });

    test("Unit measure label - unknown", () => {
        var unit = new Unit(testReport(), 'iso4217:ZAR');
        expect(unit.measureLabel()).toEqual('ZAR');
    });
});

describe("Unit monetary", () => {
    test("Unit is monetary", () => {
        var unit = new Unit(testReport(), 'iso4217:USD');
        expect(unit.isMonetary()).toBeTruthy();
    });

    test("Unit is not monetary", () => {
        var unit = new Unit(testReport(), 'other:USD');
        expect(unit.isMonetary()).toBeFalsy();
    });
});

describe("Unit value", () => {
    test("Unit value is key", () => {
        var unit = new Unit(testReport(), '(iso4217:USD*eg:share)/eg:shareholder');
        expect(unit.value()).toEqual('(iso4217:USD*eg:share)/eg:shareholder');
    });
});
