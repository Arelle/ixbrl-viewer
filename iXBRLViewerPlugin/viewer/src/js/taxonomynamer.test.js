// See COPYRIGHT.md for copyright information

import { TaxonomyNamer } from './taxonomynamer.js';
import { QName } from './qname.js';

const prefixMap = {
    "e": "http://example.com/",
    "g": "http://eggsample.com/",
};

const preferredPrefixMap = new Map([
    [ "http://ex.*\.com/", ["prefix1", "My Example"] ]
]);

function qname(s) {
    return new QName(prefixMap, s);
}

describe("readableName", () => {
    const namer = new TaxonomyNamer(preferredPrefixMap);
    test("Taxonomy name match", () => {
        expect(namer.getName(qname("e:1234")).prefix).toBe("prefix1");
        expect(namer.getName(qname("e:1234")).name).toBe("My Example");
    });
    test("Unknown taxonomy", () => {
        expect(namer.getName(qname("g:1234")).prefix).toBe("g");
        expect(namer.getName(qname("g:1234")).name).toBe("g");
    });
});

