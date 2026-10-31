// See COPYRIGHT.md for copyright information

import { ParsedContentMover } from "./parsedContentMover.js";

const REPORT = `<div id="a" class="page"><p>One <b>two</b> three</p><table><tbody><tr><td><span id="f1">1</span></td><td>2</td></tr>`
    + `<tr><td><div><span id="f2">3</span></div></td></tr></tbody></table><script>var s = 1;</script><p>Four</p></div>`
    + `<script>var t = 1;</script><div id="b"><div><div><p>Five <i>six</i></p></div></div><style>p { color: red; }</style></div>text`;

// Calls step after each node is added to target, in the order a parser would add them.
function replay(source, target, step) {
    for (const node of [...source.childNodes]) {
        const copy = node.cloneNode(false);
        target.appendChild(copy);
        step();
        replay(node, copy, step);
    }
}

function keepScripts(node) {
    return node.nodeName === "SCRIPT" || node.id === "ixv";
}

describe("ParsedContentMover", () => {
    let source, from, to;
    beforeEach(() => {
        source = document.createElement("div");
        source.innerHTML = REPORT;
        from = document.createElement("div");
        from.innerHTML = '<div id="ixv"></div>';
        to = document.implementation.createHTMLDocument("").body;
    });

    test("Content moved as it is parsed is the same as content moved at once", () => {
        const mover = new ParsedContentMover(from, to, keepScripts);
        const moved = [];
        replay(source, from, () => {
            mover.moveParsed();
            moved.push(to.textContent.length);
        });
        mover.moveAll();

        const expected = source.cloneNode(true);
        expected.querySelectorAll(":scope > script").forEach(e => e.remove());
        expect(to.innerHTML).toEqual(expected.innerHTML);
        expect([...from.childNodes].map(n => n.nodeName)).toEqual(["DIV", "SCRIPT"]);
        expect(from.firstChild.id).toEqual("ixv");
        // Content was moved before parsing finished.
        expect(moved.findIndex(n => n > 0)).toBeLessThan(moved.length / 2);
    });

    test("Content still being parsed is not moved", () => {
        const mover = new ParsedContentMover(from, to, keepScripts);
        from.insertAdjacentHTML("beforeend", "<div><p>Done</p>Text</div>");
        mover.moveParsed();

        expect(to.innerHTML).toEqual("<div><p>Done</p></div>");
        expect(from.lastChild.innerHTML).toEqual("Text");
        expect(to.firstChild).not.toBe(from.lastChild);
    });

    test("Elements are not copied while their content is being parsed", () => {
        const mover = new ParsedContentMover(from, to, keepScripts);
        from.insertAdjacentHTML("beforeend", "<div><p>Done</p><textarea>Te</textarea></div>");
        mover.moveParsed();
        expect(to.innerHTML).toEqual("<div><p>Done</p></div>");

        from.lastChild.lastChild.textContent = "Text";
        mover.moveAll();
        expect(to.innerHTML).toEqual("<div><p>Done</p><textarea>Text</textarea></div>");
    });

    test("Content inserted before an element being parsed keeps its place", () => {
        const mover = new ParsedContentMover(from, to, keepScripts);
        from.insertAdjacentHTML("beforeend", "<div><p>One</p><table><tbody><tr><td>Cell</td></tr></tbody></table></div>");
        mover.moveParsed();
        const table = from.querySelector("table");
        table.before(document.createTextNode("Fostered"));
        table.querySelector("tbody").insertAdjacentHTML("beforeend", "<tr><td>Next</td></tr>");
        mover.moveParsed();
        from.lastChild.insertAdjacentHTML("beforeend", "<p>After</p>");
        mover.moveParsed();
        mover.moveAll();

        expect(to.innerHTML).toEqual("<div><p>One</p>Fostered<table><tbody><tr><td>Cell</td></tr><tr><td>Next</td></tr></tbody></table><p>After</p></div>");
    });
});
