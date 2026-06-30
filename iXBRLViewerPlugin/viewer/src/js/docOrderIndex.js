// See COPYRIGHT.md for copyright information

export class DocOrderIndex {
    constructor() {
        this._index = [];
    }

    addItem(vuid, docIndex) {
        this._index.push({vuid: vuid, docIndex: docIndex});
    }

    indexOf(vuid) {
        return this._index.findIndex(n => n.vuid === vuid);
    }

    length(vuid) {
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
