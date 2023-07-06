// See COPYRIGHT.md for copyright information

import { iXBRLReport } from "./report.js";
import { ViewerOptions } from "./viewerOptions.js";

var testReportData = {
    "languages": {
        "en-us": "English (US)",
        "en": "English",
    },
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": "http://www.xbrl.org/2003/iso4217"
    },
    "roles": {
        "role1": "https://www.example.com/role1",
        "role2": "https://www.example.com/role2",
        "role3": "https://www.example.com/role3",
        "role4": "https://www.example.com/role4"
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
    }
};


describe("Language options", () => {
    var testReport = new iXBRLReport(testReportData);
    testReport._initialize();
    test("Available languages", () => {
        var al = testReport.availableLanguages();
        expect(al).toHaveLength(6);
        expect(al).toEqual(expect.arrayContaining(["en", "en-us", "en-gb", "fr", "de", "es"]));
    });

    test("Names for available languages", () => {
        var ln = testReport.languageNames();
        expect(Object.keys(ln)).toHaveLength(2);
        expect(ln['en']).toBe("English");
        expect(ln['en-us']).toBe("English (US)");
    });
});

describe("Fetching facts", () => {
    var testReport = new iXBRLReport(testReportData);
    testReport._initialize();

    test("Successful", () => {
        var f = testReport.getItemById("f1");
        testReport._initialize();
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });

    test("Non-existent fact", () => {
        var f = testReport.getItemById("fact-does-not-exist");
        expect(f).toBeUndefined();
    });
});

describe("Concept labels", () => {
    var testReport = new iXBRLReport(testReportData);
    var vo = new ViewerOptions();
    testReport.setViewerOptions(vo);
    test("Label fallback", () => {
        vo.language = 'fr';
        expect(testReport.getLabel('eg:Concept3', 'std')).toBe("Concept trois");
        expect(testReport.getLabelOrName('eg:Concept3', 'std')).toBe("Concept trois");
        vo.language = 'es';
        expect(testReport.getLabel('eg:Concept3', 'std')).toBe("Concept cuatro");
        expect(testReport.getLabelOrName('eg:Concept3', 'std')).toBe("Concept cuatro");
        // No English label, so fall back on German (de is first alphabetically)
        vo.language = 'en';
        expect(testReport.getLabel('eg:Concept3', 'std')).toBe("Concept vier");
        expect(testReport.getLabelOrName('eg:Concept3', 'std')).toBe("Concept vier");

        // Attempt to get an undefined label type 
        expect(testReport.getLabel('eg:Concept3', 'doc')).toBeUndefined();
        expect(testReport.getLabelOrName('eg:Concept3', 'doc')).toBe('eg:Concept3');
    });

    test("With prefix", () => {
        vo.language = 'fr';
        expect(testReport.getLabel('eg:Concept3', 'std', true)).toBe("(eg) Concept trois");
        expect(testReport.getLabelOrName('eg:Concept3', 'std', true)).toBe("(eg) Concept trois");

        expect(testReport.getLabel('eg:Concept3', 'doc', true)).toBeUndefined();
        expect(testReport.getLabelOrName('eg:Concept3', 'doc', true)).toBe("eg:Concept3");
    });

});

describe("ELR labels", () => {
    const testReport = new iXBRLReport(testReportData);
    test("Present", () => {
        expect(testReport.getRoleLabel("role1")).toBe("Role 1 Label");
    });
    test("Null", () => {
        expect(testReport.getRoleLabel("role2")).toBe("https://www.example.com/role2");
    });
    test("No label", () => {
        expect(testReport.getRoleLabel("role3")).toBe("https://www.example.com/role3");
    });
    test("Not present in roleDef", () => {
        expect(testReport.getRoleLabel("role4")).toBe("https://www.example.com/role4");
    });

});
