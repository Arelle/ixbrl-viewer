// See COPYRIGHT.md for copyright information

import $ from 'jquery'

export class Accordian {
    constructor(options) {
        this._contents = $('<div class="accordian"></div>');
        this.onSelect = $.Callbacks();
        this.options = options || {};
        if (this.options.onSelect) {
            this.onSelect.add(options.onSelect);
        }
    }

    addCard(title, body, selected, data) {
        const a = this;
        const card = $('<div class="card"></div>')
            .append($('<div class="title"></div>')
                .append(title)
                .click(function () {
                    var thisCard = $(this).closest(".card");
                    if (thisCard.hasClass("active")) {
                        if (!a.options.alwaysOpen) {
                            thisCard.removeClass("active");
                        }
                    }
                    else {
                        thisCard.closest(".accordian").find(".card").removeClass("active");
                        thisCard.addClass("active");
                        a.onSelect.fire(thisCard.data("accordian-card-id"));
                    }
                })
            )
            .append($('<div class="body"></div>').append(body))
            .appendTo(this._contents);

        if (data !== null) {
            card.data("accordian-card-id", data); 
        }

        if (selected) {
            card.addClass("active");
        }
    }

    contents() {
        if (this.options.alwaysOpen && this._contents.find(".card.active").length == 0) {
            this._contents.find(".card").first().addClass("active");
        }
        if (this.options.dissolveSingle && this._contents.children().length == 1) {
            return this._contents.children().first().find(".body");
        }
        return this._contents;
    }
}
