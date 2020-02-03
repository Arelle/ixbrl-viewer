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
import { formatNumber, wrapLabel, truncateLabel } from "./util.js";
import { ReportSearch } from "./search.js";
import { Calculation } from "./calculations.js";
import { IXBRLChart } from './chart.js';
import { ViewerOptions } from './viewerOptions.js';
import { Identifiers } from './identifiers.js';
import { Menu } from './menu.js';
import { Accordian } from './accordian.js';
import { FactSet } from './factset.js';
import { Fact } from './fact.js';
import { Footnote } from './footnote.js';

export function Inspector(iv) {
    /* Insert HTML and CSS styles into body */
    $(require('../html/inspector.html')).prependTo('body');
    var inspector_css = require('css-loader!less-loader!../less/inspector.less').toString(); 
    $('<style id="ixv-style"></style>')
        .prop("type", "text/css")
        .text(inspector_css)
        .appendTo('head');
    $('<link id="ixv-favicon" type="image/x-icon" rel="shortcut icon" />')
        .attr('href', require('../img/favicon.ico'))
        .appendTo('head');
    this._iv = iv;
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
    $("#inspector .controls .search-button").click(function () {
        $(this).closest("#inspector").toggleClass("search-mode");
    });
    $("#inspector #ixbrl-controls-top .back").click(function () {
        $(this).closest("#inspector").removeClass("search-mode");
    });
    this._optionsMenu = new Menu($("#display-options-menu"));
    this.buildDisplayOptionsMenu();

    var inspector = this;
    // Listen to messages posted to this window
    $(window).on("message", function(e) { inspector.handleMessage(e) });
}

Inspector.prototype.initialize = function (report) {
    var inspector = this;
    return new Promise(function (resolve, reject) {
        inspector._report = report;
        report.setViewerOptions(inspector._viewerOptions);
        inspector._iv.setProgress("Building search index").then(() => {
            inspector._search = new ReportSearch(report);
            inspector.buildDisplayOptionsMenu();
            resolve();
        });
    });
}

Inspector.prototype.setViewer = function (viewer) {
    this._viewer = viewer;
    var inspector = this;
    viewer.onSelect.add(function (id, eltSet) { inspector.selectItem(id, eltSet) });
    viewer.onMouseEnter.add(function (id) { inspector.viewerMouseEnter(id) });
    viewer.onMouseLeave.add(function (id) { inspector.viewerMouseLeave(id) });
    $('.ixbrl-next-tag').click(function () { viewer.selectNextTag() } );
    $('.ixbrl-prev-tag').click(function () { viewer.selectPrevTag() } );
    $('#ixbrl-search').change(function () { inspector.search($(this).val()) });
}

/*
 * Check for fragment identifier pointing to a specific fact and select it if
 * present.
 */
Inspector.prototype.handleFactDeepLink = function () {
    if (location.hash.startsWith("#f-")) {
        this.selectItem(location.hash.slice(3));
    }
}

Inspector.prototype.handleMessage = function (event) {
    var jsonString = event.originalEvent.data;
    var data = JSON.parse(jsonString);

    if (data.task == 'SHOW_FACT') {
        this.selectItem(data.factId);
    }
    else {
        console.log("Not handling unsupported task message: " + jsonString);
    }
}

Inspector.prototype.updateURLFragment = function () {
    if (this._currentItem) {
        location.hash = "#f-" + this._currentItem.id;
    }
    else {
        location.hash = "";
    }
}

Inspector.prototype.buildDisplayOptionsMenu = function () {
    var inspector = this;
    this._optionsMenu.reset();
    this._optionsMenu.addCheckboxItem("Highlight", function (checked) { inspector.highlightAllTags(checked)}, "highlight-tags");
    if (this._report) {
        var dl = this.selectDefaultLanguage();
        this._optionsMenu.addCheckboxGroup(this._report.availableLanguages(), this._report.languageNames(), dl, function (lang) { inspector.setLanguage(lang) }, "select-language");
        this.setLanguage(dl);
    }
    this._iv.callPluginMethod("extendDisplayOptionsMenu", this._optionsMenu);

}

Inspector.prototype.highlightAllTags = function (checked) {
    var inspector = this;
    this._viewer.highlightAllTags(checked, inspector._report.namespaceGroups());
}

Inspector.prototype.factListRow = function(f) {
    var row = $('<div class="fact-list-item"></div>')
        .click(() => this.selectItem(f.id))
        .dblclick(function () { $('#inspector').removeClass("search-mode"); })
        .mousedown(function (e) { 
            /* Prevents text selection via double click without
             * disabling click+drag text selection (which user-select:
             * none would )
             */
            if (e.detail > 1) { 
                e.preventDefault() 
            } 
        })
        .mouseenter(() => this._viewer.linkedHighlightFact(f))
        .mouseleave(() => this._viewer.clearLinkedHighlightFact(f))
        .data('ivid', f.id);
    $('<div class="title"></div>')
        .text(f.getLabel("std") || f.conceptName())
        .appendTo(row);
    $('<div class="dimension"></div>')
        .text(f.period().toString())
        .appendTo(row);
    var dims = f.dimensions();
    for (var d in dims) {
        $('<div class="dimension"></div>')
            .text(f.report().getLabel(dims[d], "std", true) || dims[d])
            .appendTo(row);
    }
    return row;
}

Inspector.prototype.search = function (s) {
    var results = this._search.search(s);
    var viewer = this._viewer;
    var container = $('#inspector .search-results .results');
    $('div', container).remove();
    viewer.clearRelatedHighlighting();
    var overlay = $('#inspector .search-results .search-overlay');
    if (results.length > 0) {
        overlay.hide();
        $.each(results, (i,r) => {
            var f = r.fact;
            if (i < 100) {
                this.factListRow(f).appendTo(container);
            }
        });
    }
    else {
        if (s.trim() != "") {
            $(".title", overlay).text("No Match Found");
            $(".text", overlay).text("Try again with different keywords");
        }
        else {
            $(".title", overlay).text("Fact Search");
            $(".text", overlay).text("Please enter some search terms");
        }

        overlay.show();
    }
    viewer.highlightRelatedFacts($.map(results, function (r) { return r.fact } ));
}

Inspector.prototype.updateCalculation = function (fact, elr) {
    $('.calculations .tree').empty().append(this._calculationHTML(fact, elr));
}

Inspector.prototype.updateFootnotes = function (fact) {
    $('.footnotes').empty().append(this._footnotesHTML(fact));
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
                itemHTML.click(function () { inspector.selectItem(Object.values(r.facts)[0].id ) });
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

Inspector.prototype._footnotesHTML = function (fact) {
    var html = $("<div></div>");
    $.each(fact.footnotes(), (n, fn) => {
        $("<div></div>")
            .addClass("block-list-item")
            .appendTo(html)
            .text(truncateLabel(fn.textContent(), 120))
            .mouseenter(() => this._viewer.linkedHighlightFact(fn))
            .mouseleave(() => this._viewer.clearLinkedHighlightFact(fn))
            .click(() => this.selectItem(fn.id));
    });
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

Inspector.prototype.describeChange = function (oldFact, newFact) {
    if (newFact.value() > 0 == oldFact.value() > 0 && Math.abs(oldFact.value()) + Math.abs(newFact.value()) > 0) {
        var x = (newFact.value() - oldFact.value()) * 100 / oldFact.value();
        var t;
        if (x >= 0) {
            t = formatNumber(x,1) + "% increase on ";
        }
        else {
            t = formatNumber(-1 * x,1) + "% decrease on ";
        }
        return t;
    }
    else {
        return "From " + oldFact.readableValue() + " in "; 
    }

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
            s = $("<span></span>").text(this.describeChange(mostRecent, fact));
            $("<span></span>").text(mostRecent.periodString())
            .addClass("year-on-year-fact-link")
            .appendTo(s)
            .click(() => inspector.selectItem(mostRecent.id))
            .mouseenter(() => $.each(allMostRecent, (i,f) => viewer.linkedHighlightFact(f)))
            .mouseleave(() => $.each(allMostRecent, (i,f) => viewer.clearLinkedHighlightFact(f)));

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

Inspector.prototype._updateValue = function (text, showAll, context) {
    var v = text;
    if (!showAll) {
        var fullLabel = text;
        var vv = wrapLabel(text, 120);
        if (vv.length > 1) {
            $('tr.value', context).addClass("truncated");
            $('tr.value .show-all', context).off().click(() => this._updateValue(text, true, context));
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

Inspector.prototype._footnoteFactsHTML = function() {
    var html = $('<div></div>');
    this._currentItem.facts.forEach((fact) =>  {
        html.append(this.factListRow(fact));
    });
    return html;
}

/* 
 * Build an accordian containing a summary of all nested facts/footnotes
 * corresponding to the current viewer selection.
 */
Inspector.prototype._selectionSummaryAccordian = function() {
    var cf = this._currentItem;

    // dissolveSingle => title not shown if only one item in accordian
    var a = new Accordian({
        onSelect: (id) => this.switchItem(id),
        alwaysOpen: true,
        dissolveSingle: true,
    });

    var fs = new FactSet(this._currentItemList);
    $.each(this._currentItemList, (i, fact) => {
        var factHTML;
        var title = fs.minimallyUniqueLabel(fact);
        if (fact instanceof Fact) {
            factHTML = $(require('../html/fact-details.html')); 
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
                        .click(() => this._chart.analyseDimension(fact,["p"]))
                );
            }
            this._updateEntityIdentifier(fact, factHTML);
            this._updateValue(fact.readableValue(), false, factHTML);
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
                            .click(() => this._chart.analyseDimension(fact,[d]))
                    )
                }
                $('<div class="dimension-value"></div>')
                    .text(fact.report().getLabel(dims[d], "std", true) || dims[d])
                    .appendTo(h);
            }
        }
        else if (fact instanceof Footnote) {
            factHTML = $(require('../html/footnote-details.html')); 
            this._updateValue(fact.textContent(), false, factHTML);
        }
        a.addCard(
            title,
            factHTML, 
            fact.id == cf.id,
            fact.id
        );
    });
    return a;
}

Inspector.prototype.update = function () {
    var inspector = this;
    var cf = inspector._currentItem;
    if (!cf) {
        $('#inspector').removeClass('footnote-mode');
        $('#inspector .inspector-body').addClass('no-fact-selected');
    } 
    else { 
        $('#inspector .inspector-body').removeClass('no-fact-selected');

        $('#inspector .fact-inspector')
            .empty()
            .append(this._selectionSummaryAccordian().contents());

        if (cf instanceof Fact) {
            $('#inspector').removeClass('footnote-mode');

            this.updateCalculation(cf);
            this.updateFootnotes(cf);
            $('div.references').empty().append(this._referencesHTML(cf));
            $('#inspector .search-results .result').removeClass('selected');
            $('#inspector .search-results .result').filter(function () { return $(this).data('ivid') == cf.id }).addClass('selected');

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
            $('.duplicates .prev').off().click(() => inspector.selectItem(duplicates[(n+ndup-1) % ndup].id));
            $('.duplicates .next').off().click(() => inspector.selectItem(duplicates[(n+1) % ndup].id));

            this.getPeriodIncrease(cf);

        }
        else if (cf instanceof Footnote) {
            $('#inspector').addClass('footnote-mode');
            $('#inspector .footnote-details .footnote-facts').empty().append(this._footnoteFactsHTML());
        }
    }
    this.updateURLFragment();
}

/*
 * Select a fact or footnote from the report.
 *
 * Takes an ID of the item to select.  An optional list of "alternate"
 * fact/footnotes may be specified, which will be presented in an accordian.
 * This is used when the user clicks on a nested fact/footnote in the viewer,
 * so that all items corresponding to the area clicked are shown.
 *
 * If itemIdList is omitted, the currently selected item list is reset to just
 * the primary item.
 */
Inspector.prototype.selectItem = function (id, itemIdList) {
    if (itemIdList === undefined) {
        this._currentItemList = [ this._report.getItemById(id) ];
    }
    else {
        this._currentItemList = [];
        for (var i = 0; i < itemIdList.length; i++) {
            this._currentItemList.push(this._report.getItemById(itemIdList[i]));
        }
    }
    this.switchItem(id);
}

/*
 * Switches the currently selected item.  Unlike selectItem, this does not
 * change the current list of "alternate" items.  
 *
 * For facts, the "id" must be in the current alternate fact list.
 *
 * For footnotes, we currently only support a single footnote being selected.
 */
Inspector.prototype.switchItem = function (id) {
    if (id !== null) {
        this._currentItem = this._report.getItemById(id);
        this._viewer.showItemById(id);
        this._viewer.highlightItem(id);
    }
    else {
        this._currentItem = null;
        this._viewer.clearHighlighting();
    }
    this.update();
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
