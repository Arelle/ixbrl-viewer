// See COPYRIGHT.md for copyright information

import { derivationFieldsFor } from "./descriptors.js";
import { VERDICT } from "./journal.js";
import { solveDerivation } from "./derive.js";

const solve = (factValue, capturedText, dataType = 'xs:decimal') =>
    solveDerivation({ factValue, capturedText, dataType });

describe("derivationFieldsFor", () => {
    test("offers nothing when the capture already matches", () => {
        expect(derivationFieldsFor(VERDICT.AGREE, solve("84.5", "84,5"))).toBeNull();
    });

    test("offers nothing for a coarse capture, which is not a derivation problem", () => {
        // the run contains the value plus more: fixed by Widen or a narrower
        // click, not by anything in the derivation chain
        const d = solve("84.5", "Provisions 84,5 76,8");
        expect(derivationFieldsFor(VERDICT.COARSE, d)).toBeNull();
    });

    test("offers nothing when the numbers are unrelated", () => {
        // offering a scale box here would invite adjusting it until a bad bind
        // looked acceptable -- the failure the unrelated verdict exists to name
        const d = solve("84.5", "1013.2");
        expect(d.kind).toBe("unrelated");
        expect(derivationFieldsFor(VERDICT.DIFFER, d)).toBeNull();
    });

    test("offers scale, pre-filled, when a scale explains the difference", () => {
        const d = solve("84500000", "84,5");
        const f = derivationFieldsFor(VERDICT.DIFFER, d);
        expect(f.descriptor.scalar.map(s => s.key)).toEqual(["scale"]);
        expect(f.values.scale).toBe(6);
    });

    test("offers sign when a negation explains the difference", () => {
        const d = solve("-84.5", "84,5");
        const f = derivationFieldsFor(VERDICT.DIFFER, d);
        expect(f.descriptor.scalar.map(s => s.key)).toEqual(["sign"]);
        expect(f.values.sign).toBe("-");
    });

    test("offers both where both are needed", () => {
        const d = solve("-84500000", "84,5");
        const f = derivationFieldsFor(VERDICT.DIFFER, d);
        expect(f.descriptor.scalar.map(s => s.key).sort()).toEqual(["scale", "sign"]);
    });

    test("offers the transform candidates as a select, and says they are unverified", () => {
        const d = {
            kind: "shortlist",
            solutions: [{ transformation: "xbrltt:date-day-month-year" },
                        { transformation: "xbrltt:date-month-day-year" }],
        };
        const f = derivationFieldsFor(VERDICT.DIFFER, d);
        const field = f.descriptor.scalar[0];
        expect(field.key).toBe("transformation");
        expect(field.type).toBe("select");
        // leading blank is the creator's "unset" convention
        expect(field.options).toEqual(["", "xbrltt:date-day-month-year", "xbrltt:date-month-day-year"]);
        expect(field.hint).toMatch(/none has been verified/);
    });

    test("surfaces alternative solutions rather than dropping them", () => {
        const d = { kind: "solved", solutions: [{ scale: 6, sign: null }, { scale: 3, sign: "-" }] };
        const f = derivationFieldsFor(VERDICT.DIFFER, d);
        expect(f.alternatives).toHaveLength(1);
        expect(f.alternatives[0].scale).toBe(3);
    });

    test("offers nothing when nothing is determinable", () => {
        const d = solveDerivation({ factValue: "some text", capturedText: "other", dataType: "xs:string" });
        expect(derivationFieldsFor(VERDICT.DIFFER, d)).toBeNull();
    });

    test("is null-safe", () => {
        expect(derivationFieldsFor(VERDICT.DIFFER, null)).toBeNull();
        expect(derivationFieldsFor(undefined, undefined)).toBeNull();
    });

    test("the subset is a descriptor the renderer takes unchanged", () => {
        const f = derivationFieldsFor(VERDICT.DIFFER, solve("84500000", "84,5"));
        expect(Array.isArray(f.descriptor.scalar)).toBe(true);
        expect(Array.isArray(f.descriptor.arrays)).toBe(true);
        for (const field of f.descriptor.scalar) {
            expect(typeof field.key).toBe("string");
            expect(typeof field.label).toBe("string");
            expect(typeof field.type).toBe("string");
        }
    });
});
