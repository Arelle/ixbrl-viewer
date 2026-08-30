// See COPYRIGHT.md for copyright information
//
// Adapter that converts an XbrlModel "factset" plus its converted taxonomy
// (both in OIM JSON form) into the internal report-data structure consumed by
// ReportSet / XBRLReport / Fact.  This lets the existing inspector UI operate
// on XbrlModel data with no changes to the inspector or report model.
//
// The existing embedded-iXBRL path is completely untouched; this adapter is
// only used when the viewer is loaded in XbrlModel mode (see
// iXBRLViewer.loadXbrlModel).
//
// Facts are keyed by their xbrl:htmlElementId, which is the id attribute of the
// element in the plain-HTML document.  This mirrors the way the iXBRL path keys
// facts by the ix: element id, so that the document surface can bind facts to
// the document and the rest of the viewer works unchanged.  A single XBRL fact
// that appears at several span ids becomes several viewer "facts" (which the
// existing duplicate handling treats as duplicates, exactly as for repeated
// iXBRL tags).

const CORE_DIMENSIONS = new Set([
    "xbrl:concept", "xbrl:entity", "xbrl:period", "xbrl:unit", "xbrl:language",
]);

// Map OIM label types to the role-prefix keys used by the viewer's label lookup.
// "std" is the default role used by Report.getLabelAndLang.
const LABEL_ROLE_MAP = {
    "xbrl:label": "std",
    "xbrl:standardLabel": "std",
    "xbrl:documentation": "doc",
    "xbrl:terseLabel": "terse",
    "xbrl:verboseLabel": "verbose",
    "xbrl:periodStartLabel": "periodStart",
    "xbrl:periodEndLabel": "periodEnd",
    "xbrl:totalLabel": "total",
    "xbrl:negatedLabel": "negated",
};

// Standard XBRL label-role URIs for the role prefixes emitted above.  The
// inspector resolves a human-readable role name from these via its built-in
// i18n; without an entry in the report's role map the label-role lookup returns
// undefined and the label list sort throws.
const STD_LABEL_ROLE_URI = {
    "std": "http://www.xbrl.org/2003/role/label",
    "doc": "http://www.xbrl.org/2003/role/documentation",
    "terse": "http://www.xbrl.org/2003/role/terseLabel",
    "verbose": "http://www.xbrl.org/2003/role/verboseLabel",
    "periodStart": "http://www.xbrl.org/2003/role/periodStartLabel",
    "periodEnd": "http://www.xbrl.org/2003/role/periodEndLabel",
    "total": "http://www.xbrl.org/2003/role/totalLabel",
    "negated": "http://www.xbrl.org/2009/role/negatedLabel",
};

function localName(qname) {
    return qname && qname.includes(":") ? qname.substring(qname.indexOf(":") + 1) : (qname || "");
}

function labelRolePrefix(labelType) {
    return LABEL_ROLE_MAP[labelType] ?? localName(labelType);
}

function cleanNetworkLabel(name) {
    return localName(name)
        .replace(/_parent-child_Network$/, "")
        .replace(/_Network$/, "")
        .replace(/_/g, " ")
        .trim() || localName(name);
}

function cleanCubeLabel(name) {
    return localName(name)
        .replace(/_Cube$/, "")
        .replace(/^.*?Table_/, "")
        .replace(/^group_/, "")
        .replace(/_/g, " ")
        .trim() || localName(name);
}

function firstStdLabel(labelsByObject, name) {
    const std = labelsByObject[name]?.std;
    return std ? Object.values(std)[0] : undefined;
}

function cleanGroupLabel(name) {
    return localName(name)
        .replace(/^group_cat_/, "")
        .replace(/^group_/, "")
        .replace(/_/g, " ")
        .trim() || localName(name);
}

// Reporting-structure sections (the OIM groupTree + groups + groupContents) used to
// organize the Cubes navigation panel hierarchically.  Each node is
// { name, label, cubes: [cubeName], children: [node] }, nested per the groupTree's
// xbrl:taxonomy-group relationships (source = the taxonomy for a top-level group, or a
// parent group; target = a child group) in relationship order.  Only cube contents are
// carried as leaves; a section whose subtree contains no cube is hidden by the consumer.
// Returns null when the model carries no group tree (viewer falls back to the flat cube list).
// A section's sort key: the leading role code in its label -- IFRS/ESEF labels
// begin with a bracketed code, e.g. "[210000] Statement of financial position"
// (or a bare number). Sort by that code so the sections read in numeric order.
// Labels without a code (e.g. US-GAAP, whose "NNNN - Type -" prefix is stripped)
// get a sentinel and, because the sort is stable, keep their existing order.
function sectionSortKey(node) {
    const m = /^\s*\[?(\d{3,})\]?/.exec(node.label || "");
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function sortSectionNodes(nodes) {
    nodes.sort((a, b) => sectionSortKey(a) - sectionSortKey(b));
    for (const n of nodes) {
        sortSectionNodes(n.children);
    }
    return nodes;
}

function buildSections(taxonomy, labelsByObject) {
    const groups = taxonomy.groups ?? [];
    const groupTree = taxonomy.groupTree;
    if (groups.length === 0 || !groupTree) {
        return null;
    }
    const cubeNames = new Set((taxonomy.cubes ?? []).map(c => c.name));
    const cubesByGroup = {};
    for (const gc of taxonomy.groupContents ?? []) {
        if (cubeNames.has(gc.forObject)) {
            (cubesByGroup[gc.groupName] ??= []).push(gc.forObject);
        }
    }
    const nodeByName = {};
    for (const g of groups) {
        nodeByName[g.name] = {
            name: g.name,
            label: firstStdLabel(labelsByObject, g.name) ?? cleanGroupLabel(g.name),
            cubes: cubesByGroup[g.name] ?? [],
            children: [],
        };
    }
    const placed = new Set();
    const roots = [];
    for (const rel of groupTree.relationships ?? []) {
        const child = nodeByName[rel.target];
        if (!child || placed.has(rel.target)) {
            continue;
        }
        const parent = nodeByName[rel.source]; // undefined when source is the taxonomy (top level)
        if (parent) {
            parent.children.push(child);
        }
        else {
            roots.push(child);
        }
        placed.add(rel.target);
    }
    for (const g of groups) { // groups not placed by any relationship list flat at the top
        if (!placed.has(g.name)) {
            roots.push(nodeByName[g.name]);
        }
    }
    sortSectionNodes(roots); // numeric-code order (IFRS/ESEF); stable no-op for un-coded labels
    return roots.length ? roots : null;
}

// Cubes (hypercubes/tables) are the semantic structures of the XBRL model.  A
// cube's xbrl:concept dimension points to a domain network whose members are the
// cube's line-item concepts; those drive navigation to the cube's facts.  Cubes
// without a concept domain (e.g. the open default cube) are omitted.
function buildCubes(taxonomy, labelsByObject) {
    const domainByName = {};
    for (const dn of taxonomy.domainNetworks ?? []) {
        domainByName[dn.name] = dn;
    }

    const cubes = [];
    for (const cube of taxonomy.cubes ?? []) {
        let conceptDomainNet = null;
        const dimensions = [];
        for (const cd of cube.cubeDimensions ?? []) {
            const dim = cd.dimension ?? cd.dimensionName;
            if (dim === "xbrl:concept") {
                conceptDomainNet = cd.domainNetwork ?? cd.domainName;
            }
            else if (dim && !CORE_DIMENSIONS.has(dim)) {
                dimensions.push(dim);
            }
        }
        if (!conceptDomainNet) {
            continue;
        }
        const dn = domainByName[conceptDomainNet];
        if (!dn) {
            continue;
        }
        const concepts = [];
        const seen = new Set();
        for (const rel of dn.relationships ?? []) {
            if (rel.target && !seen.has(rel.target)) {
                seen.add(rel.target);
                concepts.push(rel.target);
            }
        }
        if (concepts.length === 0) {
            continue;
        }
        cubes.push({
            name: cube.name,
            label: firstStdLabel(labelsByObject, cube.name) ?? cleanCubeLabel(cube.name),
            concepts,
            dimensions,
        });
    }
    return cubes;
}

// An XbrlModel document may be wrapped in a top-level "xbrlModel" key.
export function unwrapModel(doc) {
    return doc?.xbrlModel ?? doc ?? {};
}

function setDefault(obj, key, dflt) {
    if (obj[key] === undefined) {
        obj[key] = dflt;
    }
    return obj[key];
}

function buildLabelsByObject(taxonomy) {
    // forObject -> role -> lang -> value
    const labelsByObject = {};
    for (const lbl of taxonomy.labels ?? []) {
        if (!lbl.forObject) {
            continue;
        }
        const role = labelRolePrefix(lbl.labelType);
        const lang = lbl.language ?? "en";
        const byRole = setDefault(labelsByObject, lbl.forObject, {});
        setDefault(byRole, role, {})[lang] = lbl.value;
    }
    return labelsByObject;
}

function buildConcepts(taxonomy, labelsByObject, dimensionConcepts) {
    const concepts = {};

    const addConcept = (name, source) => {
        const entry = { labels: labelsByObject[name] ?? { std: {} } };
        const dt = source?.dataType;
        if (dt !== undefined) {
            entry.dt = dt;
            if (/textblock/i.test(localName(dt))) {
                entry.t = true;
            }
            if (/enumeration/i.test(localName(dt))) {
                entry.e = true;
            }
        }
        if (source?.balance !== undefined) {
            entry.b = source.balance;
        }
        if (source?.periodType !== undefined) {
            entry.pt = source.periodType;
        }
        concepts[name] = entry;
        return entry;
    };

    for (const c of taxonomy.concepts ?? []) {
        if (c.name) {
            addConcept(c.name, c);
        }
    }
    // Dimension members carry labels and can appear as aspect values.
    for (const m of taxonomy.members ?? []) {
        if (m.name && !concepts[m.name]) {
            addConcept(m.name, m);
        }
    }
    // Any other labelled object (e.g. concepts declared in imported base
    // taxonomies that aren't inlined here) gets a stub so its label resolves.
    for (const name of Object.keys(labelsByObject)) {
        if (name.includes(":") && !concepts[name]) {
            addConcept(name, null);
        }
    }
    // Mark taxonomy-defined dimensions so the inspector can distinguish them.
    // Explicit dimensions take members from a domain (QName values); typed
    // dimensions take arbitrary values (e.g. dates), so they must be classified
    // as typed or the summary/label code will try to treat those values as
    // concept QNames.
    for (const dim of dimensionConcepts.explicit) {
        (concepts[dim] ?? addConcept(dim, null)).d = "e";
    }
    for (const dim of dimensionConcepts.typed) {
        (concepts[dim] ?? addConcept(dim, null)).d = "t";
    }
    return concepts;
}

function collectDimensionConcepts(taxonomy) {
    // A dimension is explicit if any cube references it with a domainNetwork
    // (i.e. it has a domain of allowed members); otherwise it is typed.
    const hasDomain = new Set();
    const allDims = new Set();
    for (const cube of taxonomy.cubes ?? []) {
        for (const cd of cube.cubeDimensions ?? []) {
            const dim = cd.dimension ?? cd.dimensionName;
            if (dim && dim.includes(":") && !CORE_DIMENSIONS.has(dim)) {
                allDims.add(dim);
                if (cd.domainNetwork !== undefined || cd.domainName !== undefined) {
                    hasDomain.add(dim);
                }
            }
        }
    }
    const explicit = new Set();
    const typed = new Set();
    for (const dim of allDims) {
        (hasDomain.has(dim) ? explicit : typed).add(dim);
    }
    return { explicit, typed };
}

// Locators live in the properties of valueSources (Form A: the document text is the
// source of truth and the value is derived from it) or of valueAnchors (Form B: the
// value is provided in the factset and the anchor only locates it in the document).
// Both carry the same locator properties, so read both to make either form locatable.
function factLocators(fv) {
    return [...(fv.valueSources ?? []), ...(fv.valueAnchors ?? [])];
}

function htmlElementIdsForFact(fact) {
    const ids = [];
    for (const fv of fact.factValues ?? []) {
        for (const locator of factLocators(fv)) {
            for (const p of locator.properties ?? []) {
                // xbrl:htmlElementId is the current spec property name;
                // xbrl:htmlSpanId is accepted as a legacy alias for factsets not
                // yet regenerated to the renamed property.
                if (p.property === "xbrl:htmlElementId" || p.property === "xbrl:htmlSpanId") {
                    for (const id of p.value ?? []) {
                        ids.push(id);
                    }
                }
            }
        }
    }
    return ids;
}

// PDF locators for a fact: an array of { page, mcids } - one entry per value
// source or anchor that carries xbrl:pdfPage + xbrl:pdfMcid.  A single fact may be
// split across several marked-content ids (and pages), so all are kept and become
// the wrapper nodes of one IXNode.
function pdfLocatorsForFact(fact) {
    const locators = [];
    for (const fv of fact.factValues ?? []) {
        for (const vs of factLocators(fv)) {
            let page = null;
            const mcids = [];
            for (const p of vs.properties ?? []) {
                if (p.property === "xbrl:pdfPage") {
                    page = p.value;
                }
                else if (p.property === "xbrl:pdfMcid") {
                    for (const m of (Array.isArray(p.value) ? p.value : [p.value])) {
                        if (m != null) {
                            mcids.push(m);
                        }
                    }
                }
            }
            if (page != null && mcids.length > 0) {
                locators.push({ page, mcids });
            }
        }
    }
    return locators;
}

// PDF image locators for a fact (xbrl:pdfImageLocatorType): xbrl:pdfPage +
// xbrl:pdfBBox ("x0 y0 x1 y1" in PDF user-space points, origin lower-left).
// One embedded chart image is referenced by many facts (the SEC Tailored
// Shareholder Report pattern: a chart plus a hidden data table), so several
// facts share the same page+bbox; `key` groups them into one highlight region.
function pdfImageLocatorsForFact(fact) {
    const locators = [];
    for (const fv of fact.factValues ?? []) {
        for (const vs of factLocators(fv)) {
            let page = null;
            let bboxStr = null;
            for (const p of vs.properties ?? []) {
                if (p.property === "xbrl:pdfPage") {
                    page = p.value;
                }
                else if (p.property === "xbrl:pdfBBox") {
                    bboxStr = p.value;
                }
            }
            if (page != null && bboxStr) {
                const n = String(bboxStr).trim().split(/\s+/).map(Number);
                if (n.length === 4 && n.every(v => !Number.isNaN(v))) {
                    locators.push({
                        page,
                        bbox: { x0: n[0], y0: n[1], x1: n[2], y1: n[3] },
                        key: page + "|" + n.join(" "),
                    });
                }
            }
        }
    }
    return locators;
}

// PDF form-field locators (xbrl:pdfFormFieldLocatorType): xbrl:pdfFormField is
// an AcroForm field name.  There is no page number - the surface finds the
// field (its page, rectangle and value) via PDF.js getFieldObjects().
function pdfFormFieldsForFact(fact) {
    const names = [];
    for (const fv of fact.factValues ?? []) {
        for (const vs of factLocators(fv)) {
            for (const p of vs.properties ?? []) {
                if (p.property === "xbrl:pdfFormField") {
                    for (const name of (Array.isArray(p.value) ? p.value : [p.value])) {
                        if (name != null) {
                            names.push(name);
                        }
                    }
                }
            }
        }
    }
    return names;
}

function buildFacts(factset) {
    const facts = {};
    let pdfKeyCounter = 0;
    for (const fact of factset.facts ?? []) {
        const dims = fact.factDimensions ?? {};
        const concept = dims["xbrl:concept"];
        if (!concept) {
            continue;
        }

        const a = { c: concept };
        // OIM allows the entity (and period) dimension to be absent; only set the
        // aspect when present.  The viewer handles a missing entity/period.
        if (dims["xbrl:entity"] !== undefined) {
            a.e = dims["xbrl:entity"];
        }
        if (dims["xbrl:period"] !== undefined) {
            // OIM period is a datetime instant or start/end interval, which the
            // viewer's Period class parses directly.
            a.p = dims["xbrl:period"];
        }
        // Taxonomy-defined (extension) dimensions pass through unchanged - they
        // are already "prefix:localName" keyed, matching Fact.dimensions().
        for (const [k, v] of Object.entries(dims)) {
            if (!CORE_DIMENSIONS.has(k)) {
                a[k] = v;
            }
        }
        // Numeric facts carry a unit (mapped to the "u" aspect, which is what
        // makes Fact.isNumeric() true and surfaces the unit/accuracy/scale in the
        // inspector) plus decimals/scale/sign/transform used to reconstruct the
        // value from the document text (see parseNumericValue).
        const unit = dims["xbrl:unit"];
        if (unit !== undefined) {
            a.u = unit;
        }

        /*
         * A model fact can occur in several places in the document, and each
         * occurrence is a factValue carrying the scaling and accuracy of the
         * text where it is displayed -- Microsoft's total revenue is on pages
         * 49, 84 (twice) and 85, and us-gaap:CommercialPaper is printed in
         * millions in one place and billions in another.  They are consistent
         * duplicates in the specification's sense: one fact, agreeing on value,
         * presented differently.
         *
         * So the presentation is read per occurrence rather than merged.  Merging
         * was not merely imprecise: barely any factValue carries an explicit
         * value (27 of 1,829 in the Microsoft PDF factset), the surface computing
         * it instead from the located text and that occurrence's scale, so one
         * merged scale applied to text printed in different units gives a wrong
         * value, not just a wrong accuracy.
         */
        const presentationOf = (fv) => ({
            value: fv?.value ?? null,
            decimals: fv?.decimals,
            scale: fv?.scale,
            sign: fv?.sign,
            transformation: fv?.transformation,
        });

        const makeFactData = (fv) => {
            const { value: jsonValue, decimals, scale, sign, transformation } = presentationOf(fv);
            const factData = { a: { ...a }, v: jsonValue };
            /*
             * The model's own name for this fact.  Facts are keyed here by
             * document element id or, where there is none, by position -- neither
             * of which the model uses -- so this is the only stable identity a
             * built fact carries.  It is what lets cubeContents address them
             * (see ReportSet.cubeFactsIndex) and what a tagging journal names its
             * subject by, so an applier can find the fact in the model.
             */
            if (fact.name !== undefined) {
                factData.n = fact.name;
            }
            /*
             * The occurrence this viewer fact stands for, named as the model
             * names it.  One name, because one viewer fact is now one occurrence
             * -- which is also what makes derivedContent.factValues, keyed by
             * factValueName, resolvable to a single value here.  A fact with no
             * factValue at all (an unlocated one) has none to give.
             */
            if (fv?.name !== undefined) {
                factData.fvn = fv.name;
            }
            /*
             * The occurrence's existing sources, kept in the model's own shape.
             *
             * This is what a rebind displaces, and a journal entry records it so
             * the entry can be reversed without consulting the model.  Held by
             * reference rather than copied: the parsed factset is alive for the
             * session anyway, so this keeps a subtree rather than duplicating
             * one (223 KB of 1.1 MB were it copied, on the Microsoft PDF
             * factset).
             */
            if (Array.isArray(fv?.valueSources) && fv.valueSources.length > 0) {
                factData.vs = fv.valueSources;
            }
            if (decimals !== undefined) {
                factData.d = decimals;
            }
            // Numeric metadata for the surface to compute the value/scale.
            if (unit !== undefined) {
                factData.num = { scale, sign, transformation, explicitValue: jsonValue };
            }
            return factData;
        };

        /*
         * One viewer fact per located occurrence.  The locator helpers read a
         * whole fact, so each occurrence is passed as a fact of its own; that
         * keeps them single-purpose rather than teaching all four to take either.
         */
        let located = false;
        for (const fv of fact.factValues ?? []) {
            const occurrence = { ...fact, factValues: [fv] };

            // PDF surface first: an occurrence located in the PDF carries content
            // (MCID) and/or image (bbox) locators; keyed by a synthesised id, with
            // its locators attached for the surface to place overlay boxes.
            const pdfContent = pdfLocatorsForFact(occurrence);
            const pdfImage = pdfImageLocatorsForFact(occurrence);
            const pdfFormField = pdfFormFieldsForFact(occurrence);
            if (pdfContent.length > 0 || pdfImage.length > 0 || pdfFormField.length > 0) {
                const factData = makeFactData(fv);
                if (pdfContent.length > 0) {
                    factData.pdf = pdfContent;
                }
                if (pdfImage.length > 0) {
                    factData.pdfImage = pdfImage;
                }
                if (pdfFormField.length > 0) {
                    factData.pdfFormField = pdfFormField;
                }
                facts["pf-" + (pdfKeyCounter++)] = factData;
                located = true;
                continue;
            }

            // HTML fallback: an occurrence not located in the PDF keeps its
            // retained html source.  One viewer fact per html element id
            // (repeated ids become duplicates, as for repeated iXBRL tags).
            for (const elementId of htmlElementIdsForFact(occurrence)) {
                facts[elementId] = makeFactData(fv);
                located = true;
            }
        }
        if (located) {
            continue;
        }

        // No document locator at all -- an ix:hidden fact (e.g. dei:EntityCentralIndexKey)
        // never linked to display text. Keep it so the surface can register it as a
        // hidden fact (browsable in the fact list) rather than dropping it.  Its
        // presentation comes from its first factValue, there being no located
        // occurrence to prefer.
        facts["hf-" + (pdfKeyCounter++)] = makeFactData((fact.factValues ?? [])[0]);
    }
    return facts;
}

/*
 * The synthetic source the model uses to mark a network's roots.  It is not a
 * concept and never carries a weight.
 */
const XBRL_ROOT_SOURCE = "xbrl:rootSource";

function buildNetworks(taxonomy) {
    // OIM networks -> the viewer's ELR-keyed relationship map.
    // Parent-child networks become presentation ("pres") relationships, which
    // drives the outline/section navigation.  Networks carrying weights become
    // calculation ("calc11") relationships.
    const rels = {};
    const roles = {};
    const roleDefs = {};
    for (const net of taxonomy.networks ?? []) {
        const elr = net.name;
        const relationships = net.relationships ?? [];
        /*
         * The model states the kind directly, so ask it rather than infer.
         *
         * The weight heuristic below was the original test, and on a well-formed
         * taxonomy the two agree exactly -- 23 of 96 networks either way on the
         * Apple demo.  They part company on a taxonomy under repair: a
         * summation-item network whose relationships have lost their weights
         * carries no weight anywhere, so the heuristic silently reclassifies it
         * as presentation and it disappears from the calculation inspector
         * instead of showing up as broken.  It is kept only as a fallback for a
         * network that omits relationshipTypeName.
         */
        const isCalc = net.relationshipTypeName !== undefined
            ? net.relationshipTypeName === "xbrl:summation-item"
            : relationships.some(r =>
                (r.properties ?? []).some(p => p.property === "xbrl:weight"));
        const arcrole = isCalc ? "calc11" : "pres";
        const group = setDefault(setDefault(rels, arcrole, {}), elr, {});
        /*
         * xbrl:summationRelation says what the components are to the total:
         * "equal" (the default and the only thing Calculations 1.1 could say),
         * "atMost" for an of-which breakdown where the components are known to
         * be only part of it, or "atLeast".
         *
         * Precedence is relationship, then network, then model object, then the
         * specification default; the network level is read here and the
         * relationship level below, which covers the two that appear in a
         * network document.
         */
        const netRelation = (net.properties ?? []).find(
            p => p.property === "xbrl:summationRelation")?.value;
        for (const r of relationships) {
            /*
             * xbrl:rootSource marks which concepts a network starts from; the
             * edge is structural and carries no weight.  In a presentation
             * network it is the tree root and is wanted.  In a summation-item
             * network it is not a contribution, and defaulting a weight onto it
             * below would make every network's total a summand of a synthetic
             * concept -- 28 of them on Microsoft's FY2025 10-K, each then
             * reported as a calculation contributor.
             */
            if (arcrole === "calc11" && r.source === XBRL_ROOT_SOURCE) {
                continue;
            }
            if (!r.source || !r.target || r.source === r.target) {
                // Skip self-referential edges: some taxonomies (e.g. IFRS
                // parent-child networks) include a concept related to itself,
                // which would otherwise create an infinite tree.
                continue;
            }
            const rel = { t: r.target };
            if (r.order !== undefined) {
                rel.o = r.order;
            }
            for (const p of r.properties ?? []) {
                if (p.property === "xbrl:preferredLabel") {
                    rel.r = p.value;
                }
                if (p.property === "xbrl:weight") {
                    rel.w = Number(p.value);
                }
                if (p.property === "xbrl:summationRelation") {
                    rel.sr = p.value;
                }
            }
            if (arcrole === "calc11" && rel.w === undefined) {
                rel.w = 1;
            }
            if (arcrole === "calc11" && rel.sr === undefined && netRelation !== undefined) {
                rel.sr = netRelation;
            }
            setDefault(group, r.source, []).push(rel);
        }
        roles[elr] = elr;
        const lbl = cleanNetworkLabel(elr);
        roleDefs[elr] = { "en": lbl, "en-US": lbl };
    }
    return { rels, roles, roleDefs };
}

/**
 * Convert an XbrlModel factset + converted taxonomy into the internal
 * report-data structure (the shape ReportSet expects as its constructor
 * argument).
 *
 * @param {Object} factsetDoc   Parsed factset JSON (may be wrapped in xbrlModel)
 * @param {Object} taxonomyDoc  Parsed converted-taxonomy JSON, or null
 * @param {Object} options      { documentFile: basename of the source document }
 * @return {Object}             Internal report-data for ReportSet
 */
export function buildReportData(factsetDoc, taxonomyDoc, options = {}) {
    const factset = unwrapModel(factsetDoc);
    const taxonomy = unwrapModel(taxonomyDoc);

    const prefixes = {
        ...(taxonomyDoc?.documentInfo?.namespaces ?? {}),
        ...(factsetDoc?.documentInfo?.namespaces ?? {}),
    };

    const labelsByObject = buildLabelsByObject(taxonomy);
    const dimensionConcepts = collectDimensionConcepts(taxonomy);
    const concepts = buildConcepts(taxonomy, labelsByObject, dimensionConcepts);
    const facts = buildFacts(factset);
    // Ensure every fact's concept is registered so the inspector falls back to
    // the concept QName (not "<no label>") when no taxonomy/labels are loaded.
    for (const factData of Object.values(facts)) {
        const c = factData.a.c;
        if (c && concepts[c] === undefined) {
            concepts[c] = { labels: labelsByObject[c] ?? { std: {} } };
        }
    }
    const { rels, roles, roleDefs } = buildNetworks(taxonomy);

    // Register a role-map entry for every label-role prefix in use, so the
    // inspector can resolve a display name for each label role.
    const labelRolePrefixes = new Set();
    for (const c of Object.values(concepts)) {
        for (const role of Object.keys(c.labels ?? {})) {
            labelRolePrefixes.add(role);
        }
    }
    for (const prefix of labelRolePrefixes) {
        if (roles[prefix] === undefined) {
            roles[prefix] = STD_LABEL_ROLE_URI[prefix] ?? `http://www.xbrl.org/2003/role/${prefix}`;
        }
    }

    const languages = {};
    for (const lbl of taxonomy.labels ?? []) {
        if (lbl.language) {
            languages[lbl.language] = lbl.language;
        }
    }

    const cubes = buildCubes(taxonomy, labelsByObject);
    const sections = buildSections(taxonomy, labelsByObject);

    /*
     * What processing concluded about this report, carried unchanged.  Either
     * document may hold it: a compiled model carries its own, and a factset
     * paired with a taxonomy carries it on whichever was validated.  Stored raw
     * rather than indexed so report data stays plain JSON; Report indexes it on
     * first use.  See derivedContent.js for why a viewer carries these verdicts
     * instead of recomputing them.
     */
    const derivedContent = factsetDoc?.derivedContent ?? taxonomyDoc?.derivedContent;

    const documentFile = options.documentFile;
    const reportData = {
        concepts,
        facts,
        rels,
        roleDefs,
        cubes,
        sections,
        ...(derivedContent ? { derivedContent } : {}),
        localDocs: documentFile ? { [documentFile]: ["inline"] } : {},
    };

    return {
        prefixes,
        roles,
        languages,
        features: {},
        sourceReports: [{
            docSetFiles: documentFile ? [documentFile] : [],
            targetReports: [reportData],
        }],
        validation: [],
    };
}
