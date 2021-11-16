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

import { Dialog } from './dialog.js';

export function ValidationReportDialog() {
    Dialog.call(this, ".dialog.validation-report");
    this.addButton("Dismiss", true);
}

ValidationReportDialog.prototype = Object.create(Dialog.prototype);

ValidationReportDialog.prototype.displayErrors = function (errors) {
    var tbody = this.node.find("tbody");
    tbody.empty();
    for (const m of errors) {
        $("<tr></tr>")
            .append($("<td></td>").text(m.sev))
            .append($("<td></td>").text(m.code))
            .append($("<td></td>").text(m.msg))
            .appendTo(tbody);
    }
}
