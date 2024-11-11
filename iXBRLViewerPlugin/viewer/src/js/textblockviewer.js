// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { Dialog } from './dialog.js';
import { zoom } from './util.js';

export class TextBlockViewerDialog extends Dialog {
    constructor(iv, fact) {
        super(".dialog.text-block-viewer");        
        this.scale = 1.0;
        this.iv = iv;
        this.addButton("Dismiss", true);
        this.fact = fact;
        this.node.find('#text-block-viewer-plain-text')
            .off('change.dialog')
            .on('change.dialog', (e) => {
                this.scale = 1.0;
                this.displayTextBlock(e.target.checked);
            });
        this.node.find('.zoom-in').off('click')
            .click(() => this.zoomIn());
        this.node.find('.zoom-out').off('click')
            .click(() => this.zoomOut());
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
    
    zoomIn() {
        this.scale *= 1.1;
        this.zoom();
    }

    zoomOut() {
        this.scale /= 1.1;
        this.zoom();
    }

    zoom() {
        const iframe = this.node.find("iframe");
        var container = iframe.contents().find('#zoom-container');
        var scrollParent;
        if (container.length > 0) {
            scrollParent = iframe.contents().find('body');
        } else {
            container = iframe.contents().find('body');
            scrollParent = iframe.contents().find('html');
        }
        zoom(container, scrollParent, this.scale);
    }
    
    displayTextBlock() {
        const iframe = this.node.find("iframe").get(0);
        const doc = iframe.contentDocument || iframe.contentWindow.document;        
        if (!this.textOnly()) {
            // This feature is only used on facts with 'escape="true"'.  This means
            // that they are effectively a subset of the document that we're
            // already displaying
            //
            // The iframe will render in HTML mode, not XHTML mode, regardless of
            // the display mode of the parent document.  Arelle will ensure that
            // only empty, no-content tags (e.g. <br>) are self-closed, to ensure
            // the correct rendering.            
            if (this.iv.hasPluginMethod('extendDisplayTextblock')) {          
                const iv = this.iv;      
                setTimeout(() => {
                    (async () => { 
                        await iv.pluginPromise('extendDisplayTextblock', doc, this.fact); 
                    })();
                }, 100);
            } else {
                doc.open();
                doc.write(this.htmlWrapString(this.fact.value()));
                doc.close();
            }
        }
        else {
            const div = document.createElement('div');
            div.append(document.createTextNode(this.fact.readableValue()));
            doc.write(this.htmlWrapString(div.outerHTML));
            doc.close();
        }        
    }

}
