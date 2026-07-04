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
// Facts are keyed by their xbrl:htmlSpanId, which is the id attribute of the
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

function htmlSpanIdsForFact(fact) {
    const ids = [];
    for (const fv of fact.factValues ?? []) {
        for (const vs of fv.valueSources ?? []) {
            for (const p of vs.properties ?? []) {
                if (p.property === "xbrl:htmlSpanId") {
                    for (const id of p.value ?? []) {
                        ids.push(id);
                    }
                }
            }
        }
    }
    return ids;
}

function buildFacts(factset) {
    const facts = {};
    for (const fact of factset.facts ?? []) {
        const dims = fact.factDimensions ?? {};
        const concept = dims["xbrl:concept"];
        if (!concept) {
            continue;
        }

        const a = { c: concept };
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
        // NOTE: xbrl:unit is deliberately not mapped to the numeric "u" aspect
        // for this first surface.  Numeric values in HTML are already display-
        // formatted text; treating facts as non-numeric lets us show that text
        // verbatim without re-running numeric formatting.  Unit-aware numeric
        // rendering is a follow-up once value/decimals are carried in the OIM.

        let jsonValue = null;
        let decimals;
        for (const fv of fact.factValues ?? []) {
            if (fv.value !== undefined) {
                jsonValue = fv.value;
            }
            if (fv.decimals !== undefined) {
                decimals = fv.decimals;
            }
        }

        const spanIds = htmlSpanIdsForFact(fact);
        if (spanIds.length === 0) {
            // No document locator (e.g. a hidden fact).  Skipped for this first
            // surface; hidden-fact support would key these by fact name and
            // bind them to an empty IXNode.
            continue;
        }
        for (const spanId of spanIds) {
            const factData = { a: { ...a }, v: jsonValue };
            if (decimals !== undefined) {
                factData.d = decimals;
            }
            facts[spanId] = factData;
        }
    }
    return facts;
}

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
        const isCalc = relationships.some(r =>
            (r.properties ?? []).some(p => p.property === "xbrl:weight"));
        const arcrole = isCalc ? "calc11" : "pres";
        const group = setDefault(setDefault(rels, arcrole, {}), elr, {});
        for (const r of relationships) {
            if (!r.source || !r.target) {
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
            }
            if (arcrole === "calc11" && rel.w === undefined) {
                rel.w = 1;
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

    const documentFile = options.documentFile;
    const reportData = {
        concepts,
        facts,
        rels,
        roleDefs,
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
