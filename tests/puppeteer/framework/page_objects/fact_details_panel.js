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
                '//*[contains(@class, "fact-details")]//*[contains(@class,"std-label")]',
                'Fact Concept');
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
                '//*[@data-i18n="factDetails.factValue"]//ancestor::tr//*[contains(@class, "value")]',
                'Fact Value');
        this.entity = new Text(
                this.#viewerPage,
                '//*[@data-i18n="factDetails.entity"]//ancestor::tr//td',
                'Fact Entity');
        this.nextFact = new Button(this.#viewerPage,
                '//*[contains(@class, "ixbrl-next-tag")]', 'Next Fact');
        this.previousFact = new Button(this.#viewerPage,
                '//*[contains(@class, "ixbrl-prev-tag")]', 'Previous Fact');
    }

    // Asserts the calculation contributors listed in the fact details panel
    // under the [sectionTitle]. [expectedCalculation] is a map of concept to
    // weight ex: {'cash':'+ '}
    async assertCalculation(sectionTitle, expectedCalculations) {
        this.#viewerPage.log(`Asserting Calculations for section ${sectionTitle}`);

        // Pull the title elements and assert the section exists
        const titleElems = await this.#viewerPage.page.$$('.calculations .title');

        const titles = await Promise.all(titleElems.map(async (e) => await getTextContent(e)));
        expect(titles).toContain(sectionTitle)

        // Pull the concepts from the expected section
        const calc = await this.#viewerPage.page.evaluate((sectionTitle) => {
            const conceptElemsXPath = `
                //*[contains(@class,"calculations")]//*[text()="${sectionTitle}"]
                //ancestor::*[contains(@class,"card")]//*[contains(@class,"item")]
            `;
            const conceptElems = document.evaluate(conceptElemsXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

            let calculations = {};
            for (let i = 0; i < conceptElems.snapshotLength; i++) {
                let elem = conceptElems.snapshotItem(i);
                const nameElem = document.evaluate('.//*[contains(@class,"concept-name")]', elem, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                const weightElem = document.evaluate('.//*[contains(@class,"weight")]', elem, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                calculations[nameElem.textContent] = weightElem.textContent;
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
}
