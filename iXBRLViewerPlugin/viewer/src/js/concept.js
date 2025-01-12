// See COPYRIGHT.md for copyright information

import { DataType } from "./datatype.js";
import { Balance } from "./balance.js";

export class Concept {
    constructor(report, name) {
        const c = report.concepts()[name];
        this.hasDefinition = (c !== undefined);
        this._c = c ?? {};
        this.name = name;
        this.report = report;
    }

    /*
     * Return a space separated list of reference values, or the empty string if
     * the concept has none.
     */
    referenceValuesAsString() {
        if (!this._c.r) {
            return "";
        }
        else {
            return this._c.r.flatMap(
                r => r.map(p => p[1])
            ).join(" ");
        }
    }

    labels() {
        if (!this._c.labels) {
            return {};
        }
        const lang = this.report.reportSet.viewerOptions.language;
        return Object.fromEntries(
            Object.entries(this._c.labels)
                .map(([role, labels]) => [role, labels[lang]])
                .filter(([role, label]) => label !== undefined)
        )
    }

    references() {
        if (!this._c.r) {
            return [];
        }
        else {
            return this._c.r.map(
                r => r.map(
                    p => ({ "part": p[0], "value": p[1] }) 
                )
            );
        }
    }

    isTypedDimension() {
        return this._c.d === "t";
    }

    isExplicitDimension() {
        return this._c.d === "e";
    }

    isDimension() {
        return "d" in this._c;
    }

    isEnumeration() {
        return Boolean(this._c && this._c.e);
    }

    label() {
        return this.report.getLabelOrName(this.name);
    }

    isTextBlock() {
        return Boolean(this._c.t);
    }

    typedDomainElement() {
        return this._c.td;
    }

    dataType() {
        if (this._c.dt !== undefined) {
            return new DataType(this.report, this._c.dt);
        }
    }

    balance() {
        if (this._c.b !== undefined) {
            return new Balance(this._c.b);
        }
    }
}
