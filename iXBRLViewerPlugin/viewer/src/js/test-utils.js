// See COPYRIGHT.md for copyright information

import { Inspector } from "./inspector.js";
import { iXBRLViewer } from "./ixbrlviewer";
import { ViewerOptions } from "./viewerOptions";

export function TestInspector() {
    this._iv = new iXBRLViewer({});
    this._viewerOptions = new ViewerOptions();
}

TestInspector.prototype = Object.create(Inspector.prototype);

expect.extend({
    toEqualDecimal(received, expected) {
        const options = {
              comment: 'decimal.js equality',
              isNot: this.isNot,
              promise: this.promise,
        };
        const pass = received.equals(expected);
        const message = () =>
              this.utils.matcherHint('toEqualDecimals', undefined, undefined, options) +
              '\n\n' +
              `Expected: ${this.isNot ? '(not) ' : ''}${this.utils.printExpected(new Decimal(expected))}\n` +
              `Received: ${this.utils.printReceived(received)}`;

        return {actual: received, message, pass};
        
    }
});

export function createSimpleFact(id, concept, options=null) {
    options = options || {};
    return {
        [id]: {
            "a": {
                "c": concept,
                "u": options["unit"],
                "p": options["period"],
            },
            "d": options["decimals"],
            "v": options["value"]
        }
    };
}

export function createNumericFact(id, concept, unit, period, value, decimals) {
    const options = {
        "unit": unit,
        "period": period,
        "value": value
    };
    if (decimals !== undefined) { 
        options.decimals = decimals;
    }
    return createSimpleFact(id, concept, options);
}
