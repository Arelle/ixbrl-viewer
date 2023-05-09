// Copyright 2023 Workiva Inc.
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

import { DocumentSummary } from "./summary.js";


function testConcept(typedDomainElement) {
    return {
        isTypedDimension: () => typedDomainElement !== undefined,
        typedDomainElement: () => typedDomainElement
    }
}

function testFact(conceptName, dimensions) {
    return {
        conceptName: () => conceptName,
        dimensions: () => dimensions
    }
}

function testReport(concepts, facts) {
    return {
        getConcept: conceptName => concepts[conceptName],
        facts: () => facts
    }
}

describe("Facts summary", () => {

    test("no facts", () => {
        const report = testReport({}, []);
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(0);
    });

    test("multiple facts", () => {
        const facts = [];
        for (let i = 0; i < 10; i++) {
            facts.push(testFact("eg:Concept1", {}));
        }
        const report = testReport({}, facts);
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(10);
    });

    test("duplicate facts", () => {
        const conceptName = "eg:Concept1";
        const fact1 = testFact(conceptName, {});
        const fact2 = testFact(conceptName, {});
        const report = testReport({}, [fact1, fact2]);
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(2);
    });
});


describe("Tags summary", () => {

    test("no tags", () => {
        const report = testReport({}, [])
        const summary = new DocumentSummary(report);

        expect(summary.tagCounts()).toEqual(new Map());
    });

    test("multiple tags", () => {
        const fact1 = testFact("eg:Concept1", {});
        const fact2 = testFact("eg:Concept2", {});
        const fact3 = testFact("xz:Concept1", {});
        const report = testReport({}, [fact1, fact2, fact3])
        const summary = new DocumentSummary(report);

        expect(Object.fromEntries(summary.tagCounts())).toEqual({
            'eg': {
                "dimensions": 0,
                "members": 0,
                "primaryItems": 2,
                "total": 2
            },
            'xz': {
                "dimensions": 0,
                "members": 0,
                "primaryItems": 1,
                "total": 1
            }
        });
    });

    test("dimensions", () => {
        const dimension = "eg:dimension";
        const member = "eg:member";
        const dimensions = {
            [dimension]: member
        };
        const fact = testFact("eg:Concept1", dimensions);
        const concepts = {
            [dimension]: testConcept(),
        }
        const report = testReport(concepts, [fact])
        const summary = new DocumentSummary(report);

        expect(Object.fromEntries(summary.tagCounts())).toEqual({
            'eg': {
                "dimensions": 1,
                "members": 1,
                "primaryItems": 1,
                "total": 3
            }
        });
    });

    test("mixed dimensions", () => {
        const dimension1 = "ab:dimension";
        const dimension2 = "cd:dimension";
        const dimension3 = "ef:dimension";
        const member1 = "ab:dimension";
        const member2 = "xz:dimension";
        const dimensions = {
            [dimension1]: member1,
            [dimension2]: member1,
            [dimension3]: member2,
        };
        const fact = testFact("ab:Concept1", dimensions);
        const concepts = {
            [dimension1]: testConcept(),
            [dimension2]: testConcept(),
            [dimension3]: testConcept(),
        }
        const report = testReport(concepts, [fact])
        const summary = new DocumentSummary(report);

        expect(Object.fromEntries(summary.tagCounts())).toEqual({
            'ab': {
                "dimensions": 1,
                "members": 1,
                "primaryItems": 1,
                "total": 3
            },
            'cd': {
                "dimensions": 1,
                "members": 0,
                "primaryItems": 0,
                "total": 1
            },
            'ef': {
                "dimensions": 1,
                "members": 0,
                "primaryItems": 0,
                "total": 1
            },
            'xz': {
                "dimensions": 0,
                "members": 1,
                "primaryItems": 0,
                "total": 1
            }
        });
    });

    test("typed dimension", () => {
        const dimension = "eg:dimension";
        const typedDomain = "xz:domain";
        const dimensions = {
            [dimension]: typedDomain,
        };
        const fact = testFact("eg:Concept1", dimensions);
        const concepts = {
            [dimension]: testConcept(typedDomain),
        }
        const report = testReport(concepts, [fact])
        const summary = new DocumentSummary(report);

        expect(Object.fromEntries(summary.tagCounts())).toEqual({
            'eg': {
                "dimensions": 1,
                "members": 0,
                "primaryItems": 1,
                "total": 2
            },
            'xz': {
                "dimensions": 0,
                "members": 1,
                "primaryItems": 0,
                "total": 1
            }
        });
    });
});
