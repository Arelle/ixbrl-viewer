// See COPYRIGHT.md for copyright information

import i18next from 'i18next';
import { NAMESPACE_XBRLI } from "./util.js";

export class DataType {
    constructor(report, name) {
        this.name = name;
        this.report = name;
        this.qname = report.qname(name);
    }

    label() {
        if (this.qname.namespace == NAMESPACE_XBRLI) {
            console.log(this.qname.qname);
            return i18next.t(`dataTypes:${this.qname.localname}`, {defaultValue: this.qname.qname});
        }
        return this.qname.qname;
    }

}
