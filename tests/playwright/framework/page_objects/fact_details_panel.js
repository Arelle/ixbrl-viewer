import { Button, Text } from '../core_elements.js';
import { getTextContent } from '../utils.js';

export class FactDetailsPanel {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;

        this.accuracy = new Text(
                this.#viewerPage,
                '//*[@data-i18n="factDetails.accuracy"]//ancestor::tr//td',
                'Fact Accuracy');
        this.concept = new Text(
                this.#viewerPage,
                '//*[contains(@class, "fact-inspector")]//*[contains(@class,"concept-name-title")]',
                'Fact Concept Name');
        this.date = new Text(
                this.#viewerPage,
                '//*[@data-i18n="factDetails.date"]//ancestor::tr//td',
                'Fact Date');
        this.duplicateNext = new Button(
                this.#viewerPage,
                '//*[contains(@class,"duplicates")]//*[contains(@class,"next")]',
                'Duplicate next');
        this.duplicateText = new Text(
                this.#viewerPage,
                '//*[contains(@class,"duplicates")]//*[contains(@class,"text")]',
                'Duplicate Count');
        this.factValue = new Text(
                this.#viewerPage,
                '//*[@data-i18n="factDetails.factValue"]//ancestor::tr//*[contains(concat(" ",@class," "), " value ")]',
                'Fact Value');
        this.entity = new Text(
                this.#viewerPage,
                '//*[@data-i18n="factDetails.entity"]//ancestor::tr//td',
                'Fact Entity');
        this.source = new Text(
                this.#viewerPage,
                '//tr[contains(@class,"namespace")]//td/span[contains(@class, "text")]',
                'Source (Namespace)');
        this.nextFact = new Button(this.#viewerPage,
                '//button[contains(@class, "next-tag")]', 'Next Fact');
        this.previousFact = new Button(this.#viewerPage,
                '//button[contains(@class, "prev-tag")]', 'Previous Fact');
    }

    // Asserts the calculation contributors listed in the fact details panel
    // under the [sectionTitle]. [expectedCalculation] is a map of concept to
    // weight ex: {'cash':'+ '}
    async assertCalculation(sectionTitle, expectedCalculations) {
        this.#viewerPage.log(`Asserting Calculations for section ${sectionTitle}`);

        // Pull the title elements and assert the section exists
        const titleElems = await this.#viewerPage.page.$$('.calculations h4');

        const titles = await Promise.all(titleElems.map(async (e) => await getTextContent(e)));
        expect(titles).toContain(sectionTitle)

        // Pull the concepts from the expected section
        const calc = await this.#viewerPage.page.evaluate((sectionTitle) => {
            const conceptElemsXPath = `
                //*[contains(@class,"calculations")]//h4[text()="${sectionTitle}"]
                //ancestor::div//*[contains(@class,"content")]//*[contains(@class,"calculation-row")]
            `;
            const conceptElems = document.evaluate(conceptElemsXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

            let calculations = {};
            for (let i = 0; i < conceptElems.snapshotLength ; i++) {
                let elem = conceptElems.snapshotItem(i);
                const nameElem = document.evaluate('.//*[contains(@class,"calculation-label")]//button', elem, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                const weightElem = document.evaluate('.//*[contains(concat(" ",@class," ")," icon ")]', elem, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                let weight;
                if (weightElem.getAttribute("class").includes("plus")) {
                    weight = "+";
                }
                else if (weightElem.getAttribute("class").includes("minus")) {
                    weight = "-";
                }
                else if (weightElem.getAttribute("class").includes("equals")) {
                    weight = "=";
                }
                calculations[nameElem?.textContent ?? "TOTAL"] = weight;
            }

            return calculations;
        }, sectionTitle);

        expect(calc).toEqual(expectedCalculations);
    }

    async assertFootnotes(expectedFootnotes) {
        this.#viewerPage.log('Asserting footnotes');
        const conceptElems = await this.#viewerPage.page.$$('.footnotes .block-list-item');
        const footnotes = await Promise.all(conceptElems.map(async (e) => await getTextContent(e)));
        expect(footnotes).toEqual(expectedFootnotes);
    }

    // Returns the width of the fact details panel
    async getPanelWidth() {
        const inspectorPanel = await this.#viewerPage.page.waitForSelector('#inspector');
        const boundingBox = await inspectorPanel.boundingBox();
        return boundingBox.width;
    }

    // Resizes the panels based on the provided horizontalMovement value.
    // positive values will move the panel to the right, negative values will
    // move left
    async resizePanel(horizontalMovement) {
        this.#viewerPage.log('Resizing fact details panel by ' + horizontalMovement + ' pixels');
        const resizer = await this.#viewerPage.page
            .waitForSelector('#viewer-resize-handle', { visible: true });
        const box = await resizer.boundingBox();

        // Start the drag action
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        await this.#viewerPage.page.mouse.move(startX, startY);
        await this.#viewerPage.page.mouse.down();

        // Drag horizontally
        await this.#viewerPage.page.mouse.move(startX + horizontalMovement, startY, { steps: 10 });
        await this.#viewerPage.page.mouse.up();
    }

}
