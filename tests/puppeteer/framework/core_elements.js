import { getTextContent } from './utils.js';

export class Element {
    #viewerPage;
    #xpathSelector;
    #name;

    constructor(viewerPage, xpathSelector, name) {
        this.#viewerPage = viewerPage;
        this.#xpathSelector = xpathSelector;
        this.#name = name;
    }

    get name() {
        return this.#name;
    }

    log(message) {
        this.#viewerPage.log(message);
    }

    async waitForElement(options) {
        return await this.#viewerPage.page.waitForSelector(
            'xpath/' + this.#xpathSelector, options);
    }

    async assertVisible() {
        this.log(`Asserting ${this.name} is visible`);
        await this.waitForElement({ visible: true });
    }

    async assertNotVisible() {
        this.log(`Asserting ${this.name} is not visible`);
        await this.waitForElement();
        await this.waitForElement({ hidden: true });
    }
}

export class Text extends Element {
    async assertText(expectedText) {
        this.log(
            `Asserting text content of ${this.name} equals "${expectedText}"`);
        const elem = await this.waitForElement({ visible: true });
        const text = await getTextContent(elem);
        expect(text).toEqual(expectedText);
    }
}

export class Button extends Element {
    async hover() {
        this.log(`Hovering ${this.name}`);
        const button = await this.getButtonElement();
        await button.hover();
    }

    async select() {
        this.log(`Select ${this.name}`);
        const button = await this.getButtonElement();
        await button.click();
    }

    async doubleClick() {
        this.log(`Select ${this.name}`);
        const button = await this.getButtonElement();
        await button.click({count:2});
    }

    async getButtonElement() {
        return await this.waitForElement({ visible: true });
    }
}

export class Checkbox extends Element {
    async getInput() {
        return await this.waitForElement({ visible: true });
    }

    async isChecked() {
        const checkbox = await this.getInput();
        return await (await checkbox.getProperty('checked')).jsonValue();
    }

    async toggleOff() {
        if (await this.isChecked() === true) {
            this.log(`Toggling off ${this.name}`);
            const toggle = await this.getInput();
            await toggle.click();
        } else {
            this.log(`${this.name} was already toggled off`);
        }
    }

    async toggleOn() {
        if (await this.isChecked() === false) {
            this.log(`Toggling on ${this.name}`);
            const toggle = await this.getInput();
            await toggle.click();
        } else {
            this.log(`${this.name} already toggled on`);
        }
    }
}

export class TextInput extends Element {
    async enterText(text, pressEnter = false) {
        this.log(`Entering "${text}" into ${this.name}`);
        const input = await this.getInput();
        await input.type(text);
        await input.press('Enter');
    }

    async getInput() {
        return await this.waitForElement({ visible: true });
    }
}
