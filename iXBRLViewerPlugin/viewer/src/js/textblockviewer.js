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
    constructor() {
        super(".dialog.text-block-viewer");
        this.addButton("Dismiss", true);
    }

    htmlWrapString(content) {
        const str =
            "<!DOCTYPE html><html><head><title></title></head><body>" 
            + content 
            + "</body></html>";
        return str;
    }

    displayTextBlock(textBlockValue) {
        const iframe = this.node.find("iframe").get(0);
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        const html = this.htmlWrapString(textBlockValue);
        const parser = new DOMParser();
        const xml = parser.parseFromString(html, 'text/xml');
        const errorNode = xml.querySelector("parsererror");
        if (errorNode) {
            doc.write(this.htmlWrapString('<div style="color: red">Text block contains invalid XML.</div>'));
        }
        else {
            doc.write(html);
        }
        doc.close();
    }
}
