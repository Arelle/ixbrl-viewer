// See COPYRIGHT.md for copyright information

export class Footnote {
    constructor(report, footnoteId, title) {
        this.id = footnoteId;
        this.linkedFacts = [];
        this.title = title;
        this.ixNode = report.getIXNodeForItemId(footnoteId);
    }

    // Facts that are the source of relationships to this fact.
    addLinkedFact(f) {
        this.linkedFacts.push(f); 
    }

    textContent() {
        return this.ixNode.textContent();
    }

    readableValue() {
        return this.textContent();
    }

    isTextBlock() {
        return false;
    }
}
