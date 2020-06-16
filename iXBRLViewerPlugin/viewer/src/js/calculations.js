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

import $ from 'jquery';
import { setDefault } from './util.js';

export function Calculation(fact) {
    this._fact = fact;
}

/* Resolve calculation relationships to a map of maps of maps 
 * (ELR->conceptName->fact id->fact object) */

Calculation.prototype.calculationFacts = function () {
    var fact = this._fact;
    var report = fact.report();
    if (!this._conceptToFact) {
        var rels = report.getChildRelationships(fact.conceptName(), "calc")
        var ctf = {};
        $.each(rels, function (elr, rr) {
            ctf[elr] = {};
            if (rr.length > 0) {
                var otherFacts = report.getAlignedFacts(fact, {"c": $.map(rr, (r,i) => r.t ) });
                $.each(otherFacts, (i,ff) => setDefault(ctf[elr], ff.conceptName(), {})[ff.id] = ff);
            }
        });
        this._conceptToFact = ctf;
    }
    return this._conceptToFact;
}

Calculation.prototype.hasCalculations = function () {
    var ctf = this.calculationFacts();
    return Object.keys(ctf).length > 0;
}

Calculation.prototype.elrs = function () {
    var ctf = this.calculationFacts();
    var elrs = {};
    $.each(ctf, function (k,v) {
        if (Object.keys(v).length > 0) {
            elrs[k] = k.match(/[^\/]*$/)[0];
        }
    }); 
    return elrs;
}

/*
 * Select the ELR which is the best match for a given array of facts
 */
Calculation.prototype.bestELRForFactSet = function(facts) {
    var ctf = this.calculationFacts();
    var bestMatchELR = "";
    var bestMatchCount = -1;
    $.each(ctf, function (elr, rr) {
        var matchCount = 0;
        $.each(rr, function (concept, ff) {
            var matched = 0;
            $.each(ff, function (fid, calcFact) {
                if ($.inArray(fid, facts) >  -1) {
                    matched = 1;
                } 
            });
            matchCount += matched;
        });
        if (matchCount/Object.keys(rr).length > bestMatchCount) {
            bestMatchCount = matchCount/Object.keys(rr).length;    
            bestMatchELR = elr;
        }
    }); 
    return bestMatchELR;
}

/*
 * Returns a list of objects with properties:
 *   weight (calc weight)
 *   facts (undefined, or a map of fact IDs to fact objects)
 *   concept (conceptName)
 */
Calculation.prototype.resolvedCalculation = function(elr) {
    var calc = [];
    var calcFacts = this.calculationFacts()[elr];
    var rels = this._fact.report().getChildRelationships(this._fact.conceptName(), "calc")[elr];
    $.each(rels, function (i, r) {
        var s;
        if (r.w == 1) {
            s = '+';
        }
        else if (r.w == -1) {
            s = '-';
        }
        else {
            s = r.w;
        }
        calc.push({ weightSign: s, weight: r.w, facts: calcFacts[r.t], concept: r.t });
    });
    return calc;
    
}

