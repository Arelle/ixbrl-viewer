// See COPYRIGHT.md for copyright information

import { ReportSet } from "./reportset.js";
import { ViewerOptions } from "./viewerOptions.js";
import { TestInspector } from "./test-utils.js";
import { NAMESPACE_ISO4217 } from "./util";

var testReportData = {
    "languages": {
        "en-us": "English (US)",
        "en": "English",
    },
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217
    },
    "roles": {
        "role1": "https://www.example.com/role1",
        "role2": "https://www.example.com/role2",
        "role3": "https://www.example.com/role3",
        "role4": "https://www.example.com/role4MoreWords",
        "std": "http://www.xbrl.org/2003/role/label",
        "doc": "http://www.xbrl.org/2003/role/documentation",
        "verbose": "http://www.xbrl.org/2003/role/verboseLabel",
        "total": "http://www.xbrl.org/2003/role/totalLabel",
    },
    "roleDefs": {
        "role1": { "en": "Role 1 Label" },
        "role2": { "en": null },
        "role3": {}
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
                    "en": "English label for concept two",
                    "en-us": "English (US) label for concept two",
                    "en-gb": "English (GB) label for concept two"
                }
            }
        },
        "eg:Concept3": {
            "labels": {
                "std": {
                    "fr": "Concept trois",
                    "de": "Concept vier",
                    "es": "Concept cuatro",
                }
            }
        }
    },

    "facts": {
        "f1": {
            "d": -3,
            "v": 1000,
            "a": {
                "c": "eg:Concept1",
                "u": "iso4217:USD",
                "p": "2018-01-01/2019-01-01",
            }
        }
    },

    "softwareCredits": ["Example credit text A", "Example credit text B"],
};

var insp = new TestInspector();
beforeAll(() => {
    return insp.i18nInit();
});

describe("Language options", () => {
    const testReportSet = new ReportSet(testReportData);
    testReportSet._initialize();
    test("Available languages", () => {
        const al = testReportSet.availableLanguages();
        expect(al).toHaveLength(6);
        expect(al).toEqual(expect.arrayContaining(["en", "en-us", "en-gb", "fr", "de", "es"]));
    });
});

describe("Fetching facts", () => {
    const testReportSet = new ReportSet(testReportData);
    testReportSet._initialize();

    test("Successful", () => {
        const f = testReportSet.getItemById("0-f1");
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });

    test("Non-existent fact", () => {
        const f = testReportSet.getItemById("fact-does-not-exist");
        expect(f).toBeUndefined();
    });
});

describe("Concept labels", () => {
    const testReportSet = new ReportSet(testReportData);
    testReportSet._initialize();
    const testReport = testReportSet.reports[0];
    const vo = new ViewerOptions();
    testReportSet.viewerOptions = vo;
    test("Label fallback", () => {
        vo.language = 'fr';
        expect(testReport.getLabel('eg:Concept3', 'std')).toBe("Concept trois");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std').label).toBe("Concept trois");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std').lang).toBe("fr");
        expect(testReport.getLabelOrName('eg:Concept3', 'std')).toBe("Concept trois");
        vo.language = 'es';
        expect(testReport.getLabel('eg:Concept3', 'std')).toBe("Concept cuatro");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std').label).toBe("Concept cuatro");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std').lang).toBe("es");
        expect(testReport.getLabelOrName('eg:Concept3', 'std')).toBe("Concept cuatro");
        // No English label, so fall back on German (de is first alphabetically)
        vo.language = 'en';
        expect(testReport.getLabel('eg:Concept3', 'std')).toBe("Concept vier");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std').label).toBe("Concept vier");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std').lang).toBe("de");
        expect(testReport.getLabelOrName('eg:Concept3', 'std')).toBe("Concept vier");

        // Attempt to get an undefined label type 
        expect(testReport.getLabel('eg:Concept3', 'doc')).toBeUndefined();
        expect(testReport.getLabelAndLang('eg:Concept3', 'doc').label).toBeUndefined();
        expect(testReport.getLabelAndLang('eg:Concept3', 'doc').lang).toBeUndefined();
        expect(testReport.getLabelOrName('eg:Concept3', 'doc')).toBe('eg:Concept3');
    });

    test("With prefix", () => {
        vo.language = 'fr';
        expect(testReport.getLabel('eg:Concept3', 'std', true)).toBe("(eg) Concept trois");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std', true).label).toBe("(eg) Concept trois");
        expect(testReport.getLabelAndLang('eg:Concept3', 'std', true).lang).toBe("fr");
        expect(testReport.getLabelOrName('eg:Concept3', 'std', true)).toBe("(eg) Concept trois");

        expect(testReport.getLabel('eg:Concept3', 'doc', true)).toBeUndefined();
        expect(testReport.getLabelOrName('eg:Concept3', 'doc', true)).toBe("eg:Concept3");
    });

});

describe("ELR labels", () => {
    const testReportSet = new ReportSet(testReportData);
    testReportSet._initialize();
    const testReport = testReportSet.reports[0];
    test("Present", () => {
        expect(testReport.getRoleLabelOrURI("role1")).toBe("Role 1 Label");
    });
    test("Null", () => {
        expect(testReport.getRoleLabelOrURI("role2")).toBe("https://www.example.com/role2");
    });
    test("No label", () => {
        expect(testReport.getRoleLabelOrURI("role3")).toBe("https://www.example.com/role3");
    });
    test("Not present in roleDef", () => {
        expect(testReport.getRoleLabelOrURI("role4")).toBe("https://www.example.com/role4MoreWords");
    });
});

describe("Label role labels", () => {
    const testReportSet = new ReportSet(testReportData);
    testReportSet._initialize();
    const testReport = testReportSet.reports[0];
    test("Built-in (via i18n)", () => {
        expect(testReport.getLabelRoleLabel("std")).toBe("Standard Label");
    });
    test("Built-in (via i18n)", () => {
        expect(testReport.getLabelRoleLabel("doc")).toBe("Documentation Label");
    });
    test("Built-in (via de-camelcase)", () => {
        expect(testReport.getLabelRoleLabel("verbose")).toBe("Verbose Label");
    });
    test("Present", () => {
        expect(testReport.getLabelRoleLabel("role1")).toBe("Role 1 Label");
    });
    test("Null", () => {
        expect(testReport.getLabelRoleLabel("role2")).toBe("Role2");
    });
    test("No label", () => {
        expect(testReport.getLabelRoleLabel("role3")).toBe("Role3");
    });
    test("Not present in roleDef", () => {
        expect(testReport.getLabelRoleLabel("role4")).toBe("Role4 More Words");
    });

});

describe("Fetching software credit", () => {

    test("Successful", () => {
        const testReportSet = new ReportSet(testReportData);
        testReportSet._initialize();
        const report = testReportSet.reports[0];

        const softwareCredits = report.softwareCredits();
        expect(softwareCredits).toEqual(["Example credit text A", "Example credit text B"]);
    });

    test("Unset", () => {
        let alternateData = JSON.parse(JSON.stringify(testReportData));
        delete alternateData.softwareCredits;
        const testReportSet = new ReportSet(alternateData);
        testReportSet._initialize();
        const report = testReportSet.reports[0];

        const softwareCredits = report.softwareCredits();
        expect(softwareCredits).toEqual([]);
    });
});
