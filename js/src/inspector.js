import $ from 'jquery'

export function Inspector(report, viewer) {
    this._report = report;
    this._viewer = viewer;
    var inspector = this;

    viewer.onSelect(function (id) { inspector.selectFact(id) });
    $('#ixbrl-next-tag').click(function () { viewer.selectNextTag() } );
    $('#ixbrl-prev-tag').click(function () { viewer.selectPrevTag() } );

    $('#ixbrl-show-all-tags').change(function(e){ viewer.highlightAllTags(this.checked) });

        if(this.checked) {
            $("iframe").contents().find(".ixbrl-element").addClass("ixbrl-highlight");
        }
        else {
            $("iframe").contents().find(".ixbrl-element").removeClass("ixbrl-highlight");
        }
}


Inspector.prototype.selectFact = function (id) {
    var fact = this._report.getFactById(id);
    $('#std-label').text(fact.getLabel("std") || fact.conceptName());
    $('#documentation').text(fact.getLabel("doc") || "");
    $('#concept').text(fact.conceptName());
    $('#period').text(fact.periodString());
    $('#dimensions').empty()
    for (var d in fact.f.d) {
        var x = $('<div class="dimension">').text(this._report.getLabel(d, "std") || d);
        x.appendTo('#dimensions');
        x = $('<div class="dimension-value">').text(this._report.getLabel(fact.f.d[d], "std") || fact.f.d[d]);
        x.appendTo('#dimensions');
        
    }
    $('#ixbrl-search-results tr').removeClass('selected');
    $('#ixbrl-search-results tr').filter(function () { return $(this).data('ivid') == id }).addClass('selected');
}
