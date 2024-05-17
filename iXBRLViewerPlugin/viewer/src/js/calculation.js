// See COPYRIGHT.md for copyright information

import Decimal from 'decimal.js';
import { setDefault } from './util.js';
import { Interval } from './interval.js';
import { FactSet } from './factset.js';

export class Calculation {
    
    constructor(fact, calc11) {
        this.fact = fact;
        this.calc11 = calc11;
    }

    /* Resolve calculation relationships to a map of maps of arrays 
     * (ELR->conceptName->facts) */
    calculationFacts() {
        const fact = this.fact;
        const report = fact.report;
        if (!this._conceptToFact) {
            const rels = report.getChildRelationships(fact.conceptName(), "calc")
            const ctf = {};
            for (const [elr, rr] of Object.entries(rels)) {
                ctf[elr] = {};
                if (rr.length > 0) {
                    const otherFacts = report.getAlignedFacts(fact, {"c": rr.map(r => r.t )});
                    otherFacts.forEach(otherFact => setDefault(ctf[elr], otherFact.conceptName(), new FactSet()).add(otherFact));
                }
            }
            this._conceptToFact = ctf;
        }
        return this._conceptToFact;
    }

    hasCalculations() {
        const ctf = this.calculationFacts();
        return Object.keys(ctf).length > 0;
    }

    resolvedCalculations() {
        const calculations = [];
        const ctf = this.calculationFacts();
        for (const [elr, concepts] of Object.entries(ctf)) {
            if (Object.keys(concepts).length > 0) {
                calculations.push(this.resolvedCalculation(elr));
            }
        } 
        return calculations;
    }

    /*
     * Select the ELR which is the best match for a given array of facts
     */
    bestELRForFactSet(facts) {
        const ctf = this.calculationFacts();
        let bestMatchELR = "";
        let bestMatchCount = -1;
        for (const [elr, rr] of Object.entries(ctf)) {
            let matchCount = 0;
            for (const [concept, calcFactSet] of Object.entries(rr)) {
                let matched = 0;
                for (const calcFact of calcFactSet.items()) {
                    if (facts.includes(calcFact.vuid)) {
                        matched = 1;
                    } 
                }
                matchCount += matched;
            }
            if (matchCount/Object.keys(rr).length > bestMatchCount) {
                bestMatchCount = matchCount/Object.keys(rr).length;    
                bestMatchELR = elr;
            }
        } 
        return bestMatchELR;
    }

    /*
     * Returns a ResolvedCalculation object for the specified ELR
     */
    resolvedCalculation(elr) {
        const calcFacts = this.calculationFacts()[elr];
        const report = this.fact.report;
        const rels = report.getChildRelationships(this.fact.conceptName(), "calc")[elr];
        const resolvedCalcClass = this.calc11 ? ResolvedCalc11Calculation : ResolvedLegacyCalculation;
        const resolvedCalculation = new resolvedCalcClass(elr, this.fact);
        for (const r of rels) {
            const factset = calcFacts[r.t] ?? new FactSet();
            resolvedCalculation.addRow(new CalculationContribution(report.getConcept(r.t), r.w, factset));
        }
        return resolvedCalculation;
    }
}

class CalculationContribution {

    constructor(concept, weight, facts) {
        this.concept = concept;
        this.weight = weight;
        this.facts = facts;

        if (weight == 1) {
            this.weightSign = '+';
        }
        else if (weight == -1) {
            this.weightSign = '-';
        }
        else {
            this.weightSign = weight.toString();
        }
    }

    contributionInterval() {
        const intersection = this.facts.valueIntersection();
        if (intersection === undefined) {
            return undefined;
        }
        return intersection.times(this.weight); 
    }
}

class AbstractResolvedCalculation {

    constructor(elr, fact) {
        this.totalFact = fact;
        this.totalFactSet = new FactSet(fact.report.getAlignedFacts(fact));
        this.elr = elr;
        this.rows = [];
    }

    addRow(contribution) {
        this.rows.push(contribution);
    }

    binds() {
        return this.rows.some((r) => !r.facts.isEmpty());
    }

    unchecked() {
        return false;
    }
}

export class ResolvedCalc11Calculation extends AbstractResolvedCalculation {

    calculatedTotalInterval() {
        let total = new Interval(0, 0);
        for (const item of this.rows) {
            if (!item.facts.isEmpty()) {
                const contribution = item.contributionInterval();
                if (contribution === undefined) {
                    // Inconsistent duplicates
                    return undefined;
                }

                total = total.plus(contribution);
            }
        }
        return total;
    }

    /*
     * Is the calculation consistent under Calculations v1.1 rules?
     */
    isConsistent() {
        const cti = this.calculatedTotalInterval();
        const ti = this.totalFactSet.valueIntersection();
        return cti !== undefined && cti.intersection(ti) !== undefined;
    }
}

export class ResolvedLegacyCalculation extends AbstractResolvedCalculation {

    binds() {
        return super.binds() && this.rows.every((r) => r.facts.completeDuplicates());
    }

    unchecked() {
        return super.binds() && !this.binds();
    }

    calculatedTotal() {
        let total = new Decimal(0);

        for (const row of this.rows) {
            if (!row.facts.isConsistent()) {
                return undefined;
            }
            if (!row.facts.isEmpty()) {
                // Calculation does not bind if there are consistent (non-exact)
                // duplicates, so we can just take the first duplicate value
                total = total.plus(row.facts.items()[0].roundedValue().times(row.weight));
            }
        }
        return total;
    }

    isConsistent() {
        return this.calculatedTotal().equals(this.totalFact.roundedValue());
    }
}
