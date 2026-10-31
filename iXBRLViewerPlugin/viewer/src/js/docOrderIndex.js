// See COPYRIGHT.md for copyright information

export class DocOrderIndex {
    constructor() {
        this._index = [];
        // The first position of each item, as an item that is linked to
        // from elsewhere in the document is added more than once.
        this._positions = new Map();
    }

    addItem(vuid, docIndex) {
        if (!this._positions.has(vuid)) {
            this._positions.set(vuid, this._index.length);
        }
        this._index.push({vuid: vuid, docIndex: docIndex});
    }

    indexOf(vuid) {
        return this._positions.get(vuid) ?? -1;
    }

    length() {
        return this._index.length;
    }

    getAdjacentItem(vuid, offset) {
        const currentIndex = this.indexOf(vuid);
        const l = this._index.length;
        return this._index[(currentIndex + offset + l) % l].vuid;
    }

    getFirstInDocument(docIndex) {
        return this._index.filter(n => n.docIndex === docIndex)[0].vuid;
    }

    getLastInDocument(docIndex) {
        return this._index.filter(n => n.docIndex === docIndex).at(-1).vuid;
    }
}
