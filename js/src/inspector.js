import $ from 'jquery'
import { formatNumber } from "./util.js";

import { ReportSearch } from "./search.js";

export function Inspector() {
    /* Insert HTML and CSS styles into body */
    $(require('html-loader!./inspector.html')).prependTo('body');
    var inspector_css = require('css-loader!less-loader!./inspector.less').toString(); 
    $('<style id="ixv-style">')
        .prop("type", "text/css")
        .text(inspector_css)
        .appendTo('head');
}

Inspector.prototype.setReport = function (report) {
    this._report = report;
    this._search = new ReportSearch(report);
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

Inspector.prototype._calculationHTML = function (fact) {
    var rels = this._report.getChildConcepts(fact.conceptName(), "calc")
    var tree = $("<ul></ul>")
    var report = this._report;
    var tableFacts = this._viewer.factsInSameTable(fact);
    console.log(tableFacts.length + " facts in same table");
    var bestMatchCount = 0;
    var bestMatchELR = "";
    var viewer = this._viewer;

    var conceptToFact = {};

    $.each(rels, function (elr, rr) {
        conceptToFact[elr] = {};
        if (rr.length > 0) {
            console.log(elr);
            var otherFacts = report.getAlignedFacts(fact, {"c": $.map(rr, function (r,i) { return r.t }) });
            console.log("other facts");
            console.log(otherFacts);
            var matchCount = 0;
            $.each(otherFacts, function (i,ff) {
                conceptToFact[elr][ff.conceptName()] = conceptToFact[elr][ff.conceptName()] || {};
                conceptToFact[elr][ff.conceptName()][ff.id] = ff;
                if ($.inArray(ff.id, tableFacts) > -1) {
                    matchCount++; 
                }
            });
            console.log(elr + " " + matchCount/rr.length)
            if (matchCount/rr.length > bestMatchCount) {
                bestMatchCount = matchCount/rr.length;    
                bestMatchELR = elr;
            }
        }
    });
    console.log("Best match: " + bestMatchELR);
    $.each(rels, function (elr, rr) {
        var item =  $("<li></li>");
        item.text(elr)
        var list = $("<ul></ul>");
        list.appendTo(item);
        
        $.each(rr, function (i,r) {
            var i = $("<li class=\"concept\"></li>");
            var s;
            if (r.w == 1) {
                s = '+';
            }
            else if (r.w == -1) {
                s = '-';
            }
            else {
                s = r.w;
            }
            i.text(s + ' ' + report.getLabel(r.t, "std"));
            var ff = conceptToFact[elr][r.t];
            if (ff) {
                i.data('ivid', ff);
                i.addClass("fact-link");
                i.click(function () { viewer.showAndSelectFact(Object.values(ff)[0] ) });
                i.mouseenter(function () { $.each(ff, function (k,f) { viewer.linkedHighlightFact(f); })});
                i.mouseleave(function () { $.each(ff, function (k,f) { viewer.clearLinkedHighlightFact(f); })});
                $.each(ff, function (k,f) { viewer.highlightRelatedFact(f); });
            }
            i.appendTo(list);
        });
        item.appendTo(tree);
    });
    return tree;
}

Inspector.prototype.viewerMouseEnter = function (id) {
    $('#calculation li.concept').filter(function () {   
        return $.inArray(id, $.map($(this).data('ivid'), function (f)  { return f.id })) > -1 
    }).addClass('linked-highlight');
}

Inspector.prototype.viewerMouseLeave = function (id) {
    $('#calculation li.concept').removeClass('linked-highlight');
}

Inspector.prototype.getPeriodIncrease = function (fact) {
    var viewer = this._viewer;
    console.log("getPeriodIncrease");
    var otherFacts = this._report.getAlignedFacts(fact, {"pt": null, "pf": null });
    console.log(otherFacts);
    var mostRecent;
    $.each(otherFacts, function (i, of) {
        if (of.periodTo() < fact.periodTo() && (!mostRecent || of.periodTo() > mostRecent.periodTo()) ) {
            mostRecent = of;
        }
    });
    var s = "";
    if (mostRecent) {
        console.log(mostRecent.value() + " => " + fact.value());
        if (fact.value() > 0 == mostRecent.value() > 0) {
            var x = (fact.value() - mostRecent.value()) * 100 / mostRecent.value();
            var t;
            if (x > 0) {
                t = formatNumber(x,1) + "% increase on ";
            }
            else {
                t = formatNumber(-1 * x,1) + "% decrease on ";
            }
            s = $("<span></span>").text(t + mostRecent.periodTo())
                .addClass("year-on-year-fact-link")
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

Inspector.prototype.selectFact = function (id) {
    var fact = this._report.getFactById(id);
    $('#std-label').text(fact.getLabel("std") || fact.conceptName());
    $('#documentation').text(fact.getLabel("doc") || "");
    $('#concept').text(fact.conceptName());
    $('#period').text(fact.periodString());
    $('#calculation .tree').html(this._calculationHTML(fact, "calc"));
    var v = fact.value();
    if (fact.isMonetaryValue()) {
        v = fact.unit().localname + " " + formatNumber(v,2);
    }
    else if (fact.unit()) {
        v = v + " " + fact.unit().qname;
    }
    $('#value').text(v);
    $('#dimensions').empty();
    var dims = fact.dimensions();
    for (var d in dims) {
        var x = $('<div class="dimension">').text(this._report.getLabel(d, "std") || d);
        x.appendTo('#dimensions');
        x = $('<div class="dimension-value">').text(this._report.getLabel(dims[d], "std") || dims[d]);
        x.appendTo('#dimensions');
        
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
