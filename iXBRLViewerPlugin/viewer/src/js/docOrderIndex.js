// See COPYRIGHT.md for copyright information

export class DocOrderIndex {
    constructor() {
        this.index = [];
    }

    addItem(id, docIndex) {
        this.index.push({id: id, docIndex: docIndex});
    }

    getAdjacentItem(id, offset) {
        const currentIndex = this.index.findIndex(n => n.id == id);
        const l = this.index.length;
        return this.index[(currentIndex + offset + l) % l].id;
    }

    getFirstInDocument(docIndex) {
        return this.index.filter(n => n.docIndex == docIndex)[0].id;
    }

    getLastInDocument(docIndex) {
        return this.index.filter(n => n.docIndex == docIndex).at(-1).id;
    }
}
