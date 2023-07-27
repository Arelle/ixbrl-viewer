export class DocFrame {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
    }

    async getDocumentIframe() {
        const iframe = await this.#viewerPage.page.waitForSelector(
            'xpath/' + '//iframe[@title="iXBRL document view"]');
        return iframe.contentFrame();
    }

    async getSelectedFact() {
        const iframe = await this.getDocumentIframe();
        return iframe.waitForSelector(
            'xpath/' + '//*[contains(@class,"ixbrl-selected")]');
    }

    // Selects a fact in the document based on name
    // Ex: "dei:DocumentType"
    async selectFact(name) {
        this.#viewerPage.log(`Selecting fact ${name}`);
        const iframe = await this.getDocumentIframe();
        const fact = await iframe.waitForSelector(
            'xpath/' + `//*[@name="${name}"]`);
        return fact.click();
    }

    /// Asserts the highlight color matches for the selected document values
    async assertHighlights(highlights) {
        const contentFrame = await this.getDocumentIframe();
        for (const highlight of highlights) {
            this.#viewerPage.log(
                `Asserting the value "${highlight.docContent}" to be highlighted with ${highlight.property} ${highlight.color}`);
            const element = await contentFrame.waitForSelector(
                'xpath/' + highlight.locator);
            const style = await contentFrame.evaluate(
                (element, property) => getComputedStyle(element)
                    .getPropertyValue(property), element, highlight.property);
            expect(style).toEqual(highlight.color);
        }
    }
}

export class Highlight {

    static darkBlue = 'rgb(2, 109, 206)';
    static green = 'rgb(217, 243, 190)';
    static lightBlue = 'rgb(0, 148, 255)';
    static yellow = 'rgb(255, 240, 179)';
    static purple = 'rgb(234, 168, 255)';
    static propBgColor = 'background-color';
    static propOutline = 'outline';
    static transparent = 'rgba(0, 0, 0, 0)';

    constructor(color, locator, property, docContent) {
        this.color = color;
        this.docContent = docContent;
        this.locator = locator;
        this.property = property;
    }

    static fact(docContent, active = true) {
        const color = active ? this.green : this.transparent;
        const locator = `//*[contains(text(),"${docContent}")]//ancestor::*[contains(@class,"ixbrl-element")]`;
        return new Highlight(color, locator, this.propBgColor, docContent);
    };

    static factNamespace2(docContent, active = true) {
        const color = active ? this.purple : this.transparent;
        const locator = `//*[contains(text(),"${docContent}")]//ancestor::*[contains(@class,"ixbrl-element")]`;
        return new Highlight(color, locator, this.propBgColor, docContent);
    };

    static searchHover(docContent, active = true) {
        const color = active
            ? `${this.darkBlue} dashed 2px`
            : 'rgb(0, 0, 0) none 0px';
        const locator = `//*[contains(text(),"${docContent}")]//ancestor::*[contains(@class,"ixbrl-element")]`;
        return new Highlight(color, locator, this.propOutline, docContent);
    };

    static selectedFact(docContent, active = true) {
        const color = active
            ? `${this.lightBlue} solid 2px`
            : 'rgb(0, 0, 0) none 0px';
        const locator = `//*[contains(text(),"${docContent}")]//ancestor::*[contains(@class,"ixbrl-element")]`;
        return new Highlight(color, locator, this.propOutline, docContent);
    };

    static untaggedDate(docContent, active = true) {
        const color = active ? this.yellow : this.transparent;
        const locator =
                `//*[contains(@class,"review-untagged-date") and contains(text(),"${docContent}")]`;
        return new Highlight(color, locator, this.propBgColor, docContent)
    }

    static untaggedNumber(docContent, active = true) {
        const color = active ? this.purple : this.transparent;
        const locator =
            `//*[contains(@class,"review-untagged-number") and contains(text(),"${docContent}")]`;
        return new Highlight(color, locator, this.propBgColor, docContent);
    }
}
