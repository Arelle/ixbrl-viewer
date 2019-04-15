// Copyright 2019 Workiva Inc.
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

import $ from 'jquery'

export function Accordian() {
    this._html = $('<div class="accordian">');
}

Accordian.prototype.addCard = function(title, body, selected) {
    var card = $('<div class="card">')
        .append($('<div class="title">')
            .append(title)
            .click(function () {
                var thisCard = $(this).closest(".card");
                if (thisCard.hasClass("active")) {
                    thisCard.removeClass("active");
                }
                else {
                    thisCard.closest(".accordian").find(".card").removeClass("active");
                    thisCard.addClass("active");
                }
            })
        )
        .append($('<div class="body">').append(body))
        .appendTo(this._html);

    if (selected) {
        card.addClass("active");
    }

}

Accordian.prototype.html = function () {
    return this._html;
}
