// See COPYRIGHT.md for copyright information

// Blocks with more descendants than this are split into their children.
const SPLIT_DESCENDANTS = 3000;
// Blocks with fewer descendants than this aren't worth skipping.
const MIN_DESCENDANTS = 50;
// Blocks that can't be skipped are split into their children if they have
// more descendants than this.
const SPLIT_UNSKIPPABLE_DESCENDANTS = 500;
const SLICE_MS = 20;
// Chunks within this many viewport heights of the viewport are rendered.
const VIEWPORT_MARGIN = 1.5;

// Displays of blocks that can be skipped.
const BLOCK_DISPLAYS = new Set(["block", "flow-root", "flex", "grid"]);
const BLOCK_LEVEL_DISPLAYS = new Set([...BLOCK_DISPLAYS, "list-item", "table"]);
const FORMATTING_CONTEXT_DISPLAYS = new Set(["flow-root", "flex", "grid", "inline-block", "table", "table-cell"]);

const px = (v) => parseFloat(v) || 0;

/*
 * Lets the browser skip the rendering of parts of a large document that are
 * far from the viewport, using content-visibility, so that the cost of
 * layout, style changes and hit testing is proportional to what is near the
 * viewport rather than to the size of the document.
 *
 * Only blocks for which containment can't change layout are skipped, and
 * they are sized to exactly their rendered size.  Containment can move
 * content at fractional positions by a pixel, so blocks are rendered without
 * it before they come near the viewport.  What is displayed is rendered
 * exactly as it would be without this.
 */
export class OffscreenRendering {
    constructor(doc) {
        this._doc = doc;
        this._win = doc.defaultView;
        this._chunks = [];
        // Each as [element, top, bottom]
        this._floats = [];
        this._sizes = new Map();
        this._resizeObserver = null;
        this._visibilityObserver = null;
        this._generation = 0;
    }

    // Generator for use with runGenerator, as finding chunks requires
    // computed styles for most of the document.
    * start() {
        const generation = ++this._generation;
        let sliceStart = performance.now();
        const timeToYield = () => performance.now() - sliceStart > SLICE_MS;

        const styleSheets = this._scanStyleSheets();
        // Style containment scopes counters to the contained subtree.
        if (styleSheets.counters || this._doc.querySelector('[style*="counter-"]') !== null) {
            return;
        }
        // Static lists, as the document can change between slices.
        const floatCandidates = this._doc.body.querySelectorAll(styleSheets.floats ? "*" : '[style*="float"], [align]');
        for (const el of floatCandidates) {
            const cs = this._win.getComputedStyle(el);
            if (cs.float !== "none" && cs.display !== "none") {
                const r = el.getBoundingClientRect();
                this._floats.push([el, r.top - px(cs.marginTop), r.bottom + px(cs.marginBottom)]);
            }
            if (timeToYield()) {
                yield;
                sliceStart = performance.now();
                if (generation !== this._generation) {
                    return;
                }
            }
        }

        const candidates = [];
        this._findCandidates(this._doc.body, candidates);
        yield;
        sliceStart = performance.now();
        if (generation !== this._generation) {
            return;
        }

        // Checks only read, so layout stays clean between them.
        const accepted = [];
        while (candidates.length > 0) {
            const [el, descendants] = candidates.shift();
            if (this._canSkip(el)) {
                accepted.push(el);
            }
            else if (descendants > SPLIT_UNSKIPPABLE_DESCENDANTS) {
                this._findCandidates(el, candidates, true);
            }
            if (timeToYield()) {
                yield;
                sliceStart = performance.now();
                if (generation !== this._generation) {
                    return;
                }
            }
        }

        // Sizes come from a ResizeObserver, as rects lose precision far from
        // the viewport, and a chunk can only be skipped once its size is known.
        this._resizeObserver = new this._win.ResizeObserver(entries => this._resized(entries));
        this._visibilityObserver = new this._win.IntersectionObserver(
            entries => this._visibilityChanged(entries),
            { root: this._doc, rootMargin: `${VIEWPORT_MARGIN * 100}% 0px` },
        );
        for (const el of accepted) {
            this._chunks.push(el);
            this._resizeObserver.observe(el);
        }
    }

    // Render the whole document again.
    reset() {
        this._generation++;
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        this._visibilityObserver?.disconnect();
        this._visibilityObserver = null;
        for (const el of this._chunks) {
            this._unskip(el);
        }
        this._chunks = [];
        this._floats = [];
        this._sizes.clear();
    }

    _findCandidates(parent, candidates, childrenOnly = false) {
        for (const el of parent.children) {
            const descendants = el.getElementsByTagName("*").length;
            if (descendants < MIN_DESCENDANTS) {
                continue;
            }
            if (!childrenOnly && descendants > SPLIT_DESCENDANTS && el.childElementCount > 1) {
                const display = this._win.getComputedStyle(el).display;
                if (display === "block" || display === "flow-root" || display === "list-item") {
                    this._findCandidates(el, candidates);
                    continue;
                }
            }
            candidates.push([el, descendants]);
        }
    }

    // Whether the document's style sheets use counters or floats.  Rules that
    // can't be read are assumed to use both.
    _scanStyleSheets() {
        const used = { counters: false, floats: false };
        const isSet = (style, property) => !["", "none"].includes(style.getPropertyValue(property));
        const scan = (rules) => {
            for (const rule of rules) {
                if (rule.style !== undefined) {
                    used.counters ||= isSet(rule.style, "counter-increment") || isSet(rule.style, "counter-reset") || isSet(rule.style, "counter-set");
                    used.floats ||= isSet(rule.style, "float");
                }
                if (rule.cssRules !== undefined) {
                    scan(rule.cssRules);
                }
            }
        };
        for (const sheet of this._doc.styleSheets) {
            try {
                scan(sheet.cssRules);
            }
            catch {
                return { counters: true, floats: true };
            }
        }
        return used;
    }

    _canSkip(el) {
        const cs = this._win.getComputedStyle(el);
        const formattingContext = this._establishesFormattingContext(cs);
        return BLOCK_DISPLAYS.has(cs.display)
            && cs.position !== "fixed" && cs.position !== "sticky"
            // Sizes are observed as inline and block sizes.
            && cs.writingMode === "horizontal-tb"
            && cs.contentVisibility === "visible" && cs.contain === "none"
            && el.style.containIntrinsicSize === ""
            // Style containment would scope the list's numbering.
            && el.parentElement.closest("ol, ul, menu") === null
            // Paint containment clips overflow.
            && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1
            // Layout containment makes the block a formatting context, which
            // stops margins collapsing through it and floats crossing its edges.
            && (formattingContext || (
                !this._marginCollapsesThrough(el, cs, "Top")
                && !this._marginCollapsesThrough(el, cs, "Bottom")
                && !this._floatsCross(el)
            ))
            // A layout contained block has no baseline.
            && !this._baselineMayBeUsed(el)
            && !this._dependsOnAncestors(el)
            && el.getBoundingClientRect().height >= 1;
    }

    _floatsCross(el) {
        if (this._floats.length === 0) {
            return false;
        }
        const r = el.getBoundingClientRect();
        // Rects far from the viewport are imprecise.
        const top = r.top + 1;
        const bottom = r.bottom - 1;
        return this._floats.some(([float, floatTop, floatBottom]) => el.contains(float)
            ? floatTop < top || floatBottom > bottom
            : floatBottom > top && floatTop < bottom);
    }

    // Whether the baseline of el could position something, as a baseline
    // aligned flex or grid item, or through an ancestor's baseline.
    _baselineMayBeUsed(el) {
        for (let node = el; node.parentElement !== this._doc.documentElement; node = node.parentElement) {
            const parentStyle = this._win.getComputedStyle(node.parentElement);
            const display = parentStyle.display;
            if (display === "flex" || display === "grid") {
                const cs = this._win.getComputedStyle(node);
                const align = cs.alignSelf === "auto" ? parentStyle.alignItems : cs.alignSelf;
                const justify = cs.justifySelf === "auto" ? parentStyle.justifyItems : cs.justifySelf;
                if (align.includes("baseline") || justify.includes("baseline")) {
                    return true;
                }
            }
            else if (display !== "block" && display !== "flow-root") {
                return true;
            }
        }
        return false;
    }

    _establishesFormattingContext(cs) {
        return FORMATTING_CONTEXT_DISPLAYS.has(cs.display) || cs.overflow !== "visible" || cs.float !== "none"
            || cs.position === "absolute" || cs.position === "fixed" || cs.contain !== "none";
    }

    _isOutOfFlow(cs) {
        return cs.display === "none" || cs.position === "absolute" || cs.position === "fixed" || cs.float !== "none";
    }

    // Returns the first (or last) in-flow child element and its style, null
    // if there isn't one, or undefined if text comes first.
    _edgeChild(el, side) {
        const nodes = el.childNodes;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[side === "Top" ? i : nodes.length - 1 - i];
            if (node.nodeType === Node.TEXT_NODE && node.data.trim() !== "") {
                return undefined;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const cs = this._win.getComputedStyle(node);
                if (!this._isOutOfFlow(cs)) {
                    return [node, cs];
                }
            }
        }
        return null;
    }

    // Conservative, so may report collapsing that doesn't happen.
    _marginCollapsesThrough(el, cs, side) {
        if (this._establishesFormattingContext(cs)) {
            return false;
        }
        let current = cs;
        for (let node = el; ;) {
            if (px(current[`padding${side}`]) !== 0 || px(current[`border${side}Width`]) !== 0) {
                return false;
            }
            const child = this._edgeChild(node, side);
            if (!child) {
                return false;
            }
            const [childNode, childStyle] = child;
            if (!BLOCK_LEVEL_DISPLAYS.has(childStyle.display)) {
                return false;
            }
            // Margins also collapse through empty blocks to their siblings.
            if (px(childStyle[`margin${side}`]) !== 0 || childNode.getBoundingClientRect().height === 0) {
                return true;
            }
            if (this._establishesFormattingContext(childStyle)) {
                return false;
            }
            node = childNode;
            current = childStyle;
        }
    }

    // Whether el has descendants laid out against an ancestor, which layout
    // containment would prevent, or numbered by an ancestor's list.
    _dependsOnAncestors(el) {
        for (const d of el.getElementsByTagName("*")) {
            const cs = this._win.getComputedStyle(d);
            if (cs.position === "fixed" || (cs.position === "absolute" && !el.contains(d.offsetParent))) {
                return true;
            }
            if (cs.display === "list-item" && !el.contains(d.parentElement.closest("ol, ul, menu"))) {
                return true;
            }
        }
        return false;
    }

    _resized(entries) {
        for (const entry of entries) {
            const known = this._sizes.has(entry.target);
            const box = entry.contentBoxSize[0];
            this._sizes.set(entry.target, `${box.inlineSize}px ${box.blockSize}px`);
            if (!known) {
                this._visibilityObserver.observe(entry.target);
            }
        }
    }

    _skip(el, size) {
        el.style.containIntrinsicSize = size;
        el.style.contentVisibility = "auto";
    }

    _unskip(el) {
        el.style.removeProperty("content-visibility");
        el.style.removeProperty("contain-intrinsic-size");
        if (el.getAttribute("style") === "") {
            el.removeAttribute("style");
        }
    }

    _visibilityChanged(entries) {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                this._unskip(entry.target);
            }
            else if (entry.target.style.contentVisibility !== "auto") {
                this._skip(entry.target, this._sizes.get(entry.target));
            }
        }
    }
}
