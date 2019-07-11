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

import { Aspect, AspectSet } from "./aspect.js";
import { iXBRLReport } from "./report.js";

var testReportData = {
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
                    "en": "English label for concept two"
                }
            }
        }
    }
};

var testReport = new iXBRLReport(testReportData);

test("Concept aspect labels", () => {
    var conceptAspect = new Aspect("c", "eg:Concept1", testReport);
    expect(conceptAspect.label()).toBe("Concept");  
    expect(conceptAspect.valueLabel()).toBe("English label");  
});

test("Period aspect labels", () => {
    var periodAspect = new Aspect("p", "2018-01-01/2019-01-01", testReport);
    expect(periodAspect.label()).toBe("Period");  
    expect(periodAspect.valueLabel()).toBe("1 Jan 2018 to 31 Dec 2018");  
});

test("Unit aspects label - known currency", () => {
    var unitAspect = new Aspect("u", "iso4217:GBP", testReport);
    expect(unitAspect.label()).toBe("Unit");  
    expect(unitAspect.valueLabel()).toBe("£");  
});

test("Unit aspects label - known currency (EUR)", () => {
    var unitAspect = new Aspect("u", "iso4217:EUR", testReport);
    expect(unitAspect.label()).toBe("Unit");  
    expect(unitAspect.valueLabel()).toBe("€");  
});

test("Unit aspects label - unknown currency", () => {
    var unitAspect = new Aspect("u", "iso4217:ZAR", testReport);
    expect(unitAspect.label()).toBe("Unit");  
    expect(unitAspect.valueLabel()).toBe("iso4217:ZAR");  
});

test("Entity aspect labels - unknown scheme", () => {
    var tda = new Aspect("e", "eg:1234567", testReport);
    expect(tda.label()).toBe("Entity");  
    expect(tda.valueLabel()).toBe("eg:1234567");  
});

test("Taxonomy defined dimension labels", () => {
    var tda = new Aspect("eg:Concept1", "eg:Concept2", testReport);
    expect(tda.label()).toBe("English label");  
    expect(tda.valueLabel()).toBe("English label for concept two");  
});

describe("AspectSet", () => {
    test("Unique values", () => {
        var as = new AspectSet()
        as.add(new Aspect("c", "eg:Concept1", testReport));
        as.add(new Aspect("c", "eg:Concept2", testReport));
        as.add(new Aspect("c", "eg:Concept1", testReport));
        var uv = as.uniqueValues()
        expect(uv).toHaveLength(2);
        expect(uv.map(x => x.value())).toEqual(expect.arrayContaining(["eg:Concept1", "eg:Concept2"]));
    });
    
});


