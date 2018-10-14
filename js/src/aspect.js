

export function Aspect(a, v, report) {
    this._aspect = a;
    this._value = v;
    this._report = report;
}

Aspect.prototype.name = function() {
    return this._aspect;
}

Aspect.prototype.equalTo = function(a) {
    return a !== undefined && this._aspect == a._aspect && this._value == a._value;
}

Aspect.prototype.valueLabel = function(rolePrefix) {
    /* Taxonomy-defined dimension, treat as explicit - or concept */
    if (this._aspect.indexOf(":") > -1 || this._aspect == 'c') {
        return this._report.getLabel(this._value, rolePrefix);
    }
    else {
        return this._value;
    }
}
