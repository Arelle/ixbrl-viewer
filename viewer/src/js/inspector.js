import $ from 'jquery'
import { formatNumber, wrapLabel } from "./util.js";

import { ReportSearch } from "./search.js";
import { Calculation } from "./calculations.js";
import { IXBRLChart } from './chart.js';
import { ViewerOptions } from './viewerOptions.js';
import { Identifiers } from './identifiers.js';

export function Inspector() {
    /* Insert HTML and CSS styles into body */
    $(require('html-loader!../html/inspector.html')).prependTo('body');
    var inspector_css = require('css-loader!less-loader!../less/inspector.less').toString(); 
    $('<style id="ixv-style">')
        .prop("type", "text/css")
        .text(inspector_css)
        .appendTo('head');
    this._chart = new IXBRLChart();
    this._viewerOptions = new ViewerOptions()

    
    $(".collapsible-header").click(function () { 
        var d = $(this).closest(".collapsible-section");
        d.toggleClass("collapsed"); 
        if (d.hasClass("collapsed")) {
            d.find(".collapsible-body").slideUp(250);
        }
        else {
            d.find(".collapsible-body").slideDown(250);
        }
    });
}

Inspector.prototype.setReport = function (report) {
    this._report = report;
    report.setViewerOptions(this._viewerOptions);
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
    viewer.onSelect.add(function (id) { inspector.selectFact(id) });
    viewer.onMouseEnter.add(function (id) { inspector.viewerMouseEnter(id) });
    viewer.onMouseLeave.add(function (id) { inspector.viewerMouseLeave(id) });
    $('.ixbrl-next-tag').click(function () { viewer.selectNextTag() } );
    $('.ixbrl-prev-tag').click(function () { viewer.selectPrevTag() } );

    $('#ixbrl-show-all-tags').change(function(e){ viewer.highlightAllTags(this.checked, inspector._report.namespaceGroups()) });
    //$('#ixbrl-search').keyup(function () { inspector.search($(this).val()) });
    $('#ixbrl-search').change(function () { inspector.search($(this).val()) });
}


Inspector.prototype.search = function (s) {
    var results = this._search.search(s);
    var viewer = this._viewer;
    var table = $('#inspector .search table.results');
    $('tr', table).remove();
    viewer.clearRelatedHighlighting();
    $.each(results, function (i,r) {
        viewer.highlightRelatedFact(r.fact);
        var row = $('<tr>')
            .click(function () { viewer.showAndSelectFact(r.fact) })
            .mouseenter(function () { viewer.linkedHighlightFact(r.fact); })
            .mouseleave(function () { viewer.clearLinkedHighlightFact(r.fact); })
            .data('ivid', r.fact.id)
            .appendTo($("tbody", table));
        $('<td>')
            .text(r.fact.getLabel("std")) // + " (" + r.score + ")" );
            .appendTo(row);

    });
    
}

Inspector.prototype.updateCalculation = function (fact, elr) {
    $('.calculations .tree').html(this._calculationHTML(fact, elr));
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
    $('.calculations .item').filter(function () {   
        return $.inArray(id, $.map($(this).data('ivid'), function (f)  { return f.id })) > -1 
    }).addClass('linked-highlight');
    $('#inspector .search .results tr').filter(function () {   
        return $(this).data('ivid') == id;
    }).addClass('linked-highlight');
}

Inspector.prototype.viewerMouseLeave = function (id) {
    $('.calculations .item').removeClass('linked-highlight');
    $('#inspector .search .results tr').removeClass('linked-highlight');
}

Inspector.prototype.getPeriodIncrease = function (fact) {
    var viewer = this._viewer;
    if (fact.isNumeric()) {
        var otherFacts = this._report.getAlignedFacts(fact, {"p":null });
        var mostRecent;
        $.each(otherFacts, function (i, of) {
            if (of.periodTo() < fact.periodTo() && (!mostRecent || of.periodTo() > mostRecent.periodTo()) && fact.isEquivalentDuration(of) ) {
                mostRecent = of;
            }
        });
        var s = "";
        if (mostRecent) {
            var allMostRecent = this._report.getAlignedFacts(mostRecent);
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
            }
            else {
                s = $("<span>").text("From " + mostRecent.readableValue() + " in "); 
            }

            $("<span></span>").text(mostRecent.periodString())
            .addClass("year-on-year-fact-link")
            .appendTo(s)
            .click(function () { viewer.showAndSelectFact(mostRecent) })
            .mouseenter(function () {  $.each(allMostRecent, function (i,f) { viewer.linkedHighlightFact(f);} ) })
            .mouseleave(function () {  $.each(allMostRecent, function (i,f) { viewer.clearLinkedHighlightFact(f);} ) });

        }
        else {
            s = $("<i>").text("No prior fact");
        }
    }
    else {
        s = $("<i>").text("n/a").attr("title", "non-numeric fact");
    }
    $(".fact-properties tr.change td").html(s);

}

Inspector.prototype._updateValue = function (fact, showAll) {
    var inspector = this;
    var v = fact.readableValue();
    if (!showAll) {
        var fullLabel = v;
        var vv = wrapLabel(v, 120);
        if (vv.length > 1) {
            $('#inspector tr.value').addClass("truncated");
            $('#inspector tr.value .show-all').off().click(function () { inspector._updateValue(fact, true); });
        }
        else {
            $('#inspector tr.value').removeClass('truncated');
        }
        v = vv[0];
    }
    else {
        $('#inspector tr.value').removeClass('truncated');
    }

    $('tr.value td .value').text(v);
}

Inspector.prototype._updateEntityIdentifier = function (fact) {
    var url = Identifiers.identifierURLForFact(fact);
    var cell = $('tr.entity-identifier td');
    cell.empty();
    if (url) {
        $('<span>').text('['+Identifiers.identifierNameForFact(fact) + "] ").appendTo(cell)
        $('<a target="_blank">').attr('href',url).text(fact.identifier().localname).appendTo(cell)
    }
    else {
        cell.text(fact.f.a.e);
    }
}

Inspector.prototype.update = function () {
    if (this._currentFact) {
        $('#inspector .no-fact-selected').hide();
        $('#inspector .fact-details').show();
        var fact = this._currentFact;
        var inspector = this;
        $('.std-label').text(fact.getLabel("std", true) || fact.conceptName());
        $('.documentation').text(fact.getLabel("doc") || "");
        $('tr.concept td').text(fact.conceptName());
        $('tr.period td')
            .text(fact.periodString())
            .append(
                $("<span>") 
                    .addClass("analyse")
                    .text("")
                    .click(function () {
                        inspector._chart.analyseDimension(fact,["p"])
                    })
            );
        this._updateEntityIdentifier(fact);
        this.updateCalculation(fact);
        this._updateValue(fact);
        $('tr.accuracy td').text(fact.readableAccuracy());
        $('#dimensions').empty();
        var dims = fact.dimensions();
        for (var d in dims) {
            (function(d) {
                $('<div class="dimension">')
                    .text(fact.report().getLabel(d, "std", true) || d)
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
                .text(this._report.getLabel(dims[d], "std", true) || dims[d])
                .appendTo('#dimensions');
            
        }
        $('#inspector .search .results tr').removeClass('selected');
        $('#inspector .search .results tr').filter(function () { return $(this).data('ivid') == fact.id }).addClass('selected');

        var duplicates = fact.duplicates();
        var n = 0;
        var ndup = duplicates.length;
        for (var i = 0; i < ndup; i++) {
            if (fact.id == duplicates[i].id) {
                n = i;
            }
        }
        $('.duplicates .text').text((n + 1) + " of " + ndup);
        var viewer = this._viewer;
        $('.duplicates .prev').off().click(function () { viewer.showAndSelectFact(duplicates[(n+ndup-1) % ndup])});
        $('.duplicates .next').off().click(function () { viewer.showAndSelectFact(duplicates[(n+1) % ndup])});

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
    this._viewerOptions.language = lang;
    this.update();
}
