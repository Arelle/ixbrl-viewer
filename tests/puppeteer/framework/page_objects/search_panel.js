import { Button, TextInput } from '../core_elements.js';
import { getTextContent } from '../utils.js';

export class Search {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
        this.filterToggle = new Button(this.#viewerPage,
            '//*[contains(@class,"filter-toggle")]', 'Filter Toggle');
        this.reset = new Button(this.#viewerPage,
            '//*[contains(@data-i18n,"inspector.reset")]', 'Reset');
        this.searchButton = new Button(this.#viewerPage,
            '//*[contains(@class,"search-button")]', 'Search');
        this.searchInput = new TextInput(this.#viewerPage,
            '//*[@id="ixbrl-search"]', 'Search Input');
    }

    async getSearchResults() {
        const elements = await this.#viewerPage.page.$x(
            '//*[contains(@class,"search-results")]' +
            '//*[contains(@class,"fact-list-item")]' +
            '//*[contains(@class,"title")]');
        return Promise.all(elements.map(async (e) => {
            return getTextContent(e);
        }));
    }

    async assertSearchResultsContain(concepts) {
        this.#viewerPage.log(`Asserting search results contain ${concepts}`);
        const results = await this.getSearchResults();
        for (const concept of concepts) {
            expect(results).toContain(concept);
        }
    }

    async assertSearchResultsDoNotContain(concepts) {
        this.#viewerPage.log(
            `Asserting search results do not contain ${concepts}`);
        const results = await this.getSearchResults();
        for (const concept of concepts) {
            expect(results).not.toContain(concept);
        }
    }

    async filterConceptType(option) {
        const dropdown = await this.#viewerPage.page
            .waitForSelector('#search-filter-concept-type');
        await dropdown.select(option);
    }

    async filterPeriod(option) {
        const dropdown = await this.#viewerPage.page
            .waitForSelector('#search-filter-period select');
        await dropdown.select(option);
    }

    getSearchResultCard(conceptName) {
        return new SearchResultCard(this.#viewerPage, conceptName);
    }
}

export class SearchResultCard {
    #viewerPage;

    constructor(viewerPage, conceptName) {
        this.conceptName = conceptName;
        this.#viewerPage = viewerPage;
        this.locator = `//*[contains(@class,"title")
            and contains(text(),"${this.conceptName}")]
            //ancestor::*[contains(@class,"fact-list-item")]`;
        this.selectButton = new Button(this.#viewerPage,
            `${this.locator}//*[contains(@class,"select-icon")]`,
            'Select Button');
    }
}
