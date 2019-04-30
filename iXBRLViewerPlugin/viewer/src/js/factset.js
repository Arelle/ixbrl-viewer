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

export function FactSet(facts) {
    this._facts = facts;
}

FactSet.prototype._allDimensions = function() {
    var dims = {};
    for (var i = 0; i < this._facts.length; i++) {
        var dd = Object.keys(this._facts[i].dimensions());
        for (var j = 0; j < dd.length; j++) {
            dims[dd[j]] = 1;
        }
    }
    return Object.keys(dims);
}

FactSet.prototype.minimallyUniqueLabel = function(fact) {
    if (!this._minimallyUniqueLabels) {
        var allLabels = {};
        var allDims = this._allDimensions();
        /* Assemble a map of arrays of all aspect labels for all facts, in a
         * consistent order */
        for (var i = 0; i < this._facts.length; i++) {
            var f = this._facts[i];
            allLabels[f.id] = [ f.getLabel(), f.period().toString() ];
            for (var j = 0; j < allDims.length; j++) {
                var dd = f.dimensions()[allDims[j]];
                allLabels[f.id].push(dd ? dd.valueLabel : "");
            }
        }
        /* Iterate each aspect label and compare that label across all facts in
         * the set */
        var uniqueLabels = {};
        for (var j = 0; j < allDims.length + 2; j++) {
            var labelMap = {};
            for (var i = 0; i < this._facts.length; i++) {
                labelMap[allLabels[this._facts[i].id][j]] = true;
            }

            /* We have at least some differences, so include this label */
            var uniqueLabelsByLabel = {};
            if (Object.keys(labelMap).length > 1) {
                for (var i = 0; i < this._facts.length; i++) {
                    var fid = this._facts[i].id;
                    var l = allLabels[fid][j];
                    uniqueLabels[fid] = (uniqueLabels[fid] === undefined ? l : uniqueLabels[fid] + ", " + l);
                    uniqueLabelsByLabel[uniqueLabels[fid]] = true;
                } 
                /* We have as many different labels as facts - we're done */
                if (Object.keys(uniqueLabelsByLabel).length == this._facts.length) {
                    break;
                }
            }
        }
        this._minimallyUniqueLabels = uniqueLabels;
    }
    return this._minimallyUniqueLabels[fact.id];
}
