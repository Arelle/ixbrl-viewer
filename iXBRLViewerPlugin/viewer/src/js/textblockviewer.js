// Copyright 2023 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Dialog } from './dialog.js';

export class TextBlockViewerDialog extends Dialog {
    constructor(iv, fact) {
        super(".dialog.text-block-viewer");
        this.iv = iv;
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
            if (this.iv.hasPluginMethod('extendDisplayTextblock'))
                this.iv.callPluginMethod('extendDisplayTextblock', doc, this.fact);
            else {
                doc.write(this.htmlWrapString(this.fact.value()));
            }
        }
        else {
            const div = document.createElement('div');
            div.append(document.createTextNode(this.fact.readableValue()));
            doc.write(this.htmlWrapString(div.outerHTML));
        }
        doc.close();
    }

}
