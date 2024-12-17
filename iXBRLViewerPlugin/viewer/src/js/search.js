// See COPYRIGHT.md for copyright information

import lunr from 'lunr'

export class ReportSearch {
    constructor(reportSet) {
        this._reportSet = reportSet;
        this.ready = false;
    }

    * buildSearchIndex(doneCallback) {
        var docs = [];
        var dims = {};
        var facts = this._reportSet.facts();
        this.periods = {};
        // Add hidden facts to index later, so that they appear later in the
        // default search
        for (const hidden of [false, true]) {
            for (var i = 0; i < facts.length; i++) {
                var f = facts[i];
                if (f.isHidden() !== hidden) {
                    continue;
                }
                var doc = { "id": f.vuid };
                var l = f.getLabel("std");
                doc.concept = f.conceptQName().localname;
                doc.doc = f.getLabel("doc");
                doc.date = f.periodTo();
                doc.startDate = f.periodFrom();
                var dims = f.dimensions();
                for (var d in dims) {
                    if (f.report.getConcept(d).isTypedDimension()) {
                        if (dims[d] !== null) {
                            l += " " + dims[d];
                        }
                    }
                    else {
                        l += " " + f.report.getLabel(dims[d], "std");
                    }
                }
                doc.label = l;
                doc.ref = f.concept().referenceValuesAsString();
                const wider = f.widerConcepts();
                if (wider.length > 0) {
                    doc.widerConcept = f.report.qname(wider[0]).localname;
                    doc.widerLabel = f.report.getLabel(wider[0], "std");
                    doc.widerDoc = f.report.getLabel(wider[0], "doc");
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
        return (
                s.visibilityFilter === '*' ||
                s.visibilityFilter === 'visible' && !item.isHidden() ||
                s.visibilityFilter === 'hidden' && item.isHidden()
        )
    }

    periodFilter(s, item) {
        return (
            s.periodFilter.length === 0 ||
            s.periodFilter.some(p => item.period().key() === p)
        );
    }

    conceptTypeFilter(s, item) {
        return (
            s.conceptTypeFilter === '*' ||
            s.conceptTypeFilter === (item.isNumeric() ? 'numeric' : 'text')
        );
    }

    dimensionTypeFilter(s, item) {
        const typed = s.dimensionTypeFilter.includes('typed');
        const explicit = s.dimensionTypeFilter.includes('explicit');
        return (
            s.dimensionTypeFilter.length === 0 ||
            (typed && item.hasTypedDimension()) ||
            (explicit && item.hasExplicitDimension())
        )
    }

    factValueFilter(s, item) {
        return (
            s.factValueFilter === '*' ||
            (s.factValueFilter === 'positive' && item.isPositive()) ||
            (s.factValueFilter === 'negative' && item.isNegative())
        );
    }

    calculationsFilter(s, item) {
        const summation = s.calculationsFilter.includes('summation');
        const contributor = s.calculationsFilter.includes('contributor');
        return (
            s.calculationsFilter.length === 0 ||
            (summation && item.isCalculationSummation()) ||
            (contributor && item.isCalculationContributor())
        );
    }

    namespacesFilter(s, item) {
        return (
            s.namespacesFilter.length === 0 ||
            s.namespacesFilter.some(p => item.getConceptPrefix() === p)
        );
    }

    dataTypesFilter(s, item) {
        return (
            s.dataTypesFilter == null ||
            s.dataTypesFilter.length === 0 ||
            s.dataTypesFilter.some(p => item.concept().dataType()?.name === p)
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

    targetDocumentFilter(s, item) {
        return (
            s.targetDocumentFilter.length === 0 ||
            s.targetDocumentFilter.some(t => (item.targetDocument() ?? ':default') === t)
        );
    }

    mandatoryFactFilter(s, item) {
        if(!s.showMandatoryFacts) {
            return true;
        }
        return item.isMandatory();
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
            this.dimensionTypeFilter,
            this.factValueFilter,
            this.calculationsFilter,
            this.namespacesFilter,
            this.dataTypesFilter,
            this.unitsFilter,
            this.scalesFilter,
            this.targetDocumentFilter,
            this.mandatoryFactFilter
        ];

        rr.forEach((r,_) => {
                const item = searchIndex._reportSet.getItemById(r.ref);
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
