// See COPYRIGHT.md for copyright information

/*
 * derivedContent -- what processing concluded, as opposed to what the filer
 * reported.
 *
 * A compiled model may carry a `derivedContent` object beside `documentInfo` and
 * `xbrlModel`: resolved fact values, which facts fall in which cube, and the
 * calculation verdicts. It sits beside the model rather than inside it because
 * merging would make it indistinguishable from what was reported, and publishing
 * it separately would break its binding to the model it describes.
 *
 * Two kinds, and the difference decides what a viewer may do when something is
 * absent:
 *
 *   derivable      the model implies it and any processor can compute it, so
 *                  deriving it locally is legitimate.  cubeContents.
 *   non-derivable  a record of what a processor did, not reproducible from the
 *                  model.  A consumer MUST NOT present its own computation as
 *                  though it were the absent content.  calculationResults.
 *
 * That second rule is why this module reports NOT_VALIDATED as a state rather
 * than falling back to a local answer. A viewer recomputing is not a second
 * opinion on the same question: standards, rules and implementations move
 * between the moment a report was received and any later moment it is read, so a
 * local result answers a different question while sitting exactly where the
 * producer's verdict would have been, indistinguishable to the reader.
 */

export const CALC_STATE = {
    CONSISTENT: "consistent",
    INCONSISTENT: "inconsistent",
    NOT_VALIDATED: "not-validated",
    AMBIGUOUS: "ambiguous",     // several carried results disagree for one binding
};

/*
 * Result aspects are named as the model names them; the viewer's fact aspects
 * use short keys for the core four and pass taxonomy-defined dimensions through
 * unchanged (see buildFacts in adapter.js). Translating here keeps the mapping
 * in one place rather than at every comparison.
 */
const ASPECT_KEY = {
    "xbrl:concept": "c",
    "xbrl:entity": "e",
    "xbrl:period": "p",
    "xbrl:unit": "u",
};

function viewerAspectKey(name) {
    return ASPECT_KEY[name] ?? name;
}

/*
 * Does a carried result's aspect set describe this fact?
 *
 * Compared on the aspects the result states, not on set equality: `aspects`
 * omits anything the binding does not constrain, so a result constraining only
 * period, entity and unit legitimately describes a fact that also carries
 * dimensions. Requiring equality would match nothing on a dimensional report --
 * 46 of the Microsoft results constrain a FinancialInstrumentAxis, and the rest
 * do not.
 *
 * Being a subset test, it is deliberately loose, and several results can describe
 * one fact at once. Resolving that is specificity's job, below -- not this
 * function's.
 */
function aspectsDescribe(resultAspects, factAspects) {
    for (const [name, value] of Object.entries(resultAspects ?? {})) {
        const key = viewerAspectKey(name);
        if (String(factAspects?.[key]) !== String(value)) {
            return false;
        }
    }
    return true;
}

function aspectCount(result) {
    return Object.keys(result?.aspects ?? {}).length;
}

/*
 * Index the carried results for lookup by (networkName, total).
 *
 * The cube is deliberately not part of the key. It is part of the binding's
 * identity in the model, but the viewer has no cube scoping, so including it
 * would mean matching on something the caller cannot supply. Where equally
 * specific results still disagree -- reached, say, under different cubes -- the
 * lookup reports AMBIGUOUS rather than choosing, since picking one would present
 * a coin toss as a finding. Microsoft's 10-K does not exercise that case: its 183
 * results are all under one cube, and each fact resolves to exactly one of them.
 */
export function indexCalculationResults(doc) {
    const derived = doc?.derivedContent ?? {};
    const byKey = new Map();
    for (const r of derived.calculationResults ?? []) {
        const key = `${r.networkName} ${r.total}`;
        if (!byKey.has(key)) {
            byKey.set(key, []);
        }
        byKey.get(key).push(r);
    }
    return {
        byKey,
        derivation: derived.derivation,
        // Distinguishes "this model carries no derived content" from "it carries
        // some, and none of it covers this binding". Only the second is a
        // finding about the binding.
        present: Array.isArray(derived.calculationResults),
        count: (derived.calculationResults ?? []).length,
    };
}

/*
 * The carried verdict for one binding, or why there is none.
 *
 * Never computes anything: an absent result asserts neither consistency nor that
 * anything was checked, and this returns NOT_VALIDATED so a caller can say so.
 */
export function calculationVerdict(index, { networkName, total, factAspects } = {}) {
    if (!index?.present) {
        return { state: CALC_STATE.NOT_VALIDATED, reason: "model carries no derived content" };
    }
    const matching = (index.byKey.get(`${networkName} ${total}`) ?? [])
        .filter(r => aspectsDescribe(r.aspects, factAspects));
    if (matching.length === 0) {
        /*
         * Carries the derivation even though there is no result: the reader is
         * being told this binding was not covered, and by which run -- "not
         * validated, as of this processor on this date" is a materially
         * different statement from "not validated" with no run behind it.
         */
        return {
            state: CALC_STATE.NOT_VALIDATED,
            reason: "no carried result for this binding",
            derivation: index.derivation,
        };
    }
    /*
     * The most specific match wins. A result constraining fewer aspects is not a
     * looser opinion about this fact, it is the verdict on a different binding:
     * for a fact dimensioned by asset class, hierarchy level and instrument,
     * Microsoft's model carries verdicts on all three of the un-dimensioned
     * total, the asset-class total and the fully dimensioned one, and only the
     * last is about this fact. Taking them all as candidates made 11 of the 183
     * results look like disagreements when nothing disagreed.
     */
    const finest = Math.max(...matching.map(aspectCount));
    const candidates = matching.filter(r => aspectCount(r) === finest);
    const verdicts = new Set(candidates.map(r => r.consistent === true));
    if (candidates.length > 1 && verdicts.size > 1) {
        return {
            state: CALC_STATE.AMBIGUOUS,
            results: candidates,
            derivation: index.derivation,
            reason: `${candidates.length} carried results disagree`,
        };
    }
    const result = candidates[0];
    return {
        state: result.consistent === true ? CALC_STATE.CONSISTENT : CALC_STATE.INCONSISTENT,
        result,
        derivation: index.derivation,
    };
}

/*
 * cubeContents is derivable, so its absence is not a finding: where the model
 * states the fact-to-cube association, use it; otherwise the adapter's
 * dimensional match stands. Returns null when nothing is carried, which the
 * caller reads as "derive as before".
 */
export function cubeFactsFromDerived(doc) {
    const contents = doc?.derivedContent?.cubeContents;
    if (!Array.isArray(contents) || contents.length === 0) {
        return null;
    }
    const byCube = new Map();
    for (const c of contents) {
        if (c?.cubeName) {
            byCube.set(c.cubeName, c.facts ?? []);
        }
    }
    return byCube;
}
