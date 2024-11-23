// See COPYRIGHT.md for copyright information

import i18next from 'i18next';
import { NAMESPACE_XBRLI } from "./util.js";

export class DataType {
    constructor(report, name) {
        this.name = name;
        this.report = report;
        this.qname = report.qname(name);
    }

    label() {
        if (this.qname.namespace == NAMESPACE_XBRLI) {
            return i18next.t(`dataTypes:${this.qname.localname}`, {defaultValue: this.qname.qname});
        }
        return this.report.reportSet.taxonomyNamer.convertQName(this.qname);
    }

}
