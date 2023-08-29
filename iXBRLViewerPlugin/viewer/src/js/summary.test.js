// See COPYRIGHT.md for copyright information

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

function testReport(concepts, facts, documents) {
    return {
        getConcept: conceptName => concepts[conceptName],
        facts: () => facts,
        localDocuments: () => documents
    }
}

describe("Facts summary", () => {

    test("no facts", () => {
        const report = testReport({}, [], {});
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(0);
    });

    test("multiple facts", () => {
        const facts = [];
        for (let i = 0; i < 10; i++) {
            facts.push(testFact("eg:Concept1", {}));
        }
        const report = testReport({}, facts, {});
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(10);
    });

    test("duplicate facts", () => {
        const conceptName = "eg:Concept1";
        const fact1 = testFact(conceptName, {});
        const fact2 = testFact(conceptName, {});
        const report = testReport({}, [fact1, fact2], {});
        const summary = new DocumentSummary(report);

        expect(summary.totalFacts()).toBe(2);
    });
});


describe("Tags summary", () => {

    test("no tags", () => {
        const report = testReport({}, [], {})
        const summary = new DocumentSummary(report);

        expect(summary.tagCounts()).toEqual(new Map());
    });

    test("multiple tags", () => {
        const fact1 = testFact("eg:Concept1", {});
        const fact2 = testFact("eg:Concept2", {});
        const fact3 = testFact("xz:Concept1", {});
        const report = testReport({}, [fact1, fact2, fact3], {})
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
        const report = testReport(concepts, [fact], {})
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
        const report = testReport(concepts, [fact], {})
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
        const report = testReport(concepts, [fact], {})
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

describe("Files summary", () => {

    test("no files", () => {
        const documentData = {}
        const report = testReport({}, [], documentData);
        const summary = new DocumentSummary(report);

        expect(summary.getLocalDocuments()).toEqual({
            inline: [],
            schema: [],
            calcLinkbase: [],
            defLinkbase: [],
            labelLinkbase: [],
            presLinkbase: [],
            refLinkbase: [],
            unrecognizedLinkbase: [],
        });
    });

    test("with files", () => {
        const documentData = {
            'inline.htm': ['inline'],
            'docset': ['inline'],
            'schema.xsd': ['schema'],
            'calcLinkbase.xml': ['calcLinkbase'],
            'defLinkbase.xml': ['defLinkbase'],
            'presLinkbase.xml': ['presLinkbase'],
            'refLinkbase2.xml': ['refLinkbase', 'labelLinkbase'],
            'refLinkbase1.xml': ['refLinkbase'],
            'labelLinkbase.xml': ['labelLinkbase'],
            'unrecognizedLinkbase.xml': ['unrecognizedLinkbase'],
        }
        const report = testReport({}, [], documentData);
        const summary = new DocumentSummary(report);

        expect(summary.getLocalDocuments()).toEqual({
            inline: ['docset', 'inline.htm'],
            schema: ['schema.xsd'],
            calcLinkbase: ['calcLinkbase.xml'],
            defLinkbase: ['defLinkbase.xml'],
            labelLinkbase: ['labelLinkbase.xml', 'refLinkbase2.xml'],
            presLinkbase: ['presLinkbase.xml'],
            refLinkbase: ['refLinkbase1.xml', 'refLinkbase2.xml'],
            unrecognizedLinkbase: ['unrecognizedLinkbase.xml'],
        });
    });
});
