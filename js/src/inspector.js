import $ from 'jquery'
import { formatNumber } from "./util.js";

import { ReportSearch } from "./search.js";
import { Calculation } from "./calculations.js";
import { IXBRLChart } from './chart.js';

export function Inspector() {
    /* Insert HTML and CSS styles into body */
    $(require('html-loader!./inspector.html')).prependTo('body');
    var inspector_css = require('css-loader!less-loader!./inspector.less').toString(); 
    $('<style id="ixv-style">')
        .prop("type", "text/css")
        .text(inspector_css)
        .appendTo('head');
    this._chart = new IXBRLChart();
}

Inspector.prototype.setReport = function (report) {
    this._report = report;
    this._search = new ReportSearch(report);
    var inspector = this;
    var langSelect = $('#ixbrl-language-select');
    var dl = this.selectDefaultLanguage();
    inspector.setLanguage(dl);
    langSelect.empty();
    $.each(report.availableLanguages(), function (i,l) {
        var o = $('<option>').text(l).appendTo(langSelect);
        if (l == dl) {
            o.attr("selected","selected");
        }
    });
    langSelect.change(function () { inspector.setLanguage($(this).val()) });
}


Inspector.prototype.setViewer = function (viewer) {
    this._viewer = viewer;
    var inspector = this;
    viewer.onSelect(function (id) { inspector.selectFact(id) });
    viewer.onMouseEnter(function (id) { inspector.viewerMouseEnter(id) });
    viewer.onMouseLeave(function (id) { inspector.viewerMouseLeave(id) });
    $('#ixbrl-next-tag').click(function () { viewer.selectNextTag() } );
    $('#ixbrl-prev-tag').click(function () { viewer.selectPrevTag() } );

    $('#ixbrl-show-all-tags').change(function(e){ viewer.highlightAllTags(this.checked) });
    $('#ixbrl-search').keyup(function () { inspector.search($(this).val()) });
}


Inspector.prototype.search = function (s) {
    var results = this._search.search(s);
    var viewer = this._viewer;
    $('#ixbrl-search-results tr').remove();
    $.each(results, function (i,r) {
        var row = $('<tr><td></td></tr>');
        row.find("td").text(r.fact.getLabel("std") + " (" + r.score + ")" );
        row.data('ivid', r.fact.id);
        row.appendTo('#ixbrl-search-results');
        row.click(function () { viewer.showAndSelectFact(r.fact) });
    });
    
}

Inspector.prototype.updateCalculation = function (fact, elr) {
    $('#calculation .tree').html(this._calculationHTML(fact, elr));
}

Inspector.prototype._calculationHTML = function (fact, elr) {
    var calc = new Calculation(fact);
    if (!calc.hasCalculations()) {
        return "";
    }
    var tableFacts = this._viewer.factsInSameTable(fact);
    if (!elr) {
        elr = calc.bestELRForFactSet(tableFacts);
    }
    var rCalc = calc.resolvedCalculation(elr);
    var report = this._report;
    var viewer = this._viewer;
    var inspector = this;
    var html = $("<div></div>");
    var select = $("<select></select>").appendTo(html)
        .change(function () { inspector.updateCalculation(fact, $(this).val())  });
    $.each(calc.elrs(), function (e, label) {
        var o = $("<option>").attr("value", e).text(label).appendTo(select);
        if (e == elr) {
            o.attr("selected", "selected");
        }  
    });

    $.each(rCalc, function (i, r) {
        var itemHTML = $("<div></div>")
            .addClass("item")
            .append($("<span>").addClass("weight").text(r.weightSign + " "))
            .append($("<span>").addClass("concept-name").text(report.getLabel(r.concept, "std")))
            .appendTo(html);
        if (r.facts) {
            itemHTML.addClass("fact-link");
            itemHTML.data('ivid', r.facts);
            itemHTML.click(function () { viewer.showAndSelectFact(Object.values(r.facts)[0] ) });
            itemHTML.mouseenter(function () { $.each(r.facts, function (k,f) { viewer.linkedHighlightFact(f); })});
            itemHTML.mouseleave(function () { $.each(r.facts, function (k,f) { viewer.clearLinkedHighlightFact(f); })});
            $.each(r.facts, function (k,f) { viewer.highlightRelatedFact(f); });
        }
    });
    $("<div>").addClass("item").addClass("total")
        .append($("<span>").addClass("weight"))
        .append($("<span>").addClass("concept-name").text(fact.getLabel("std")))
        .appendTo(html);
    return html;
}

Inspector.prototype.viewerMouseEnter = function (id) {
    $('#calculation .item').filter(function () {   
        return $.inArray(id, $.map($(this).data('ivid'), function (f)  { return f.id })) > -1 
    }).addClass('linked-highlight');
}

Inspector.prototype.viewerMouseLeave = function (id) {
    $('#calculation .item').removeClass('linked-highlight');
}

Inspector.prototype.getPeriodIncrease = function (fact) {
    var viewer = this._viewer;
    var otherFacts = this._report.getAlignedFacts(fact, {"p":null });
    var mostRecent;
    $.each(otherFacts, function (i, of) {
        if (of.periodTo() < fact.periodTo() && (!mostRecent || of.periodTo() > mostRecent.periodTo()) ) {
            mostRecent = of;
        }
    });
    var s = "";
    if (mostRecent) {
        if (fact.value() > 0 == mostRecent.value() > 0) {
            var x = (fact.value() - mostRecent.value()) * 100 / mostRecent.value();
            var t;
            if (x > 0) {
                t = formatNumber(x,1) + "% increase on ";
            }
            else {
                t = formatNumber(-1 * x,1) + "% decrease on ";
            }
            s = $("<span>").text(t);
            $("<span></span>").text(mostRecent.periodTo())
            .addClass("year-on-year-fact-link")
            .appendTo(s)
            .click(function () { viewer.showAndSelectFact(mostRecent) })
            .mouseenter(function () {  viewer.linkedHighlightFact(mostRecent); })
            .mouseleave(function () {  viewer.clearLinkedHighlightFact(mostRecent); });

        }
        else {
            s = "(change n/a)";
        }
    }
    $("#period-comparison").html(s);

}

Inspector.prototype.update = function () {
    if (this._currentFact) {
        var fact = this._currentFact;
        var inspector = this;
        $('#std-label').text(fact.getLabel("std") || fact.conceptName());
        $('#documentation').text(fact.getLabel("doc") || "");
        $('#concept').text(fact.conceptName());
        $('#period')
            .text(fact.periodString())
            .append(
                $("<span>") 
                    .addClass("analyse")
                    .text("")
                    .click(function () {
                        inspector._chart.analyseDimension(fact,["p"])
                    })
            );
        this.updateCalculation(fact);
        var v = fact.value();
        if (fact.isMonetaryValue()) {
            v = fact.unit().valueLabel() + " " + formatNumber(v,2);
        }
        else if (fact.unit()) {
            v = v + " " + fact.unit().qname;
        }
        $('#value').text(v);
        $('#dimensions').empty();
        var dims = fact.dimensions();
        for (var d in dims) {
            (function(d) {
                $('<div class="dimension">')
                    .text(fact.report().getLabel(d, "std") || d)
                    .append(
                        $("<span>") 
                            .addClass("analyse")
                            .text("")
                            .click(function () {
                                inspector._chart.analyseDimension(fact,[d])
                            })
                    )
                    .appendTo('#dimensions');
            })(d); 
            $('<div class="dimension-value">')
                .text(this._report.getLabel(dims[d], "std") || dims[d])
                .appendTo('#dimensions');
            
        }
        $('#ixbrl-search-results tr').removeClass('selected');
        $('#ixbrl-search-results tr').filter(function () { return $(this).data('ivid') == id }).addClass('selected');

        var duplicates = fact.duplicates();
        var n = 0;
        var ndup = duplicates.length;
        for (var i = 0; i < ndup; i++) {
            if (fact.id == duplicates[i].id) {
                n = i;
            }
        }
        $('#duplicates .text').text((n + 1) + " of " + ndup);
        var viewer = this._viewer;
        $('#duplicates .prev').off().click(function () { viewer.showAndSelectFact(duplicates[(n+ndup-1) % ndup])});
        $('#duplicates .next').off().click(function () { viewer.showAndSelectFact(duplicates[(n+1) % ndup])});

        this.getPeriodIncrease(fact);

    }
    

}

Inspector.prototype.selectFact = function (id) {
    this._currentFact = this._report.getFactById(id);
    this.update();
}


Inspector.prototype.selectDefaultLanguage = function () {
    var preferredLanguages = window.navigator.languages || [ window.navigator.language || window.navigator.userLanguage ] ;
    var al = this._report.availableLanguages();
    $.each(preferredLanguages, function (i, pl) {
        $.each(al, function (j, l) {
            if (l.toLowerCase() == pl.toLowerCase()) {
                return l;
            }
        });
    });
    return this._report.availableLanguages()[0];
}

Inspector.prototype.setLanguage = function (lang) {
    this._language = lang;
    this._report.setLanguage(lang);
    this.update();
}
