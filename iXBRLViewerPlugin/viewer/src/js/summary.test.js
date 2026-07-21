// See COPYRIGHT.md for copyright information

import { DocumentSummary } from "./summary.js";
import { QName } from './qname.js';

function testQName(prefix, localpart, uri) {
    return {
        localname: localpart,
        prefix: prefix,
        namespace: uri,
        qname: prefix + ":" + localpart
    }
}

function testConcept(typedDomainElement) {
    return {
        isTypedDimension: () => typedDomainElement !== undefined,
        typedDomainElement: () => typedDomainElement,
        hasDefinition: true,
    }
}

function testFact(conceptName, dimensions, identifier) {
    return {
        conceptName: () => conceptName,
        conceptQName: () => ({ localname: conceptName.split(':')[1] }),
        dimensions: () => dimensions,
        identifier: () => identifier
    }
}

function testReportSet(concepts, facts, documents, softwareCredits) {
    const report = {
        getConcept: conceptName => concepts[conceptName],
        localDocuments: () => documents,
    }
    for (const f of facts) {
        f.report = report;
    }
    return {
        facts: () => facts,
        getSoftwareCredits: () => softwareCredits,
        reports: [ report ]
    }
}

describe("Facts summary", () => {

    test("no facts", () => {
        const reportSet = testReportSet({}, [], {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.totalFacts()).toBe(0);
    });

    test("multiple facts", () => {
        const facts = [];
        const identifier = testQName('lei', '123', 'http://example.com');
        for (let i = 0; i < 10; i++) {
            facts.push(testFact("eg:Concept1", {}, [], identifier));
        }
        const reportSet = testReportSet({}, facts, {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.totalFacts()).toBe(10);
    });

    test("duplicate facts", () => {
        const conceptName = "eg:Concept1";
        const identifier = testQName('lei', '123', 'http://example.com');
        const fact1 = testFact(conceptName, {}, identifier);
        const fact2 = testFact(conceptName, {}, identifier);
        const reportSet = testReportSet({}, [fact1, fact2], {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.totalFacts()).toBe(2);
    });
});


describe("Tags summary", () => {

    test("no tags", () => {
        const reportSet = testReportSet({}, [], {}, [])
        const summary = new DocumentSummary(reportSet);

        expect(summary.tagCounts()).toEqual(new Map());
    });

    test("multiple tags", () => {
        const identifier = testQName('lei', '123', 'http://example.com');
        const fact1 = testFact("eg:Concept1", {}, identifier);
        const fact2 = testFact("eg:Concept2", {}, identifier);
        const fact3 = testFact("xz:Concept1", {}, identifier);
        const reportSet = testReportSet({}, [fact1, fact2, fact3], {}, [])
        const summary = new DocumentSummary(reportSet);

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
        const identifier = testQName('lei', '123', 'http://example.com');
        const dimension = "eg:dimension";
        const member = "eg:member";
        const dimensions = {
            [dimension]: member
        };
        const fact = testFact("eg:Concept1", dimensions, identifier);
        const concepts = {
            [dimension]: testConcept(),
        }
        const reportSet = testReportSet(concepts, [fact], {}, [])
        const summary = new DocumentSummary(reportSet);

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
        const identifier = testQName('lei', '123', 'http://example.com');
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
        const fact = testFact("ab:Concept1", dimensions, identifier);
        const concepts = {
            [dimension1]: testConcept(),
            [dimension2]: testConcept(),
            [dimension3]: testConcept(),
        }
        const reportSet = testReportSet(concepts, [fact], {}, [])
        const summary = new DocumentSummary(reportSet);

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
        const identifier = testQName('lei', '123', 'http://example.com');
        const dimension = "eg:dimension";
        const typedDomain = "xz:domain";
        const dimensions = {
            [dimension]: typedDomain,
        };
        const fact = testFact("eg:Concept1", dimensions, identifier);
        const concepts = {
            [dimension]: testConcept(typedDomain),
        }
        const reportSet = testReportSet(concepts, [fact], {}, [])
        const summary = new DocumentSummary(reportSet);

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

describe("Identifiers summary", () => {

    test("no facts yields no identifiers", () => {
        const reportSet = testReportSet({}, [], {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.identifiers()).toEqual([]);
    });

    test("orders identifiers by descending fact count", () => {
        const conceptName = "eg:Concept1";
        const idA = testQName('lei', 'A', 'http://example.com');
        const idB = testQName('lei', 'B', 'http://example.com');
        const facts = [
            testFact(conceptName, {}, idA),
            testFact(conceptName, {}, idB),
            testFact(conceptName, {}, idB),
        ];
        const reportSet = testReportSet({}, facts, {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.identifiers()).toEqual([idB.qname, idA.qname]);
    });
});

describe("Entity names summary", () => {

    test("no facts yields no entity names", () => {
        const reportSet = testReportSet({}, [], {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.entityNames()).toEqual([]);
    });

    test("returns facts tagged with recognized entity name concepts", () => {
        const identifier = testQName('lei', '123', 'http://example.com');
        const entityFact = testFact("dei:EntityRegistrantName", {}, identifier);
        const otherFact = testFact("eg:Concept1", {}, identifier);
        const reportSet = testReportSet({}, [entityFact, otherFact], {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.entityNames()).toEqual([entityFact]);
    });

    test("returns no facts when no entity name concepts are present", () => {
        const identifier = testQName('lei', '123', 'http://example.com');
        const otherFact = testFact("eg:Concept1", {}, identifier);
        const reportSet = testReportSet({}, [otherFact], {}, []);
        const summary = new DocumentSummary(reportSet);

        expect(summary.entityNames()).toEqual([]);
    });
});

describe("Files summary", () => {

    test("no files", () => {
        const documentData = {}
        const reportSet = testReportSet({}, [], documentData, []);
        const summary = new DocumentSummary(reportSet);

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
        const reportSet = testReportSet({}, [], documentData, []);
        const summary = new DocumentSummary(reportSet);

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

describe("Software credit", () => {

    test("no credits", () => {
        const softwareCredits = []
        const documentData = {}
        const reportSet = testReportSet({}, [], documentData, softwareCredits);
        const summary = new DocumentSummary(reportSet);

        expect(summary.getSoftwareCredits()).toEqual([]);
    });

    test("one credit", () => {
        const softwareCredits = ["Example credit text"]
        const documentData = {}
        const reportSet = testReportSet({}, [], documentData, softwareCredits);
        const summary = new DocumentSummary(reportSet);

        expect(summary.getSoftwareCredits()).toEqual(["Example credit text"]);
    });

    test("multiple credits", () => {
        const softwareCredits = [
            "Example credit text A",
            "Example credit text B",
        ]
        const documentData = {}
        const reportSet = testReportSet({}, [], documentData, softwareCredits);
        const summary = new DocumentSummary(reportSet);

        expect(summary.getSoftwareCredits()).toEqual([
            "Example credit text A",
            "Example credit text B",
        ]);
    });
});
