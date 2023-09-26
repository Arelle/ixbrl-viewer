// See COPYRIGHT.md for copyright information

import { Fact } from "./fact.js"
import { Footnote } from "./footnote.js"
import { QName } from "./qname.js"
import { Concept } from "./concept.js";
import { setDefault, viewerUniqueId } from "./util.js";
import $ from 'jquery'
import i18next from "i18next";

// Class to represent the XBRL data from a single target document in a single
// Inline XBRL Document or Document Set.

export function XBRLReport(reportSet, reportData) {
    this.reportSet = reportSet;
    this._reportData = reportData;
    // A map of IDs to Fact and Footnote objects
    this._reverseRelationshipCache = {};
}

XBRLReport.prototype.availableLanguages = function() {
    if (!this._availableLanguages) {
        this._availableLanguages = new Set()
        for (const c of Object.values(this._reportData.concepts)) {
            for (const ll of Object.values(c.labels)) {
                for (const lang of Object.keys(ll)) {
                    this._availableLanguages.add(lang);
                }
            }
        }
    }
    return this._availableLanguages;
}

XBRLReport.prototype.facts = function() {
    return this.reportSet.factsForReport(this);
}

XBRLReport.prototype.getChildRelationships = function(conceptName, arcrole) {
    var rels = {}
    const elrs = this._reportData.rels[arcrole] || {};
    for (const elr in elrs) {
        if (conceptName in elrs[elr]) {
            rels[elr] = elrs[elr][conceptName];
        }
    }
    return rels;
}

/* 
 * Build and cache an inverse map of relationships for a given arcrole for
 * efficient lookup of parents concept from a child.
 *
 * Map is arcrole => elr => target => [ rel, ... ]
 *
 * "rel" is modified to have a "src" property with the source concept.
 */
XBRLReport.prototype._reverseRelationships = function(arcrole) {
    if (!(arcrole in this._reverseRelationshipCache)) {
        const rrc = {};
        const elrs = this._reportData.rels[arcrole] || {};
        for (const [elr, relSet] of Object.entries(elrs)) {
            for (const [src, rels] of Object.entries(relSet)) {
                for (const r of rels) {
                    r.src = src;
                    setDefault(setDefault(rrc, elr, {}), r.t, []).push(r);
                }
            }
        }
        this._reverseRelationshipCache[arcrole] = rrc;
    }
    return this._reverseRelationshipCache[arcrole];
}

XBRLReport.prototype.getParentRelationships = function(conceptName, arcrole) {
    const rels = {}
    for (const [elr, relSet] of Object.entries(this._reverseRelationships(arcrole))) {
        if (conceptName in relSet) {
            rels[elr] = relSet[conceptName];
        }
    }
    return rels;
}

XBRLReport.prototype.getParentRelationshipsInGroup = function(conceptName, arcrole, elr) {
    const relSet = this._reverseRelationships(arcrole)[elr] || {};
    return relSet[conceptName] || [];
}

XBRLReport.prototype.dimensionDefault = function(dimensionName) {
    // ELR is irrelevant for dimension-default relationships, so check all of
    // them, and return the first (illegal for there to be more than one
    for (const rel of Object.values(this._reportData.rels["d-d"] || {})) {
        if (dimensionName in rel) {
            return rel[dimensionName][0].t;
        }
    }
    return undefined;
}

XBRLReport.prototype.relationshipGroups = function(arcrole) {
    return Object.keys(this._reportData.rels[arcrole] || {});
}

XBRLReport.prototype.relationshipGroupRoots = function(arcrole, elr) {
    const roots = [];
    for (const conceptName in this._reportData.rels[arcrole][elr]) {
        if (!(elr in this.getParentRelationships(conceptName, arcrole))) {
            roots.push(conceptName);
        }
    }
    return roots;
}

XBRLReport.prototype.getAlignedFacts = function(f, coveredAspects) {
    // XXX should filter to current report facts?
    var all = this.reportSet.facts();
    var aligned = [];
    if (!coveredAspects) {
        coveredAspects = {};
    }
    $.each(all, function (i, ff) {
        if (ff.isAligned(f, coveredAspects)) {
            aligned.push(ff);
        }
    });
    return aligned; 
}

XBRLReport.prototype.deduplicate = function (facts) {
    const ff = [];
    $.each(facts, function (i, f) {
        var dupe = false;
        $.each(ff, function (j, of) {
            if (of.isAligned(f,{})) {
                dupe = true;
            }
        });
        if (!dupe){
            ff.push(f);
        }
    });
    return ff;
}


XBRLReport.prototype.getConcept = function(name) {
    return new Concept(this, name);
}

XBRLReport.prototype.getRoleLabel = function(rolePrefix) {
    /* This is currently hard-coded to "en" as the generator does not yet
     * support generic labels, and instead provides the (non-localisable) role
     * definition as a single "en" label.
     *
     * Returns the ELR URI if there is no label
     */
    const labels = this._reportData.roleDefs[rolePrefix];
    if (labels !== undefined) {
        const label = labels["en"];
        // Earlier versions of the generator added a "null" label if no labels
        // were available.
        if (label !== undefined && label !== null) {
            return label;
        }
    }
    return this.reportSet.roleMap()[rolePrefix];
}

XBRLReport.prototype.localDocuments = function() {
    if (this._reportData.localDocs === undefined) {
        return {}
    }
    return this._reportData.localDocs;
}

XBRLReport.prototype.qname = function(v) {
    return this.reportSet.qname(v);
}

XBRLReport.prototype.getScaleLabel = function(scale, isMonetaryValue, currency=null) {
    var label = i18next.t(`scale.${scale}`, {defaultValue:"noName"});
    if (isMonetaryValue && scale === -2) {
        label = i18next.t(`currencies:cents${currency}`, {defaultValue: label});
    }
    if (label === "noName") {
        return null;
    }
    return label;
}

XBRLReport.prototype.concepts = function() {
    return this._reportData.concepts;
}

XBRLReport.prototype.getLabel = function(c, rolePrefix, showPrefix) {
    rolePrefix = rolePrefix || 'std';
    const lang = this.reportSet.viewerOptions.language;
    const concept = this._reportData.concepts[c];
    if (concept === undefined) {
        console.log("Attempt to get label for undefined concept: " + c);
        return "<no label>";
    }
    const labels = concept.labels[rolePrefix]
    if (labels === undefined || Object.keys(labels).length == 0) {
        return undefined;
    }
    else {
        var label;
        if (lang && labels[lang]) {
            label = labels[lang];
        }
        else {
            // Fall back on English, then any label deterministically.
            label = labels["en"] || labels["en-us"] || labels[Object.keys(labels).sort()[0]];
        }
        if (label === undefined) {
            return undefined;
        }
        var s = '';
        if (showPrefix && this.reportSet.viewerOptions.showPrefixes) {
            s = "(" + this.qname(c).prefix + ") ";
        }
        s += label;
        return s;
    }
}

XBRLReport.prototype.getLabelOrName = function(c, rolePrefix, showPrefix) {
    const label = this.getLabel(c, rolePrefix, showPrefix);
    if (label === undefined) {
        return c;
    }
    return label;
}

XBRLReport.prototype.isCalculationContributor = function(c) {
    if (this._calculationContributors === undefined) {
        if (this._reportData.rels?.calc) {
            this._calculationContributors = new Set(Object.values(this._reportData.rels.calc).flatMap(calculations => {
                return Object.values(calculations).flatMap(contributors => {
                    return contributors.map(c => c.t);
                });
            }));
        } else {
            this._calculationContributors = new Set();
        }
    }
    return this._calculationContributors.has(c);
}

XBRLReport.prototype.isCalculationSummation = function(c) {
    if (this._calculationSummations === undefined) {
        if (this._reportData.rels?.calc) {
            this._calculationSummations = new Set(Object.values(this._reportData.rels.calc).flatMap(calculations => {
                return Object.keys(calculations);
            }));
        } else {
            this._calculationSummations = new Set();
        }
    }
    return this._calculationSummations.has(c);
}
