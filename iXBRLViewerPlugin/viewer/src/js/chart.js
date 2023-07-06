// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import Chart from 'chart.js';
import { AspectSet } from './aspect.js';
import { wrapLabel } from "./util.js";
import { Dialog } from './dialog.js';

export class IXBRLChart extends Dialog {
    constructor() {
        super(".dialog.chart");
    }

    _multiplierDescription(m) {
        const desc = {
            0: "",
            3: "'000s",
            6: "millions",
            9: "billions",
        };
        return desc[m];
    }

    _chooseMultiplier(facts) {
        let max = Math.max(...facts.map(f => Math.abs(Number(f.value()))));
        let scale = 0;
        while (max >= 1000 && scale < 9) {
            max = max / 1000;
            scale += 3; 
        } 
        return scale;
    }

    dataSetColour(i) {
        return [
            '#66cc00',
            '#0094ff',
            '#fbad17'
        ][i];
    }

    addAspect(a) {
        this._analyseDims.push(a);
        this._showAnalyseDimensionChart();
    }

    removeAspect(a) {
        this._analyseDims = this._analyseDims.filter(d => d != a);
        this._showAnalyseDimensionChart();
    }

    analyseDimension(fact, dims) {
        this._analyseFact = fact;
        this._analyseDims = dims;
        this._showAnalyseDimensionChart();
    }

    /*
     * Create a bar chart show fact values broken down along up to two dimensions
     */
    _showAnalyseDimensionChart() {
        const fact = this._analyseFact;
        const dims = this._analyseDims;
        const c = this.node;
        $("canvas", c).remove();
        $("<canvas>").appendTo($(".chart-container", c));
        this.show();

        /* Find all facts that are aligned with the current fact, except for the
         * two dimensions that we're breaking down by */
        const covered = {};
        if (dims[0]) {
            covered[dims[0]] = null;
        }
        if (dims[1]) {
            covered[dims[1]] = null;
        }

        const facts = fact.report().deduplicate(fact.report().getAlignedFacts(fact, covered));

        /* Get the unique aspect values along each dimension.  This is to ensure
         * that we assign facts to datasets consistently (we have one dataset per value
         * on the second aspect, and a value within each dataset for each value on the
         * first aspect */

        const set1av = new AspectSet();
        const set2av = new AspectSet();
        for (const f of facts) {
            if (dims[0]) {
                set1av.add(f.aspect(dims[0]));
            }
            if (dims[1]) {
                set2av.add(f.aspect(dims[1]));
            }
        }
        const uv1 = set1av.uniqueValues();
        const uv2 = set2av.uniqueValues();

        const scale = this._chooseMultiplier(facts);
        const yLabel = fact.measureLabel() + " " + this._multiplierDescription(scale);
        const labels = [];
        
        const dataSets = [];
        /* Assign values to datasets.  If a dimension isn't specified, we still go
         * through the relevant loop once so that we always have at least one plotted
         * value */
        for (let i = 0; i < (dims[0] ? uv1.length : 1); i++) {
            labels.push(dims[0] ? wrapLabel(uv1[i].valueLabel("std") || '', 40) : "");
            for (let j = 0; j < (dims[1] ? uv2.length : 1); j++) {
                dataSets[j] = dataSets[j] || { 
                    label: dims[1] ? uv2[j].valueLabel() : '' || '', 
                    data: [],
                    backgroundColor: this.dataSetColour(j),
                    borderColor: this.dataSetColour(j),
                };

                /* Find the fact that is aligned with the reference fact, except
                 * for the specified value(s) for the dimension(s) that we're analysing */
                const covered = {};
                if (dims[0]) {
                    covered[dims[0]] = uv1[i].value();
                }
                if (dims[1]) {
                    covered[dims[1]] = uv2[j].value();
                }
                const dp = fact.report().getAlignedFacts(fact, covered);
                if (dp.length > 0) {
                    dataSets[j].data[i] = dp[0].value()/(10**scale);
                }
                else {
                    dataSets[j].data[i] = 0;
                }
            }
        }

        /* Create controls for adding or removing aspects for analysis */
        $(".other-aspects", c).empty();
        const unselectedAspects = [];
        for (const av of fact.aspects()) {
            /* Don't show concept in list of additional aspects */
            if (av.name() != 'c') {
                const a = $("<div>")
                    .addClass("other-aspect")
                    .appendTo($(".other-aspects",c));
                if (dims.includes(av.name())) {
                    a.addClass("selected")
                        .text(av.label() + ": *")
                        .click(() => this.removeAspect(av.name()));
                }
                else {
                    if (av.name() != 'u') {
                        unselectedAspects.push(av.valueLabel());
                    }
                    a.text(av.label() + ": " + av.valueLabel());
                    if (dims.length < 2) {
                        a.addClass("addable")
                            .click(() => this.addAspect(av.name()));
                    }
                }
            }
        }

        if (!dims[1]) {
            if (!dims[0]) {
                labels[0] = unselectedAspects.join(", ");
                dataSets[0].label = unselectedAspects.join(", ");
            }
            else {
                dataSets[0].label = unselectedAspects.join(", ");
            }
        }

        this.setChartSize();

        const ctx = $("canvas", c);
        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: dataSets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        },
                        scaleLabel: {
                            display: true,
                            labelString:  yLabel,
                        }

                    }],
                    xAxes: [{
                        ticks: {
                            autoSkip: false
                        }
                    }]
                }
                
            }
        });
        $(window).resize(() => {  
            this.setChartSize();
            chart.resize();
        });
    }

    setChartSize() {
        const c = this.node;
        const nh = c.height() - $('.other-aspects', this.node).outerHeight() - 16;
        $('.chart-container', c).height(nh);
        $('canvas', c).attr('height', nh).height(nh);
    }
}
