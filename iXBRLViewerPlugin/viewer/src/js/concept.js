// Copyright 2019 Workiva Inc.
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

import $ from 'jquery'

export class Concept {
    constructor(report, name) {
        this._report = report;
        this.name = name;  
        this._c = report.data.concepts[name];
    }

    /*
     * Return a space separated list of reference values, or the empty string if
     * the concept has none.
     */
    referenceValuesAsString() {
        if (!this._c || !this._c.r) {
            return "";
        }
        else {
            return this._c.r.flatMap(
                r => r.map(p => p[1])
            ).join(" ");
        }
    }

    references() {
        if (!this._c || !this._c.r) {
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
        return this._c && this._c.d == "t";
    }

    isExplicitDimension() {
        return this._c && this._c.d == "e";
    }

    isDimension() {
        return this._c && "d" in this._c;
    }

    isEnumeration() {
        return Boolean(this._c.en);
    }
}

Concept.prototype.isTaxonomyExtension = function() {
    return this._c && this._c.hasOwnProperty('e') && this._c.e === 1;
}

Concept.prototype.getLabel = function(rolePrefix, withPrefix) {
    return this._report.getLabel(this.name, rolePrefix, withPrefix);
}
