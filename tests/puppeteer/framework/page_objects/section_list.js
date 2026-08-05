import { Button, Element } from '../core_elements.js';

const CONTAINER_XPATH = '//*[@id="inspector"]//*[contains(@class,"facts-by-group")]';
const SECTIONS_XPATH = `${CONTAINER_XPATH}//*[contains(@class,"collapsible-section")]`;

export class SectionList {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
    }

    async getSectionCount() {
        const sections = await this.#viewerPage.page.$$('xpath/' + SECTIONS_XPATH);
        return sections.length;
    }

    async assertSectionCount(expectedCount) {
        this.#viewerPage.log(
            `Asserting section list holds ${expectedCount} sections`);
        expect(await this.getSectionCount()).toEqual(expectedCount);
    }

    getSection(position) {
        return new Section(this.#viewerPage, position);
    }

    async getSections() {
        const count = await this.getSectionCount();
        return Array.from({ length: count }, (_, i) => this.getSection(i + 1));
    }
}

export class Section {
    constructor(viewerPage, position) {
        this.locator = `(${SECTIONS_XPATH})[${position}]`;
        this.header = new Button(viewerPage,
            `${this.locator}//*[contains(@class,"collapsible-header")]/button[1]`,
            `Section ${position} Header`);
        this.body = new Element(viewerPage,
            `${this.locator}/*[contains(@class,"collapsible-body")]`,
            `Section ${position} Body`);
    }
}
