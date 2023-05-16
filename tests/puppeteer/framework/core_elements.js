import {getTextContent} from "./utils";

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
        this.#viewerPage.log(`Asserting text content of ${this.#name} equals "${expectedText}"`);
        const elem = await this.#viewerPage.page.waitForSelector('xpath/' + this.#xpathSelector);
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

    async select() {
        this.#viewerPage.log(`Select ${this.#name}`);
        const button = await this.getButtonElement();
        await button.click();
    }

    async getButtonElement() {
        return await this.#viewerPage.page.waitForSelector('xpath/' + this.#xpathSelector);
    }
}
