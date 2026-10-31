// See COPYRIGHT.md for copyright information

import { DocOrderIndex } from "./docOrderIndex.js";

function index(...items) {
    const i = new DocOrderIndex();
    for (const [vuid, docIndex] of items) {
        i.addItem(vuid, docIndex);
    }
    return i;
}

describe("DocOrderIndex", () => {
    test("indexOf gives the first position of an item", () => {
        const i = index(["a", 0], ["b", 0], ["a", 1], ["c", 1]);

        expect(i.indexOf("a")).toBe(0);
        expect(i.indexOf("b")).toBe(1);
        expect(i.indexOf("c")).toBe(3);
        expect(i.indexOf("d")).toBe(-1);
        expect(i.length()).toBe(4);
    });

    test("getAdjacentItem wraps around the ends", () => {
        const i = index(["a", 0], ["b", 0], ["c", 1]);

        expect(i.getAdjacentItem("a", 1)).toBe("b");
        expect(i.getAdjacentItem("a", -1)).toBe("c");
        expect(i.getAdjacentItem("c", 1)).toBe("a");
    });
});
