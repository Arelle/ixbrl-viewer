// See COPYRIGHT.md for copyright information

import Decimal from 'decimal.js';

/*
 * Class for working with numeric intervals, of the form: [a, b]
 *
 * Interval is closed (includes both bounds)
 * a must be <= b
 */
export class Interval {

    constructor(a, b) {
        this.a = typeof a == 'object' ? a : new Decimal(a);
        this.b = typeof b == 'object' ? b : new Decimal(b);
    }

    static fromFact(fact) {
        if (!fact.isNumeric()) {
            return undefined;
        }
        const decimals = fact.decimals();
        let width = 0;
        if (decimals !== undefined) {
            const x = new Decimal(10);
            width = x.pow(0-decimals).times(0.5);
        }
        let value;
        const factValue = fact.value();
        try {
            value = new Decimal(factValue);
        } catch (e) {
            if (e instanceof Error && /DecimalError/.test(e.message)) {
                return undefined;
            }
            throw e;
        }
        return new Interval(value.minus(width), value.plus(width));
    }

    intersection(other) {
        return Interval.intersection(this, other);
    }

    static intersection(...intervals) {
        if (intervals.includes(undefined) || intervals.length == 0) {
            return undefined;
        }
        const aa = intervals.map(x => x.a);
        const bb = intervals.map(x => x.b);
        const a = Decimal.max(...aa);
        const b = Decimal.min(...bb);
        if (b.lessThan(a)) {
            return undefined;
        }
        return new Interval(a, b);
    }

    plus(other) {
        return new Interval(this.a.plus(other.a), this.b.plus(other.b));
    }

    times(x) {
        return x > 0 ? new Interval(this.a.times(x), this.b.times(x)) : new Interval(this.b.times(x), this.a.times(x));
    }

    midpoint() {
        return Decimal.add(this.a, this.b).div(2);
    }
}
