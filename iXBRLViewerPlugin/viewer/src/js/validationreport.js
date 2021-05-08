// Copyright 2021 Workiva Inc.
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

import $ from 'jquery';

export function ValidationReport() {
    this._dialog = $('#ixv #validation-report');
    var c = this;
    $('.close', this._dialog).click(function () { c.close() });
    $(document).bind("keyup",function (e) {
        if (e.keyCode === 27) {
            c.close();
        }
    });
}

ValidationReport.prototype.displayErrors = function (errors) {
    var tbody = this._dialog.find("tbody");
    tbody.empty();
    for (const m of errors) {
        $("<tr></tr>")
            .append($("<td></td>").text(m.sev))
            .append($("<td></td>").text(m.code))
            .append($("<td></td>").text(m.msg))
            .appendTo(tbody);
    }
}

ValidationReport.prototype.close = function () {
    $('.dialog-mask').hide(); 
    this._dialog.hide() ;
}

ValidationReport.prototype.show = function (errors) {
    this.displayErrors(errors);
    $('.dialog-mask').hide(); 
    this._dialog.show();
}


