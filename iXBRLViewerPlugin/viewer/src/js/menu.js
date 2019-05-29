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

export function Menu(elt) {
    this._elt = elt;
    var menu = this;

    elt.find(".title").click(function (e) {
        elt.find(".content-container").toggle();
        /* Stop an opening click from also being treated as an "out-of-menu"
         * closing click */
        e.stopPropagation();
    });

    $('html').click(function(event) {
        if ($(".content",elt).find($(event.target)).length === 0) {
            console.log("closing");
            menu.close();
        }
    });
}

Menu.prototype.reset = function() {
    this._elt.find(".content").empty();
}

Menu.prototype.close = function() {
    this._elt.find(".content-container").hide();
}

Menu.prototype.addCheckboxItem = function(name, callback) {
    var menu = this;
    $('<div class="item checkbox"></div>')
        .text(name)
        .appendTo(this._elt.find(".content"))
        .click(function () {
            $(this).toggleClass("checked");
            callback($(this).hasClass("checked"));
            menu.close(); 
        });
}

Menu.prototype.addCheckboxGroup = function(values, names, def, callback) {
    var menu = this;
    var group = $('<div class="group"></div>').appendTo(this._elt.find(".content"));

    $.each(values, function (i, v) {
        var item = $('<div class="item checkbox"></div>')
            .text(names[v])
            .appendTo(group)
            .click(function () {
                group.find(".item.checkbox").removeClass("checked");
                $(this).addClass("checked");
                callback(v);
                menu.close(); 
            });
        if (v == def) {
            item.addClass("checked");
        }

    });
    
}
