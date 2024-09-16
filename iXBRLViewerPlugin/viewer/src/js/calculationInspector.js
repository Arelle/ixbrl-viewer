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
import { ResolvedCalc11Calculation } from './calculation.js';

export class CalculationInspector extends Dialog {
    constructor() {
        super(".dialog.calculation-inspector");
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

    populateCalc11Table(resolvedCalculation, table) {
        table.addClass("calc11");
        const tbody = table.find("tbody");
        let hasIcons = false;
        for (const row of resolvedCalculation.rows) {
            let factText = "";
            let minText = "";
            let maxText = "";

            if (!row.facts.isEmpty()) {
                let f = row.facts.items()[0];
                const reportedInterval = row.facts.valueIntersection();
                if (reportedInterval === undefined) {
                    factText = "n/a";
                    minText = "n/a"; 
                    maxText = "n/a";
                }
                else {
                    factText = f.readableValue(reportedInterval.midpoint().toNumber());
                    const contributionInterval = row.contributionInterval();
                    minText = f.readableValue(contributionInterval.a.toNumber());
                    maxText = f.readableValue(contributionInterval.b.toNumber());
                }
            }
            const icons = this.duplicateFactIcons(row.facts);
            hasIcons = hasIcons || icons.find("span").length > 0;
            $("<tr></tr>")
                .append($("<td></td>").addClass("weight").text(row.weightSign))
                .append($("<td></td>").text(row.concept.label()).addClass("line-item"))
                .append($("<td></td>").addClass("figure").text(factText))
                .append(icons)
                .append($("<td></td>").addClass("figure").text(minText))
                .append($("<td></td>").addClass("figure").text(maxText))
                .appendTo(tbody);
        }
        const fact = resolvedCalculation.totalFact;
        const cvi = resolvedCalculation.calculatedTotalInterval();
            $("<tr></tr>").addClass("total")
                .append($("<td></td>"))
                .append($("<td></td>").text(`${fact.concept().label()} (${i18next.t('calculation.calculated-total')})`).addClass("line-item"))
                .append($("<td></td>").text(cvi === undefined ? 'n/a' : fact.readableValue(cvi.midpoint().toNumber())).addClass("figure"))
                .append($("<td></td>").addClass("icons"))
                .append($("<td></td>").text(cvi === undefined ? 'n/a' : fact.readableValue(cvi.a.toNumber())).addClass("figure"))
                .append($("<td></td>").text(cvi === undefined ? 'n/a' : fact.readableValue(cvi.b.toNumber())).addClass("figure"))
                .appendTo(tbody);

        const tvi = resolvedCalculation.totalFactSet.valueIntersection();
        const icons = this.duplicateFactIcons(resolvedCalculation.totalFactSet);
        $("<tr></tr>")
            .append($("<td></td>"))
            .append($("<td></td>").text(`${fact.concept().label()} (${i18next.t('calculation.reported-total')})`).addClass("line-item"))
            .append($("<td></td>").text(tvi === undefined ? 'n/a' : fact.readableValue(tvi.midpoint().toNumber())).addClass("figure"))
            .append(icons)
            .append($("<td></td>").text(tvi === undefined ? 'n/a' : fact.readableValue(tvi.a.toNumber())).addClass("figure"))
            .append($("<td></td>").text(tvi === undefined ? 'n/a' : fact.readableValue(tvi.b.toNumber())).addClass("figure"))
            .appendTo(tbody);
        if (hasIcons) {
            table.addClass("has-icons");
        }
    }

    populateLegacyCalcTable(resolvedCalculation, table) {
        table.removeClass("calc11");
        const tbody = table.find("tbody");
        let hasIcons = false;
        for (const row of resolvedCalculation.rows) {
            let factText = "";

            if (!row.facts.isEmpty()) {
                let f = row.facts.items()[0];
                const reportedInterval = row.facts.valueIntersection();
                if (reportedInterval === undefined) {
                    factText = "Inconsistent duplicates";
                }
                else if (!row.facts.completeDuplicates()) {
                    factText = "Duplicate facts"; 
                }
                else {
                    factText = f.readableValue();
                }
            }
            const icons = this.duplicateFactIcons(row.facts);
            hasIcons = hasIcons || icons.find("span").length > 0;
            $("<tr></tr>")
                .append($("<td></td>").addClass("weight").text(row.weightSign))
                .append($("<td></td>").text(row.concept.label()).addClass("line-item"))
                .append($("<td></td>").addClass("figure").text(factText))
                .append(icons)
                .appendTo(tbody);
        }
        const fact = resolvedCalculation.totalFact;
        const ct = resolvedCalculation.calculatedTotal();
        $("<tr></tr>").addClass("total")
            .append($("<td></td>"))
            .append($("<td></td>").text(`${fact.concept().label()} (${i18next.t('calculation.calculated-total')})`).addClass("line-item"))
            .append($("<td></td>").text(fact.readableValue(ct)).addClass("figure"))
            .append($("<td></td>").addClass("icons"))
            .appendTo(tbody);

        $("<tr></tr>")
            .append($("<td></td>"))
            .append($("<td></td>").text(`${fact.concept().label()} (${i18next.t('calculation.reported-total')})`).addClass("line-item"))
            .append($("<td></td>").text(fact.readableValue()).addClass("figure"))
            .append($("<td></td>").addClass("icons"))
            .appendTo(tbody);
        if (hasIcons) {
            table.addClass("has-icons");
        }
    }

    displayCalculation(resolvedCalculation) {
        const table = this.node.find("table.calculation-trace");
        const tbody = table.find("tbody");
        // We remove the padding on the icons column (used to indicate
        // duplicate facts) if it is empty to avoid an unsightly gap
        tbody.empty();
        table.removeClass("has-icons");
        if (resolvedCalculation instanceof ResolvedCalc11Calculation) {
            this.populateCalc11Table(resolvedCalculation, table);
        }
        else {
            this.populateLegacyCalcTable(resolvedCalculation, table);
        }


        const messageCell = table.find("td.status");
        messageCell.removeClass("inconsistent").removeClass("consistent").removeClass("unchecked");
        if (resolvedCalculation.unchecked()) {
            messageCell.addClass("unchecked").find(".message").text(i18next.t('calculation.does-not-bind'));
        } 
        else if (resolvedCalculation.isConsistent()) {
            messageCell.addClass("consistent").find(".message").text(i18next.t('factDetails.calculationIsConsistent'));
        }
        else {
            messageCell.addClass("inconsistent").find(".message").text(i18next.t('factDetails.calculationIsInconsistent'));
        }
    }
}


