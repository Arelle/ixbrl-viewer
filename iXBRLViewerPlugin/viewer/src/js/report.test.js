// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
