// See COPYRIGHT.md for copyright information

import { Fact } from "./fact.js";
import { Footnote } from "./footnote.js";
import { Interval } from './interval.js';

export class FactSet {

    constructor (items) {
        this.itemMap = new Map();
        for (const item of items ?? []) {
            this.add(item)
        }
    }

    add(item) {
        this.itemMap.set(item.vuid, item);
    }

    items() {
        return Array.from(this.itemMap.values());
    }

    /* Returns the union of dimensions present on facts in the set */
    _allDimensions() {
        const dims = {};
        const facts = this.items().filter((item) => item instanceof Fact);
        for (const fact of facts) {
            const dd = Object.keys(fact.dimensions());
            for (var j = 0; j < dd.length; j++) {
                dims[dd[j]] = true;
            }
        }
        return Object.keys(dims);
    }

    /* Returns the "minimally unique" label for the specified fact in the set.
     * 
     * Minimally unique means that we include the value for just enough dimensions
     * to generate labels that are unique within the set.
     *
     * In order to generate the best labels, we try concept and period first.
     */
    minimallyUniqueLabel(fact) {
        if (!this._minimallyUniqueLabels) {
            var facts = this.items().filter((item) => item instanceof Fact);
            var allLabels = {};
            var allAspects = ["c", "p"].concat(this._allDimensions());
            /* Assemble a map of arrays of all aspect labels for all facts, in a
             * consistent order */
            for (var i = 0; i < facts.length; i++) {
                var f = facts[i];
                allLabels[f.vuid] = [];
                for (var j = 0; j < allAspects.length; j++) {
                    var dd = f.aspect(allAspects[j]);
                    allLabels[f.vuid].push(dd ? dd.valueLabel() : null);
                }
            }
            /* Iterate each aspect label and compare that label across all facts in
             * the set */
            var uniqueLabels = {};
            for (var j = 0; j < allAspects.length; j++) {
                var labelMap = {};
                for (var i = 0; i < facts.length; i++) {
                    labelMap[allLabels[facts[i].vuid][j]] = true;
                }

                var uniqueLabelsByLabel = {};
                if (Object.keys(labelMap).length > 1) {
                    /* We have at least two different labels, so include this
                     * aspect in the label for all facts in the set */
                    for (var i = 0; i < facts.length; i++) {
                        var fid = facts[i].vuid;
                        var l = allLabels[fid][j];
                        var ul = uniqueLabels[fid] || [];
                        if (l !== null) {
                            ul.push(l);
                        }
                        if (ul.length > 0) {
                            uniqueLabels[fid] = ul;
                            uniqueLabelsByLabel[ul.join(", ")] = true;
                        }
                    } 
                    /* We have as many different labels as facts - we're done */
                    if (Object.keys(uniqueLabelsByLabel).length == facts.length) {
                        break;
                    }
                }
            }

            /* If any label is empty, add the concept label onto the start of all
             * of them */
            if (Object.keys(uniqueLabels).length < facts.length) {
                for (var i = 0; i < facts.length; i++) {
                    var fid = facts[i].vuid;
                    var ul = uniqueLabels[fid] || [];
                    ul.unshift(allLabels[fid][0]);
                    uniqueLabels[fid] = ul;
                }
            }

            this.items().filter((item) => item instanceof Footnote).forEach((fn) => {
                uniqueLabels[fn.vuid] = [fn.title];
            });

            this._minimallyUniqueLabels = uniqueLabels;
        }
        return this._minimallyUniqueLabels[fact.vuid].join(", ");
    }

    isEmpty() {
        return this.itemMap.size == 0;
    }

    /*
     * Returns an Interval for the intersection of all values in the set, or
     * undefined if there is no intersection (inconsistent duplicates)
     */
    valueIntersection() {
        const duplicates = this.items().map(fact => Interval.fromFact(fact));
        return Interval.intersection(...duplicates);
    }

    completeDuplicates() {
        return this.items().every(f => f.isCompleteDuplicate(this.items()[0]));
    }

    isConsistent() {
        if (this.itemMap.size == 0) {
            return true;
        }
        const duplicates = this.items().map(fact => Interval.fromFact(fact));
        return Interval.intersection(...duplicates) !== undefined;
    }

    size() {
        return this.itemMap.size;
    }

    /*
     * Return the most precise (highest decimals) value within the set.
     */
    mostPrecise() {
        return this.items().reduce((a, b) => b.isMorePrecise(a) ? b : a);
    }
}
