// See COPYRIGHT.md for copyright information

import $ from 'jquery'

// DocumentOutline chooses a fact for each presentation group (ELR) that
// represents the start of that ELR.  This is done by deciding which ELRs each
// fact participates in (see factInGroup()) and then finding the longest
// continuous run of facts in document order that participate in each ELR.
export class DocumentOutline {
    constructor(report) {
        this._report = report;
        const facts = report.facts().sort((a, b) => a.ixNode.docOrderindex - b.ixNode.docOrderindex);
        const runLength = {};
        const runStart = {};
        const longestRun = {};
        const longestRunStart = {};
        this._buildDimensionMap();
        const elrs = report.relationshipGroups("pres");
        for (const f of facts) {
            if (f.isHidden()) {
                continue;
            }
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

    // Returns true if a fact participates in the given presentation group.
    factInGroup(fact, elr) {
        // Roots are abstract so no need to check for concepts with outgoing
        // relationships only.
        if (this._report.getParentRelationshipsInGroup(fact.conceptName(), "pres", elr).length == 0) {
            return false;
        }
        const fd = fact.dimensions();
        const dm = this.dimensionMap[elr];
        // Check all dimensions specified in this ELR
        for (const [dim, spec] of Object.entries(dm)) {
            // If a fact has a dimension, it must be in the list of permitted
            // members, otherwise, the default member must be allowed
            if (spec.typed) {
                if (!(dim in fd)) {
                    return false;
                }
            }
            else if ((dim in fd) ? !(fd[dim] in spec.members) : !spec.allowDefault) {
                return false;
            }
        }
        return true;
    }

    // Build a map of ELRs to dimensional information:
    //   { elr: 
    //      { dimensionQName: 
    //          { 
    //              allowDefault: true, 
    //              members: { 
    //                  memberQName: true
    //              } 
    //          } 
    //      } 
    //   } 
    //
    //   Note that all dimensional information (other than dimension defaults) is
    //   inferred from the presentation tree, rather than definitional/dimensional
    //   relationships.  This assumes that the presentation follows SEC/EFM rules.
    //   Using dimensional relationships would require assuming a correspondence
    //   between presentation and dimensional ELRs.
    //
    _buildDimensionMap() {
        const groups = this._report.relationshipGroups("pres");
        this.dimensionMap = {};
        for (const elr of groups) {
            this.dimensionMap[elr] = {};
            for (const root of this._report.relationshipGroupRoots("pres", elr)) {
                this.buildDimensionMapFromSubTree("pres", elr, null, root);
            }
        }
    }

    buildDimensionMapFromSubTree(arcrole, elr, dimension, conceptName) {
        const c = this._report.getConcept(conceptName);
        if (c.isTypedDimension()) {
            this.dimensionMap[elr][conceptName] = { typed: true };
            return
        }
        else if (c.isExplicitDimension()) {
            dimension = conceptName;
            this.dimensionMap[elr][dimension] = { members: {}, allowDefault: false};
        }
        var children = this._report.getChildRelationships(conceptName, arcrole);
        if (!(elr in children)) {
            return
        }
        for (var rel of children[elr]) {
            if (dimension) {
                if (this._report.dimensionDefault(dimension) == rel.t) {
                    this.dimensionMap[elr][dimension].allowDefault = true;
                }
                else {
                    this.dimensionMap[elr][dimension].members[rel.t] = true;
                }
            }
            this.buildDimensionMapFromSubTree(arcrole, elr, dimension, rel.t);
        }
    }

    // Returns a list of presentation groups that this fact participates in
    groupsForFact(fact) {
        var factGroups = [];
        for (const group of this._report.relationshipGroups("pres")) {
            if (this.factInGroup(fact, group)) {
                factGroups.push(group);
            }
        }
        return factGroups;
    }

    hasOutline() {
        return Object.keys(this.sections).length > 0;
    }

    sortedSections() {
        const sections = Object.keys(this.sections);
        const re = /\(parenthetical\)\s*$/i;
        const filteredSections = sections.filter(s => !re.test(this._report.getRoleLabel(s)));
        return filteredSections.sort((a, b) => this._report.getRoleLabel(a).localeCompare(this._report.getRoleLabel(b)));
    }
}
