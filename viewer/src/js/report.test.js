import { iXBRLReport } from "./report.js";

var testReportData = {
    "languages": {
        "en-us": "English (US)",
        "en": "English",
    },
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
                    "en": "English label for concept two",
                    "en-us": "English (US) label for concept two",
                    "en-gb": "English (GB) label for concept two"
                }
            }
        }
    }
};


test("Language options", () => {
    var testReport = new iXBRLReport(testReportData);
    var al = testReport.availableLanguages();
    expect(al).toHaveLength(3);
    expect(al).toEqual(expect.arrayContaining(["en", "en-us", "en-gb"]));

    var ln = testReport.languageNames();
    expect(Object.keys(ln)).toHaveLength(2);
    expect(ln['en']).toBe("English");
    expect(ln['en-us']).toBe("English (US)");
});
