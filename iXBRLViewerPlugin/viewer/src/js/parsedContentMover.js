// See COPYRIGHT.md for copyright information

// Elements whose content the parser doesn't add as child nodes as it goes, or
// that act on being inserted, so are only moved once they are complete.
const MOVE_WHEN_COMPLETE = new Set([
    "SCRIPT", "STYLE", "TEXTAREA", "TITLE", "TEMPLATE", "XMP", "IFRAME",
    "NOEMBED", "NOFRAMES", "NOSCRIPT", "PLAINTEXT", "SELECT", "OBJECT",
]);

/*
 * Moves the content of an element that is still being parsed into another
 * element, as the parser finishes with it, so that the content can be shown
 * elsewhere while the rest is parsed.
 *
 * The parser only adds nodes after the last child of each element that it
 * hasn't finished, so everything before that is moved as is.  Elements that
 * the parser may still add to are replaced with shallow copies, which their
 * children are moved into as they are completed.  Once parsing has finished,
 * moveAll moves what remains, so the result is the same as moving the
 * content in one go, other than for the identity of the elements that were
 * copied.
 */
export class ParsedContentMover {
    // Children of from for which keep returns true are left where they are.
    constructor(from, to, keep) {
        // Each as [element being parsed, its copy]
        this._path = [[from, to]];
        this._keep = keep;
    }

    // Move what the parser has finished with.
    moveParsed() {
        for (let depth = 0; ; depth++) {
            const [from, to] = this._path[depth];
            const next = this._path[depth + 1];
            if (next !== undefined) {
                // Insertions before the last child, for example content
                // moved out of a table by the parser.
                this._moveChildren(depth, from, to, next[0], next[1]);
                if (next[0].nextSibling === null) {
                    continue;
                }
                this._complete(depth + 1);
            }
            const last = from.lastChild;
            this._moveChildren(depth, from, to, last, null);
            if (last === null || last.nodeType !== Node.ELEMENT_NODE
                    || MOVE_WHEN_COMPLETE.has(last.nodeName.toUpperCase())
                    || (depth === 0 && this._keep(last))) {
                return;
            }
            const copy = last.cloneNode(false);
            to.appendChild(copy);
            this._path.push([last, copy]);
        }
    }

    // Move everything, once parsing has finished.
    moveAll() {
        if (this._path.length > 1) {
            this._moveChildren(0, this._path[0][0], this._path[0][1], this._path[1][0], this._path[1][1]);
            this._complete(1);
        }
        this._moveChildren(0, this._path[0][0], this._path[0][1], null, null);
    }

    // Move the children of from that precede end into to, before the node
    // before.
    _moveChildren(depth, from, to, end, before) {
        for (let node = from.firstChild; node !== null && node !== end;) {
            const following = node.nextSibling;
            if (depth > 0 || !this._keep(node)) {
                to.insertBefore(node, before);
            }
            node = following;
        }
    }

    // Move the rest of the content of the elements from depth down, which the
    // parser has finished with, into their copies, and remove them.
    _complete(depth) {
        for (let i = depth; i < this._path.length; i++) {
            const [from, to] = this._path[i];
            const next = this._path[i + 1];
            if (next !== undefined) {
                this._moveChildren(i, from, to, next[0], next[1]);
                for (let node = next[0].nextSibling; node !== null;) {
                    const following = node.nextSibling;
                    to.appendChild(node);
                    node = following;
                }
            }
            else {
                this._moveChildren(i, from, to, null, null);
            }
        }
        this._path[depth][0].remove();
        this._path.length = depth;
    }
}
