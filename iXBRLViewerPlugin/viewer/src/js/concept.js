// See COPYRIGHT.md for copyright information

export class Concept {
    constructor(report, name) {
        this._c = report.concepts()[name] || {};
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
        return this._c.td
    }
}
