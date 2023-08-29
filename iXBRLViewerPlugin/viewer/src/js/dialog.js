// See COPYRIGHT.md for copyright information

import $ from 'jquery';

export class Dialog {
    constructor(selector) {
        this.node = $("#dialog-templates").find(selector).clone().appendTo("#ixv #dialog-container");

        $('.close', this.node).click(() => this.close());
        $(document).bind("keyup", (e) => {
            if (e.keyCode === 27) {
                this.close();
            }
        });
    }

    addButton(text, primary, callback) {
        const buttons = this.node.find('.buttons');
        const button = $("<button></button>").text(text).addClass(primary ? "dialog-button-primary" : "dialog-button-cancel");
        buttons.append(button);
        button.on("click", () => {
            // Close if no callback provided, or callback returns true
            if (!callback || callback()) {
                this.close();
            }
        });
    };

    close() {
        $('.dialog-mask').hide(); 
        this.node.remove() ;
    }

    show() {
        $('.dialog-mask').show(); 
        this.node.show();
    }
}

