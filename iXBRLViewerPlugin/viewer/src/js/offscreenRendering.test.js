// See COPYRIGHT.md for copyright information

import { OffscreenRendering } from "./offscreenRendering.js";

// jsdom leaves properties it doesn't compute empty.
const STYLE_DEFAULTS = { position: "static", contentVisibility: "visible", contain: "none", overflow: "visible", float: "none", writingMode: "horizontal-tb" };

let resizeObserver;
let visibilityObserver;
let realGetComputedStyle;

class MockObserver {
    constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.observed = [];
    }
    observe(el) { this.observed.push(el); }
    disconnect() { this.observed = []; }
}

beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    resizeObserver = undefined;
    visibilityObserver = undefined;
    realGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (el) => {
        const cs = realGetComputedStyle(el);
        return new Proxy(cs, { get: (target, prop) => target[prop] || STYLE_DEFAULTS[prop] || target[prop] });
    };
    window.ResizeObserver = class extends MockObserver {
        constructor(...args) { super(...args); resizeObserver = this; }
    };
    window.IntersectionObserver = class extends MockObserver {
        constructor(...args) { super(...args); visibilityObserver = this; }
    };
});

afterEach(() => {
    window.getComputedStyle = realGetComputedStyle;
    delete window.ResizeObserver;
    delete window.IntersectionObserver;
});

function sizeEntry(el) {
    const r = el.getBoundingClientRect();
    return { target: el, contentBoxSize: [{ inlineSize: r.width, blockSize: r.height }] };
}

function visibilityEntry(el) {
    const r = el.getBoundingClientRect();
    return { target: el, isIntersecting: r.bottom > -1.5 * window.innerHeight && r.top < 2.5 * window.innerHeight };
}

// Deliver the observers' initial notifications, based on the mocked rects.
function deliver() {
    resizeObserver?.callback(resizeObserver.observed.map(sizeEntry));
    visibilityObserver?.callback(visibilityObserver.observed.map(visibilityEntry));
}

function setRect(el, top, height, width = 800) {
    el.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: width, width });
}

// A block of the given number of descendants, placed in the document.
function block(top, height, { style = "position: relative", descendants = 60 } = {}) {
    const div = document.createElement("div");
    if (style !== null) {
        div.setAttribute("style", style);
    }
    div.innerHTML = "<span>x</span>".repeat(descendants);
    setRect(div, top, height);
    document.body.append(div);
    return div;
}

function run(offscreen) {
    for (const _ of offscreen.start()) {
        // Run to completion.
    }
    deliver();
}

const FAR = 10000;

describe("OffscreenRendering", () => {
    test("skips self-contained blocks far from the viewport at their observed size", () => {
        const near = block(0, 500.25);
        const far = block(FAR, 1068.484375);
        run(new OffscreenRendering(document));

        expect(far.style.contentVisibility).toBe("auto");
        expect(far.style.containIntrinsicSize).toBe("800px 1068.484375px");
        expect(near.style.contentVisibility).toBe("");
        expect(visibilityObserver.observed).toEqual([near, far]);
        expect(visibilityObserver.options.root).toBe(document);
    });

    test("doesn't skip blocks until their size is known", () => {
        const el = block(FAR, 1000);
        for (const _ of new OffscreenRendering(document).start()) {
            // Run to completion.
        }
        expect(resizeObserver.observed).toEqual([el]);
        expect(visibilityObserver.observed).toEqual([]);
        expect(el.style.contentVisibility).toBe("");
    });

    test("doesn't skip blocks where containment could change layout or appearance", () => {
        const small = block(FAR, 100, { descendants: 10 });
        const inline = block(FAR, 100, { style: "display: inline" });
        const overflowing = block(FAR, 100);
        Object.defineProperty(overflowing, "scrollHeight", { value: 120 });
        Object.defineProperty(overflowing, "clientHeight", { value: 100 });

        const collapsing = block(FAR, 100, { style: null });
        collapsing.innerHTML = `<p style="margin-top: 10px">${"<span>x</span>".repeat(60)}</p>`;
        setRect(collapsing.firstChild, FAR, 90);

        const escaping = block(FAR, 100, { style: null });
        escaping.firstChild.setAttribute("style", "position: absolute");
        Object.defineProperty(escaping.firstChild, "offsetParent", { value: document.body });

        const contained = block(FAR, 100);
        contained.firstChild.setAttribute("style", "position: absolute");
        Object.defineProperty(contained.firstChild, "offsetParent", { value: contained });

        run(new OffscreenRendering(document));

        for (const el of [small, inline, overflowing, collapsing, escaping]) {
            expect(el.style.contentVisibility).toBe("");
        }
        expect(contained.style.contentVisibility).toBe("auto");
    });

    test("doesn't skip blocks that floats cross into", () => {
        const float = document.createElement("img");
        float.setAttribute("style", "float: left");
        setRect(float, FAR - 50, 100);
        document.body.append(float);
        const crossed = block(FAR, 1000);
        const formattingContext = block(FAR, 1000, { style: "position: relative; display: flow-root" });
        const below = block(FAR + 2000, 1000);
        run(new OffscreenRendering(document));

        expect(crossed.style.contentVisibility).toBe("");
        expect(formattingContext.style.contentVisibility).toBe("auto");
        expect(below.style.contentVisibility).toBe("auto");
    });

    test("doesn't skip blocks whose baseline may be used", () => {
        const flex = document.createElement("div");
        flex.setAttribute("style", "display: flex; align-items: baseline");
        document.body.append(flex);
        const aligned = block(FAR, 1000);
        flex.append(aligned);
        const cell = document.createElement("div");
        cell.setAttribute("style", "display: inline-block");
        document.body.append(cell);
        const inline = block(FAR, 1000);
        cell.append(inline);
        run(new OffscreenRendering(document));

        expect(aligned.style.contentVisibility).toBe("");
        expect(inline.style.contentVisibility).toBe("");
    });

    test("doesn't skip blocks in lists, or containing items of an enclosing list", () => {
        const list = document.createElement("ol");
        document.body.append(list);
        const item = document.createElement("li");
        list.append(item);
        const inList = block(FAR, 1000);
        item.append(inList);
        const containsItem = block(FAR, 1000);
        containsItem.append(document.createElement("li"));
        const containsList = block(FAR, 1000);
        const nestedList = document.createElement("ol");
        nestedList.append(document.createElement("li"));
        containsList.insertBefore(nestedList, containsList.children[30]);
        run(new OffscreenRendering(document));

        expect(inList.style.contentVisibility).toBe("");
        expect(containsItem.style.contentVisibility).toBe("");
        expect(containsList.style.contentVisibility).toBe("auto");
    });

    test("doesn't skip anything in documents that use counters", () => {
        const style = document.createElement("style");
        style.textContent = "h2 { counter-increment: section; }";
        document.head.append(style);
        const el = block(FAR, 1000);
        run(new OffscreenRendering(document));

        expect(el.style.contentVisibility).toBe("");
    });

    test("splits large blocks that can't be skipped into their children", () => {
        const outer = block(FAR, 1000, { descendants: 0 });
        Object.defineProperty(outer, "scrollHeight", { value: 2000 });
        const children = [0, 1].map(i => {
            const child = block(FAR + i * 500, 500);
            outer.append(child);
            return child;
        });
        for (let i = 0; i < 500; i++) {
            children[0].append(document.createElement("i"));
        }
        run(new OffscreenRendering(document));

        expect(outer.style.contentVisibility).toBe("");
        for (const child of children) {
            expect(child.style.contentVisibility).toBe("auto");
        }
    });

    test("renders blocks before they come into view, and skips them again once they leave", () => {
        const el = block(FAR, 1000);
        run(new OffscreenRendering(document));

        setRect(el, 0, 1000);
        visibilityObserver.callback([visibilityEntry(el)]);
        expect(el.style.contentVisibility).toBe("");

        setRect(el, -FAR, 1200);
        resizeObserver.callback([sizeEntry(el)]);
        visibilityObserver.callback([visibilityEntry(el)]);
        expect(el.style.contentVisibility).toBe("auto");
        expect(el.style.containIntrinsicSize).toBe("800px 1200px");
    });

    test("reset restores the original style attributes", () => {
        const styled = block(FAR, 1000);
        const unstyled = block(FAR, 1000, { style: null });
        const offscreen = new OffscreenRendering(document);
        run(offscreen);
        expect(unstyled.style.contentVisibility).toBe("auto");

        offscreen.reset();
        expect(styled.getAttribute("style")).toBe("position: relative;");
        expect(unstyled.hasAttribute("style")).toBe(false);
        expect(resizeObserver.observed).toEqual([]);
        expect(visibilityObserver.observed).toEqual([]);
    });

    test("reset abandons a pass in progress", () => {
        const el = block(FAR, 1000);
        const offscreen = new OffscreenRendering(document);
        const pass = offscreen.start();
        pass.next();
        offscreen.reset();
        while (!pass.next().done) {
            // Run to completion.
        }
        expect(el.style.contentVisibility).toBe("");
    });
});
