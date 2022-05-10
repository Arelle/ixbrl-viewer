// Copyright 2021 Workiva Inc.
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

import $ from 'jquery';
import i18next from 'i18next';

import { Dialog } from './dialog.js';

export class CalculationInspector extends Dialog {
    constructor() {
        super();
        Dialog.call(this, ".dialog.calculation-inspector");
        this.addButton("Dismiss", true);
    }

    duplicateFactIcons(factset) {
        const icons = $("<td></td>").addClass("icons");
        if (factset.size() > 1 && !factset.completeDuplicates()) {
            if (factset.isConsistent()) {
                icons.append(
                    $("<span></span>")
                    .addClass("duplicate-facts")
                    .attr("title", i18next.t('calculation.consistent-duplicate-facts-present', {nfacts: factset.size()}))
                );
            }
            else {
                icons.append(
                    $("<span></span>")
                    .addClass("duplicate-facts")
                    .attr("title", i18next.t('calculation.inconsistent-duplicate-facts-present', {nfacts: factset.size()}))
                );
            }
        }
        return icons;
    }

    displayCalculation(resolvedCalculation) {
        var tbody = this.node.find("tbody");
        tbody.empty();
        for (const row of resolvedCalculation.rows) {
            let factText = "";
            let minText = "";
            let maxText = "";

            if (!row.facts.isEmpty()) {
                let f = row.facts.items[0];
                const reportedInterval = row.facts.valueIntersection();
                if (reportedInterval === undefined) {
                    factText = "Inconsistent duplicates"; // XXX untested
                }
                else {
                    factText = f.readableValue(reportedInterval.midpoint().toNumber());
                    const contributionInterval = row.contributionInterval();
                    minText = f.readableValue(contributionInterval.a.toNumber());
                    maxText = f.readableValue(contributionInterval.b.toNumber());
                }
            }
            $("<tr></tr>")
                .append($("<td></td>").addClass("weight").text(row.weightSign))
                .append($("<td></td>").text(row.concept.label()))
                .append($("<td></td>").addClass("figure").text(factText))
                .append(this.duplicateFactIcons(row.facts))
                .append($("<td></td>").addClass("figure").text(minText))
                .append($("<td></td>").addClass("figure").text(maxText))
                .appendTo(tbody);
        }
        const fact = resolvedCalculation.totalFact;
        const cvi = resolvedCalculation.calculatedTotalInterval();
        $("<tr></tr>").addClass("total")
            .append($("<td></td>"))
            .append($("<td></td>").text(`${fact.concept().label()} (${i18next.t('calculation.calculated-total')})`))
            .append($("<td></td>").text(fact.readableValue(cvi.midpoint().toNumber())).addClass("figure"))
            .append($("<td></td>"))
            .append($("<td></td>").text(fact.readableValue(cvi.a.toNumber())).addClass("figure"))
            .append($("<td></td>").text(fact.readableValue(cvi.b.toNumber())).addClass("figure"))
            .appendTo(tbody);

        const rvi = fact.valueInterval();
        $("<tr></tr>").addClass("total")
            .append($("<td></td>"))
            .append($("<td></td>").text(`${fact.concept().label()} (${i18next.t('calculation.reported-total')})`))
            .append($("<td></td>").text(fact.readableValue()).addClass("figure"))
            .append($("<td></td>"))
            .append($("<td></td>").text(fact.readableValue(rvi.a.toNumber())).addClass("figure"))
            .append($("<td></td>").text(fact.readableValue(rvi.b.toNumber())).addClass("figure"))
            .appendTo(tbody);
    }
}


