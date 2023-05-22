import { getTextContent } from './utils.js';

export class Text {
    #viewerPage;
    #xpathSelector;
    #name;

    constructor(viewerPage, xpathSelector, name) {
        this.#viewerPage = viewerPage;
        this.#xpathSelector = xpathSelector;
        this.#name = name;
    }

    async assertText(expectedText) {
        this.#viewerPage.log(
            `Asserting text content of ${this.#name} equals "${expectedText}"`);
        const elem = await this.#viewerPage.page.waitForSelector(
            'xpath/' + this.#xpathSelector, { visible: true });
        const text = await getTextContent(elem);
        expect(text).toEqual(expectedText);
    }
}

export class Button {
    #viewerPage;
    #xpathSelector;
    #name;

    constructor(viewerPage, xpathSelector, name) {
        this.#viewerPage = viewerPage;
        this.#xpathSelector = xpathSelector;
        this.#name = name;
    }

    async hover() {
        this.#viewerPage.log(`Hovering ${this.#name}`);
        const button = await this.getButtonElement();
        await button.hover();
    }

    async select() {
        this.#viewerPage.log(`Select ${this.#name}`);
        const button = await this.getButtonElement();
        await button.click();
    }

    async getButtonElement() {
        return await this.#viewerPage.page.waitForSelector(
            'xpath/' + this.#xpathSelector, { visible: true });
    }
}

export class Checkbox {
    #viewerPage;
    #xpathSelector;
    #name;

    constructor(viewerPage, xpathSelector, name) {
        this.#viewerPage = viewerPage;
        this.#xpathSelector = xpathSelector;
        this.#name = name;
    }

    async getInput() {
        return await this.#viewerPage.page.waitForSelector(
            'xpath/' + this.#xpathSelector, { visible: true });
    }

    async isChecked() {
        const checkbox = await this.getInput();
        return await (await checkbox.getProperty('checked')).jsonValue();
    }

    async toggleOff() {
        if (await this.isChecked() === true) {
            this.#viewerPage.log(`Toggling off ${this.#name}`);
            const toggle = await this.getInput();
            await toggle.click();
        } else {
            this.#viewerPage.log(`${this.#name} was already toggled off`);
        }
    }

    async toggleOn() {
        if (await this.isChecked() === false) {
            this.#viewerPage.log(`Toggling on ${this.#name}`);
            const toggle = await this.getInput();
            await toggle.click();
        } else {
            this.#viewerPage.log(`${this.#name} already toggled on`);
        }
    }
}

export class TextInput {
    #viewerPage;
    #xpathSelector;
    #name;

    constructor(viewerPage, xpathSelector, name) {
        this.#viewerPage = viewerPage;
        this.#xpathSelector = xpathSelector;
        this.#name = name;
    }

    async enterText(text, pressEnter = false) {
        this.#viewerPage.log(`Entering "${text}" into ${this.#name}`);
        const input = await this.getInput();
        await input.type(text);
        await input.press('Enter');
    }

    async getInput() {
        return await this.#viewerPage.page.waitForSelector(
            'xpath/' + this.#xpathSelector, { visible: true });
    }
}
