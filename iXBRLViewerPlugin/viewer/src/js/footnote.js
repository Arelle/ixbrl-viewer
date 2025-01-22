// See COPYRIGHT.md for copyright information

export class Footnote {
    constructor(report, footnoteId, title) {
        this.vuid = footnoteId;
        this.linkedFacts = [];
        this.title = title;
        this.ixNode = report.reportSet.getIXNodeForItemId(footnoteId);
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

    readableValueHTML() {
        const span = document.createElement("span");
        span.append(document.createTextNode(this.textContent()));
        return span;
    }

    isTextBlock() {
        return false;
    }
}
