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
