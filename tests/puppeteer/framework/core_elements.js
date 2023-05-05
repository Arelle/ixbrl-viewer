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
        let elem = await this.#viewerPage.page.waitForSelector('xpath/' + this.#xpathSelector);
        let text = await (await elem.getProperty('textContent')).jsonValue();
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
        let button = await this.getButtonElement();
        await button.click();

    }

    async getButtonElement() {
        return await this.#viewerPage.page.waitForSelector('xpath/' + this.#xpathSelector);
    }
}
