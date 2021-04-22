// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import $ from 'jquery'
import FileSaver from 'file-saver'
import * as Excel from 'exceljs/dist/exceljs.min.js';
import { Fact } from './fact.js';

export function TableExport(table, report) {
    this._table = table;
    this._report = report;
} 

TableExport.addHandles = function (iframe, report) {

    $('table', iframe).each(function () {
        var table = $(this);
        if (table.find(".ixbrl-element").length > 0) {
            table.css("position", "relative");
            var exporter = new TableExport(table, report);
            $('<div class="ixbrl-table-handle"><span>Export table</span></div>')
                .appendTo(table)
                .click(function () { exporter.exportTable() });
        }
    });

}

TableExport.prototype._getRawTable = function (table) {
    var table = this._table;
    var report = this._report;
    var maxRowLength = 0;
    var rows = [];
    var fact;
    table.find("tr:visible").each(function () {
        var row = [];
        $(this).find("td:visible, th:visible").each(function () {
            var colspan = $(this).attr("colspan");
            if (colspan) {
                for (var i=0; i < colspan-1; i++) {
                    row.push({ type: "static", value: ""});
                }
            }
            var v;
            
            var facts = $(this).find(".ixbrl-element").addBack(".ixbrl-element");
            var id;
            fact = null;
            if (facts.length > 0) {
                var id = facts.first().data('ivid');
                fact = report.getItemById(id);
            }
            if (fact instanceof Fact) {
                var cell = { type: "fact", fact: fact};
                
                var td = $(this)[0];
                var n = facts[0];
                var s = n.textContent;
                while (n !== td) {
                    if (n.previousSibling !== null) {
                        n = n.previousSibling;
                    }
                    else {
                        n = n.parentNode;
                    }
                    if (n.nodeType == 3) {
                        s = n.textContent + s;
                    }
                }
                if (s.match(/[\(-]\s*\d/) !== null) {
                    cell.negative = true;
                }
                cell.topBorder = ($(this).css('border-top-style').match(/(solid|double)/) !== null);
                cell.bottomBorder = ($(this).css('border-bottom-style').match(/(solid|double)/) !== null);
                row.push(cell);
                
            }
            else {
                v = $(this).text();
                row.push({ type: "static", value: v});
            }
        });
        if (row.length > maxRowLength) {
            maxRowLength = row.length;
        }
        rows.push(row);
    });
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        while (row.length < maxRowLength) {
            row.push({ type: "static", value: "" });
        }
    }
    return rows;
}

TableExport.prototype._getFactsInSlice = function (slice) {
    var facts = [];
    for (var j = 0; j < slice.length; j++) {
        var cell = slice[j];
        if (cell.type == 'fact') {
            facts.push(cell.fact);
        }
    }
    return facts;
}

/* 
 * Returns a map of aspect names to Aspect objects for aspects that are common
 * to all facts in the given table slice.  Returns null if there are no facts
 * in the slice.
 */ 
TableExport.prototype._getConstantAspectsForSlice = function (slice, aspects) {
    var facts = this._getFactsInSlice(slice);
    if (facts.length == 0) {
        return null;
    }
    var allAspectsMap = {};
    for (const fact of facts) {
        for (const a of fact.aspects()) {
            allAspectsMap[a.name()] = 1;
        }
    }
    var allAspects = Object.keys(allAspectsMap);

    var constantAspects = {};
    for (var i = 0; i < allAspects.length; i++) {
        var a = allAspects[i];
        constantAspects[a] = facts[0].aspect(a);
        for (var j = 1; j < facts.length; j++) {
            if (constantAspects[a] === undefined || !constantAspects[a].equalTo(facts[j].aspect(a))) {
                delete constantAspects[a];
            }
        }
    }
    return constantAspects;
}

TableExport.prototype._writeTable = function (data) {
    var wb = new Excel.Workbook();
    var ws = wb.addWorksheet('Table');
    
    var s = '';
    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        for (var j = 0; j < row.length; j++) {
            var cell = row[j];

            var cc = ws.getRow(i+1).getCell(j+1);
            if (cell.type == 'fact') {
                cc.value = Number(cell.fact.value());
                cc.numFmt = '#,##0';
                ws.getColumn(j+1).width = 18;
                /* Make this an option - apply presentation signs */
                if (cell.negative) {
                    cc.value = Math.abs(cc.value) * -1;
                }
                else {
                    cc.value = Math.abs(cc.value);
                }
                cc.border = {};
                if (cell.topBorder) {
                    cc.border.top = {style: "medium", color: { argb: 'FF000000' }};
                }
                if (cell.bottomBorder) {
                    cc.border.bottom = {style: "medium", color: { argb: 'FF000000' }};
                }
            }
            else if (cell.type == 'aspectLabel') {
                cc.value = cell.value;
            }
            else {
                cc.value = cell.value;
                cc.font = { color : { argb: 'FF707070' } };
            }
        }
    }
    return wb;
}

TableExport.prototype.exportTable = function () {

    var data = this._getRawTable(this._table);
    var rowLength = 0;

    var rowAspects = []; // array of aspect sets that are constant for each row
    var allRowAspectsMap = {}; // map to record full set of aspect names that appear on rows
    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var constantAspects = this._getConstantAspectsForSlice(row);
        rowAspects.push(constantAspects);
        $.each(constantAspects || {}, function (k,v) { allRowAspectsMap[k] = 1; });
        if (row.length > rowLength) {
            rowLength = row.length;
        }
    }

    var columnAspects = [];
    var allColumnAspectsMap = {};
    for (var i = 0; i < rowLength; i++) {
        var slice = [];
        for (var j = 0; j < data.length; j++) {
            slice.push(data[j][i]);
        }
        var constantAspects = this._getConstantAspectsForSlice(slice);
        columnAspects.push(constantAspects);
        $.each(constantAspects || {}, function (k,v) { allColumnAspectsMap[k] = 1; });
    }
    /* Attempt to remove unnecessary headers.  If an aspect is specified on all
     * columns that have facts (a universal column aspect), then don't include it
     * as a row aspect as well.  XXX: we should do the reverse, but need to be
     * careful not to delete aspects altogether. */
    var universalColumnAspectMap = $.extend({}, allColumnAspectsMap);
    $.each(allColumnAspectsMap, function (k,v) { 
        $.each(columnAspects, function (i,ca) { 
            if (ca !== null && !ca[k]) { delete universalColumnAspectMap[k] }
        })}
    );
    $.each(universalColumnAspectMap, function (k,v) { delete allRowAspectsMap[k] });

    var allRowAspects = Object.keys(allRowAspectsMap);
    var allColumnAspects = Object.keys(allColumnAspectsMap);

    for (var i = 0; i < allColumnAspects.length; i++) {
        var newRow = [];
        var aspect = allColumnAspects[i];
        for (var k = 0; k < allRowAspects.length; k++) {
            newRow.push("");
        }
        for (var k = 0; k < rowLength; k++) {
            var ca = columnAspects[k] || {};
            var v = ca[aspect];
            if (v !== undefined) {
                v = v.valueLabel("std");
            }
            newRow.push({ type: 'aspectLabel', value : v || ""});
        }
        data.unshift(newRow);
    }

    for (var k = allColumnAspects.length; k < data.length; k++) {
        var newCols = [];
        for (var i = 0; i < allRowAspects.length; i++) {
            var aspect = allRowAspects[i];
            var ra = rowAspects[k - allColumnAspects.length] || {};
            var v = ra[aspect];
            if (v !== undefined) {
                v = v.valueLabel("std");
            }
            newCols.push({ type: 'aspectLabel', value : v || ""});
        }
        data[k] = newCols.concat(data[k]);
    }


    var wb = this._writeTable(data);
    wb.xlsx.writeBuffer().then( data => {
      const blob = new Blob( [data], {type: "application/octet-stream"} );
      FileSaver.saveAs( blob, 'table.xlsx');
    });
}
