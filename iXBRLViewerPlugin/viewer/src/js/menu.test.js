// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { Menu } from "./menu.js";

const menuFixture = () => $(`
    <div class="menu" id="test-menu">
      <button class="menu-title"></button>
      <div class="content-container">
        <div class="content"></div>
      </div>
    </div>
`);

describe("Menu.isEmpty", () => {
    test("returns true for an empty menu", () => {
        const menu = new Menu(menuFixture());
        expect(menu.isEmpty()).toBe(true);
    });

    test("returns false once an item has been added", () => {
        const menu = new Menu(menuFixture());
        menu.addLink("Link", "https://example.com");
        expect(menu.isEmpty()).toBe(false);
    });

    test("returns true again after reset()", () => {
        const menu = new Menu(menuFixture());
        menu.addLink("Link", "https://example.com");
        menu.reset();
        expect(menu.isEmpty()).toBe(true);
    });
});
