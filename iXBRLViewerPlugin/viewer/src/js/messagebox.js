// Copyright 2021 Workiva Inc.
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
