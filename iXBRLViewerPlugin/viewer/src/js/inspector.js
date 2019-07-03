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

import $ from 'jquery'
import { formatNumber, wrapLabel } from "./util.js";
import { ReportSearch } from "./search.js";
import { Calculation } from "./calculations.js";
import { IXBRLChart } from './chart.js';
import { ViewerOptions } from './viewerOptions.js';
import { Identifiers } from './identifiers.js';
import { Menu } from './menu.js';
import { Accordian } from './accordian.js';
import { FactSet } from './factset.js';

export function Inspector() {
    /* Insert HTML and CSS styles into body */
    $(require('../html/inspector.html')).prependTo('body');
    var inspector_css = require('css-loader!less-loader!../less/inspector.less').toString(); 
    $('<style id="ixv-style"></style>')
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
    this._optionsMenu = new Menu($("#display-options-menu"));
    this.buildDisplayOptionsMenu();

    var inspector = this;
    // Listen to messages posted to this window
    $(window).on("message", function(e) { inspector.handleMessage(e) });
}

Inspector.prototype.setReport = function (report) {
    this._report = report;
    report.setViewerOptions(this._viewerOptions);
    this._search = new ReportSearch(report);
    this.buildDisplayOptionsMenu();
}


Inspector.prototype.setViewer = function (viewer) {
    this._viewer = viewer;
    var inspector = this;
    viewer.onSelect.add(function (id, eltSet) { inspector.selectFact(id, eltSet) });
    viewer.onMouseEnter.add(function (id) { inspector.viewerMouseEnter(id) });
    viewer.onMouseLeave.add(function (id) { inspector.viewerMouseLeave(id) });
    $('.ixbrl-next-tag').click(function () { viewer.selectNextTag() } );
    $('.ixbrl-prev-tag').click(function () { viewer.selectPrevTag() } );

    //$('#ixbrl-search').keyup(function () { inspector.search($(this).val()) });
    $('#ixbrl-search').change(function () { inspector.search($(this).val()) });

    $('#top-bar .document-title').text(this._viewer.getTitle());
}

/*
 * Check for fragment identifier pointing to a specific fact and select it if
 * present.
 */
Inspector.prototype.handleFactDeepLink = function () {
    if (location.hash.startsWith("#f-")) {
        this.selectFact(location.hash.slice(3));
    }
}

Inspector.prototype.handleMessage = function (event) {
    var jsonString = event.originalEvent.data;
    var data = JSON.parse(jsonString);

    if (data.task == 'SHOW_FACT') {
        this.selectFact(data.factId);
    }
    else {
        console.log("Not handling unsupported task message: " + jsonString);
    }
}

Inspector.prototype.updateURLFragment = function () {
    if (this._currentFact) {
        location.hash = "#f-" + this._currentFact.id;
    }
}

Inspector.prototype.buildDisplayOptionsMenu = function () {
    var inspector = this;
    this._optionsMenu.reset();
    this._optionsMenu.addCheckboxItem("Highlight", function (checked) { inspector.highlightAllTags(checked)});
    if (this._report) {
        var dl = this.selectDefaultLanguage();
        this._optionsMenu.addCheckboxGroup(this._report.availableLanguages(), this._report.languageNames(), dl, function (lang) { inspector.setLanguage(lang) });
        this.setLanguage(dl);
    }

}

Inspector.prototype.highlightAllTags = function (checked) {
    var inspector = this;
    this._viewer.highlightAllTags(checked, inspector._report.namespaceGroups());
}


Inspector.prototype.search = function (s) {
    var results = this._search.search(s);
    var viewer = this._viewer;
    var inspector = this;
    var table = $('#inspector .search table.results');
    $('tr', table).remove();
    viewer.clearRelatedHighlighting();
    $.each(results, function (i,r) {
        if (i < 100) {
            var row = $('<tr></tr>')
                .click(function () { inspector.selectFact(r.fact.id) })
                .mouseenter(function () { viewer.linkedHighlightFact(r.fact); })
                .mouseleave(function () { viewer.clearLinkedHighlightFact(r.fact); })
                .data('ivid', r.fact.id)
                .appendTo($("tbody", table));
            $('<td></td>')
                .text(r.fact.getLabel("std")) // + " (" + r.score + ")" );
                .appendTo(row);
        }
    });
    viewer.highlightRelatedFacts($.map(results, function (r) { return r.fact } ));
}

Inspector.prototype.updateCalculation = function (fact, elr) {
    $('.calculations .tree').empty().append(this._calculationHTML(fact, elr));
}

Inspector.prototype._referencesHTML = function (fact) {
    var c = fact.concept();
    var a = new Accordian();
    $.each(fact.concept().references(), function (i,r) {
        var title = $("<span></span>").text(r[0].value);
        var body =  $('<table class="fact-properties"><tbody></tbody></table>')
        var tbody = body.find("tbody");
        $.each(r, function (j,p) {
            var row = $("<tr>")
                .append($("<th></th>").text(p.part))
                .append($("<td></td>").text(p.value))
                .appendTo(tbody);
            if (p.part == 'URI') {
                row.addClass("uri");
                row.find("td").wrapInner($("<a>").attr("href",p.value));
            }
        });
        a.addCard(title, body, i == 0);
    });
    return a.contents();
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
    var report = this._report;
    var viewer = this._viewer;
    var inspector = this;
    var a = new Accordian();

    $.each(calc.elrs(), function (e, rolePrefix) {
        var label = report.getRoleLabel(rolePrefix, inspector._viewerOptions);

        var rCalc = calc.resolvedCalculation(e);
        var calcBody = $('<div></div>');
        $.each(rCalc, function (i, r) {
            var itemHTML = $("<div></div>")
                .addClass("item")
                .append($("<span></span>").addClass("weight").text(r.weightSign + " "))
                .append($("<span></span>").addClass("concept-name").text(report.getLabel(r.concept, "std")))
                .appendTo(calcBody);

            if (r.facts) {
                itemHTML.addClass("fact-link");
                itemHTML.data('ivid', r.facts);
                itemHTML.click(function () { inspector.selectFact(Object.values(r.facts)[0].id ) });
                itemHTML.mouseenter(function () { $.each(r.facts, function (k,f) { viewer.linkedHighlightFact(f); })});
                itemHTML.mouseleave(function () { $.each(r.facts, function (k,f) { viewer.clearLinkedHighlightFact(f); })});
                $.each(r.facts, function (k,f) { viewer.highlightRelatedFact(f); });
            }
        });
        $("<div></div>").addClass("item").addClass("total")
            .append($("<span></span>").addClass("weight"))
            .append($("<span></span>").addClass("concept-name").text(fact.getLabel("std")))
            .appendTo(calcBody);

        a.addCard($("<span></span>").text(label), calcBody, e == elr);

    });
    return a.contents();
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
    var inspector = this;
    if (fact.isNumeric()) {
        var otherFacts = this._report.getAlignedFacts(fact, {"p":null });
        var mostRecent;
        if (fact.periodTo()) {
            $.each(otherFacts, function (i, of) {
                if (of.periodTo() && of.periodTo() < fact.periodTo() && (!mostRecent || of.periodTo() > mostRecent.periodTo()) && fact.isEquivalentDuration(of)) {
                    mostRecent = of;
                }
            });
        }
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
            .click(function () { inspector.selectFact(mostRecent.id) })
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

Inspector.prototype._updateValue = function (fact, showAll, context) {
    var inspector = this;
    var v = fact.readableValue();
    if (!showAll) {
        var fullLabel = v;
        var vv = wrapLabel(v, 120);
        if (vv.length > 1) {
            $('tr.value', context).addClass("truncated");
            $('tr.value .show-all', context).off().click(function () { inspector._updateValue(fact, true); });
        }
        else {
            $('tr.value', context).removeClass('truncated');
        }
        v = vv[0];
    }
    else {
        $('tr.value', context).removeClass('truncated');
    }

    $('tr.value td .value', context).text(v);
}

Inspector.prototype._updateEntityIdentifier = function (fact, context) {
    var url = Identifiers.identifierURLForFact(fact);
    var cell = $('tr.entity-identifier td', context);
    cell.empty();
    if (url) {
        $('<span></span>').text('['+Identifiers.identifierNameForFact(fact) + "] ").appendTo(cell)
        $('<a target="_blank"></a>').attr('href',url).text(fact.identifier().localname).appendTo(cell)
    }
    else {
        cell.text(fact.f.a.e);
    }
}

Inspector.prototype.update = function () {
    var inspector = this;
    var cf = inspector._currentFact;
    if (cf) {
        $('#inspector .fact-inspector').empty();
        var a = new Accordian({
            onSelect: function (id) { 
                inspector.switchFact(id);
            }, 
            alwaysOpen: true,
            dissolveSingle: true,
        });
        var fs = new FactSet(this._currentFactList);
        $.each(inspector._currentFactList, function (i, fact) {
            var factHTML = $(require('../html/fact-details.html')); 
            $('.std-label', factHTML).text(fact.getLabel("std", true) || fact.conceptName());
            $('.documentation', factHTML).text(fact.getLabel("doc") || "");
            $('tr.concept td', factHTML).text(fact.conceptName());
            $('tr.period td', factHTML)
                .text(fact.periodString());
            if (fact.isNumeric()) {
                $('tr.period td', factHTML).append(
                    $("<span></span>") 
                        .addClass("analyse")
                        .text("")
                        .click(function () {
                            inspector._chart.analyseDimension(fact,["p"])
                        })
                );
            }
            inspector._updateEntityIdentifier(fact, factHTML);
            inspector._updateValue(fact, false, factHTML);
            $('tr.accuracy td', factHTML).text(fact.readableAccuracy());
            $('#dimensions', factHTML).empty();
            var dims = fact.dimensions();
            for (var d in dims) {
                var h = $('<div class="dimension"></div>')
                    .text(fact.report().getLabel(d, "std", true) || d)
                    .appendTo($('#dimensions', factHTML));
                if (fact.isNumeric()) {
                    h.append(
                        $("<span></span>") 
                            .addClass("analyse")
                            .text("")
                            .click(function () {
                                inspector._chart.analyseDimension(fact,[d])
                            })
                    )
                }
            }
            a.addCard(
                fs.minimallyUniqueLabel(fact),
                factHTML.children(), 
                fact.id == cf.id,
                fact.id
            );
        });

        a.contents().appendTo('#inspector .fact-inspector');
        this.updateCalculation(cf);
        $('div.references').empty().append(this._referencesHTML(cf));
        $('#inspector .search .results tr').removeClass('selected');
        $('#inspector .search .results tr').filter(function () { return $(this).data('ivid') == cf.id }).addClass('selected');

        var duplicates = cf.duplicates();
        var n = 0;
        var ndup = duplicates.length;
        for (var i = 0; i < ndup; i++) {
            if (cf.id == duplicates[i].id) {
                n = i;
            }
        }
        $('.duplicates .text').text((n + 1) + " of " + ndup);
        var viewer = this._viewer;
        $('.duplicates .prev').off().click(function () { inspector.selectFact(duplicates[(n+ndup-1) % ndup].id)});
        $('.duplicates .next').off().click(function () { inspector.selectFact(duplicates[(n+1) % ndup].id)});

        this.getPeriodIncrease(cf);

    }
    this.updateURLFragment();
}

/*
 * Select a fact from the report.
 *
 * Takes a fact ID to select and an optional list of "alternate" facts, which
 * will be presented in an accordian.  This is used when the user clicks on a
 * nested fact in the viewer, so that all facts corresponding to the area
 * clicked are shown.
 *
 * If factIdList is omitted, the currently selected fact list is reset to just
 * the primary fact.
 */
Inspector.prototype.selectFact = function (id, factIdList) {
    if (factIdList === undefined) {
        this._currentFactList = [ this._report.getFactById(id) ];
    }
    else {
        this._currentFactList = [];
        for (var i = 0; i < factIdList.length; i++) {
            this._currentFactList.push(this._report.getFactById(factIdList[i]));
        }
    }
    this.switchFact(id);
}

/*
 * Switches the currently selected fact.  Unlike selectFact, this does not
 * change the current list of "alternate" facts.  The fact "id" must be in the
 * current fact list.
 */
Inspector.prototype.switchFact = function (id) {
    this._currentFact = this._report.getFactById(id);
    this._viewer.showFactById(id);
    this._viewer.highlightFact(id);
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
