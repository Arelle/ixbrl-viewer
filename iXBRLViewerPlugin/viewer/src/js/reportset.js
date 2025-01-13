// See COPYRIGHT.md for copyright information

import { XBRLReport } from './report.js';
import { Fact } from "./fact.js"
import { Footnote } from "./footnote.js"
import { Unit } from "./unit";
import { titleCase, viewerUniqueId } from "./util.js";
import { QName } from "./qname.js";
import { ViewerOptions } from './viewerOptions.js';
import { TaxonomyNamer } from './taxonomynamer.js';

// Class represents the set of XBRL "target" reports shown in the viewer.
// Each contained report represents the data from a single target document in a
// single iXBRL Document or iXBRL Document Set

export class ReportSet {
    constructor(data) {
        this._data = data;
        this._ixNodeMap = {};
        this.viewerOptions = new ViewerOptions()
        this.taxonomyNamer = new TaxonomyNamer(new Map());
    }

    /*
     * Set additional information about facts obtained from parsing the iXBRL.
     */
    setIXNodeMap(ixData) {
        this._ixNodeMap = ixData;
        this._initialize();
    }

    _initialize() {
        this._items = {};
        this.reports = [];
        // Build an array of footnotes IDs in document order so that we can assign
        // numbers to foonotes
        const fnorder = Object.keys(this._ixNodeMap).filter((id) => this._ixNodeMap[id].footnote);
        fnorder.sort((a,b) => this._ixNodeMap[a].docOrderindex - this._ixNodeMap[b].docOrderindex);

        // Create Fact objects for all facts.
        for (const [reportIndex, sourceReport] of (this._data.sourceReports ?? [ { "targetReports": [ this._data ] } ]).entries()) {
            for (const reportData of sourceReport.targetReports) {
                const report = new XBRLReport(this, reportData);
                this.reports.push(report);
                for (const [id, factData] of Object.entries(reportData.facts)) {
                    const vuid = viewerUniqueId(reportIndex, id);
                    this._items[vuid] = new Fact(report, vuid, factData);
                }

                // Now resolve footnote references, creating footnote objects for "normal"
                // footnotes, and finding Fact objects for fact->fact footnotes.  
                //
                // Associate source facts with target footnote/facts to allow two way
                // navigation.
                for (const [id, factData] of Object.entries(reportData.facts)) {
                    const vuid = viewerUniqueId(reportIndex, id);
                    const fact = this._items[vuid];
                    const fns = factData.fn || [];
                    fns.forEach((fnid) => {
                        const fnvuid = viewerUniqueId(reportIndex, fnid);
                        var fn = this._items[fnvuid];
                        if (fn === undefined) {
                            fn = new Footnote(fact.report, fnvuid, "Footnote " + (fnorder.indexOf(fnvuid) + 1));
                            this._items[fnvuid] = fn;
                        }
                        // Associate fact with footnote
                        fn.addLinkedFact(fact);
                        fact.addFootnote(fn);
                    });
                }
            }
        }
    }

    availableLanguages() {
        return Array.from(this.reports.reduce(
            (langs, report) => new Set([...langs, ...report.availableLanguages()]), 
            new Set()
        ));
    }

    getItemById(vuid) {
        return this._items[vuid];
    }

    getIXNodeForItemId(vuid) {
        return this._ixNodeMap[vuid] || {};
    }

    facts() {
        return Object.values(this._items).filter(i => i instanceof Fact);
    }

    filingDocuments() {
        return this._data.filingDocuments;
    }

    prefixMap() {
        return this._data.prefixes;
    }

    preferredPrefix(prefix) {
        return this.taxonomyNamer.getName(prefix, this._data.prefixes[prefix]).prefix;
    }

    namespaceGroups() {
        const counts = {};
        for (const f of this.facts()) {
            counts[f.conceptQName().prefix] = (counts[f.conceptQName().prefix] || 0) + 1;
        }
        const prefixes = Object.keys(counts);
        prefixes.sort((a, b) => counts[b] - counts[a]);
        return prefixes;
    }

    getUsedConceptPrefixes() {
        if (this._usedPrefixes === undefined) {
            this._usedPrefixes = new Set(Object.values(this._items)
                    .filter(f => f instanceof Fact)
                    .map(f => f.getConceptPrefix()));
        }
        return this._usedPrefixes;
    }

    getUsedConceptDataTypes() {
        if (this._usedDataTypes === undefined) {
            const map = new Map()
            for (const dt of Object.values(this._items)
                    .filter(f => f instanceof Fact)
                    .map(f => ({ dataType: f.concept().dataType(), isNumeric: f.isNumeric() }))
                    .filter(t => t.dataType !== undefined)) {
                map.set(dt.dataType.name, dt);
            }
            this._usedDataTypes = map.values().toArray();
        }
        return this._usedDataTypes;
    }

    /**
     * @return {Array[String]} Sorted list of unique software credit text values
     */
    getSoftwareCredits() {
        let softwareCredits = new Set(this.reports.flatMap(r => r.softwareCredits()));
        return Array.from(softwareCredits).sort();
    }

    getTargetDocuments() {
        if (this._targetDocuments === undefined) {
            this._targetDocuments = new Set(Object.values(this._items)
                    .filter(f => f instanceof Fact)
                    .map(f => f.targetDocument()));
        }
        return this._targetDocuments;
    }

    /**
     * Returns a set of OIM format unit strings used by facts on this report. Lazy-loaded.
     * @return {Set[String]} Set of OIM format unit strings
     */
    getUsedUnits() {
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
    getUnit(unitKey) {
        if (this._unitsMap === undefined) {
            this._unitsMap = {};
        }
        if (this._unitsMap[unitKey] === undefined) {
            this._unitsMap[unitKey] = new Unit(this, unitKey)
        }
        return this._unitsMap[unitKey];
    }

    getUsedScalesMap() {
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

    roleMap() {
        return this._data.roles;
    }

    qname(v) {
        return new QName(this.prefixMap(), v);
    }

    reportsData() {
        return this._data.sourceReports?.flatMap(sr => sr.targetReports) ?? [ this._data ];
    }

    /**
     * Returns a flat list of source files for all reports in the report set.
     * Each entry in the list is an object with:
     *   file - name of the file
     *   index - index of the report that it is for
     * May return an empty list for single file, non-stub viewers.
     * @return {List}   A list of objects describing each file
     */
    reportFiles() {
        const sourceReports = this._data.sourceReports ?? [ this._data ];
        return sourceReports.map((x, n) => (x.docSetFiles ?? []).map(file => ({ index: n, file: file }))).flat();
    }

    /**
     * Returns true if the viewer is for more than one Inline XBRL document
     * This may be a single document set with multiple files, or multiple
     * document sets
     * @return {Boolean}   true if the viewer covers more than one iXBRL
     *                     document
     */

    isMultiDocumentViewer() {
        return this.reportFiles().length > 1;
    }

    usesAnchoring() {
        return this.reportsData().some(r => r.rels?.["w-n"] !== undefined);
    }

    usesCalculations() {
        return this.reportsData().some(r => Object.keys(r.rels?.calc ?? {}).length > 0);
    }

    hasValidationErrors() {
        return this._data.validation !== undefined && this._data.validation.length > 0;
    }

    validation() {
        return this._data.validation;
    }

    factsForReport(report) {
        return Object.values(this._items).filter(i => i instanceof Fact && i.report == report);
    }

}
