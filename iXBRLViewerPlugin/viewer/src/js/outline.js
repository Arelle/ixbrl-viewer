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
    this.dimensionMap = this.buildDimensionMap();
    const elrs = report.relationshipGroups("pres");
    for (const f of facts) {
        if (f.isHidden()) {
            continue;
        }
        // Find the ELRs that this fact has a presentation parent in
        // (roots are abstract, so don't worry about it being a root)
        for (const elr of elrs) {
            if (this.factInGroup(f, elr)) {
                if (!(elr in runLength)) {
                    // Start counting a run
                    runLength[elr] = 0;
                    runStart[elr] = f;
                }
                runLength[elr]++;
            }
            else if (elr in runLength) { 
                // End of a run
                if (!(elr in longestRun) || longestRun[elr] < runLength[elr]) {
                    longestRun[elr] = runLength[elr];
                    longestRunStart[elr] = runStart[elr];
                }
                delete runLength[elr];
                delete runStart[elr];
            }
        }
    }

    // End of document, check if any current runs are the longest run for the
    // ELR.
    for (const elr in runLength) {
        if (!(elr in longestRun) || longestRun[elr] < runLength[elr]) {
            longestRun[elr] = runLength[elr];
            longestRunStart[elr] = runStart[elr];
        }
    }

    this.sections = longestRunStart;
}

DocumentOutline.prototype.factInGroup = function (fact, elr) {
    if (this._report.getParentRelationshipsInGroup(fact.conceptName(), "pres", elr).length == 0) {
        return false;
    }
    const fd = fact.dimensions();
    const dm = this.dimensionMap[elr];
    // Check all dimensions specified in this ELR
    for (const [dim, spec] of Object.entries(dm)) {
        // If a fact has a dimension, it must be in the list of permitted
        // members, otherwise, the default member must be allowed
        if ((dim in fd) ? !(fd[dim] in spec.members) : !spec.allowDefault) {
            return false;
        }
    }
    return true;
}

DocumentOutline.prototype.buildDimensionMap = function () {
    const groups = this._report.relationshipGroups("pres");
    var dimensionMap = {};
    for (const elr of groups) {
        dimensionMap[elr] = {};
        for (const root of this._report.relationshipGroupRoots("pres", elr)) {
            this.buildDimensionMapFromSubTree(dimensionMap[elr], "pres", elr, null, root);
        }
    }
    return dimensionMap;
}

DocumentOutline.prototype.buildDimensionMapFromSubTree = function(dimensionMap, arcrole, elr, dimension, conceptName) {
    var children = this._report.getChildRelationships(conceptName, arcrole);
    if (!(elr in children)) {
        return
    }
    const c = this._report.getConcept(conceptName);
    if (c.isDimension()) {
        dimension = conceptName;
        dimensionMap[dimension] = { members: {}, allowDefault: false};
    }
    for (var rel of children[elr]) {
        if (dimension) {
            if (this._report.dimensionDefault(dimension) == rel.t) {
                dimensionMap[dimension].allowDefault = true;
            }
            else {
                dimensionMap[dimension].members[rel.t] = 1;
            }
        }
        this.buildDimensionMapFromSubTree(dimensionMap, arcrole, elr, dimension, rel.t);
    }
}

DocumentOutline.prototype.groupsForFact = function(fact) {
    var factGroups = [];
    for (const group of this._report.relationshipGroups("pres")) {
        if (this.factInGroup(fact, group)) {
            factGroups.push(group);
        }
    }
    return factGroups;
}

DocumentOutline.prototype.sortedSections = function () {
    var sections = Object.keys(this.sections);
    const re = /\(parenthetical\)\s*$/i;
    var filteredSections = sections.filter(s => !re.test(this._report.getRoleLabel(s)));
    return filteredSections.sort((a, b) => this._report.getRoleLabel(a).localeCompare(this._report.getRoleLabel(b)));
}
