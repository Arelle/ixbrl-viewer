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

import lunr from 'lunr'
import $ from 'jquery'

export function ReportSearch (report) {
    this._report = report;
    this.buildSearchIndex();
    this.searchString = '';
    this.showHiddenFacts = true;
    this.showVisibleFacts = true;
    this.periodFilter = '*';

}

ReportSearch.prototype.buildSearchIndex = function () {
    var docs = [];
    var dims = {};
    var facts = this._report.facts();
    this.periods = {};
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
        doc.ref = f.concept().referenceValuesAsString();
        docs.push(doc);

        var p = f.period();
        if (p) {
            this.periods[p.key()] = p.toString();
        }

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

ReportSearch.prototype.searchResults = function () {
    var rr = this._searchIndex.search(this.searchString);
    var results = []
    var searchIndex = this;

    if (this._searchString == "") {
        return [];
    }

    rr.forEach((r,i) => {
            var item = searchIndex._report.getItemById(r.ref);
            if (
                ((!item.isHidden() && this.showVisibleFacts) || (item.isHidden() && this.showHiddenFacts)) &&
                (this.periodFilter == '*' || item.period().key() == this.periodFilter)) {
                results.push({
                    "fact": item,
                    "score": r.score
                });
            }
        }
    );
    return results;
}
