// See COPYRIGHT.md for copyright information

import lunr from 'lunr'
import { SEARCH_FIELDS, createIndexBuilder } from "./search.js"

// lunr's standard builder with every field declared. Results must match it.
function baselineBuilder() {
    const builder = new lunr.Builder();
    builder.pipeline.add(lunr.trimmer, lunr.stopWordFilter, lunr.stemmer);
    builder.searchPipeline.add(lunr.stemmer);
    builder.ref('id');
    for (const field of SEARCH_FIELDS) {
        builder.field(field);
    }
    return builder;
}

function build(builder, docs) {
    for (const doc of docs) {
        builder.add(doc);
    }
    return builder.build();
}

function results(index, queryString) {
    return index.search(queryString).map(r => ({
        ref: r.ref,
        score: Math.round(r.score * 1e6) / 1e6,
    }));
}

// A term, and a field-scoped term. The empty query is asserted separately
// because it walks every declared field.
const QUERY_SHAPES = [
    'revenue',
    'label:revenue',
];

// A US filing populates only label, concept and date.
const usDocs = [
    {
        id: 'us1',
        label: 'Cash and Cash Equivalents',
        concept: 'CashAndCashEquivalentsAtCarryingValue',
        startDate: null,
        date: 'Tue Jan 01 2019 00:00:00 GMT-0500',
    },
    {
        id: 'us2',
        label: 'Cash and Cash Equivalents',
        concept: 'CashAndCashEquivalentsAtCarryingValue',
        startDate: null,
        date: 'Tue Jan 01 2019 00:00:00 GMT-0500',
    },
    {
        id: 'us3',
        label: 'Total Revenue $ *** (unaudited)',
        concept: 'Revenues',
        startDate: null,
        date: 'Tue Jan 01 2019 00:00:00 GMT-0500',
    },
    {
        id: 'us4',
        label: 'Total assets of the entity',
        concept: 'Assets',
        startDate: null,
        date: 'Mon Jan 01 2018 00:00:00 GMT-0500',
    },
    {
        id: 'us5',
        label: 'Net cash flow from operations',
        concept: 'NetCashProvidedByUsedInOperatingActivities',
        startDate: null,
        date: 'Mon Jan 01 2018 00:00:00 GMT-0500',
    },
];

// One fact populating a field the rest leave empty is enough to declare it.
const mixedDocs = [
    ...usDocs,
    { ...usDocs[0], id: 'mixed1', ref: 'IFRS 7 Paragraph 25 Disclosure' },
];

const CORPORA = [
    ['a US filing, four fields empty', usDocs],
    ['a filing where one fact populates references', mixedDocs],
];

describe.each(CORPORA)("Cheaper index feed on %s", (_label, docs) => {
    const baseline = build(baselineBuilder(), docs);
    const index = build(createIndexBuilder(docs), docs);

    test.each(QUERY_SHAPES)("Query %p returns identical refs and scores", (queryString) => {
        expect(results(index, queryString)).toEqual(results(baseline, queryString));
    });

    test("Empty query returns every document in insertion order", () => {
        expect(index.search('').map(r => r.ref)).toEqual(docs.map(d => d.id));
    });
});

describe("Indexed field declaration", () => {
    test("A field no document populates is not declared", () => {
        const index = build(createIndexBuilder(usDocs), usDocs);
        expect(index.fields).toEqual(['label', 'concept', 'date']);
    });

    test("A field one document populates is declared", () => {
        const index = build(createIndexBuilder(mixedDocs), mixedDocs);
        expect(index.fields).toContain('ref');
    });

    test("Every field is declared when every field is populated", () => {
        const docs = [{
            id: 'esef1',
            label: 'Cash',
            concept: 'Cash',
            startDate: 'Mon Jan 01 2018 00:00:00 GMT-0500',
            date: 'Tue Jan 01 2019 00:00:00 GMT-0500',
            doc: 'Cash documentation',
            ref: 'IFRS 7 Paragraph 25 Disclosure',
            widerConcept: 'Assets',
            widerLabel: 'Total assets',
            widerDoc: 'The total of all assets',
        }];
        const index = build(createIndexBuilder(docs), docs);
        expect(index.fields).toEqual(SEARCH_FIELDS);
    });
});
