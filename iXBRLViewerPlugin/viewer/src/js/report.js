// See COPYRIGHT.md for copyright information

import { Concept } from "./concept.js";
import { setDefault } from "./util.js";
import i18next from "i18next";

// Class to represent the XBRL data from a single target document in a single
// Inline XBRL Document or Document Set.

export class XBRLReport {

    constructor(reportSet, reportData) {
        this.reportSet = reportSet;
        this._reportData = reportData;
        // A map of IDs to Fact and Footnote objects
        this._reverseRelationshipCache = {};
    }

    availableLanguages() {
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

    facts() {
        return this.reportSet.factsForReport(this);
    }

    targetDocument() {
        return this._reportData.target ?? null;
    }

    getChildRelationships(conceptName, arcrole) {
        const rels = {}
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
    _reverseRelationships(arcrole) {
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

    getParentRelationships(conceptName, arcrole) {
        const rels = {}
        for (const [elr, relSet] of Object.entries(this._reverseRelationships(arcrole))) {
            if (conceptName in relSet) {
                rels[elr] = relSet[conceptName];
            }
        }
        return rels;
    }

    getParentRelationshipsInGroup(conceptName, arcrole, elr) {
        const relSet = this._reverseRelationships(arcrole)[elr] || {};
        return relSet[conceptName] || [];
    }

    dimensionDefault(dimensionName) {
        // ELR is irrelevant for dimension-default relationships, so check all of
        // them, and return the first (illegal for there to be more than one
        for (const rel of Object.values(this._reportData.rels["d-d"] || {})) {
            if (dimensionName in rel) {
                return rel[dimensionName][0].t;
            }
        }
        return undefined;
    }

    relationshipGroups(arcrole) {
        return Object.keys(this._reportData.rels[arcrole] || {});
    }

    relationshipGroupRoots(arcrole, elr) {
        const roots = [];
        for (const conceptName in this._reportData.rels[arcrole][elr]) {
            if (!(elr in this.getParentRelationships(conceptName, arcrole))) {
                roots.push(conceptName);
            }
        }
        return roots;
    }

    getAlignedFacts(f, coveredAspects) {
        // XXX should filter to current report facts?
        const all = this.reportSet.facts();
        const aligned = [];
        if (!coveredAspects) {
            coveredAspects = {};
        }
        for (const ff of all) {
            if (ff.isAligned(f, coveredAspects)) {
                aligned.push(ff);
            }
        }
        return aligned; 
    }

    deduplicate(facts) {
        const ff = [];
        for (const f of facts) {
            let dupe = false;
            for (const other of ff) {
                if (other.isAligned(f,{})) {
                    dupe = true;
                }
            }
            if (!dupe) {
                ff.push(f);
            }
        }
        return ff;
    }

    getConcept(name) {
        return new Concept(this, name);
    }

    getRoleLabel(rolePrefix) {
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
        return undefined;
    }

    getRoleLabelOrURI(rolePrefix) {
        return this.getRoleLabel(rolePrefix) ?? this.reportSet.roleMap()[rolePrefix];
    }

    getLabelRoleLabel(rolePrefix) {
        const roleURI = this.reportSet.roleMap()[rolePrefix];
        if (roleURI === undefined) {
            return undefined;
        }

        // Built-in label roles don't have a definition in the taxonomy. Do an
        // i18n look-up on the last part of the URI. For "en" the camel-case
        // splitter will do what we want for everything except standard label
        // and documentation label 
        const suffix = roleURI.split("/").pop();
        if (roleURI.startsWith("http://www.xbrl.org/2003/role/") && i18next.exists(`labelRoles:${suffix}`)) {
            return i18next.t(`labelRoles:${suffix}`);
        }

        // Attempt to get a label from the role definition
        const label = this.getRoleLabel(rolePrefix);
        if (label !== undefined) {
            return label;
        }

        // Fall back on de-camel-casing the last part of the URI
        return suffix
            .replaceAll(/([A-Z][a-z]+)/g, ' $1')
            .trim()
            .replace(/^./, s => s.toUpperCase());
    }

    localDocuments() {
        if (this._reportData.localDocs === undefined) {
            return {}
        }
        return this._reportData.localDocs;
    }

    qname(v) {
        return this.reportSet.qname(v);
    }

    getScaleLabel(scale, unit) {
        let label = i18next.t(`scale:${scale}`, {defaultValue:"noName"});
        if (unit && unit.isMonetary() && scale === -2) {
            let measure = unit.value() ?? '';
            if (measure) {
                measure = this.qname(measure).localname;
            }
            label = i18next.t(`currencies:cents${measure}`, {defaultValue: label});
        }
        if (label === "noName") {
            return null;
        }
        return label;
    }

    concepts() {
        return this._reportData.concepts;
    }

    getLabel(c, rolePrefix, showPrefix) {
        return this.getLabelAndLang(c, rolePrefix, showPrefix).label;
    }

    getLabelAndLang(c, rolePrefix, showPrefix) {
        rolePrefix = rolePrefix || 'std';
        const lang = this.reportSet.viewerOptions.language;
        const concept = this._reportData.concepts[c];
        if (concept === undefined) {
            console.log("Attempt to get label for undefined concept: " + c);
            return { label: "<no label>" };
        }
        const labels = concept.labels[rolePrefix]
        if (labels === undefined || Object.keys(labels).length == 0) {
            return { label: undefined };
        }
        else {
            let label;
            let actualLang;
            if (lang && labels[lang]) {
                label = labels[lang];
                actualLang = lang;
            }
            else {
                // Fall back on English, then any label deterministically.
                for (const l of ["en", "en-us", Object.keys(labels).sort()[0]]) {
                    if (labels[l] !== undefined) {
                        label = labels[l];
                        actualLang = l;
                        break;
                    }
                }
            }
            if (label === undefined) {
                return {label: undefined};
            }
            let s = '';
            if (showPrefix && this.reportSet.viewerOptions.showPrefixes) {
                s = "(" + this.reportSet.taxonomyNamer.fromQName(this.qname(c)).prefix + ") ";
            }
            s += label;
            return { label: s, lang: actualLang };
        }
    }

    getLabelOrName(c, rolePrefix, showPrefix) {
        const label = this.getLabel(c, rolePrefix, showPrefix);
        if (label === undefined) {
            return c;
        }
        return label;
    }

    getLabelOrNameAndLang(c, rolePrefix, showPrefix) {
        const labelLang = this.getLabelAndLang(c, rolePrefix, showPrefix);
        if (labelLang.label === undefined) {
            return { label: c };
        }
        return labelLang;
    }

    isCalculationContributor(c) {
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

    isCalculationSummation(c) {
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

    /**
     * @return {Array[String]} Software credit text labels provided with this report for display purposes.
     */
    softwareCredits() {
        return this._reportData.softwareCredits ?? [];
    }
}
