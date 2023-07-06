// See COPYRIGHT.md for copyright information

import { Fact } from "./fact.js"
import { Footnote } from "./footnote.js"
import { QName } from "./qname.js"
import { Concept } from "./concept.js";
import { Unit } from "./unit";
import { ViewerOptions } from "./viewerOptions.js";
import { setDefault, titleCase } from "./util.js";
import $ from 'jquery'
import i18next from "i18next";

export function iXBRLReport (data) {
    this.data = data;
    // A map of IDs to Fact and Footnote objects
    this._items = {};
    this._ixNodeMap = {};
    this._viewerOptions = new ViewerOptions();
    this._reverseRelationshipCache = {};
}

/*
 * Set additional information about facts obtained from parsing the iXBRL.
 */
iXBRLReport.prototype.setIXNodeMap = function(ixData) {
    this._ixNodeMap = ixData;
    this._initialize();
}

iXBRLReport.prototype._initialize = function () {

    // Build an array of footnotes IDs in document order so that we can assign
    // numbers to foonotes
    var fnorder = Object.keys(this._ixNodeMap).filter((id) => this._ixNodeMap[id].footnote);
    fnorder.sort((a,b) => this._ixNodeMap[a].docOrderindex - this._ixNodeMap[b].docOrderindex);

    // Create Fact objects for all facts.
    for (const id in this.data.facts) {
        this._items[id] = new Fact(this, id);
    }

    // Now resolve footnote references, creating footnote objects for "normal"
    // footnotes, and finding Fact objects for fact->fact footnotes.  
    //
    // Associate source facts with target footnote/facts to allow two way
    // navigation.
    for (const id in this.data.facts) {
        const f = this._items[id];
        const fns = this.data.facts[id].fn || [];
        fns.forEach((fnid) => {
            var fn = this._items[fnid];
            if (fn === undefined) {
                fn = new Footnote(this, fnid, "Footnote " + (fnorder.indexOf(fnid) + 1));
                this._items[fnid] = fn;
            }
            // Associate fact with footnote
            fn.addLinkedFact(f);
        });
    }
}

iXBRLReport.prototype.isCalculationContributor = function(c) {
    if (this._calculationContributors === undefined) {
        if (this.data.rels?.calc) {
            this._calculationContributors = new Set(Object.values(this.data.rels.calc).flatMap(calculations => {
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

iXBRLReport.prototype.isCalculationSummation = function(c) {
    if (this._calculationSummations === undefined) {
        if (this.data.rels?.calc) {
            this._calculationSummations = new Set(Object.values(this.data.rels.calc).flatMap(calculations => {
                return Object.keys(calculations);
            }));
        } else {
            this._calculationSummations = new Set();
        }
    }
    return this._calculationSummations.has(c);
}

iXBRLReport.prototype.getLabel = function(c, rolePrefix, showPrefix) {
    rolePrefix = rolePrefix || 'std';
    var lang = this._viewerOptions.language;
    const concept = this.data.concepts[c];
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
        if (showPrefix && this._viewerOptions.showPrefixes) {
            s = "(" + this.qname(c).prefix + ") ";
        }
        s += label;
        return s;
    }
}

iXBRLReport.prototype.getLabelOrName = function(c, rolePrefix, showPrefix) {
    const label = this.getLabel(c, rolePrefix, showPrefix);
    if (label === undefined) {
        return c;
    }
    return label;
}

iXBRLReport.prototype.availableLanguages = function() {
    if (!this._availableLanguages) {
        var map = {};
        $.each(this.data.concepts, function (k,v) {
            $.each(v.labels, function (rolePrefx, ll) {
                $.each(ll, function (lang, v) {
                    map[lang] = 1;
                });
            });
        });
        this._availableLanguages = Object.keys(map);

    }
    return this._availableLanguages;
}

iXBRLReport.prototype.languageNames = function() {
    return this.data.languages;
}

iXBRLReport.prototype.getItemById = function(id) {
    return this._items[id];
}

iXBRLReport.prototype.getIXNodeForItemId = function(id) {
    return this._ixNodeMap[id] || {};
}

iXBRLReport.prototype.facts = function() {
    return Object.keys(this.data.facts).map(id => this.getItemById(id));
}

iXBRLReport.prototype.filingDocuments = function() {
    return this.data.filingDocuments;
}

iXBRLReport.prototype.prefixMap = function() {
    return this.data.prefixes;
}

iXBRLReport.prototype.getUsedPrefixes = function() {
    if (this._usedPrefixes === undefined) {
        this._usedPrefixes = new Set(Object.values(this._items)
                .filter(f => f instanceof Fact)
                .map(f => f.getConceptPrefix()));
    }
    return this._usedPrefixes;
}

/**
 * Returns a set of OIM format unit strings used by facts on this report. Lazy-loaded.
 * @return {Set[String]} Set of OIM format unit strings
 */
iXBRLReport.prototype.getUsedUnits = function() {
    if (this._usedUnits === undefined) {
        this._usedUnits = new Set(Object.values(this._items)
                .filter(f => f instanceof Fact)
                .map(f => f.unit()?.value())
                .filter(f => f)
                .sort());
    }
    return this._usedUnits;
}

/**
 * Returns details about the provided unit. Lazy-loaded once per unit.
 * @param  {String} unitKey  Unit in OIM format
 * @return {Unit}  Unit instance corresponding with provided key
 */
iXBRLReport.prototype.getUnit = function(unitKey) {
    if (this._unitsMap === undefined) {
        this._unitsMap = {};
    }
    if (this._unitsMap[unitKey] === undefined) {
        this._unitsMap[unitKey] = new Unit(this, unitKey)
    }
    return this._unitsMap[unitKey];
}

iXBRLReport.prototype.getUsedScalesMap = function() {
    // Do not lazy load. This is language-dependent so needs to re-evaluate after language changes.
    const usedScalesMap = {};
    Object.values(this._items)
        .filter(f => f instanceof Fact)
        .forEach(fact => {
            const scale = fact.scale();
            if (scale !== null && scale !== undefined) {
                if (!(scale in usedScalesMap)) {
                    usedScalesMap[scale] = new Set();
                }
                const labels = usedScalesMap[scale];
                const label = titleCase(fact.getScaleLabel(scale));
                if (label && !labels.has(label)) {
                    labels.add(label);
                }
            }
        });
    return usedScalesMap;
}

iXBRLReport.prototype.roleMap = function() {
    return this.data.roles;
}

iXBRLReport.prototype.qname = function(v) {
    return new QName(this.prefixMap(), v);
}

iXBRLReport.prototype.getChildRelationships = function(conceptName, arcrole) {
    var rels = {}
    const elrs = this.data.rels[arcrole] || {};
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
iXBRLReport.prototype._reverseRelationships = function(arcrole) {
    if (!(arcrole in this._reverseRelationshipCache)) {
        const rrc = {};
        const elrs = this.data.rels[arcrole] || {};
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

iXBRLReport.prototype.getParentRelationships = function(conceptName, arcrole) {
    var rels = {}
    for (const [elr, relSet] of Object.entries(this._reverseRelationships(arcrole))) {
        if (conceptName in relSet) {
            rels[elr] = relSet[conceptName];
        }
    }
    return rels;
}

iXBRLReport.prototype.getParentRelationshipsInGroup = function(conceptName, arcrole, elr) {
    var rels = {}
    const relSet = this._reverseRelationships(arcrole)[elr] || {};
    return relSet[conceptName] || [];
}

iXBRLReport.prototype.dimensionDefault = function(dimensionName) {
    // ELR is irrelevant for dimension-default relationships, so check all of
    // them, and return the first (illegal for there to be more than one
    for (const rel of Object.values(this.data.rels["d-d"] || {})) {
        if (dimensionName in rel) {
            return rel[dimensionName][0].t;
        }
    }
    return undefined;
}

iXBRLReport.prototype.relationshipGroups = function(arcrole) {
    return Object.keys(this.data.rels[arcrole] || {});
}

iXBRLReport.prototype.relationshipGroupRoots = function(arcrole, elr) {
    var roots = [];
    for (const conceptName in this.data.rels[arcrole][elr]) {
        if (!(elr in this.getParentRelationships(conceptName, arcrole))) {
            roots.push(conceptName);
        }
    }
    return roots;
}

iXBRLReport.prototype.getAlignedFacts = function(f, coveredAspects) {
    var all = this.facts();
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

iXBRLReport.prototype.deduplicate = function (facts) {
    var ff = [];
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

iXBRLReport.prototype.setViewerOptions = function (vo) {
    this._viewerOptions = vo;
}

iXBRLReport.prototype.namespaceGroups = function () {
    var counts = {};
    $.each(this.facts(), function (i, f) {
        counts[f.conceptQName().prefix] = counts[f.conceptQName().prefix] || 0;
        counts[f.conceptQName().prefix]++;
    });
    var prefixes = Object.keys(counts);
    prefixes.sort(function (a, b) { return counts[b] - counts[a] });
    return prefixes;
}

iXBRLReport.prototype.getConcept = function(name) {
    return new Concept(this, name);
}

iXBRLReport.prototype.getRoleLabel = function(rolePrefix, viewerOptions) {
    /* This is currently hard-coded to "en" as the generator does not yet
     * support generic labels, and instead provides the (non-localisable) role
     * definition as a single "en" label.
     *
     * Returns the ELR URI if there is no label
     */
    const labels = this.data.roleDefs[rolePrefix];
    if (labels !== undefined) {
        const label = labels["en"];
        // Earlier versions of the generator added a "null" label if no labels
        // were available.
        if (label !== undefined && label !== null) {
            return label;
        }
    }
    return this.roleMap()[rolePrefix];
}

iXBRLReport.prototype.localDocuments = function() {
    if (this.data.localDocs === undefined) {
        return {}
    }
    return this.data.localDocs;
}

iXBRLReport.prototype.documentSetFiles = function() {
    if (this.data.docSetFiles === undefined) {
        return []
    }
    return this.data.docSetFiles;
}

iXBRLReport.prototype.isDocumentSet = function() {
    return this.documentSetFiles().length > 1;
}

iXBRLReport.prototype.usesAnchoring = function() {
    return this.data.rels["w-n"] !== undefined;
}

iXBRLReport.prototype.hasValidationErrors = function() {
    return this.data.validation !== undefined && this.data.validation.length > 0;
}

iXBRLReport.prototype.getScaleLabel = function(scale, isMonetaryValue, currency=null) {
    var label = i18next.t(`scale.${scale}`, {defaultValue:"noName"});
    if (isMonetaryValue && scale === -2) {
        label = i18next.t(`currencies:cents${currency}`, {defaultValue: label});
    }
    if (label === "noName") {
        return null;
    }
    return label;
}
