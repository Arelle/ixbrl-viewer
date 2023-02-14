import $ from 'jquery'

const highlightToggle = "red-highlight-toggle-on";
const highlight = "example-containing-t-red-highlight";
export class ExtendedViewer {
    constructor(iv) {
        this._iv = iv;
    }

    extendDisplayOptionsMenu = (menu) => {
        menu.addCheckboxItem("Example Menu Item (Highlight Words containing the letter 'T' Red)",(checked) => {
            let body = this._iv.viewer.contents().find("body");
            if (checked) {
                body.addClass(highlightToggle)
            } else {
                body.removeClass(highlightToggle)
            }
        }, "example-menu-item", "highlight-tags")
    }

    preProcessiXBRL = (body, docIndex) => {
        this._iv.setProgress("Finding words with the letter 'T'").then(() => {
            // Temporarily hide all children of "body" to avoid constant
            // re-layouts when wrapping untagged numbers
            const body = this._iv.viewer.contents().find("body");
            const children = body.children();
            children.hide();
            children.each(function () {
                if (this.textContent !== null) {
                    const containsTheLetterT = this.textContent.toUpperCase().includes("T");
                    if (containsTheLetterT) {
                        $(this).addClass(highlight);
                    }
                }
            });
            children.show();
        });
    }

    updateViewerStyleElements = (styleElts) => {
        styleElts.append(document.createTextNode(
                `.${highlightToggle} .${highlight} {\n    background-color: red;\n}`
        ));
    }
}

