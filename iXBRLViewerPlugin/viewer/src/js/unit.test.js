// See COPYRIGHT.md for copyright information

import { Unit } from "./unit.js";
import { ReportSet } from "./reportset.js";
import { TestInspector } from "./test-utils.js";
import { NAMESPACE_ISO4217 } from "./util";

var testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217,
        "e": "http://example.com/entity",
        "utr": "http://www.xbrl.org/2009/utr",
        "xbrli": "http://www.xbrl.org/2003/instance",
    },
    "facts": {},
};

function testReport() {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
    const report = new ReportSet(data);
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
        expect(unit.label()).toEqual('US $');
    });

    test("Unit label for complex unit", () => {
        var unit = new Unit(testReport(), 'iso4217:USD/eg:share');
        expect(unit.label()).toEqual('US $/share');
    });

    test("Unit label for complex unit with numerator parentheses", () => {
        var unit = new Unit(testReport(), '(iso4217:USD*eg:share)/eg:shareholder');
        expect(unit.label()).toEqual('(US $*share)/shareholder');
    });

    test("Unit label for complex unit with denominator parentheses", () => {
        var unit = new Unit(testReport(), 'iso4217:USD/(eg:share*eg:shareholder)');
        expect(unit.label()).toEqual('US $/(share*shareholder)');
    });
});

describe("Unit label", () => {
    test("Unit label - known currency", () => {
        var unit = new Unit(testReport(), 'eg:share');
        expect(unit.label()).toEqual('share');
    });

    test("Unit label - known currency", () => {
        var unit = new Unit(testReport(), 'iso4217:USD');
        // Note "US $" from i18n takes precedence over "USD $" generated from UTR
        expect(unit.label()).toEqual('US $');
    });

    test("Unit label - UTR currency", () => {
        var unit = new Unit(testReport(), 'iso4217:THB');
        expect(unit.label()).toEqual('฿');
    });

    test("Unit label - UTR currency with '$' symbol", () => {
        var unit = new Unit(testReport(), 'iso4217:SGD');
        expect(unit.label()).toEqual('SGD $');
    });

    test("Unit label - UTR currency without symbol falls back to name", () => {
        var unit = new Unit(testReport(), 'iso4217:YER');
        expect(unit.label()).toEqual('Yemeni rial');
    });

    test("Unit label - UTR currency without symbol falls back to name", () => {
        var unit = new Unit(testReport(), 'iso4217:XAU');
        expect(unit.label()).toEqual('Gold');
    });

    test("Unit label - unknown", () => {
        var unit = new Unit(testReport(), 'iso4217:ZZZZ');
        expect(unit.label()).toEqual('ZZZZ');
    });

    test("Unit label - UTR non-currency symbol used", () => {
        var unit = new Unit(testReport(), 'utr:m3');
        expect(unit.label()).toEqual('m³');
    });

    test("Unit label - UTR non-currency symbol used", () => {
        var unit = new Unit(testReport(), 'utr:sqkm');
        expect(unit.label()).toEqual('km²');
    });

    test("Unit label - UTR non-currency symbol used", () => {
        var unit = new Unit(testReport(), 'utr:F');
        expect(unit.label()).toEqual('°F');
    });

    test("Unit label - UTR non-currency without symbol falls back to name", () => {
        var unit = new Unit(testReport(), 'xbrli:shares');
        expect(unit.label()).toEqual('Share');
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
    test("Unit value is simple unit", () => {
        var unit = new Unit(testReport(), 'iso4217:USD');
        expect(unit.value()).toEqual('iso4217:USD');
    });
});
