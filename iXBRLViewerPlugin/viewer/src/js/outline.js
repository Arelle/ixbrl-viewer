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
    this.report = report;
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
}

DocumentOutline.prototype.sortedSections = function () {
    var sections = Object.keys(this.sections);
    return sections.sort((a, b) => this.report.getRoleLabel(a).localeCompare(this.report.getRoleLabel(b)));
}
