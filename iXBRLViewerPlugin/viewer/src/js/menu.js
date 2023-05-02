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

export class Menu {
    constructor(elt, attr) {
        this._elt = elt;
        attr = attr || {};
        this.type = attr.type || "dropdown";

        elt.find(".menu-title").click((e) => {
            elt.find(".content-container").toggle();
            /* Stop an opening click from also being treated as an "out-of-menu"
             * closing click */
            e.stopPropagation();
        });

        $('html').click((event) => {
            if ($(".content", elt).find($(event.target)).length === 0) {
                this.close();
            }
        });
    }

    reset() {
        this._elt.find(".content").empty();
    }

    close() {
        if (this.type == "dropdown") {
            this._elt.find(".content-container").hide();
        }
    }

    _add(item, after) {
        if (after !== undefined) {
            const i = this._elt.find(".content > div").filter(() => $(this).data('iv-menu-item-name') === after);
            if (i !== undefined && i.length > 0) {
                i.after(item);
                return;
            }
        }
        item.appendTo(this._elt.find(".content"));
    }

    addDownloadButton(name, filename) {
        const menu = this;
        const item = $('<a></a>')
                .attr({
                    href: filename,
                    download: filename})
                .prepend($('<input type="button">')
                        .prop("value", name)
                        .click(() => menu.close()));
        this._add(item);
    }

    addCheckboxItem(name, callback, itemName, after, onByDefault) {
        const menu = this;
        const item = $("<label></label>")
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

    addCheckboxGroup(values, names, def, callback, name, after) {
        const menu = this;
        const group = $('<div class="group"></div>').data("iv-menu-item-name", name);
        this._add(group, after);

        for (const v of values) {
            const item = $("<label></label>")
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

            if (v === def) {
                item.find("input").prop("checked", true);
            }
        }
    }
}
