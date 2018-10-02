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
    $.each(rels, function (elr, rr) {
        var item =  $("<li></li>");
        item.text(elr)
        var list = $("<ul></ul>");
        list.appendTo(item);
        
        $.each(rr, function (i,r) {
            var i = $("<li></li>");
            i.text(report.getLabel(r, "std"));
            i.appendTo(list)
        });
        item.appendTo(tree);
    });
    return tree;
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


    var rels = this._report.getChildConcepts(fact.conceptName(), "calc")
    if (Object.keys(rels).length > 0) {
        var elr = Object.keys(rels)[0];
        var otherFacts = this._report.getAlignedFacts(fact, {"c": rels[elr] });
        $.each(otherFacts, function (i,ff) {
            viewer.highlightRelatedFact(ff);
        });
    }


}
