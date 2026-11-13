// See COPYRIGHT.md for copyright information

// An item added more than once takes the position it was last added at.
export class DocOrderIndex {
    constructor() {
        this._index = [];
        this._added = new Set();
        this._hasRepeats = false;
    }

    addItem(vuid, docIndex) {
        if (this._added.has(vuid)) {
            this._hasRepeats = true;
        }
        this._added.add(vuid);
        this._index.push({vuid: vuid, docIndex: docIndex});
    }

    _entries() {
        if (this._hasRepeats) {
            const lastPosition = new Map(this._index.map((n, i) => [n.vuid, i]));
            this._index = this._index.filter((n, i) => lastPosition.get(n.vuid) === i);
            this._hasRepeats = false;
        }
        return this._index;
    }

    indexOf(vuid) {
        return this._entries().findIndex(n => n.vuid === vuid);
    }

    length() {
        return this._entries().length;
    }

    getAdjacentItem(vuid, offset) {
        const index = this._entries();
        const currentIndex = this.indexOf(vuid);
        const l = index.length;
        return index[(currentIndex + offset + l) % l].vuid;
    }

    getFirstInDocument(docIndex) {
        return this._entries().filter(n => n.docIndex === docIndex)[0].vuid;
    }

    getLastInDocument(docIndex) {
        return this._entries().filter(n => n.docIndex === docIndex).at(-1).vuid;
    }
}
