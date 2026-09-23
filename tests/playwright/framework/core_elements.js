import { expect } from '@playwright/test';

export class Element {
    #viewerPage;
    #name;

    constructor(viewerPage, xpathSelector, name) {
        this.#viewerPage = viewerPage;
        this.locator = viewerPage.page.locator('xpath=' + xpathSelector);
        this.#name = name;
    }

    get name() {
        return this.#name;
    }

    log(message) {
        this.#viewerPage.log(message);
    }

    async assertVisible() {
        this.log(`Asserting ${this.name} is visible`);
        await expect(this.locator).toBeVisible();
    }

    async assertNotVisible() {
        this.log(`Asserting ${this.name} is not visible`);
        await expect(this.locator).toBeAttached();
        await expect(this.locator).toBeHidden();
    }

    async assertAttribute(name, expectedValue) {
        this.log(`Asserting ${name} of ${this.name} equals "${expectedValue}"`);
        await expect(this.locator).toBeVisible();
        await expect(this.locator).toHaveAttribute(name, expectedValue);
    }

    async assertFocused() {
        this.log(`Asserting ${this.name} holds keyboard focus`);
        await expect(this.locator).toBeFocused();
    }

    async pressKey(key) {
        this.log(`Pressing ${key} on ${this.name}`);
        await this.locator.press(key);
    }

    async pressShiftTab() {
        await this.pressKey('Shift+Tab');
    }
}

export class Text extends Element {
    async assertText(expectedText) {
        this.log(`Asserting text content of ${this.name} equals "${expectedText}"`);
        await expect(this.locator).toBeVisible();
        await expect(this.locator).toHaveText(expectedText);
    }
}

export class Button extends Element {
    async hover() {
        this.log(`Hovering ${this.name}`);
        await this.locator.hover();
    }

    async select() {
        this.log(`Select ${this.name}`);
        await this.locator.click();
    }

    async doubleClick() {
        this.log(`Double click ${this.name}`);
        await this.locator.dblclick();
    }
}

export class Checkbox extends Element {
    async isChecked() {
        return this.locator.isChecked();
    }

    async toggleOff() {
        this.log(`Toggling off ${this.name}`);
        await this.locator.uncheck();
    }

    async toggleOn() {
        this.log(`Toggling on ${this.name}`);
        await this.locator.check();
    }
}

export class TextInput extends Element {
    async enterText(text, pressEnter = false) {
        this.log(`Entering "${text}" into ${this.name}`);
        await this.locator.pressSequentially(text);
        await this.locator.press('Enter');
    }
}
