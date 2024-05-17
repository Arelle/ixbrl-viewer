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

import { Fact } from "./fact.js";
import { Interval } from "./interval.js";
import { ReportSet } from "./reportset.js";
import Decimal from 'decimal.js';
import { viewerUniqueId } from "./util.js";
import './test-utils.js';

function testReportSet(facts) {
    const reportset = new ReportSet({
            prefixes: {},
            concepts: {},
            facts: facts
        });
    reportset._initialize();
    return reportset;
}

function testFact(factData) {
    factData.a = factData.a || {};
    factData.a.c = factData.a.c || 'eg:Concept1';
    if (!('u' in factData.a)) {
        factData.a.u = 'eg:pure';
    }
    else if (factData.a.u === undefined) {
        delete factData.a.u;
    }
    return testReportSet({"f1": factData}).getItemById(viewerUniqueId(0, "f1"));
}

describe("From facts", () => {
    test("Infinite precision", () => {
        var i = Interval.fromFact(testFact({v: 20}));
        expect(i.a).toEqualDecimal(20);
        expect(i.b).toEqualDecimal(20);

        i = Interval.fromFact(testFact({v: -20}));
        expect(i.a).toEqualDecimal(-20);
        expect(i.b).toEqualDecimal(-20);
    });

    test("Finite precision", () => {
        var i = Interval.fromFact(testFact({v: 20, d: 0}));
        expect(i.a).toEqualDecimal(19.5);
        expect(i.b).toEqualDecimal(20.5);

        i = Interval.fromFact(testFact({v: -20.123, d: 3}));
        expect(i.a).toEqualDecimal(-20.1235);
        expect(i.b).toEqualDecimal(-20.1225);

        i = Interval.fromFact(testFact({v: -20.123, d: -1}));
        expect(i.a).toEqualDecimal(-25.123);
        expect(i.b).toEqualDecimal(-15.123);
    });

    test("Non numeric", () => {
        var i = Interval.fromFact(testFact({v: 20, a: {u: undefined}}));
        expect(i).toBeUndefined();

        // This would be invalid XBRL
        i = Interval.fromFact(testFact({v: "abc" }));
        expect(i).toBeUndefined();
    });
});


describe("Intersect", () => {
    test("Intersecting", () => {
        var x = new Interval(5, 15);
        var y = new Interval(10, 25);
        var ii = x.intersection(y);
        expect(ii.a).toEqualDecimal(10);
        expect(ii.b).toEqualDecimal(15);

        ii = Interval.intersection(x, y);
        expect(ii.a).toEqualDecimal(10);
        expect(ii.b).toEqualDecimal(15);

        ii = y.intersection(x);
        expect(ii.a).toEqualDecimal(10);
        expect(ii.b).toEqualDecimal(15);

        y = new Interval(15, 25);
        ii = x.intersection(y);
        expect(ii.a).toEqualDecimal(15);
        expect(ii.b).toEqualDecimal(15);

        x = new Interval(10, 20);
        y = new Interval(15, 25);
        var z = new Interval(18, 30);
        ii = Interval.intersection(x, y, z);
        expect(ii.a).toEqualDecimal(18);
        expect(ii.b).toEqualDecimal(20);

    });

    test("No intersection", () => {
        var x = new Interval(5, 15);
        expect(x.intersection(new Interval(20, 25))).toBeUndefined();
        expect(x.intersection(new Interval(1, 4.99))).toBeUndefined();

        x = new Interval(10, 20);
        var y = new Interval(15, 25);
        var z = new Interval(21, 30);
        expect(Interval.intersection(x, y, z)).toBeUndefined();
    });
})

describe("Arithmetic", () => {
    test("Add", () => {
        var i = new Interval(5, 15);
        var ii = i.plus(new Interval(10, 20));
        expect(ii.a).toEqualDecimal(15);
        expect(ii.b).toEqualDecimal(35);
    });

    test("Multiply", () => {
        var i = new Interval(5, 15);
        var ii = i.times(2);
        expect(ii.a).toEqualDecimal(10);
        expect(ii.b).toEqualDecimal(30);

        ii = i.times(-2);
        expect(ii.a).toEqualDecimal(-30);
        expect(ii.b).toEqualDecimal(-10);

        i = new Interval(-10, -5);
        ii = i.times(2);
        expect(ii.a).toEqualDecimal(-20);
        expect(ii.b).toEqualDecimal(-10);

        ii = i.times(-2);
        expect(ii.a).toEqualDecimal(10);
        expect(ii.b).toEqualDecimal(20);

    });

});


