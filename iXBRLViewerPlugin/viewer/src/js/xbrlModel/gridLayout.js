// See COPYRIGHT.md for copyright information

/*
 * Interpretation of Tavi gridLayout data tables: a model's data table and facts in, the
 * table's grid out -- header cells with their spans, and data cells with their dimensions
 * and the facts placed in them.  No DOM: a surface renders the grid its own way.
 *
 * The rules follow the Tavi layout objects (tavi.md, "Data table object" onward) as the
 * PWD demo's model viewer reads them:
 *
 *  - A data cell's dimensions are those of its x and y axis items, its z axis item, and any
 *    tablePoints entry at its (1-based) grid coordinates.
 *  - A fact is in a cell when it has every one of the cell's dimensions with the same value
 *    and no other dimension than period, entity, unit and language.  A fact with a further
 *    dimension belongs to another table.
 *  - An axis group with no axisNetwork leaves its dimension to the facts: on the x axis it is
 *    a key column of an open table (whose rows are the facts' distinct key values), on the z
 *    axis a dimension the table is shown for one member at a time.  Here every combination
 *    the facts use is shown, one sheet each, so that every placed fact has a cell.
 *  - gridHeaders are read in document order: a header is followed by the headers beneath it
 *    (its children, at lower labelLevels), except one with rollUpLocation "end", which
 *    follows them.  A header has a position of its own (a row or column) unless its
 *    rollUpLocation is "none", or it has children and no rollUpLocation.
 */

const CORE_DIMENSIONS = new Set(['xbrl:concept', 'xbrl:period', 'xbrl:entity', 'xbrl:unit', 'xbrl:language']);
const FREE_DIMENSIONS = new Set(['xbrl:period', 'xbrl:entity', 'xbrl:unit', 'xbrl:language']);

function axisItems(axis) {
    return axis?.gridAxis?.axisItems ?? [];
}

function axisGroups(axis) {
    return axis?.gridAxis?.axisGroups ?? [];
}

/*
 * Labels by object name, for a language preference: the model's xbrl:label in the first
 * language available from `languages`.
 */
export function labelIndex(model, languages = ['en']) {
    const byObject = new Map();
    for (const label of model.labels ?? []) {
        if ((label.labelType ?? 'xbrl:label') !== 'xbrl:label') {
            continue;
        }
        const rank = languages.indexOf(label.language);
        const current = byObject.get(label.forObject);
        if (current === undefined || (rank >= 0 && (current.rank < 0 || rank < current.rank))) {
            byObject.set(label.forObject, { rank, value: label.value });
        }
    }
    return (name) => byObject.get(name)?.value;
}

/*
 * The cells of one axis's gridHeaders, as rectangles on a (level x position) grid.
 *
 * Returns { levels, positions, cells }, where each cell is
 * { label, level, first, last, depth } -- it starts at `level` (the highest is outermost)
 * and covers positions first..last; `depth` is how many levels it extends down (1 unless
 * nothing is beneath it).  Positions are the axis's rows or columns, in the order of its
 * axis items.
 */
export function gridHeaderCells(gridHeaders) {
    const headers = gridHeaders ?? [];
    const levels = headers.reduce((max, h) => Math.max(max, h.labelLevel ?? 1), 0);

    // The children of each header: the run of lower-level headers after it (before it, for
    // rollUpLocation "end"), unless a later same-level "end" header claims that run.
    const children = headers.map(() => []);
    headers.forEach((h, i) => {
        const level = h.labelLevel ?? 1;
        if (h.rollUpLocation === 'end') {
            for (let j = i - 1; j >= 0 && (headers[j].labelLevel ?? 1) < level; j--) {
                children[i].push(j);
            }
            return;
        }
        const run = [];
        let j = i + 1;
        for (; j < headers.length && (headers[j].labelLevel ?? 1) < level; j++) {
            run.push(j);
        }
        const claimedByEnd = j < headers.length && (headers[j].labelLevel ?? 1) === level
                             && headers[j].rollUpLocation === 'end';
        if (!claimedByEnd) {
            children[i].push(...run);
        }
    });

    // Own positions, in document order.
    const position = headers.map(() => null);
    let positions = 0;
    headers.forEach((h, i) => {
        const hasChildren = children[i].length > 0;
        if (h.rollUpLocation === 'none' || (hasChildren && !h.rollUpLocation)) {
            return;
        }
        position[i] = positions++;
    });

    const cells = [];
    headers.forEach((h, i) => {
        const covered = [i, ...children[i]].map(k => position[k]).filter(p => p !== null);
        if (covered.length === 0) {
            return;
        }
        cells.push({
            label: h.label ?? '',
            level: h.labelLevel ?? 1,
            first: Math.min(...covered),
            last: Math.max(...covered),
            depth: 1,
        });
    });

    // A cell extends down over the levels beneath it that no other cell occupies.
    const occupied = (level, first, last) => cells.some(c =>
        level <= c.level && level > c.level - c.depth && c.first <= last && first <= c.last);
    for (const cell of cells) {
        while (cell.level - cell.depth >= 1 && !occupied(cell.level - cell.depth, cell.first, cell.last)) {
            cell.depth++;
        }
    }
    return { levels, positions, cells };
}

/*
 * Every cell of one axis's header block, blanks included: the gridHeader cells, and a blank
 * wherever no header is, extending down the levels for as long as nothing else is there.
 * Each is { text, level, depth, first, span, blank }: it starts at `level` (outermost is
 * highest) and covers `depth` levels, and positions first..first+span-1.
 */
function headerBlock(gridHeaders, positions) {
    const { levels, cells } = gridHeaderCells(gridHeaders);
    const occupied = Array.from({ length: levels + 1 }, () => new Array(positions).fill(false));
    const block = [];
    for (const c of cells) {
        if (c.last >= positions) {
            continue; // more header positions than axis items: not drawn
        }
        block.push({ text: c.label, level: c.level, depth: c.depth, first: c.first, span: c.last - c.first + 1, blank: false });
        for (let level = c.level; level > c.level - c.depth; level--) {
            for (let p = c.first; p <= c.last; p++) {
                occupied[level][p] = true;
            }
        }
    }
    for (let level = levels; level >= 1; level--) {
        for (let p = 0; p < positions; p++) {
            if (occupied[level][p]) {
                continue;
            }
            let depth = 0;
            while (level - depth >= 1 && !occupied[level - depth][p]) {
                occupied[level - depth][p] = true;
                depth++;
            }
            block.push({ text: '', level, depth, first: p, span: 1, blank: true });
        }
    }
    return { levels, cells: block };
}

function canonicalKey(dimensions) {
    return JSON.stringify(Object.keys(dimensions).sort().map(k => [k, dimensions[k]]));
}

function memberText(value, label) {
    return label(value) ?? value;
}

/*
 * Whether a cell's dimensions lie in a negative (exclusion) cube: each of the cube's
 * dimensions other than the core period, entity and unit has, in the cell, a value in its
 * domain network (or none, where the dimension is optional), and the cell has no dimension
 * the cube lacks.
 */
function inExclusionCube(cellDimensions, cube, domainMembers) {
    const cubeDimensions = new Map((cube.cubeDimensions ?? []).map(cd => [cd.dimension, cd]));
    for (const dimension of Object.keys(cellDimensions)) {
        if (!cubeDimensions.has(dimension) && !FREE_DIMENSIONS.has(dimension)) {
            return false;
        }
    }
    for (const [dimension, cd] of cubeDimensions) {
        if (FREE_DIMENSIONS.has(dimension)) {
            continue;
        }
        const value = cellDimensions[dimension];
        if (value === undefined) {
            if (!cd.optional) {
                return false;
            }
            continue;
        }
        if (cd.domainNetwork && !domainMembers(cd.domainNetwork).has(value)) {
            return false;
        }
    }
    return true;
}

/*
 * The grid of a gridLayout data table, with `facts` (the model's fact objects) placed.
 *
 * Returns {
 *   name, label, cornerText,
 *   xHeaderRows: [[cell]],      // above the data columns (gridHeaders, then axis ids)
 *   yHeaderColumns: number,     // columns left of the data: gridHeader levels + 1 for ids
 *   sheets: [{ label, rows: [{ headerCells: [cell], dataCells: [cell] }] }],
 *   placedFacts: Map(fact name -> [{sheet, row, column}]),
 * }
 * A header cell is { text, colSpan, rowSpan, kind }; a data cell is { kind: 'data',
 * dimensions, facts: [name], blocked } or, in an open table's key column, { kind: 'key',
 * text, dimension, value }.  A table with no placed facts has no sheets.
 */
export function buildGrid(model, dataTable, facts, options = {}) {
    const label = options.label ?? labelIndex(model);
    const domainCache = new Map();
    const domainMembers = (name) => {
        if (!domainCache.has(name)) {
            const network = (model.domainNetworks ?? []).find(d => d.name === name)
                         ?? (model.networks ?? []).find(n => n.name === name);
            domainCache.set(name, new Set((network?.relationships ?? []).flatMap(r => [r.source, r.target])));
        }
        return domainCache.get(name);
    };

    const xItems = axisItems(dataTable.xAxis);
    const yItems = axisItems(dataTable.yAxis);
    const zItems = axisItems(dataTable.zAxis);
    const keyGroups = axisGroups(dataTable.xAxis).filter(g => g.dimensionName && !g.axisNetwork);
    const keyAxisIds = new Set(keyGroups.flatMap(g => g.axisIds ?? []));
    const keyDimensions = keyGroups.map(g => g.dimensionName);
    const zGroupDimensions = axisGroups(dataTable.zAxis).map(g => g.dimensionName).filter(d => d);
    const isOpen = yItems.length === 0 && keyGroups.length > 0;
    const freeDimensions = new Set([...keyDimensions, ...zGroupDimensions]);

    const cube = (model.cubes ?? []).find(c => c.name === dataTable.cubeName);
    const exclusionCubes = (cube?.excludeCubes ?? [])
        .map(name => (model.cubes ?? []).find(c => c.name === name)).filter(c => c);

    const tablePointDimensions = (x, y) => {
        const dimensions = {};
        for (const point of dataTable.tablePoints ?? []) {
            const coordinates = point.gridCoordinates ?? {};
            if (coordinates.xAxis !== undefined && String(coordinates.xAxis) !== String(x + 1)) {
                continue;
            }
            if (coordinates.yAxis !== undefined && String(coordinates.yAxis) !== String(y + 1)) {
                continue;
            }
            Object.assign(dimensions, point.dimensions ?? {});
        }
        return dimensions;
    };

    // Each cell's fixed dimensions (open tables: per column, the row adds the key values).
    const rowsOfItems = isOpen ? [null] : (yItems.length > 0 ? yItems : [{ dimensions: {} }]);
    const zChoices = zItems.length > 0 ? zItems : [{ dimensions: {} }];

    /*
     * Place every fact: index the cells of each z item by their dimensions other than the
     * core ones, and look each fact up by its own dimensions less the free ones (key and z
     * group dimensions), whose values then name its sheet and, in an open table, its row.
     */
    /*
     * Only facts of the table's concepts can be in it, so where every cell names its concept
     * the candidates come from options.factsByConcept (an index over all the facts, built once
     * for a model's tables) rather than from every fact.
     */
    let candidates = facts;
    if (options.factsByConcept) {
        const cellConcepts = new Set();
        let everyCellHasConcept = true;
        for (const zItem of zChoices) {
            for (const xItem of xItems.filter(i => !keyAxisIds.has(i.axisId))) {
                for (const [row, yItem] of rowsOfItems.entries()) {
                    const concept = tablePointDimensions(xItems.indexOf(xItem), row)['xbrl:concept']
                        ?? yItem?.dimensions?.['xbrl:concept'] ?? xItem.dimensions?.['xbrl:concept'] ?? zItem.dimensions?.['xbrl:concept'];
                    if (concept === undefined) {
                        everyCellHasConcept = false;
                    }
                    else {
                        cellConcepts.add(concept);
                    }
                }
            }
        }
        if (everyCellHasConcept) {
            // in the facts' own order, which is an open table's row order
            candidates = [...cellConcepts].flatMap(c => options.factsByConcept.get(c) ?? [])
                .sort((a, b) => options.factIndex.get(a) - options.factIndex.get(b));
        }
    }

    const placements = []; // {fact, zIndex, zValues, keyValues, row, column}
    zChoices.forEach((zItem, zIndex) => {
        const cellsByKey = new Map();
        rowsOfItems.forEach((yItem, row) => {
            xItems.forEach((xItem, column) => {
                if (keyAxisIds.has(xItem.axisId)) {
                    return;
                }
                const dimensions = { ...(zItem.dimensions ?? {}), ...(xItem.dimensions ?? {}),
                                     ...(yItem?.dimensions ?? {}), ...tablePointDimensions(column, row) };
                const nonCore = Object.fromEntries(Object.entries(dimensions).filter(([d]) => !FREE_DIMENSIONS.has(d)));
                const key = canonicalKey(nonCore);
                if (!cellsByKey.has(key)) {
                    cellsByKey.set(key, []);
                }
                cellsByKey.get(key).push({ row, column, dimensions });
            });
        });
        for (const fact of candidates) {
            const factDimensions = fact.factDimensions ?? {};
            const own = Object.fromEntries(Object.entries(factDimensions)
                .filter(([d]) => !FREE_DIMENSIONS.has(d) && !freeDimensions.has(d)));
            for (const cell of cellsByKey.get(canonicalKey(own)) ?? []) {
                // core dimensions a cell sets (from a z item or tablePoints) must match too
                const coreMatches = Object.entries(cell.dimensions).every(([d, v]) =>
                    !FREE_DIMENSIONS.has(d) || factDimensions[d] === v);
                if (!coreMatches) {
                    continue;
                }
                placements.push({
                    fact,
                    zIndex,
                    zValues: zGroupDimensions.map(d => factDimensions[d] ?? null),
                    keyValues: keyDimensions.map(d => factDimensions[d] ?? null),
                    row: cell.row,
                    column: cell.column,
                });
            }
        }
    });

    // Sheets: each z item and z group combination with facts, in the order of the facts.
    const sheetKeys = [];
    const sheetIndex = new Map();
    for (const p of placements) {
        const key = JSON.stringify([p.zIndex, p.zValues]);
        if (!sheetIndex.has(key)) {
            sheetIndex.set(key, sheetKeys.length);
            sheetKeys.push({ zIndex: p.zIndex, zValues: p.zValues });
        }
        p.sheet = sheetIndex.get(key);
    }

    // Header block of the x axis: gridHeaders, then a row of axis ids.
    const xBlock = headerBlock(dataTable.xAxis?.gridHeaders, xItems.length);
    const yBlock = isOpen ? { levels: 0, cells: [] } : headerBlock(dataTable.yAxis?.gridHeaders, yItems.length);
    const yHeaderColumns = yBlock.levels + 1;
    const hasXIds = xItems.some(i => i.axisId);
    const xHeaderRowCount = xBlock.levels + (hasXIds ? 1 : 0);

    const xHeaderRows = [];
    for (let level = xBlock.levels, r = 0; level >= 1; level--, r++) {
        const cells = xBlock.cells.filter(c => c.level === level).sort((a, b) => a.first - b.first)
            .map(c => ({ text: c.text, colSpan: c.span, rowSpan: c.depth, kind: c.blank ? 'blank' : 'x-header' }));
        if (r === 0) {
            cells.unshift({ text: options.cornerText ?? '', colSpan: yHeaderColumns, rowSpan: Math.max(1, xHeaderRowCount), kind: 'corner' });
        }
        xHeaderRows.push(cells);
    }
    if (hasXIds) {
        const cells = xItems.map(item => ({ text: item.axisId ?? '', colSpan: 1, rowSpan: 1, kind: 'x-id',
                                            title: dimensionsTitle(item.dimensions) }));
        if (xBlock.levels === 0) {
            cells.unshift({ text: options.cornerText ?? '', colSpan: yHeaderColumns, rowSpan: 1, kind: 'corner' });
        }
        xHeaderRows.push(cells);
    }

    // Row header cells of each y position: the y header block cells starting there, outermost
    // first (across the header area a cell's depth is its colSpan, its span the rowSpan), then
    // the row's axis id.
    const yHeaderCellsByRow = yItems.map((item, row) => [
        ...yBlock.cells.filter(c => c.first === row).sort((a, b) => b.level - a.level)
            .map(c => ({ text: c.text, colSpan: c.depth, rowSpan: c.span, kind: c.blank ? 'blank' : 'y-header' })),
        { text: item.axisId ?? '', colSpan: 1, rowSpan: 1, kind: 'y-id', title: dimensionsTitle(item.dimensions) },
    ]);

    const placedFacts = new Map();
    const sheets = sheetKeys.map((sheetKey, sheet) => {
        const zItem = zChoices[sheetKey.zIndex];
        const zDimensions = { ...(zItem.dimensions ?? {}) };
        zGroupDimensions.forEach((d, i) => {
            if (sheetKey.zValues[i] !== null) {
                zDimensions[d] = sheetKey.zValues[i];
            }
        });
        const sheetPlacements = placements.filter(p => p.sheet === sheet);

        // An open table's rows: the key value combinations of its facts, in fact order.
        let rowKeys = null;
        if (isOpen) {
            rowKeys = [];
            const seen = new Map();
            for (const p of sheetPlacements) {
                const key = JSON.stringify(p.keyValues);
                if (!seen.has(key)) {
                    seen.set(key, rowKeys.length);
                    rowKeys.push(p.keyValues);
                }
                p.row = seen.get(key);
            }
        }

        const rowCount = isOpen ? rowKeys.length : rowsOfItems.length;
        const rows = [];
        for (let row = 0; row < rowCount; row++) {
            const keyDimensionValues = isOpen
                ? Object.fromEntries(keyDimensions.map((d, i) => [d, rowKeys[row][i]]).filter(([, v]) => v !== null))
                : {};
            const headerCells = isOpen
                ? [{ text: String(row + 1), colSpan: 1, rowSpan: 1, kind: 'y-id' }]
                : (yItems.length > 0 ? yHeaderCellsByRow[row] : [{ text: '', colSpan: 1, rowSpan: 1, kind: 'y-id' }]);
            const dataCells = xItems.map((xItem, column) => {
                const keyGroup = keyGroups.find(g => (g.axisIds ?? []).includes(xItem.axisId));
                if (keyGroup) {
                    const value = keyDimensionValues[keyGroup.dimensionName];
                    return { kind: 'key', dimension: keyGroup.dimensionName, value,
                             text: value === undefined ? '' : memberText(value, label) };
                }
                const dimensions = { ...zDimensions, ...(xItem.dimensions ?? {}),
                                     ...(isOpen ? keyDimensionValues : (rowsOfItems[row].dimensions ?? {})),
                                     ...tablePointDimensions(column, row) };
                return {
                    kind: 'data',
                    dimensions,
                    facts: [],
                    blocked: exclusionCubes.some(c => inExclusionCube(dimensions, c, domainMembers)),
                };
            });
            rows.push({ headerCells, dataCells });
        }
        for (const p of sheetPlacements) {
            const cell = rows[p.row]?.dataCells[p.column];
            if (cell?.kind === 'data') {
                cell.facts.push(p.fact.name);
                if (!placedFacts.has(p.fact.name)) {
                    placedFacts.set(p.fact.name, []);
                }
                placedFacts.get(p.fact.name).push({ sheet, row: p.row, column: p.column });
            }
        }

        const zLabels = [];
        for (const [d, v] of Object.entries(zDimensions)) {
            zLabels.push(`${label(d) ?? d}: ${memberText(v, label)}`);
        }
        return { label: zLabels.join('; '), dimensions: zDimensions, rows };
    });

    return {
        name: dataTable.name,
        label: label(dataTable.name) ?? options.tableLabel,
        xHeaderRows,
        yHeaderColumns,
        isOpen,
        sheets,
        placedFacts,
    };
}

function dimensionsTitle(dimensions) {
    return Object.entries(dimensions ?? {}).map(([d, v]) => `${d}: ${v}`).join('\n');
}

/*
 * The gridLayout data tables of a model, each with its grid; tables in which no fact is
 * placed are left out (a report shows the templates it reports).
 */
export function gridLayoutTables(model, options = {}) {
    const label = labelIndex(model, options.languages);
    const facts = model.facts ?? [];
    const factsByConcept = new Map();
    const factIndex = new Map(facts.map((fact, i) => [fact, i]));
    for (const fact of facts) {
        const concept = fact.factDimensions?.['xbrl:concept'];
        if (!factsByConcept.has(concept)) {
            factsByConcept.set(concept, []);
        }
        factsByConcept.get(concept).push(fact);
    }
    const tables = [];
    for (const layout of model.layouts ?? []) {
        for (const dataTable of layout.dataTables ?? []) {
            if (dataTable.tableType !== 'gridLayout') {
                continue;
            }
            const grid = buildGrid(model, dataTable, facts, { label, factsByConcept, factIndex });
            if (grid.sheets.length > 0 || options.includeEmpty) {
                tables.push(grid);
            }
        }
    }
    return tables;
}
