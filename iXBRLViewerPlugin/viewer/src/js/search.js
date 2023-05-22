// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import lunr from 'lunr'
import $ from 'jquery'
import Decimal from "decimal.js";

export class ReportSearch {
    constructor(report) {
        this._report = report;
        this.ready = false;
    }

    * buildSearchIndex(doneCallback) {
        var docs = [];
        var dims = {};
        var facts = this._report.facts();
        this.periods = {};
        for (var i = 0; i < facts.length; i++) {
            var f = facts[i];
            var doc = { "id": f.id };
            var l = f.getLabel("std");
            doc.concept = f.conceptQName().localname;
            doc.doc = f.getLabel("doc");
            doc.date = f.periodTo();
            doc.startDate = f.periodFrom();
            var dims = f.dimensions();
            for (var d in dims) {
                if (this._report.getConcept(d).isTypedDimension()) {
                    if (dims[d] !== null) {
                        l += " " + dims[d];
                    }
                }
                else {
                    l += " " + this._report.getLabel(dims[d], "std");
                }
            }
            doc.label = l;
            doc.ref = f.concept().referenceValuesAsString();
            const wider = f.widerConcepts();
            if (wider.length > 0) {
                doc.widerConcept = this._report.qname(wider[0]).localname;
                doc.widerLabel = this._report.getLabel(wider[0], "std");
                doc.widerDoc = this._report.getLabel(wider[0], "doc");
            }
            docs.push(doc);

            var p = f.period();
            if (p) {
                this.periods[p.key()] = p.toString();
            }

            if (i % 100 === 0) {
                yield;
            }
        }
        const builder = new lunr.Builder();
        builder.pipeline.add(
          lunr.trimmer,
          lunr.stopWordFilter,
          lunr.stemmer
        )

        builder.searchPipeline.add(
          lunr.stemmer
        )

        builder.ref('id');
        builder.field('label');
        builder.field('concept');
        builder.field('startDate');
        builder.field('date');
        builder.field('doc');
        builder.field('ref');
        builder.field('widerLabel');
        builder.field('widerDoc');
        builder.field('widerConcept');


        for (const [i, doc] of docs.entries()) {
            builder.add(doc);
            if (i % 100 === 0) {
                yield;
            }
        }
        this._searchIndex = builder.build();
        this.ready = true;
        doneCallback();
    }

    visibilityFilter(s, item) {
        return item.isHidden() ? s.showHiddenFacts : s.showVisibleFacts;
    }

    periodFilter(s, item) {
        return (
            s.periodFilter === '*' ||
            s.periodFilter === item.period().key()
        );
    }

    conceptTypeFilter(s, item) {
        return (
            s.conceptTypeFilter === '*' ||
            s.conceptTypeFilter === (item.isNumeric() ? 'numeric' : 'text')
        );
    }

    factValueFilter(s, item) {
        return (
            s.factValueFilter === '*' ||
            (s.factValueFilter === 'positive' && item.isPositive()) ||
            (s.factValueFilter === 'negative' && item.isNegative())
        );
    }

    calculationsFilter(s, item) {
        return (
            s.calculationsFilter === '*' ||
            (s.calculationsFilter === 'summation' && item.isCalculationSummation()) ||
            (s.calculationsFilter === 'contributor' && item.isCalculationContributor()) ||
            (s.calculationsFilter === 'summationOrContributor' && (item.isCalculationSummation() || item.isCalculationContributor()))
        );
    }

    namespacesFilter(s, item) {
        return (
            s.namespacesFilter.length === 0 ||
            s.namespacesFilter.some(p => item.getConceptPrefix() === p)
        );
    }

    unitsFilter(s, item) {
        return (
                s.unitsFilter.length === 0 ||
                s.unitsFilter.some(u => item.unit()?.value() === u)
        );
    }

    scalesFilter(s, item) {
        return (
                s.scalesFilter.length === 0 ||
                s.scalesFilter.some(x => item.scale() === Number(x))
        );
    }

    search(s) {
        if (!this.ready) {
            return;
        }
        const rr = this._searchIndex.search(s.searchString);
        const results = []
        const searchIndex = this;

        const filters = [
            this.visibilityFilter,
            this.periodFilter,
            this.conceptTypeFilter,
            this.factValueFilter,
            this.calculationsFilter,
            this.namespacesFilter,
            this.unitsFilter,
            this.scalesFilter,
        ];

        rr.forEach((r,_) => {
                const item = searchIndex._report.getItemById(r.ref);
                if (filters.every(f => f(s, item))) {
                    results.push({
                        "fact": item,
                        "score": r.score
                    });
                }
            }
        );
        return results;
    }
}
