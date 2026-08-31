// See COPYRIGHT.md for copyright information

import { parseNumeric, solveNumeric, candidateTransforms, solveDerivation } from "./derive.js";

/* A cut-down stand-in for transform-types.json, with the real patterns. */
const DATA_TYPES = {
    "xbrltt:numCommaDecimalType": { patterns: ["[\\.  0-9]*(,[  0-9]+)?"] },
    "xbrltt:numDotDecimalType": { patterns: ["[,  0-9]*(\\.[  0-9]+)?"] },
    "xbrltt:dateDayMonthYearType": { patterns: ["[0-9]{1,2}[^0-9]+[0-9]{1,2}[^0-9]+([0-9]{1,2}|[0-9]{4})"] },
    "xbrltt:dateMonthDayYearType": { patterns: ["[0-9]{1,2}[^0-9]+[0-9]{1,2}[^0-9]+([0-9]{1,2}|[0-9]{4})"] },
};

const TRANSFORMS = [
    { name: "xbrltt:num-comma-decimal", inputDataType: "xbrltt:numCommaDecimalType", outputDataType: "xs:decimal" },
    { name: "xbrltt:num-dot-decimal", inputDataType: "xbrltt:numDotDecimalType", outputDataType: "xs:decimal" },
    { name: "xbrltt:date-day-month-year", inputDataType: "xbrltt:dateDayMonthYearType", outputDataType: "xs:date" },
    { name: "xbrltt:date-month-day-year", inputDataType: "xbrltt:dateMonthDayYearType", outputDataType: "xs:date" },
];

describe("parseNumeric", () => {
    test("parses presentations the verdict normaliser accepts", () => {
        expect(parseNumeric("41 182,5")).toBe(41182.5);
        expect(parseNumeric("(84,5)")).toBe(-84.5);
        expect(parseNumeric("1,234")).toBe(1234);
    });

    test("rejects text that is not a number", () => {
        expect(parseNumeric("TOTAL GROUPE")).toBeNull();
        expect(parseNumeric("84,5 76,8")).toBeNull();
        expect(parseNumeric("")).toBeNull();
        expect(parseNumeric(null)).toBeNull();
    });
});

describe("solveNumeric", () => {
    test("solves a scale exactly", () => {
        const r = solveNumeric("84500000", "84,5");
        expect(r.solutions).toEqual([
            expect.objectContaining({ scale: 6, sign: null }),
        ]);
    });

    test("survives binary floating point at large magnitudes", () => {
        // 41182.5 * 10^6 is not exact in IEEE754; a naive === would miss it
        const r = solveNumeric("41182500000", "41 182,5");
        expect(r.solutions.map(s => s.scale)).toContain(6);
    });

    test("reports no adjustment when the two already agree", () => {
        const r = solveNumeric("84.5", "84,5");
        expect(r.solutions).toEqual([
            expect.objectContaining({ scale: null, sign: null }),
        ]);
    });

    test("solves a sign flip", () => {
        const r = solveNumeric("-84.5", "84,5");
        expect(r.solutions).toEqual([
            expect.objectContaining({ sign: "-", scale: null }),
        ]);
    });

    test("solves sign and scale together", () => {
        const r = solveNumeric("-84500000", "84,5");
        expect(r.solutions).toEqual([
            expect.objectContaining({ sign: "-", scale: 6 }),
        ]);
    });

    test("does not offer a redundant sign flip when signs already agree", () => {
        const r = solveNumeric("-84.5", "(84,5)");
        // (84,5) already parses negative, so negating would be wrong
        expect(r.solutions.every(s => s.sign === null)).toBe(true);
    });

    test("returns no solution when no power of ten relates the two", () => {
        const r = solveNumeric("84.5", "1013.2");
        expect(r.solutions).toEqual([]);
    });

    test("is null when either end is not numeric", () => {
        expect(solveNumeric("84.5", "TOTAL")).toBeNull();
        expect(solveNumeric("2025-01-01", "1 Jan 2025")).toBeNull();
    });

    test("treats zero against zero as indeterminate rather than solved", () => {
        const r = solveNumeric("0", "0");
        expect(r.solutions).toEqual([
            expect.objectContaining({ scale: null, sign: null }),
        ]);
        expect(r.solutions[0].note).toMatch(/not determinable/);
    });

    test("zero against non-zero has no solution", () => {
        expect(solveNumeric("84.5", "0").solutions).toEqual([]);
        expect(solveNumeric("0", "84.5").solutions).toEqual([]);
    });
});

describe("candidateTransforms", () => {
    test("filters by output datatype", () => {
        const r = candidateTransforms({
            capturedText: "1 Jan 2025", dataType: "xs:date",
            transforms: TRANSFORMS, dataTypes: DATA_TYPES,
        });
        expect(r.every(c => c.transformation.includes("date"))).toBe(true);
    });

    test("filters by the input pattern, so numeric text yields no date transform", () => {
        const r = candidateTransforms({
            capturedText: "TOTAL GROUPE", dataType: "xs:date",
            transforms: TRANSFORMS, dataTypes: DATA_TYPES,
        });
        expect(r).toEqual([]);
    });

    test("returns every genuinely ambiguous candidate rather than choosing", () => {
        // 01/02/2025 is a real date under both day-month-year and month-day-year
        const r = candidateTransforms({
            capturedText: "01/02/2025", dataType: "xs:date",
            transforms: TRANSFORMS, dataTypes: DATA_TYPES,
        });
        expect(r.map(c => c.transformation).sort()).toEqual([
            "xbrltt:date-day-month-year",
            "xbrltt:date-month-day-year",
        ]);
    });

    test("anchors patterns, so a date inside a sentence is not a candidate", () => {
        const r = candidateTransforms({
            capturedText: "as at 01/02/2025 the balance was", dataType: "xs:date",
            transforms: TRANSFORMS, dataTypes: DATA_TYPES,
        });
        expect(r).toEqual([]);
    });

    test("is empty without a datatype to filter on", () => {
        expect(candidateTransforms({
            capturedText: "01/02/2025", dataType: null,
            transforms: TRANSFORMS, dataTypes: DATA_TYPES,
        })).toEqual([]);
    });
});

describe("solveDerivation", () => {
    const ctx = { transforms: TRANSFORMS, dataTypes: DATA_TYPES };

    test("kind none when nothing needs adjusting", () => {
        const r = solveDerivation({ factValue: "84.5", capturedText: "84,5", dataType: "xs:decimal", ...ctx });
        expect(r.kind).toBe("none");
    });

    test("kind solved for a scale", () => {
        const r = solveDerivation({ factValue: "84500000", capturedText: "84,5", dataType: "xs:decimal", ...ctx });
        expect(r.kind).toBe("solved");
        expect(r.solutions[0].scale).toBe(6);
    });

    test("kind shortlist for a date, and does not claim to have verified it", () => {
        const r = solveDerivation({ factValue: "2025-02-01", capturedText: "01/02/2025", dataType: "xs:date", ...ctx });
        expect(r.kind).toBe("shortlist");
        expect(r.solutions.length).toBe(2);
    });

    test("kind unrelated when both are numeric but no scale connects them", () => {
        const r = solveDerivation({ factValue: "84.5", capturedText: "1013.2", dataType: "xs:decimal", ...ctx });
        expect(r.kind).toBe("unrelated");
    });

    test("kind unknown when nothing is determinable", () => {
        const r = solveDerivation({ factValue: "some text", capturedText: "other text", dataType: "xs:string", ...ctx });
        expect(r.kind).toBe("unknown");
        expect(r.solutions).toEqual([]);
    });

    test("works with no transform table supplied", () => {
        const r = solveDerivation({ factValue: "84500000", capturedText: "84,5", dataType: "xs:decimal" });
        expect(r.kind).toBe("solved");
    });
});
