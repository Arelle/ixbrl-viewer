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

import $ from 'jquery';
import Chart from 'chart.js';
import { AspectSet } from './aspect.js';
import { wrapLabel } from "./util.js";
import { Dialog } from './dialog.js';

export function IXBRLChart() {
    Dialog.call(this, ".dialog.chart");
}

IXBRLChart.prototype = Object.create(Dialog.prototype);

IXBRLChart.prototype._multiplierDescription = function(m) {
    var desc = {
        0: "",
        3: "'000s",
        6: "millions",
        9: "billions",
    };
    return desc[m];
}

IXBRLChart.prototype._chooseMultiplier = function(facts) {
    var max = 0;
    $.each(facts, function (i, f) {
        var v = Number(f.value());
        if(v > max) {
            max = v;
        }
    });
    var scale = 0;
    while (max > 1000 && scale < 9) {
        max = max / 1000;
        scale += 3; 
    } 
    return scale;
}

IXBRLChart.prototype.dataSetColour = function(i) {
    return [
        '#66cc00',
        '#0094ff',
        '#fbad17'
    ][i];
}

IXBRLChart.prototype.addAspect = function(a) {
    this._analyseDims.push(a);
    this._showAnalyseDimensionChart();
}

IXBRLChart.prototype.removeAspect = function(a) {
    var newDims = [];
    $.each(this._analyseDims, function (i,d) { if (d != a) { newDims.push(d) }});
    this._analyseDims = newDims;
    this._showAnalyseDimensionChart();
}

IXBRLChart.prototype.analyseDimension = function(fact, dims) {
    this._analyseFact = fact;
    this._analyseDims = dims;
    this._showAnalyseDimensionChart();
}

/*
 * Create a bar chart show fact values broken down along up to two dimensions
 */
IXBRLChart.prototype._showAnalyseDimensionChart = function() {
    var fact = this._analyseFact;
    var dims = this._analyseDims;
    var co = this;
    var c = this.node;
    $("canvas",c).remove();
    $("<canvas>").appendTo($(".chart-container",c));
    this.show();

    /* Find all facts that are aligned with the current fact, except for the
     * two dimensions that we're breaking down by */
    var covered = {};
    if (dims[0]) {
        covered[dims[0]] = null;
    }
    if (dims[1]) {
        covered[dims[1]] = null;
    }

    var facts = fact.report().deduplicate(fact.report().getAlignedFacts(fact, covered));

    /* Get the unique aspect values along each dimension.  This is to ensure
     * that we assign facts to datasets consistently (we have one dataset per value
     * on the second aspect, and a value within each dataset for each value on the
     * first aspect */

    var set1av = new AspectSet();
    var set2av = new AspectSet();
    $.each(facts, function (i,f) {
        if (dims[0]) {
            set1av.add(f.aspect(dims[0]));
        }
        if (dims[1]) {
            set2av.add(f.aspect(dims[1]));
        }
    });
    var uv1 = set1av.uniqueValues();
    var uv2 = set2av.uniqueValues();

    var scale = this._chooseMultiplier(facts);
    var yLabel = fact.unit().valueLabel() + " " + this._multiplierDescription(scale);
    var labels = [];
    
    var dataSets = [];
    /* Assign values to datasets.  If a dimension isn't specified, we still go
     * through the relevant loop once so that we always have at least one plotted
     * value */
    for (var i = 0; i < (dims[0] ? uv1.length : 1); i++) {
        labels.push(dims[0] ? wrapLabel(uv1[i].valueLabel("std") || '', 40) : "");
        for (var j = 0; j < (dims[1] ? uv2.length : 1); j++) {
            dataSets[j] = dataSets[j] || { 
                label: dims[1] ? uv2[j].valueLabel() : '' || '', 
                data: [],
                backgroundColor: this.dataSetColour(j),
                borderColor: this.dataSetColour(j),
            };

            /* Find the fact that is aligned with the reference fact, except
             * for the specified value(s) for the dimension(s) that we're analysing */
            var covered = {};
            if (dims[0]) {
                covered[dims[0]] = uv1[i].value();
            }
            if (dims[1]) {
                covered[dims[1]] = uv2[j].value();
            }
            var dp = fact.report().getAlignedFacts(fact, covered);
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
    var unselectedAspects = [];
    for (const av of fact.aspects()) {
        /* Don't show concept in list of additional aspects */
        if (av.name() != 'c') {
            var a = $("<div>")
                .addClass("other-aspect")
                .appendTo($(".other-aspects",c));
            if ($.inArray(av.name(), dims) > -1) {
                a.addClass("selected")
                    .text(av.label() + ": *")
                    .click(function () { co.removeAspect(av.name()) });
            }
            else {
                if (av.name() != 'u') {
                    unselectedAspects.push(av.valueLabel());
                }
                a.text(av.label() + ": " + av.valueLabel());
                if (dims.length < 2) {
                    a.addClass("addable")
                        .click(function () { co.addAspect(av.name()) });
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

    co.setChartSize();

    var ctx = $("canvas", c);
    var chart = new Chart(ctx, {
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
    $(window).resize(function () {  
        co.setChartSize();
        chart.resize();
    });
}

IXBRLChart.prototype.setChartSize = function () {
    var c = this.node;
    var nh = c.height() - $('.other-aspects').height() - 16;
    $('.chart-container',c).height(nh);
    $('canvas',c).attr('height',nh).height(nh);

}
