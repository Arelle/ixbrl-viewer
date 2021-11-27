// Copyright 2021 Workiva Inc.
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

import Decimal from 'decimal.js';

export function Interval(a, b) {
    this.a = typeof a == 'object' ? a : new Decimal(a);
    this.b = typeof b == 'object' ? b : new Decimal(b);
}

Interval.fromFact = function(fact) {
    const decimals = fact.decimals();
    let width = 0;
    if (decimals !== undefined) {
        const x = new Decimal(10);
        width = x.pow(0-decimals).times(0.5);
    }
    const value = new Decimal(fact.value());
    return new Interval(value.minus(width), value.plus(width));
}

Interval.prototype.intersection = function(other) {
    const a = Decimal.max(this.a, other.a);
    const b = Decimal.min(this.b, other.b);
    if (b.lessThan(a)) {
        return undefined;
    }
    return new Interval(a, b);
}

Interval.intersection = function(...intervals) {
    const aa = intervals.map(x => x.a);
    const bb = intervals.map(x => x.b);
    const a = Decimal.max(...aa);
    const b = Decimal.min(...bb);
    if (b.lessThan(a)) {
        return undefined;
    }
    return new Interval(a, b);
}

Interval.prototype.plus = function(other) {
    return new Interval(this.a.plus(other.a), this.b.plus(other.b));
}

Interval.prototype.times = function(x) {
    return x > 0 ? new Interval(this.a.times(x), this.b.times(x)) : new Interval(this.b.times(x), this.a.times(x));
}

