// See COPYRIGHT.md for copyright information

/*
 * Hit-testing untagged PDF content for bind mode.
 *
 * A PDF page's text is painted onto a canvas, and only facts that are already
 * bound carry overlay divs -- so the content bind mode targets is precisely the
 * content with nothing to receive a mouse event.  Giving every marked-content
 * run its own div is not the answer: that is the 26k-overlay path that made
 * highlight-on-startup take 14 seconds.  So the cursor is tested against the
 * rectangles directly.
 *
 * The index is one-dimensional, banded on y, because PDF text is laid out in
 * rows -- the same structure the aligner's row-signature strategy already
 * depends on.  A lookup reads the band under the cursor rather than scanning
 * the page, which matters because this runs on every mouse move.
 *
 * Two properties are worth stating because they are the ones a naive banded
 * index gets wrong:
 *
 *   - A rectangle is inserted into every band it overlaps, so a tall run is
 *     found from anywhere within it.  Rectangles taller than `maxSpan` bands
 *     go to a spill list scanned on every lookup instead, which bounds the
 *     duplication without losing them.
 *   - A lookup returns every rectangle containing the point, smallest first.
 *     Overlap is normal -- a run sitting within a larger one, or touching
 *     boxes -- and for tagging the smallest is nearly always the intended
 *     target: the number, not the row it sits in.
 */

const DEFAULT_MAX_SPAN = 8;
const MIN_BAND = 8;
const MAX_BAND = 64;

function areaOf(r) {
    return Math.max(0, r.width) * Math.max(0, r.height);
}

/*
 * Band height follows the page's own text: the median rectangle height, which
 * tracks the current render scale without having to be told about zoom.  A
 * fixed height would over- or under-band as the user zooms, quietly turning
 * one-band lookups into many.
 */
function autoBandHeight(entries) {
    if (!entries.length) {
        return MIN_BAND;
    }
    const heights = entries.map(e => e.rect.height).sort((a, b) => a - b);
    const median = heights[Math.floor(heights.length / 2)];
    return Math.min(MAX_BAND, Math.max(MIN_BAND, median * 1.5));
}

/*
 * Build the index from a page's { mcidStr: [rect] } map -- the structure
 * _setupPage already produces, so nothing new has to be extracted from the PDF.
 */
export function buildHitIndex(mcidRects, { bandHeight = "auto", maxSpan = DEFAULT_MAX_SPAN } = {}) {
    const entries = [];
    for (const [mcid, rects] of Object.entries(mcidRects ?? {})) {
        for (const rect of rects ?? []) {
            if (!(rect.width > 0) || !(rect.height > 0)) {
                continue;   // zero-area runs cannot be hit and would pollute the median
            }
            entries.push({ mcid, rect, area: areaOf(rect) });
        }
    }
    const band = bandHeight === "auto" ? autoBandHeight(entries) : bandHeight;
    const bands = new Map();
    const oversized = [];

    for (const entry of entries) {
        const first = Math.floor(entry.rect.top / band);
        const last = Math.floor((entry.rect.top + entry.rect.height) / band);
        if (last - first + 1 > maxSpan) {
            oversized.push(entry);
            continue;
        }
        for (let b = first; b <= last; b++) {
            let bucket = bands.get(b);
            if (!bucket) {
                bucket = [];
                bands.set(b, bucket);
            }
            bucket.push(entry);
        }
    }
    return { bands, oversized, bandHeight: band, size: entries.length };
}

function contains(rect, x, y) {
    return x >= rect.left && x <= rect.left + rect.width
        && y >= rect.top && y <= rect.top + rect.height;
}

/*
 * Every entry whose rectangle contains the point, smallest area first.
 * Coordinates are page-container relative, matching how the rects were built.
 */
export function hitTest(index, x, y) {
    if (!index) {
        return [];
    }
    const bucket = index.bands.get(Math.floor(y / index.bandHeight)) ?? [];
    const hits = [];
    // Defensive rather than currently reachable: an entry lives either in the
    // bands or in the spill list, and a lookup reads one band, so nothing is
    // seen twice today.  It matters the moment a lookup widens to neighbouring
    // bands -- a hover tolerance, say -- because a rect spanning bands is filed
    // in each of them.  Keyed on identity, not mcid: one mcid legitimately owns
    // many rects and they are distinct hit targets.
    const seen = new Set();
    for (const list of [bucket, index.oversized]) {
        for (const entry of list) {
            if (seen.has(entry) || !contains(entry.rect, x, y)) {
                continue;
            }
            seen.add(entry);
            hits.push(entry);
        }
    }
    hits.sort((a, b) => a.area - b.area);
    return hits;
}

/* The narrowest thing under the cursor, or null. */
export function hitTestBest(index, x, y) {
    return hitTest(index, x, y)[0] ?? null;
}

/*
 * The union of every rectangle belonging to one marked-content id -- the next
 * rung up the widen ladder from a single run.  Built by scanning rather than
 * kept as a second index: widening happens on a click, not on a mouse move.
 */
export function mcidBounds(index, mcid) {
    if (!index) {
        return null;
    }
    let box = null;
    const consider = (entry) => {
        if (entry.mcid !== mcid) {
            return;
        }
        const r = entry.rect;
        if (!box) {
            box = { left: r.left, top: r.top, width: r.width, height: r.height };
            return;
        }
        const right = Math.max(box.left + box.width, r.left + r.width);
        const bottom = Math.max(box.top + box.height, r.top + r.height);
        box.left = Math.min(box.left, r.left);
        box.top = Math.min(box.top, r.top);
        box.width = right - box.left;
        box.height = bottom - box.top;
    };
    const seen = new Set();
    for (const bucket of index.bands.values()) {
        for (const entry of bucket) {
            if (!seen.has(entry)) {
                seen.add(entry);
                consider(entry);
            }
        }
    }
    for (const entry of index.oversized) {
        consider(entry);
    }
    return box;
}
