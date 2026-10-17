// See COPYRIGHT.md for copyright information

import { gridHeaderCells, buildGrid, gridLayoutTables } from './gridLayout.js';

const fact = (name, dimensions, value = '1') => ({
    name,
    factDimensions: { 'xbrl:entity': 'lei:E', 'xbrl:period': '2027-01-01T00:00:00', ...dimensions },
    factValues: [{ name: `${name}_fv`, value }],
});

describe('gridHeaderCells', () => {
    test('a parent is followed by its children; "start" gives it a position of its own', () => {
        const { levels, positions, cells } = gridHeaderCells([
            { label: 'Assets', labelLevel: 2, rollUpLocation: 'start' },
            { label: 'Cash', labelLevel: 1 },
            { label: 'Bonds', labelLevel: 1 },
            { label: 'Liabilities', labelLevel: 2 },
        ]);
        expect(levels).toBe(2);
        expect(positions).toBe(4);
        expect(cells.map(c => [c.label, c.first, c.last, c.depth])).toEqual([
            ['Assets', 0, 2, 1], ['Cash', 1, 1, 1], ['Bonds', 2, 2, 1], ['Liabilities', 3, 3, 2],
        ]);
    });

    test('"none" spans its children without a position; "end" follows its children', () => {
        const { positions, cells } = gridHeaderCells([
            { label: 'Current year', labelLevel: 2, rollUpLocation: 'none' },
            { label: 'Q1', labelLevel: 1 },
            { label: 'Q2', labelLevel: 1 },
            { label: 'H1', labelLevel: 1 },
            { label: 'Q3', labelLevel: 1 },
            { label: 'Total', labelLevel: 2, rollUpLocation: 'end' },
        ]);
        // Q1..H1..Q3 are claimed by Total, which follows them: Current year has no children
        // and, rollUpLocation "none", no position, so it is not drawn
        expect(positions).toBe(5);
        expect(cells.map(c => [c.label, c.first, c.last])).toEqual([
            ['Q1', 0, 0], ['Q2', 1, 1], ['H1', 2, 2], ['Q3', 3, 3], ['Total', 0, 4],
        ]);
    });
});

describe('buildGrid', () => {
    const model = {
        labels: [
            { forObject: 'x:Total', labelType: 'xbrl:label', language: 'en', value: 'Total' },
            { forObject: 'x:Art', labelType: 'xbrl:label', language: 'en', value: 'Article' },
            { forObject: 'x:yes', labelType: 'xbrl:label', language: 'en', value: 'Yes' },
        ],
        domainNetworks: [{ name: 'x:blockedRows', root: 'x:RCls', relationships: [{ source: 'x:RCls', target: 'x:r2' }] }],
        cubes: [
            { name: 'x:Cube', cubeType: 'xbrl:reportCube', excludeCubes: ['x:Excl'],
              cubeDimensions: [{ dimension: 'xbrl:concept' }, { dimension: 'x:R', optional: true }] },
            { name: 'x:Excl', cubeType: 'xbrl:negativeCube',
              cubeDimensions: [{ dimension: 'xbrl:concept' }, { dimension: 'x:R', domainNetwork: 'x:blockedRows' },
                               { dimension: 'x:Art', optional: true }] },
        ],
    };
    const table = {
        name: 'x:T', tableType: 'gridLayout', cubeName: 'x:Cube',
        xAxis: { gridAxis: { axisItems: [{ axisId: 'C0010', dimensions: { 'xbrl:concept': 'x:c1' } },
                                          { axisId: 'C0020', dimensions: { 'xbrl:concept': 'x:c2' } }] } },
        yAxis: { gridAxis: { axisItems: [{ axisId: 'R0010', dimensions: { 'x:R': 'x:r1' } },
                                          { axisId: 'R0020', dimensions: { 'x:R': 'x:r2' } }] },
                 gridHeaders: [{ label: 'Row one', labelLevel: 1 }, { label: 'Row two', labelLevel: 1 }] },
        zAxis: { gridAxis: { axisGroups: [{ dimensionName: 'x:Art' }] } },
    };

    test('facts go to the cell with exactly their dimensions, one sheet per z group member', () => {
        const facts = [
            fact('f1', { 'xbrl:concept': 'x:c1', 'x:R': 'x:r1', 'x:Art': 'x:yes' }, '11'),
            fact('f2', { 'xbrl:concept': 'x:c2', 'x:R': 'x:r1', 'x:Art': 'x:yes' }, '21'),
            fact('f3', { 'xbrl:concept': 'x:c1', 'x:R': 'x:r1', 'x:Art': 'x:no' }, '12'),
            fact('other', { 'xbrl:concept': 'x:c1', 'x:R': 'x:r1', 'x:Art': 'x:yes', 'x:Fund': 'x:f9' }),
        ];
        const grid = buildGrid(model, table, facts);
        expect(grid.sheets.map(s => s.label)).toEqual(['Article: Yes', 'Article: x:no']);
        const [yes, no] = grid.sheets;
        expect(yes.rows[0].dataCells.map(c => c.facts)).toEqual([['f1'], ['f2']]);
        expect(no.rows[0].dataCells.map(c => c.facts)).toEqual([['f3'], []]);
        expect(grid.placedFacts.has('other')).toBe(false);
        expect(yes.rows[0].headerCells.map(c => c.text)).toEqual(['Row one', 'R0010']);
    });

    test('a cell in an exclusion cube is blocked', () => {
        const grid = buildGrid(model, table, [fact('f1', { 'xbrl:concept': 'x:c1', 'x:R': 'x:r1', 'x:Art': 'x:yes' })]);
        expect(grid.sheets[0].rows.map(r => r.dataCells.map(c => c.blocked))).toEqual([[false, false], [true, true]]);
    });

    test('an open table takes its rows from the key values of its facts', () => {
        const open = {
            name: 'x:Open', tableType: 'gridLayout',
            xAxis: { gridAxis: {
                axisItems: [{ axisId: 'C0001', dimensions: {} },
                            { axisId: 'C0010', dimensions: { 'xbrl:concept': 'x:amount' } }],
                axisGroups: [{ dimensionName: 'x:Line', axisIds: ['C0001'] }] } },
            yAxis: { gridAxis: {} },
        };
        const facts = [
            fact('a', { 'xbrl:concept': 'x:amount', 'x:Line': 'L1' }, '5'),
            fact('b', { 'xbrl:concept': 'x:amount', 'x:Line': 'L2' }, '6'),
            fact('c', { 'xbrl:concept': 'x:amount', 'x:Line': 'L1', 'x:Other': 'x:o' }, '7'),
        ];
        const grid = buildGrid({}, open, facts);
        expect(grid.isOpen).toBe(true);
        const rows = grid.sheets[0].rows;
        expect(rows.map(r => r.headerCells[0].text)).toEqual(['1', '2']);
        expect(rows.map(r => r.dataCells[0].text)).toEqual(['L1', 'L2']);
        expect(rows.map(r => r.dataCells[1].facts)).toEqual([['a'], ['b']]);
    });

    test('a band spans its children; a header with nothing beneath extends down', () => {
        const banded = {
            name: 'x:B', tableType: 'gridLayout',
            xAxis: { gridAxis: { axisItems: ['C1', 'C2', 'C3'].map((id, i) => ({ axisId: id, dimensions: { 'xbrl:concept': `x:c${i}` } })) },
                     gridHeaders: [{ label: 'Band', labelLevel: 2, rollUpLocation: 'none' },
                                   { label: 'A', labelLevel: 1 }, { label: 'B', labelLevel: 1 },
                                   { label: 'Alone', labelLevel: 2 }] },
            yAxis: { gridAxis: { axisItems: [{ axisId: 'R1', dimensions: {} }] } },
        };
        const grid = buildGrid({}, banded, [fact('f', { 'xbrl:concept': 'x:c0' })]);
        expect(grid.xHeaderRows.map(r => r.map(c => [c.kind, c.text, c.colSpan, c.rowSpan]))).toEqual([
            [['corner', '', 1, 3], ['x-header', 'Band', 2, 1], ['x-header', 'Alone', 1, 2]],
            [['x-header', 'A', 1, 1], ['x-header', 'B', 1, 1]],
            [['x-id', 'C1', 1, 1], ['x-id', 'C2', 1, 1], ['x-id', 'C3', 1, 1]],
        ]);
    });

    test('tables with no placed facts are left out', () => {
        const tables = gridLayoutTables({ layouts: [{ dataTables: [table] }], ...model, facts: [] });
        expect(tables).toEqual([]);
    });
});
