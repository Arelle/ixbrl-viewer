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
    this.a = a;
    this.b = b;
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
