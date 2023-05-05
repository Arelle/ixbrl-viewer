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

import { ReportSearch } from "./search.js"
import {iXBRLReport} from "./report";

const testReportData = {
    "concepts": {},
    "languages": {},
    "facts": {},
    "prefixes": {},
    "roles": {},
    "roleDefs": {},
    "rels": {}
};

function getReportSearch(report) {
    const reportSearch = new ReportSearch(report);
    const searchIndex = reportSearch.buildSearchIndex(() => {});
    for (const _ of searchIndex) {}
    return reportSearch;
}

function createSimpleConcept(name, label) {
    return {
        [name]: {
            "labels": {
                "ns0": {
                    "en-us": label
                }
            }
        }
    };
}

function createSimpleFact(id, concept, options=null) {
    options = options || {};
    return {
        [id]: {
            "a": {
                "c": concept,
                "u": options["unit"],
                "p": options["period"],
            },
            "d": options["decimals"],
            "v": options["value"]
        }
    };
}

function createNumericFact(id, concept, unit, period, value) {
    return createSimpleFact(id, concept, {
        "unit": unit,
        "period": period,
        "value": value
    });
}

function testReport(ixData, testData) {
    // Deep copy of standing data
    const data = {
        ...JSON.parse(JSON.stringify(testReportData)),
        ...testData
    }
    const report = new iXBRLReport(data);
    report.setIXNodeMap(ixData);
    return report;
}

function testSearchSpec(searchString='') {
    const spec = {};
    spec.searchString = searchString;
    spec.showVisibleFacts = true;
    spec.showHiddenFacts = true;
    spec.periodFilter = '*';
    spec.conceptTypeFilter = '*';
    spec.factValueFilter = '*';
    spec.calculationsFilter = "*";
    return spec;
}

describe("Search fact value filter", () => {
    const cashConcept = 'us-gaap:Cash';
    const cashUnit = 'iso4217:USD';
    const report = testReport(
            {'positive': {}, 'negative': {}, 'zero': {}, 'text': {}, 'undefined': {}},
            {
                'concepts': {
                    ...createSimpleConcept(cashConcept, 'Cash')
                },
                'facts': {
                    ...createNumericFact('positive', cashConcept, cashUnit, '2018-01-01/2019-01-01', 1000 ),
                    ...createNumericFact('negative', cashConcept, cashUnit, '2018-01-01/2019-01-01', -1000 ),
                    ...createNumericFact('zero', cashConcept, cashUnit, '2018-01-01/2019-01-03', 0 ),
                    ...createNumericFact('text', cashConcept, undefined, '2018-01-01/2019-01-03', 'someText' ),
                    ...createNumericFact('undefined', cashConcept, cashUnit, '2018-01-01/2019-01-03', undefined ),
                }
            },
    )
    const reportSearch = getReportSearch(report);

    test("Fact Value Negative filter works", () => {
        const spec = testSearchSpec('Cash');
        spec.factValueFilter = 'negative'
        const results = reportSearch.search(spec);
        expect(results.length).toEqual(1)
        expect(results[0]["fact"]["id"]).toEqual("negative")
    });

    test("Fact Value Negative filter works with other filter", () => {
        const spec = testSearchSpec('Cash');
        spec.factValueFilter = 'negative'
        spec.periodFilter = '2018-01-01/2019-01-01'
        const results = reportSearch.search(spec);
        expect(results.length).toEqual(1)
        expect(results[0]["fact"]["id"]).toEqual("negative")
    });

    test("Fact Value Positive filter works", () => {
        const spec = testSearchSpec('Cash');
        spec.factValueFilter = 'positive'
        const results = reportSearch.search(spec);
        expect(results.length).toEqual(1)
        expect(results[0]["fact"]["id"]).toEqual("positive")
    });

    test("Fact Value Positive filter works with other filter", () => {
        const spec = testSearchSpec('Cash');
        spec.factValueFilter = 'positive'
        spec.periodFilter = '2018-01-01/2019-01-01'
        const results = reportSearch.search(spec);
        expect(results.length).toEqual(1)
        expect(results[0]["fact"]["id"]).toEqual("positive")
    });
});

describe("Search calculation filter", () => {
    const report = testReport(
            {'summation': {}, 'item1': {}, 'item2': {}, 'other': {}},
            {
                "concepts": {
                    ...createSimpleConcept("test:Summation", "Summation"),
                    ...createSimpleConcept("test:Item1", "Item1"),
                    ...createSimpleConcept("test:Item2", "Item2"),
                    ...createSimpleConcept("test:Other", "Other"),
                },
                "facts": {
                    ...createSimpleFact("summation", "test:Summation"),
                    ...createSimpleFact("item1", "test:Item1"),
                    ...createSimpleFact("item2", "test:Item2"),
                    ...createSimpleFact("other", "test:Other"),
                },
                "rels": {
                    "calc": {
                        "ns": {
                            "test:Summation": [
                                {"t": "test:Item1", "w": 1},
                                {"t": "test:Item2", "w": 1}
                            ]
                        }
                    }
                }
            }
    )
    const reportSearch = getReportSearch(report);

    test("Calculations 'all' filter works", () => {
        const spec = testSearchSpec();
        spec.calculationsFilter = '*';
        const results = reportSearch.search(spec).map(r => r.fact.id).sort();
        expect(results).toEqual(['item1', 'item2', 'other', 'summation']);
    });

    test("Calculations 'contributor' filter works", () => {
        const spec = testSearchSpec();
        spec.calculationsFilter = 'contributor';
        const results = reportSearch.search(spec).map(r => r.fact.id).sort();
        expect(results).toEqual(['item1', 'item2']);
    });

    test("Calculations 'summation' filter works", () => {
        const spec = testSearchSpec();
        spec.calculationsFilter = 'summation';
        const results = reportSearch.search(spec).map(r => r.fact.id).sort();
        expect(results).toEqual(['summation']);
    });

    test("Calculations 'summationOrContributor' filter works", () => {
        const spec = testSearchSpec();
        spec.calculationsFilter = 'summationOrContributor';
        const results = reportSearch.search(spec).map(r => r.fact.id).sort();
        expect(results).toEqual(['item1', 'item2', 'summation']);
    });
    const emptyReport = testReport(
            {'fact': {}},
            {
                "concepts": {
                    ...createSimpleConcept("test:Concept", "Concept"),
                },
                "facts": {
                    ...createSimpleFact("fact", "test:Fact"),
                },
            },
    )
    const emptyReportSearch = getReportSearch(emptyReport);

    test("Calculations filter works on empty report", () => {
        const spec = testSearchSpec();
        spec.calculationsFilter = 'summationOrContributor';
        const results = emptyReportSearch.search(spec).map(r => r.fact.id).sort();
        expect(results).toEqual([]);
    });
});
