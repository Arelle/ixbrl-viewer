import { QName } from './qname.js';
import $ from 'jquery';

export function Aspect(a, v, report) {
    this._aspect = a;
    this._value = v;
    this._report = report;
}

Aspect.prototype.name = function() {
    return this._aspect;
}

Aspect.prototype.label = function() {
    if (this._aspect == 'c') {
        return "Concept";
    }
    else if (this._aspect == 'p') {
        return "Period";
    }
    else if (this._aspect == 'u') {
        return "Unit";
    }
    else {
        return this._report.getLabel(this._aspect);
    }
}

Aspect.prototype.value = function() {
    return this._value;
}

Aspect.prototype.equalTo = function(a) {
    return a !== undefined && this._aspect == a._aspect && this._value == a._value;
}

Aspect.prototype.valueLabel = function(rolePrefix) {
    /* Taxonomy-defined dimension, treat as explicit - or concept */
    if (this._aspect.indexOf(":") > -1 || this._aspect == 'c') {
        return this._report.getLabel(this._value, rolePrefix);
    }
    else if (this._aspect == 'u') {
        var qname = this._report.qname(this._value);
        if (qname.namespace == "http://www.xbrl.org/2003/iso4217") {
            if (qname.localname == 'GBP') {
                return "£";
            }
            else if (qname.localname == 'USD') {
                return "US $";
            }
        }
        else {
            return this._value;
        }
    }
    else {
        return this._value;
    }
}

export function AspectSet(as) {
    this._aspectSet = as || [];
}

AspectSet.prototype.add = function (a) {
    this._aspectSet.push(a);
}

AspectSet.prototype.uniqueValues = function() {
    var x = {};
    $.each(this._aspectSet, function (i, v) {
        x[v.value()] = v;
    });
    return Object.values(x); 
}


