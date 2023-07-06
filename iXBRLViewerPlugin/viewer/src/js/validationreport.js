// See COPYRIGHT.md for copyright information

import $ from 'jquery';

import { Dialog } from './dialog.js';

export class ValidationReportDialog extends Dialog {
    constructor() {
        super(".dialog.validation-report");
        this.addButton("Dismiss", true);
    }

    displayErrors(errors) {
        const tbody = this.node.find("tbody");
        tbody.empty();
        for (const m of errors) {
            $("<tr></tr>")
                .append($("<td></td>").text(m.sev))
                .append($("<td></td>").text(m.code))
                .append($("<td></td>").text(m.msg))
                .appendTo(tbody);
        }
    }
}
