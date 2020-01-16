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
        doc.ref = f.concept().referenceValuesAsString();
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

    if (s == "") {
        return [];
    }

    rr.forEach((r,i) => 
        results.push({
            "fact": searchIndex._report.getItemById(r.ref),
            "score": r.score
        })
    );
    return results;
}
