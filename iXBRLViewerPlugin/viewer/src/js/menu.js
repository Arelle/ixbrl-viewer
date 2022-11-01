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

export function Menu(elt, attr) {
    this._elt = elt;
    var menu = this;
    attr = attr || {};
    this.type = attr.type || "dropdown";

    elt.find(".menu-title").click(function (e) {
        elt.find(".content-container").toggle();
        /* Stop an opening click from also being treated as an "out-of-menu"
         * closing click */
        e.stopPropagation();
    });

    $('html').click(function(event) {
        if ($(".content",elt).find($(event.target)).length === 0) {
            menu.close();
        }
    });
}

Menu.prototype.reset = function() {
    this._elt.find(".content").empty();
}

Menu.prototype.close = function() {
    if (this.type == "dropdown") {
        this._elt.find(".content-container").hide();
    }
}

Menu.prototype._add = function(item, after) {
    var i;
    if (after !== undefined) {
        i = this._elt.find(".content > div").filter(function () {
            return $(this).data('iv-menu-item-name') == after;     
        });
    }
    if (i !== undefined && i.length > 0) {
        i.after(item);
    }
    else {
        item.appendTo(this._elt.find(".content"));
    }
}

Menu.prototype.addCheckboxItem = function(name, callback, itemName, after, onByDefault) {
    var menu = this;
    var item = $("<label></label>")
        .addClass("menu-checkbox")
        .addClass("item")
        .text(name)
        .data("iv-menu-item-name", itemName)
        .prepend(
            $('<input type="checkbox"></input>')
                .prop("checked", onByDefault)
                .change(function () {
                    callback($(this).prop("checked"));
                    menu.close(); 
                })
        )
        .append($("<span></span>").addClass("checkmark"));
    this._add(item, after);
    if (onByDefault) {
        callback(true);
    }
}

Menu.prototype.addCheckboxGroup = function(values, names, def, callback, name, after) {
    var menu = this;
    var group = $('<div class="group"></div>').data("iv-menu-item-name", name);
    this._add(group, after);

    $.each(values, function (i, v) {
        var item = $("<label></label>")
            .addClass("menu-checkbox")
            .addClass("item")
            .text(names[v])
            .prepend(
                $('<input type="radio"></input>')
                    .attr({ "name": name, "value": v})
                    .change(function () {
                        callback($(this).val())
                        menu.close(); 
                    })
            )
            .append($("<span></span>").addClass("checkmark"))
            .appendTo(group);

        if (v == def) {
            item.find("input").prop("checked", true);
        }

    });
    
}
