import $ from 'jquery';
import Chart from 'chart.js';
import { AspectSet } from './aspect.js';

export function IXBRLChart() {
    this._chart = $('#ixv #chart');
    var c = this._chart;
    $('.close', c).click(function () { $('.dialog-mask').hide(); c.hide() });

}

/* takes a string phrase and breaks it into separate phrases 
 *    no bigger than 'maxwidth', breaks are made at complete words.*/

function formatLabel(str, maxwidth){
    var sections = [];
    var words = str.split(" ");
    var temp = "";

    words.forEach(function(item, index){
        if(temp.length > 0)
        {
            var concat = temp + ' ' + item;

            if(concat.length > maxwidth){
                sections.push(temp);
                temp = "";
            }
            else{
                if(index == (words.length-1))
                {
                    sections.push(concat);
                    return;
                }
                else{
                    temp = concat;
                    return;
                }
            }
        }

        if(index == (words.length-1))
        {
            sections.push(item);
            return;
        }

        if(item.length < maxwidth) {
            temp = item;
        }
        else {
            sections.push(item);
        }

    });

    return sections;
}

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
    console.log("max: " + max + " scale: " + scale);
    return scale;
}

IXBRLChart.prototype.dataSetColour = function(i) {
    return [
        'rgba(255, 0, 108, 1.0)',
        'rgba(255, 108, 0, 1.0)',
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

IXBRLChart.prototype._showAnalyseDimensionChart = function() {
    var fact = this._analyseFact;
    var dims = this._analyseDims;
    var co = this;
    var c = this._chart;
    $("canvas",c).remove();
    $("<canvas>").appendTo($(".chart-container",c));
    $('.dialog-mask').show();
    c.show();
    var covered = {};
    covered[dims[0]] = null;
    if (dims[1]) {
        covered[dims[1]] = null;
    }

    var dataLabel = fact.getLabel("std");

    var facts = fact.report().deduplicate(fact.report().getAlignedFacts(fact, covered));

    var scale = this._chooseMultiplier(facts);
    var yLabel = fact.unit().valueLabel() + " " + this._multiplierDescription(scale);
    var labels = [];
    var set1av = new AspectSet();
    var set2av = new AspectSet();

    $.each(facts, function (i,f) {
        set1av.add(f.aspects()[dims[0]]);
        if (dims[1]) {
            set2av.add(f.aspects()[dims[1]]);
        }
    });

    var uv1 = set1av.uniqueValues();
    var uv2 = set2av.uniqueValues();
    
    var dataSets = [];

    for (var i = 0; i < uv1.length; i++) {
        labels.push(formatLabel(uv1[i].valueLabel("std") || '', 40));
        for (var j = 0; j < (dims[1] ? uv2.length : 1); j++) {
            var covered = {};
            covered[dims[0]] = uv1[i].value();
            if (dims[1]) {
                covered[dims[1]] = uv2[j].value();
            }

            dataSets[j] = dataSets[j] || { 
                label: dims[1] ? uv2[j].valueLabel() : '' || '', 
                data: [],
                backgroundColor: this.dataSetColour(j),
                borderColor: this.dataSetColour(j),
            };

            console.log(covered);
            var dp = fact.report().getAlignedFacts(fact, covered);
            console.log(dp);
            if (dp.length > 0) {
                dataSets[j].data[i] = dp[0].value()/(10**scale);
            }
            else {
                dataSets[j].data[i] = 0;
            }
        }
    }

    $(".other-aspects", c).empty();
    var unselectedAspects = [];
    $.each(fact.aspects(), function (a,av) {
        console.log(av);
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
    });
    if (!dims[1]) {
        dataSets[0].label = unselectedAspects.join(", ");
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
    var c = this._chart;
    var nh = c.height() - $('.other-aspects').height() - 16;
    console.log("c.height " + c.height() + " od.heigh " + $('.other-aspects').height())
    console.log("Setting height to " + nh);
    $('.chart-container',c).height(nh);
    $('canvas',c).attr('height',nh).height(nh);

}
