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

export function DocumentOutline(report) {
    this._report = report;
    var facts = report.facts().sort((a, b) => a.ixNode.docOrderindex - b.ixNode.docOrderindex);
    var runLength = {};
    var runStart = {};
    var longestRun = {};
    var longestRunStart = {};
    for (const f of facts) {
        if (f.isHidden()) {
            continue;
        }
        const rels = report.getParentRelationships(f.conceptName(), "pres");
        for (const elr in rels) {
            if (!(elr in runLength)) {
                runLength[elr] = 0;
                runStart[elr] = f;
            }
            runLength[elr]++;
        }
        for (const elr in runLength) {
            if (!(elr in rels)) {
                if (!(elr in longestRun) || longestRun[elr] < runLength[elr]) {
                    longestRun[elr] = runLength[elr];
                    longestRunStart[elr] = runStart[elr];
                }
                delete runLength[elr];
                delete runStart[elr];
            }
        }
    }
    for (const elr in runLength) {
        if (!(elr in longestRun) || longestRun[elr] < runLength[elr]) {
            longestRun[elr] = runLength[elr];
            longestRunStart[elr] = runStart[elr];
        }
    }
    for (const elr in longestRun) {
        console.log(report.data.roles[elr] + ": " + longestRun[elr] + " " + longestRunStart[elr].conceptName() + " " + longestRunStart[elr].id);
    }
    this.sections = longestRunStart;
    this.dimensionMap();
}

DocumentOutline.prototype.dimensionMap = function () {
    const groups = this._report.relationshipGroups("pres");
    var dimensionMap = {};
    for (const elr of groups) {
        console.log("ELR: " + this._report.getRoleLabel(elr));
        dimensionMap[elr] = {};
        for (const root of this._report.relationshipGroupRoots("pres", elr)) {
            console.log("  Root: " + root);
            this.buildDimensionMap(dimensionMap[elr], "pres", elr, null, root);
        }
    }
}

DocumentOutline.prototype.buildDimensionMap = function(dimensionMap, arcrole, elr, dimension, conceptName) {
    var children = this._report.getChildRelationships(conceptName, arcrole);
    if (!(elr in children)) {
        return
    }
    const c = this._report.getConcept(conceptName);
    if (c.isDimension()) {
        dimension = conceptName;
        dimensionMap[dimension] = {};
        console.log("  Dimension: " + dimension)
    }
    for (var rel of children[elr]) {
        if (dimension) {
            dimensionMap[rel.t] = 1;
            console.log("    Member: " + rel.t);
        }
        this.buildDimensionMap(dimensionMap, arcrole, elr, dimension, rel.t);
    }

}

DocumentOutline.prototype.sortedSections = function () {
    var sections = Object.keys(this.sections);
    return sections.sort((a, b) => this._report.getRoleLabel(a).localeCompare(this._report.getRoleLabel(b)));
}
