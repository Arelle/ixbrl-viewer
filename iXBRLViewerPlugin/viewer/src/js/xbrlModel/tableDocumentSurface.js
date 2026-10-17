// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { viewerUniqueId } from '../util.js';
import { iframeReady, applyFactValue } from './surfaceUtil.js';
import { gridLayoutTables, labelIndex } from './gridLayout.js';

/*
 * TableDocumentSurface shows a model's facts in the grid layouts of its data tables, for
 * reports that have no document of their own -- a prudential report is its templates.
 *
 * It implements the document surface contract of HtmlDocumentSurface and
 * PdfDocumentSurface: prepareDocument writes a document into the iframe, here generated
 * from the model's gridLayout data tables (gridLayout.js places the facts), and bind gives
 * each placed fact's cell the "ixbrl-element" wrapper, ivids and IXNode the Viewer relies
 * on, so selection, the inspector, search and next/previous work as on a document.
 *
 * Every data table with a placed fact is drawn, and every z axis selection its facts use,
 * one after another, so that every placed fact has a cell to select.  A fact placed in no
 * cell is kept as a hidden fact, as the other surfaces keep an unlocated one.
 */
export class TableDocumentSurface {

    constructor(options = {}) {
        this.languages = options.languages ?? ['en'];
    }

    // documentSource is { model }: the xbrlModel object whose layouts and facts are drawn.
    async prepareDocument(iframe, documentSource, iv) {
        const model = documentSource.model ?? {};
        this._tables = gridLayoutTables(model, { languages: this.languages });
        const label = labelIndex(model, this.languages);
        const factsByName = new Map((model.facts ?? []).map(f => [f.name, f]));
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(this._documentHtml(this._tables, factsByName, label));
        doc.close();
        this._doc = doc;
        await iframeReady(iframe);
    }

    _documentHtml(tables, factsByName, label) {
        const parts = [`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tables</title><style>${STYLE}</style></head><body>`];
        if (tables.length === 0) {
            parts.push('<p class="tl-empty">No fact of this report is in a grid layout table.</p>');
        }
        else {
            parts.push('<nav class="tl-contents"><ol>');
            tables.forEach((t, i) => {
                parts.push(`<li><a href="#tl-${i}">${escapeHtml(tableTitle(t))}</a> <span class="tl-count">${t.placedFacts.size}</span></li>`);
            });
            parts.push('</ol></nav>');
        }
        tables.forEach((t, i) => {
            parts.push(`<section class="tl-table" id="tl-${i}"><h2>${escapeHtml(tableTitle(t))}</h2>`);
            t.sheets.forEach((sheet) => {
                if (sheet.label) {
                    parts.push(`<h3>${escapeHtml(sheet.label)}</h3>`);
                }
                parts.push('<table class="tl-grid">');
                for (const row of t.xHeaderRows) {
                    parts.push('<tr>' + row.map(c => headerCellHtml(c)).join('') + '</tr>');
                }
                for (const row of sheet.rows) {
                    parts.push('<tr>' + row.headerCells.map(c => headerCellHtml(c)).join('')
                        + row.dataCells.map(c => dataCellHtml(c, factsByName, label)).join('') + '</tr>');
                }
                parts.push('</table>');
            });
            parts.push('</section>');
        });
        parts.push('</body></html>');
        return parts.join('');
    }

    bind(viewer) {
        const reportIndex = 0;
        const iframe = viewer._iframes.eq(0);
        iframe.data("selected", true);
        const facts = viewer._reportSet.reportsData()[0].facts;

        // The viewer's facts are keyed by position; each carries its model name.
        const keysByName = new Map();
        for (const [key, factData] of Object.entries(facts)) {
            if (factData.n === undefined) {
                continue;
            }
            if (!keysByName.has(factData.n)) {
                keysByName.set(factData.n, []);
            }
            keysByName.get(factData.n).push(key);
        }

        const bound = new Set();
        for (const span of this._doc.querySelectorAll('span[data-facts]')) {
            const names = JSON.parse(span.getAttribute('data-facts'));
            const nodes = $(span);
            for (const name of names) {
                for (const key of keysByName.get(name) ?? []) {
                    const factData = facts[key];
                    const vuid = viewerUniqueId(reportIndex, key);
                    nodes.addClass("ixbrl-element");
                    viewer._addIdToNodes(nodes, vuid);
                    const ixn = viewer._getOrCreateIXNode(vuid, nodes, 0, false);
                    if (!bound.has(key)) {
                        viewer.docOrderItemIndex.addItem(vuid, 0);
                        viewer.itemContinuationMap[vuid] = [];
                        applyFactValue(factData, ixn, span.textContent);
                        bound.add(key);
                    }
                    nodes.addClass(factData.a.u !== undefined ? "ixbrl-element-nonfraction" : "ixbrl-element-nonnumeric");
                }
            }
        }

        for (const [key, factData] of Object.entries(facts)) {
            if (!bound.has(key)) {
                this._bindHiddenFact(viewer, reportIndex, key, factData);
            }
        }
        return Promise.resolve();
    }

    // A fact in no cell: an IXNode with no wrapper, as HtmlDocumentSurface._bindHiddenFact.
    _bindHiddenFact(viewer, reportIndex, key, factData) {
        const vuid = viewerUniqueId(reportIndex, key);
        const ixn = viewer._getOrCreateIXNode(vuid, $([]), 0, false);
        ixn.isHidden = true;
        ixn._htmlHiddenCache = false;
        viewer.docOrderItemIndex.addItem(vuid, 0);
        viewer.itemContinuationMap[vuid] = [];
        applyFactValue(factData, ixn, "");
    }
}

function tableTitle(table) {
    const name = table.name?.split(':').pop() ?? '';
    return table.label ? `${name} ${table.label}` : name;
}

function headerCellHtml(cell) {
    const spans = (cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '') + (cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '');
    const title = cell.title ? ` title="${escapeHtml(cell.title)}"` : '';
    return `<th class="tl-${cell.kind}"${spans}${title}>${escapeHtml(cell.text ?? '')}</th>`;
}

function dataCellHtml(cell, factsByName, label) {
    if (cell.kind === 'key') {
        return `<td class="tl-key" title="${escapeHtml(cell.dimension)}">${escapeHtml(cell.text ?? '')}</td>`;
    }
    const classes = ['tl-data'];
    if (cell.blocked) {
        classes.push('tl-blocked');
    }
    if (cell.facts.length === 0) {
        return `<td class="${classes.join(' ')}"></td>`;
    }
    const values = [...new Set(cell.facts.map(name => displayValue(factsByName.get(name), label)))];
    if (values.length > 1) {
        classes.push('tl-conflict');
    }
    return `<td class="${classes.join(' ')}"><span data-facts="${escapeHtml(JSON.stringify(cell.facts))}">${escapeHtml(values[0])}</span></td>`;
}

/*
 * The text a cell shows for a fact: a number grouped and to its decimals, a member by its
 * label, anything else as it is.  The inspector shows the fact's own value.
 */
export function displayValue(fact, label) {
    const fv = fact?.factValues?.[0];
    const value = fv?.value;
    if (value === undefined || value === null) {
        return fact?.properties?.some(p => p.property === 'xbrl:nil') ? 'nil' : '';
    }
    const number = Number(value);
    if (fact.factDimensions?.['xbrl:unit'] !== undefined && value !== '' && !Number.isNaN(number)) {
        const decimals = fv.decimals;
        return number.toLocaleString('en-US', decimals !== undefined && decimals >= 0
            ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
            : { maximumFractionDigits: 0 });
    }
    return label(String(value)) ?? String(value);
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLE = `
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 13px; margin: 16px; color: #1f2328; }
.tl-contents ol { columns: 2; margin: 0 0 24px; padding-left: 20px; }
.tl-contents .tl-count { color: #6e7781; font-size: 11px; }
.tl-table { margin-bottom: 32px; }
.tl-table h2 { font-size: 15px; margin: 24px 0 8px; }
.tl-table h3 { font-size: 13px; font-weight: 600; margin: 12px 0 6px; color: #444c56; }
table.tl-grid { border-collapse: collapse; margin-bottom: 12px; }
.tl-grid th, .tl-grid td { border: 1px solid #c8ccd1; padding: 4px 6px; vertical-align: top; }
.tl-grid th { background: #f3f4f6; font-weight: 600; text-align: left; max-width: 260px; }
.tl-grid th.tl-x-header, .tl-grid th.tl-x-id { text-align: center; }
.tl-grid th.tl-x-id, .tl-grid th.tl-y-id { background: #e9ecef; white-space: nowrap; }
.tl-grid th.tl-blank, .tl-grid th.tl-corner { background: #f3f4f6; }
.tl-grid td.tl-data { text-align: right; white-space: nowrap; min-width: 48px; }
.tl-grid td.tl-key { text-align: left; white-space: nowrap; }
.tl-grid td.tl-blocked { background: #d3d3d3; }
.tl-grid td.tl-conflict { background: #ffcccc; }
`;
