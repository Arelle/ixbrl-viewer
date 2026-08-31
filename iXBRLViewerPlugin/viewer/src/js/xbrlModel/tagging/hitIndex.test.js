// See COPYRIGHT.md for copyright information

import { buildHitIndex, hitTest, hitTestBest, mcidBounds } from "./hitIndex.js";

const r = (left, top, width, height) => ({ left, top, width, height });

/* A page of ordinary line-height runs, as _setupPage would produce. */
function textPage() {
    const m = {};
    for (let line = 0; line < 40; line++) {
        m[`mc${line}`] = [
            r(50, line * 14, 120, 10),
            r(200, line * 14, 60, 10),
            r(300, line * 14, 60, 10),
        ];
    }
    return m;
}

describe("buildHitIndex", () => {
    test("indexes every non-degenerate rect", () => {
        const idx = buildHitIndex(textPage());
        expect(idx.size).toBe(120);
    });

    test("drops zero-area runs rather than indexing unhittable entries", () => {
        const idx = buildHitIndex({ mc0: [r(0, 0, 0, 10), r(0, 0, 10, 0), r(0, 0, 10, 10)] });
        expect(idx.size).toBe(1);
    });

    test("auto band height tracks the page's own text size", () => {
        const small = buildHitIndex(textPage());
        const large = buildHitIndex({ mc0: [r(0, 0, 100, 40)] });
        expect(large.bandHeight).toBeGreaterThan(small.bandHeight);
    });

    test("auto band height is clamped, so odd pages cannot degenerate the index", () => {
        const tiny = buildHitIndex({ mc0: [r(0, 0, 10, 0.5)] });
        const huge = buildHitIndex({ mc0: [r(0, 0, 10, 5000)] });
        expect(tiny.bandHeight).toBeGreaterThanOrEqual(8);
        expect(huge.bandHeight).toBeLessThanOrEqual(64);
    });

    test("survives an empty or missing page", () => {
        expect(buildHitIndex({}).size).toBe(0);
        expect(buildHitIndex(null).size).toBe(0);
        expect(hitTest(buildHitIndex(null), 5, 5)).toEqual([]);
    });
});

describe("hitTest", () => {
    test("finds the run under the point", () => {
        const idx = buildHitIndex(textPage());
        const hit = hitTestBest(idx, 60, 5);
        expect(hit.mcid).toBe("mc0");
        expect(hit.rect.left).toBe(50);
    });

    test("returns nothing for a point in the gutter between runs", () => {
        const idx = buildHitIndex(textPage());
        expect(hitTest(idx, 180, 5)).toEqual([]);
    });

    test("returns nothing outside the page content", () => {
        const idx = buildHitIndex(textPage());
        expect(hitTest(idx, 60, 5000)).toEqual([]);
        expect(hitTest(idx, -10, 5)).toEqual([]);
    });

    test("smallest area first, so a number wins over the row containing it", () => {
        const idx = buildHitIndex({
            row: [r(0, 0, 500, 12)],      // whole-row run
            cell: [r(100, 0, 40, 12)],    // the number within it
        });
        const hits = hitTest(idx, 110, 6);
        expect(hits.map(h => h.mcid)).toEqual(["cell", "row"]);
    });

    test("a tall run is found from any band it spans", () => {
        // a drop cap / display figure crossing several line bands
        const idx = buildHitIndex({ ...textPage(), tall: [r(400, 0, 30, 60)] });
        for (const y of [2, 20, 40, 58]) {
            const hits = hitTest(idx, 410, y).map(h => h.mcid);
            expect(hits).toContain("tall");
        }
    });

    test("a run taller than maxSpan goes to the spill list and is still found", () => {
        const idx = buildHitIndex({ ...textPage(), banner: [r(400, 0, 30, 2000)] },
            { bandHeight: 10, maxSpan: 4 });
        expect(idx.oversized).toHaveLength(1);
        for (const y of [5, 500, 1900]) {
            expect(hitTest(idx, 410, y).map(h => h.mcid)).toContain("banner");
        }
    });

    test("the spill list does not leak hits outside its own bounds", () => {
        const idx = buildHitIndex({ banner: [r(400, 0, 30, 2000)] }, { bandHeight: 10, maxSpan: 4 });
        expect(hitTest(idx, 410, 2500)).toEqual([]);
        expect(hitTest(idx, 100, 500)).toEqual([]);
    });

    test("a rect filed in several bands is still reported once", () => {
        const idx = buildHitIndex({ tall: [r(0, 0, 50, 60)] }, { bandHeight: 10, maxSpan: 20 });
        expect(hitTest(idx, 10, 30)).toHaveLength(1);
    });

    test("hits exactly on an edge count as inside", () => {
        const idx = buildHitIndex({ mc: [r(10, 10, 20, 20)] });
        expect(hitTestBest(idx, 10, 10)).not.toBeNull();
        expect(hitTestBest(idx, 30, 30)).not.toBeNull();
        expect(hitTestBest(idx, 9.9, 10)).toBeNull();
    });

    test("finds runs on a band boundary", () => {
        // a rect starting exactly where a band does must not fall between bands
        const idx = buildHitIndex({ mc: [r(0, 20, 50, 10)] }, { bandHeight: 10 });
        expect(hitTestBest(idx, 10, 20)).not.toBeNull();
        expect(hitTestBest(idx, 10, 29)).not.toBeNull();
    });
});

describe("mcidBounds", () => {
    test("unions every rect of one marked-content id", () => {
        const idx = buildHitIndex({
            para: [r(50, 0, 100, 10), r(50, 14, 80, 10), r(50, 28, 120, 10)],
            other: [r(500, 0, 10, 10)],
        });
        expect(mcidBounds(idx, "para")).toEqual({ left: 50, top: 0, width: 120, height: 38 });
    });

    test("includes rects that landed in the spill list", () => {
        const idx = buildHitIndex({ m: [r(0, 0, 10, 10), r(0, 0, 10, 900)] },
            { bandHeight: 10, maxSpan: 4 });
        expect(mcidBounds(idx, "m").height).toBe(900);
    });

    test("is null for an unknown mcid", () => {
        expect(mcidBounds(buildHitIndex(textPage()), "nope")).toBeNull();
        expect(mcidBounds(null, "mc0")).toBeNull();
    });
});

describe("lookup cost", () => {
    test("a dense page reads a small fraction of its runs per lookup", () => {
        // 3,000 runs, as a dense financial page carries
        const m = {};
        for (let line = 0; line < 1000; line++) {
            m[`mc${line}`] = [r(50, line * 12, 100, 10), r(200, line * 12, 100, 10),
                              r(350, line * 12, 100, 10)];
        }
        const idx = buildHitIndex(m);
        expect(idx.size).toBe(3000);
        const band = idx.bands.get(Math.floor(6000 / idx.bandHeight)) ?? [];
        // the point of the index: a lookup touches a handful, not thousands
        expect(band.length).toBeLessThan(30);
        expect(idx.oversized).toHaveLength(0);
    });
});
