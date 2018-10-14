import $ from 'jquery'
import FileSaver from 'file-saver'

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
    var rows = [];
    table.find("tr").each(function () {
        var row = [];
        $(this).find("td, th").each(function () {
            var colspan = $(this).attr("colspan");
            if (colspan) {
                for (var i=0; i < colspan-1; i++) {
                    row.push("");
                }
            }
            var v;
            var facts = $(this).find('.ixbrl-element');
            if (facts.length > 0) {
                var id = facts.first().data('ivid');
                var fact = report.getFactById(id);
                row.push(fact);
            }
            else {
                v = $(this).text();
                row.push(v);
            }
        });
        rows.push(row);
    });
    return rows;
}

TableExport.prototype._getFactsInSlice = function (slice) {
    var facts = [];
    for (var j = 0; j < slice.length; j++) {
        var cell = slice[j];
        if (typeof cell == "object") {
            facts.push(cell);

        }
    }
    return facts;
}

TableExport.prototype._getConstantAspectsForSlice = function (slice, aspects) {
    var facts = this._getFactsInSlice(slice);
    var allAspectsMap = {};
    for (var i = 0; i < facts.length; i++) {
        var aa = Object.keys(facts[i].aspects());
        for (var k = 0; k < aa.length; k++) {
            allAspectsMap[aa[k]] = 1;
        }
    }
    var allAspects = Object.keys(allAspectsMap);

    var constantAspects = {};
    if (facts.length > 0) {
        for (var i = 0; i < allAspects.length; i++) {
            var a = allAspects[i];
            constantAspects[a] = facts[0].aspects()[a];
            for (var j = 1; j < facts.length; j++) {
                if (facts[j].aspects()[a] != constantAspects[a]) {
                    delete constantAspects[a];
                }
            }
        }
    }
    return constantAspects;
}

TableExport.prototype._getColumnSlice = function (x) {

}

TableExport.prototype.exportTable = function () {

    var data = this._getRawTable(this._table);
    var rowLength = 0;

    var rowAspects = [];
    var allRowAspectsMap = {};
    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var constantAspects = this._getConstantAspectsForSlice(row);
        rowAspects.push(constantAspects);
        $.each(constantAspects, function (k,v) { allRowAspectsMap[k] = 1; });
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
        $.each(constantAspects, function (k,v) { allColumnAspectsMap[k] = 1; });
    }

    /* If an aspect is on both rows and columns, if must be constant across the
     * table, so only show it on columns */
    $.each(allColumnAspectsMap, function (k,v) { delete allRowAspectsMap[k] });
    var allRowAspects = Object.keys(allRowAspectsMap);
    var allColumnAspects = Object.keys(allColumnAspectsMap);

    for (var i = 0; i < allColumnAspects.length; i++) {
        var newRow = [];
        var aspect = allColumnAspects[i];
        for (var k = 0; k < allRowAspects.length; k++) {
            newRow.push("");
        }
        for (var k = 0; k < rowLength; k++) {
            newRow.push(columnAspects[k][aspect] || "");
        }
        data.unshift(newRow);
    }

    for (var k = allColumnAspects.length; k < data.length; k++) {
        var newCols = [];
        for (var i = 0; i < allRowAspects.length; i++) {
            var aspect = allRowAspects[i];
            newCols.push(rowAspects[k - allColumnAspects.length][aspect] || "");
        }
        data[k] = newCols.concat(data[k]);
    }

    var s = "";

    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        for (var j = 0; j < row.length; j++) {
            var cell = row[j];
            var v;
            if (typeof cell == 'object') {
                v = cell.value(); 
            }
            else {
                v = cell;
            }
            s += '"' + v + '",';
        }
        s += "\n";
    }

    var file = new File([s],"table.csv", {type: "text/plain;charset=utf-8"});
    FileSaver.saveAs(file);
}
