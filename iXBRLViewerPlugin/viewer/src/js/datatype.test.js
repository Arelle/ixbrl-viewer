// See COPYRIGHT.md for copyright information

import { ReportSet } from "./reportset.js";
import { NAMESPACE_ISO4217, NAMESPACE_XBRLI } from "./util";
import { TestInspector } from "./test-utils.js";

const testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217,
        "xbrli": NAMESPACE_XBRLI,
        "e": "http://example.com/entity",
    },
    "concepts": {
    },
    "facts": {
    }
}

function testReport(concept) {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
    data.concepts["eg:concept"] = concept;
    const reportSet = new ReportSet(data);
    reportSet.setIXNodeMap({});
    return reportSet.reports[0];
}

const insp = new TestInspector();
beforeAll(() => {
    insp.i18nInit();
});

describe("Data types", () => {
    test("Monetary", () => {
        const r1 = testReport({ "dt": "xbrli:monetaryItemType" });
        expect(r1.getConcept("eg:concept").dataType().label()).toBe("Monetary");
    });

    test("String", () => {
        const r1 = testReport({ "dt": "xbrli:stringItemType" });
        expect(r1.getConcept("eg:concept").dataType().label()).toBe("String");
    });

    test("Unknown xbrli", () => {
        const r1 = testReport({ "dt": "xbrli:unknown" });
        expect(r1.getConcept("eg:concept").dataType().label()).toBe("xbrli:unknown");
    });

    test("Custom", () => {
        const r1 = testReport({ "dt": "eg:stringItemType" });
        expect(r1.getConcept("eg:concept").dataType().label()).toBe("eg:stringItemType");
    });

    test("No datatype", () => {
        const r1 = testReport({});
        expect(r1.getConcept("eg:concept").dataType()).toBeUndefined();
    });
})



