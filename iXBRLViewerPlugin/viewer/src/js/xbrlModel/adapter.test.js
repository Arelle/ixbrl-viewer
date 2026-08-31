// See COPYRIGHT.md for copyright information

import { buildReportData } from "./adapter.js";

/*
 * A cube needs an xbrl:concept dimension resolving to a domain network for the
 * adapter to offer it, so both cubes here carry one.
 */
const taxonomyWith = (cubes) => ({
    documentInfo: { namespaces: { eg: "http://www.example.com" } },
    xbrlModel: {
        cubeTypes: [
            { name: "xbrl:reportCube" },
            { name: "eg:legacyAccommodationCubeType", baseCubeType: "xbrl:reportCube" },
        ],
        cubes,
        domainNetworks: [{
            name: "eg:LineItems",
            relationships: [{ source: "eg:Root", target: "eg:Revenue" }],
        }],
    },
});

const cube = (name, cubeType) => ({
    name, cubeType,
    cubeDimensions: [{ dimension: "xbrl:concept", domainNetwork: "eg:LineItems" }],
});

const cubesOffered = (doc) =>
    buildReportData({}, doc, {}).sourceReports[0].targetReports[0].cubes.map(c => c.name);

describe("the legacy accommodation cube", () => {
    test("is not offered as a navigable structure", () => {
        /*
         * A legacy XBRL 2.1 instance has no notion of cube membership, so the
         * translation generates a cube for facts to belong to and translated
         * calculations to bind in. It corresponds to nothing the filer authored.
         */
        const doc = taxonomyWith([
            cube("eg:Statement", "xbrl:reportCube"),
            cube("eg:legacyAccommodationCube", "eg:legacyAccommodationCubeType"),
        ]);
        expect(cubesOffered(doc)).toEqual(["eg:Statement"]);
    });

    test("is recognised by its type, not by a name or a missing group tree", () => {
        // the type is model-defined, so each translated model declares its own in
        // its own namespace; the local name is the contract
        const doc = taxonomyWith([
            cube("eg:allFactsCube", "xbrl:reportCube"),
            cube("other:someCube", "other:legacyAccommodationCubeType"),
        ]);
        // a cube merely named for holding everything is an ordinary cube
        expect(cubesOffered(doc)).toEqual(["eg:allFactsCube"]);
    });

    test("an ordinary cube deriving from reportCube is still offered", () => {
        const doc = taxonomyWith([cube("eg:Statement", "eg:houseStyleCubeType")]);
        expect(cubesOffered(doc)).toEqual(["eg:Statement"]);
    });
});

describe("resolved values from derived content", () => {
    const docWith = (factValues, fvName = "eg:F1_fv") => ({
        documentInfo: { namespaces: { eg: "http://www.example.com" } },
        xbrlModel: { facts: [{
            name: "eg:F1",
            factDimensions: { "xbrl:concept": "eg:Revenue", "xbrl:unit": "iso4217:USD" },
            factValues: [{ name: fvName, valueSources: [{ properties: [
                { property: "xbrl:htmlElementId", value: ["e1"] }] }] }],
        }] },
        derivedContent: { factValues },
    });
    const built = (doc) => Object.values(
        buildReportData(doc, {}, {}).sourceReports[0].targetReports[0].facts)[0];

    test("reach the fact keyed by factValueName", () => {
        const f = built(docWith([{ factValueName: "eg:F1_fv", basis: "resolved", value: "100" }]));
        expect(f.num.derivedValue).toBe("100");
    });

    test("a bound value supersedes a resolved one for the same occurrence", () => {
        // bound came from an applied tagging journal, the model's own sources
        // having failed to locate it on that surface
        const f = built(docWith([
            { factValueName: "eg:F1_fv", basis: "resolved", value: "100" },
            { factValueName: "eg:F1_fv", basis: "bound", value: "250" },
        ]));
        expect(f.num.derivedValue).toBe("250");
    });

    test("a fact the derived content does not mention carries none", () => {
        const f = built(docWith([{ factValueName: "eg:Other_fv", basis: "resolved", value: "100" }]));
        expect(f.num.derivedValue).toBeUndefined();
    });
});
