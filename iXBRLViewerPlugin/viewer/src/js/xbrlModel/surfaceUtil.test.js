// See COPYRIGHT.md for copyright information

import { parseNumericValue } from "./surfaceUtil.js";

describe("a value processing resolved, where the document text cannot give one", () => {
    test("text the viewer can read wins over the resolved value", () => {
        /*
         * Reconstructing from the located text is what makes a mis-bound locator
         * visible: a fact reading the wrong text shows the wrong value. Preferring
         * the resolved value everywhere would show the right value at the wrong
         * place, which is the harder defect to notice.
         */
        expect(parseNumericValue("1,234", { derivedValue: "999" })).toBe("1234");
        expect(parseNumericValue("(45)", { derivedValue: "999" })).toBe("-45");
    });

    test("text it cannot read falls back rather than showing raw text", () => {
        // ixt-sec:numwordsen, and the fifteen others SEC defines, leave text no
        // arithmetic here can read
        expect(parseNumericValue("one hundred", { derivedValue: "100" })).toBe("100");
        expect(parseNumericValue("", { derivedValue: "100" })).toBe("100");
        expect(parseNumericValue(null, { derivedValue: "100" })).toBe("100");
    });

    test("with nothing resolved, unreadable text is still unreadable", () => {
        expect(parseNumericValue("one hundred", {})).toBeNull();
        expect(parseNumericValue(null, {})).toBeNull();
    });

    test("an unusable resolved value does not throw", () => {
        expect(parseNumericValue("one hundred", { derivedValue: "not a number" })).toBeNull();
        expect(parseNumericValue("one hundred", { derivedValue: null })).toBeNull();
    });

    test("an explicit model value still outranks both", () => {
        expect(parseNumericValue("1,234", { explicitValue: "7", derivedValue: "999" })).toBe("7");
    });
});
