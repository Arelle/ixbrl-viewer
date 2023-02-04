import $ from 'jquery'

export function ExtendedVeiwer(iv) {
    this._iv = iv;
}

const highlightToggle = "red-highlight-toggle-on";
const highlight = "example-containing-t-red-highlight";

ExtendedVeiwer.prototype.extendDisplayOptionsMenu = function(menu) {
    let iv = this._iv;
    menu.addCheckboxItem("Example Menu Item (Highlight Words containing the letter 'T' Red)", function(checked) {
        let body = iv.viewer.contents().find("body");
        if (checked) {
            body.addClass(highlightToggle)
        } else {
            body.removeClass(highlightToggle)
        }
    }, "example-menu-item", "highlight-tags")
}

ExtendedVeiwer.prototype.preProcessiXBRL = function(body, docIndex) {
    return new Promise((resolve, reject) => {
        this._iv.setProgress("Finding words with the letter 'T'").then(() => {
            // Temporarily hide all children of "body" to avoid constant
            // re-layouts when wrapping untagged numbers
            const body = this._iv.viewer.contents().find("body");
            const children = body.children();
            children.hide();
            children.each(function () {
                if (this.textContent != null) {
                    const containsTheLetterT = this.textContent.toUpperCase().includes("T");
                    if (containsTheLetterT) {
                        $(this).addClass(highlight);
                    }
                }
            });
            children.show();
            resolve();
        });
    });
}

ExtendedVeiwer.prototype.updateViewerStyleElements = function(styleElts) {
    styleElts.append(document.createTextNode(
            "." + highlightToggle + " ." + highlight + " {\n    background-color: red;\n}"
    ));
}
