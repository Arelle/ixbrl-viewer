// See COPYRIGHT.md for copyright information

import $ from "jquery";
import { IXNode } from "./ixnode.js";

function wrapper(checkVisibility, className = "ixbrl-element") {
    const e = document.createElement("span");
    e.className = className;
    e.style.color = "rgb(0, 0, 0)";
    document.body.appendChild(e);
    if (checkVisibility !== undefined) {
        e.checkVisibility = () => checkVisibility;
    }
    return e;
}

describe("htmlHidden", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("is true if a wrapper is not rendered", () => {
        const node = new IXNode("f1", $([wrapper(true), wrapper(false)]), 0);

        expect(node.htmlHidden()).toBe(true);
    });

    test("is false if every wrapper is rendered", () => {
        const node = new IXNode("f1", $([wrapper(true), wrapper(true)]), 0);

        expect(node.htmlHidden()).toBe(false);
    });

    test("is true if a wrapper is inside an element that is not displayed", () => {
        const shown = wrapper();
        const notDisplayed = document.body.appendChild(document.createElement("div"));
        notDisplayed.style.display = "none";
        notDisplayed.appendChild(wrapper());

        expect(new IXNode("f1", $([shown]), 0).htmlHidden()).toBe(false);
        expect(new IXNode("f2", $([shown, notDisplayed.firstChild]), 0).htmlHidden()).toBe(true);
    });

    test("ignores wrappers that are not highlighted", () => {
        const node = new IXNode("f1", $([wrapper(true), wrapper(false, "ixbrl-element ixbrl-no-highlight")]), 0);

        expect(node.htmlHidden()).toBe(false);
    });

    test("is true if a wrapper's text is transparent", () => {
        const transparent = wrapper(true);
        transparent.style.color = "rgba(0, 0, 0, 0)";
        const node = new IXNode("f1", $([wrapper(true), transparent]), 0);

        expect(node.htmlHidden()).toBe(true);
    });
});
