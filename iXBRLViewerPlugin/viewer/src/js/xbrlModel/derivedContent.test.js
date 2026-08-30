// See COPYRIGHT.md for copyright information

import { indexCalculationResults, calculationVerdict, cubeFactsFromDerived,
         CALC_STATE } from "./derivedContent.js";

/* Shaped as the Arelle plugin emits it, from Microsoft's FY2025 10-K. */
const RESULT = {
    cubeName: "msft:allFactsCube",
    networkName: "msft:group_DisclosureComponentsOfLongtermDebtDetail_CalcNet",
    total: "us-gaap:LongTermDebt",
    aspects: {
        "xbrl:period": "2025-07-01T00:00:00",
        "xbrl:entity": "cik:0000789019",
        "xbrl:unit": "iso4217:USD",
    },
    consistent: true,
    calculated: "[43149000000, 43153000000]",
    reported: "[43150500000, 43151500000]",
};

const INCONSISTENT = {
    ...RESULT,
    networkName: "msft:group_Role_DisclosureDeferredIncomeTaxAssetsAndLiabilitiesDetail2_CalcNet",
    total: "us-gaap:DeferredTaxAssetsLiabilitiesNet",
    consistent: false,
    code: "oimtc:inconsistentCalculationUsingRounding",
};

const DERIVATION = {
    derived: "2026-08-30T18:24:32Z",
    processor: "Arelle d225d62 / XbrlModel plugin",
    ruleSets: ["oimte", "oimce", "oime", "oimtc"],
};

const docWith = (results) => ({
    documentInfo: {}, xbrlModel: {},
    derivedContent: { derivation: DERIVATION, calculationResults: results },
});

/* Viewer-side aspects: core four abbreviated, dimensions passed through. */
const factAspects = (over = {}) => ({
    c: "us-gaap:LongTermDebt",
    p: "2025-07-01T00:00:00",
    e: "cik:0000789019",
    u: "iso4217:USD",
    ...over,
});

const ask = (doc, over = {}) => calculationVerdict(indexCalculationResults(doc), {
    networkName: RESULT.networkName,
    total: RESULT.total,
    factAspects: factAspects(),
    ...over,
});

describe("carrying the verdict rather than recomputing", () => {
    test("a consistent result is reported with its provenance", () => {
        const v = ask(docWith([RESULT]));
        expect(v.state).toBe(CALC_STATE.CONSISTENT);
        expect(v.result.reported).toBe("[43150500000, 43151500000]");
        // "this is what validation concluded, THEN" is the whole claim
        expect(v.derivation.derived).toBe("2026-08-30T18:24:32Z");
        expect(v.derivation.ruleSets).toContain("oimtc");
    });

    test("an inconsistent result carries its code", () => {
        const v = calculationVerdict(indexCalculationResults(docWith([INCONSISTENT])), {
            networkName: INCONSISTENT.networkName,
            total: INCONSISTENT.total,
            factAspects: factAspects({ c: INCONSISTENT.total }),
        });
        expect(v.state).toBe(CALC_STATE.INCONSISTENT);
        expect(v.result.code).toBe("oimtc:inconsistentCalculationUsingRounding");
    });

    test("a model carrying no derived content is NOT VALIDATED, not consistent", () => {
        // the state a viewer must never fill in with its own computation
        const v = ask({ documentInfo: {}, xbrlModel: {} });
        expect(v.state).toBe(CALC_STATE.NOT_VALIDATED);
        expect(v.reason).toMatch(/no derived content/);
    });

    test("carrying results but none for this binding is also NOT VALIDATED", () => {
        // distinguished from the above by its reason: this model was validated,
        // and this binding was not among what it reports
        const v = ask(docWith([INCONSISTENT]));
        expect(v.state).toBe(CALC_STATE.NOT_VALIDATED);
        expect(v.reason).toMatch(/no carried result/);
        // and by which run: "not validated, as of this processor on this date"
        // says more than a bare "not validated"
        expect(v.derivation).toBe(DERIVATION);
    });

    test("no derived content at all carries no derivation to show", () => {
        expect(ask({ documentInfo: {} }).derivation).toBeUndefined();
    });

    test("never returns a verdict it computed itself", () => {
        for (const doc of [{}, { derivedContent: {} }, docWith([])]) {
            const v = ask(doc);
            expect(v.state).toBe(CALC_STATE.NOT_VALIDATED);
            expect(v.result).toBeUndefined();
        }
    });
});

describe("matching a binding to a result", () => {
    test("aspects the result does not state do not have to match", () => {
        // 46 of the Microsoft results constrain a dimension and the rest do not;
        // requiring set equality would match nothing on a dimensional report
        const v = ask(docWith([RESULT]), {
            factAspects: factAspects({ "us-gaap:FinancialInstrumentAxis": "msft:SomeMember" }),
        });
        expect(v.state).toBe(CALC_STATE.CONSISTENT);
    });

    test("an aspect the result DOES state must match", () => {
        const dimensional = { ...RESULT,
            aspects: { ...RESULT.aspects, "us-gaap:FinancialInstrumentAxis": "msft:DebtMember" } };
        expect(ask(docWith([dimensional])).state).toBe(CALC_STATE.NOT_VALIDATED);
        expect(ask(docWith([dimensional]), {
            factAspects: factAspects({ "us-gaap:FinancialInstrumentAxis": "msft:DebtMember" }),
        }).state).toBe(CALC_STATE.CONSISTENT);
    });

    test("a different period does not match", () => {
        expect(ask(docWith([RESULT]), {
            factAspects: factAspects({ p: "2024-07-01T00:00:00" }),
        }).state).toBe(CALC_STATE.NOT_VALIDATED);
    });

    test("a different network or total does not match", () => {
        expect(ask(docWith([RESULT]), { networkName: "msft:other" }).state)
            .toBe(CALC_STATE.NOT_VALIDATED);
        expect(ask(docWith([RESULT]), { total: "us-gaap:Other" }).state)
            .toBe(CALC_STATE.NOT_VALIDATED);
    });

    test("the most specific result wins over less-dimensioned bindings", () => {
        // Microsoft carries verdicts on the un-dimensioned total, the asset-class
        // total and the fully dimensioned one. All three describe this fact under
        // a subset test; only the last is about it. Before specificity ranking,
        // 11 of the 183 results looked like disagreements.
        const dims = {
            "us-gaap:FairValueByAssetClassAxis": "us-gaap:DerivativeMember",
            "us-gaap:FinancialInstrumentAxis": "us-gaap:CorporateNoteMember",
        };
        const undimensioned = { ...RESULT, consistent: false, code: "oimtc:inconsistentCalculation" };
        const assetClass = { ...RESULT, aspects: { ...RESULT.aspects,
            "us-gaap:FairValueByAssetClassAxis": dims["us-gaap:FairValueByAssetClassAxis"] } };
        const exact = { ...RESULT, aspects: { ...RESULT.aspects, ...dims } };

        const v = ask(docWith([undimensioned, exact, assetClass]),
                      { factAspects: factAspects(dims) });
        expect(v.state).toBe(CALC_STATE.CONSISTENT);
        expect(v.result).toBe(exact);
    });

    test("equally specific results that disagree are still ambiguous", () => {
        // specificity resolves different bindings, not a genuine conflict
        const other = { ...RESULT, cubeName: "msft:otherCube", consistent: false };
        const v = ask(docWith([RESULT, other]));
        expect(v.state).toBe(CALC_STATE.AMBIGUOUS);
    });

    test("results agreeing across cubes are not ambiguous", () => {
        const other = { ...RESULT, cubeName: "msft:otherCube" };
        expect(ask(docWith([RESULT, other])).state).toBe(CALC_STATE.CONSISTENT);
    });

    test("results DISAGREEING across cubes are ambiguous, not a coin toss", () => {
        const other = { ...RESULT, cubeName: "msft:otherCube", consistent: false,
                        code: "oimtc:inconsistentCalculation" };
        const v = ask(docWith([RESULT, other]));
        expect(v.state).toBe(CALC_STATE.AMBIGUOUS);
        expect(v.results).toHaveLength(2);
    });
});

describe("cubeContents is derivable, so absence is not a finding", () => {
    test("returns the association where the model states it", () => {
        const byCube = cubeFactsFromDerived({ derivedContent: { cubeContents: [
            { cubeName: "msft:allFactsCube", facts: ["ex:F_1", "ex:F_2"] }] } });
        expect(byCube.get("msft:allFactsCube")).toEqual(["ex:F_1", "ex:F_2"]);
    });

    test("returns null where it does not, so the caller derives as before", () => {
        expect(cubeFactsFromDerived({})).toBeNull();
        expect(cubeFactsFromDerived({ derivedContent: {} })).toBeNull();
        expect(cubeFactsFromDerived({ derivedContent: { cubeContents: [] } })).toBeNull();
    });
});
