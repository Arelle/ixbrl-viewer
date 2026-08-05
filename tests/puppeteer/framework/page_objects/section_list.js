import { Button, Element, Text } from '../core_elements.js';

const FACT_INSPECTOR_XPATH = '//*[@id="inspector"]//*[contains(@class,"inspector-container") and contains(@class,"fact-inspector")]';
const CONTAINER_XPATH = '//*[@id="inspector"]//*[contains(@class,"facts-by-group")]';
const SECTIONS_XPATH = `${CONTAINER_XPATH}//*[contains(@class,"collapsible-section")]`;
const CONTROLS_XPATH = `${FACT_INSPECTOR_XPATH}/*[contains(@class,"section-list-controls")]`;

export class SectionList {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
        this.controls = new Element(viewerPage, CONTROLS_XPATH,
            'Section List Toolbar');
        this.collapseAll = new BulkToggle(viewerPage,
            '//button[@id="collapse-all-sections"]',
            'Collapse All');
        this.expandAll = new BulkToggle(viewerPage,
            '//button[@id="expand-all-sections"]',
            'Expand All');
        this.factsTab = new Button(viewerPage,
            '//*[@data-mode="fact-mode"]', 'XBRL Facts Tab');
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

export class BulkToggle extends Button {
    async assertAvailable() {
        await this.assertAttribute('aria-disabled', 'false');
    }

    async assertUnavailable() {
        await this.assertAttribute('aria-disabled', 'true');
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
        this.firstFact = new Button(viewerPage,
            `(${this.locator}//button[contains(@class,"fact-list-item")])[1]`,
            `Section ${position} First Fact`);
    }
}
