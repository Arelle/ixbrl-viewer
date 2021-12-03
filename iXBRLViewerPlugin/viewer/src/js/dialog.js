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

export function Dialog(selector) {
    this.node = $("#dialog-templates").find(selector).clone().appendTo("#ixv #dialog-container");

    $('.close', this.node).click(() => this.close());
    $(document).bind("keyup",(e) => {
        if (e.keyCode === 27) {
            this.close();
        }
    });
}

Dialog.prototype.addButton = function(text, primary, callback) {
    var buttons = this.node.find('.buttons');
    var button = $("<button></button>").text(text).addClass(primary ? "dialog-button-primary" : "dialog-button-cancel");
    buttons.append(button);
    button.on("click", () => {
        // Close if no callback provided, or callback returns true
        if (!callback || callback()) {
            this.close();
        }
    });
};

Dialog.prototype.close = function () {
    $('.dialog-mask').hide(); 
    this.node.remove() ;
}

Dialog.prototype.show = function () {
    $('.dialog-mask').show(); 
    this.node.show();
}

