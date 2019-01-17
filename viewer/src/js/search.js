import lunr from 'lunr'
import $ from 'jquery'

export function ReportSearch (report) {
    this._report = report;
    this.buildSearchIndex();
}

ReportSearch.prototype.buildSearchIndex = function () {
    var docs = [];
    var dims = {};
    var facts = this._report.facts();
    for (var i = 0; i < facts.length; i++) {
        var f = facts[i];
        var doc = { "id": f.id };
        var l = f.getLabel("std");
        doc.doc = f.getLabel("doc");
        doc.date = f.periodTo();
        doc.startDate = f.periodFrom();
        var dims = f.dimensions();
        for (var d in dims) {
            l += " " + this._report.getLabel(dims[d],"std");
        }
        doc.label = l;
        doc.ref = f.concept().references();
        docs.push(doc);
    }
    this._searchIndex = lunr(function () {
      this.ref('id');
      this.field('label');
      this.field('startDate');
      this.field('date');
      this.field('doc');
      this.field('ref');

      docs.forEach(function (doc) {
        this.add(doc);
      }, this)
    })
}

ReportSearch.prototype.search = function(s) {
    var rr = this._searchIndex.search(s);
    var results = []
    var searchIndex = this;

    $.each(rr, function (i,r) {
        results.push({
            "fact": searchIndex._report.getFactById(r.ref),
            "score": r.score
        });
    })
    return results;
}
