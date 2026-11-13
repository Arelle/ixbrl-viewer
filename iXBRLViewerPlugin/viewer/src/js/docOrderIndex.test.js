// See COPYRIGHT.md for copyright information

import { DocOrderIndex } from "./docOrderIndex.js";

function indexOf(items) {
    const index = new DocOrderIndex();
    for (const [vuid, docIndex] of items) {
        index.addItem(vuid, docIndex);
    }
    return index;
}

describe("DocOrderIndex", () => {
    test("puts an item added more than once where it was last added", () => {
        const index = indexOf([["h1", 0], ["h2", 0], ["f1", 0], ["f2", 0], ["h1", 0], ["f3", 0]]);

        expect(index.length()).toBe(5);
        expect(index.indexOf("h1")).toBe(3);
        expect(index.indexOf("f3")).toBe(4);
    });

    test("visits every item once going forwards", () => {
        const index = indexOf([["h1", 0], ["h2", 0], ["f1", 0], ["f2", 0], ["h1", 0], ["f3", 0]]);
        const visited = [];
        let vuid = "h2";
        for (let i = 0; i < 5; i++) {
            vuid = index.getAdjacentItem(vuid, 1);
            visited.push(vuid);
        }

        expect(visited).toEqual(["f1", "f2", "h1", "f3", "h2"]);
    });

    test("finds an item added more than once in the document it was last added in", () => {
        const index = indexOf([["h1", 0], ["f1", 0], ["f2", 1], ["h1", 1]]);

        expect(index.getFirstInDocument(0)).toBe("f1");
        expect(index.getLastInDocument(1)).toBe("h1");
    });

    test("keeps items added after a query in order", () => {
        const index = indexOf([["h1", 0], ["f1", 0], ["h1", 0]]);
        expect(index.length()).toBe(2);

        index.addItem("f2", 0);
        index.addItem("f1", 0);

        expect(index.length()).toBe(3);
        expect(index.getAdjacentItem("h1", 1)).toBe("f2");
        expect(index.getAdjacentItem("f2", 1)).toBe("f1");
    });
});
