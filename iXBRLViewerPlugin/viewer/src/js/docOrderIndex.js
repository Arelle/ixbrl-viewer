// See COPYRIGHT.md for copyright information

export class DocOrderIndex {
    constructor() {
        this.index = [];
    }

    addItem(vuid, docIndex) {
        this.index.push({vuid: vuid, docIndex: docIndex});
    }

    getAdjacentItem(vuid, offset) {
        const currentIndex = this.index.findIndex(n => n.vuid === vuid);
        const l = this.index.length;
        return this.index[(currentIndex + offset + l) % l].vuid;
    }

    getFirstInDocument(docIndex) {
        return this.index.filter(n => n.docIndex === docIndex)[0].vuid;
    }

    getLastInDocument(docIndex) {
        return this.index.filter(n => n.docIndex === docIndex).at(-1).vuid;
    }
}
