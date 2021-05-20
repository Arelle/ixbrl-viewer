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
    "facts": {
    }
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
