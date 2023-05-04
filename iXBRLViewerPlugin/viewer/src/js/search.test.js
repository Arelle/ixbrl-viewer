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
    "concepts": {
        "us-gaap:Cash": {
            "labels": {
                "ns0": {
                    "en-us": "Cash"
                }
            }
        }
    },
    "languages": {
        "en-us": "En (US)"
    },
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

    "facts": {},
    "prefixes": {
        "us-gaap": "http://fasb.org/us-gaap/2023",
    },
    "roles": {},
    "roleDefs": {},
    "rels": {}
};

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

function testSearchSpec(searchString) {
    const spec = {};
    spec.searchString = searchString;
    spec.showVisibleFacts = true;
    spec.showHiddenFacts = true;
    spec.periodFilter = '*';
    spec.conceptTypeFilter = '*';
    spec.factValueFilter = '*';
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
