// See COPYRIGHT.md for copyright information

import { Dialog } from './dialog.js';

export class TextBlockViewerDialog extends Dialog {
    constructor(fact) {
        super(".dialog.text-block-viewer");
        this.addButton("Dismiss", true);
        this.fact = fact;
        this.node.find('#text-block-viewer-plain-text')
            .off('change.dialog')
            .on('change.dialog', (e) => this.displayTextBlock(e.target.checked));
    }

    htmlWrapString(content) {
        const str =
            "<!DOCTYPE html><html><head><title></title></head><body>" 
            + content 
            + "</body></html>";
        return str;
    }

    static canRender(item) {
        return item.isTextBlock() && item.escaped();
    }

    textOnly() {
        return this.node.find("#text-block-viewer-plain-text").prop('checked');
    }
    

    displayTextBlock() {
        const iframe = this.node.find("iframe").get(0);
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        if (!this.textOnly()) {
            // This feature is only used on facts with 'escape="true"'.  This means
            // that they are effectively a subset of the document that we're
            // already displaying
            //
            // The iframe will render in HTML mode, not XHTML mode, regardless of
            // the display mode of the parent document.  Arelle will ensure that
            // only empty, no-content tags (e.g. <br>) are self-closed, to ensure
            // the correct rendering.
            doc.write(this.htmlWrapString(this.fact.value()));
        }
        else {
            const div = document.createElement('div');
            div.append(document.createTextNode(this.fact.readableValue()));
            doc.write(this.htmlWrapString(div.outerHTML));
        }
        doc.close();
    }

}
