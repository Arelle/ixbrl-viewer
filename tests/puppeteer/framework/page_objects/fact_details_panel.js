import {Button, Text} from "../core_elements";

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
        let titleElems = await this.#viewerPage.page.$x('//*[contains(@class,"calculations")]//*[contains(@class,"title")]');

        let titles = await Promise.all(titleElems.map(async (e) => await (await e.getProperty('textContent')).jsonValue()));
        expect(titles).toContain(sectionTitle)

        // Pull the concepts from the expected section
        let conceptElems = await this.#viewerPage.page.$x(`
            //*[contains(@class,"calculations")]//*[text()="${sectionTitle}"]
            //ancestor::*[contains(@class,"card")]//*[contains(@class,"item")]
        `);

        let calc = {};
        for(const elem in conceptElems){
            let nameElem = await conceptElems[elem].waitForSelector('xpath/' + '*[contains(@class,"concept-name")]');
            let name = await (await nameElem.getProperty('textContent')).jsonValue();
            let weightElem = await conceptElems[elem].waitForSelector('xpath/' + '*[contains(@class,"weight")]');
            let weight = await (await weightElem.getProperty('textContent')).jsonValue();
            calc[name] = weight;
        }
        expect(calc).toEqual(expectedCalculations);
    }

    async assertFootnotes(expectedFootnotes) {
        this.#viewerPage.log('Asserting footnotes');
        let conceptElems = await this.#viewerPage.page.$x(
                '//*[contains(@class,"footnotes")]//*[contains(@class,"block-list-item")]');
        let footnotes = await Promise.all(conceptElems.map(async (e) => await (await e.getProperty('textContent')).jsonValue()));
        expect(footnotes).toEqual(expectedFootnotes);
    }
}
