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


function testFact(conceptName, dimensions) {
    return {
        conceptName: () => conceptName,
        dimensions: () => dimensions
    }
}

function testReport(facts) {
    return {
        facts: () => facts
    }
}

describe("Facts summary", () => {

    test("no facts", () => {
        const report = testReport([]);
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(0);
    });

    test("multiple facts", () => {
        const facts = [];
        for (let i = 0; i < 10; i++) {
            facts.push(testFact("eg:Concept1", {}));
        }
        const report = testReport(facts);
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(10);
    });

    test("duplicate facts", () => {
        const conceptName = "eg:Concept1";
        const fact1 = testFact(conceptName, {});
        const fact2 = testFact(conceptName, {});
        const report = testReport([fact1, fact2]);
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(2);
    });
});
