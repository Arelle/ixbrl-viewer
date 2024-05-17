// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { Dialog } from './dialog.js';

export class MessageBox extends Dialog {
    constructor(title, message, okText, cancelText) {
        super(".dialog.message-box");
        this.title = title;
        this.message = message;
        this.okText = okText;
        this.cancelText = cancelText;
    }

    show(onOK, onCancel) {
        this.node.find('.title').text(this.title);
        this.node.find('.message')
            .empty()
            .append(this.message);
        const buttons = this.node.find('.buttons').empty();
        const okButton = $("<button></button>").text(this.okText).addClass("dialog-button-primary");
        buttons.append(okButton);
        okButton.on("click", () => {
            this.close();
            if (onOK) {
                onOK();
            }
        });
        if (this.cancelText) {
            const cancelButton = $("<button></button>").text(this.cancelText).addClass("dialog-button-cancel");
            buttons.append(cancelButton);
            cancelButton.on("click", () => {
                this.close();
                if (onCancel) {
                    onCancel();
                }
            });
        }

        super.show(this);
    }

    showAsync() {
        return new Promise((resolve, reject) => {
            this.show(() => resolve(true), () => resolve(false));
        });
    }
}
