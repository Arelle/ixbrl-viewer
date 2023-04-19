import $ from 'jquery';
import { Dialog } from './dialog.js';

export class PreviewBox extends Dialog {
    constructor(title, okText) {
        super(".dialog.preview-box");        
        let iframe = this.node.find('iframe');
        if (iframe.length == 0) {        
            this.iframe = $('<iframe id="preview-iframe"></iframe>').appendTo(this.node.find('.contents.preview'));
        } else {
            this.iframe = iframe; 
        }
        this.title = title;
        this.okText = okText;
    }

    show() {
        this.node.find('.title').text(this.title);
        super.show(this);
    }
}