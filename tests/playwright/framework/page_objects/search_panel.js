import { Button, TextInput } from '../core_elements.js';
import { expect } from '@playwright/test';

export class Search {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
        this.filterButton = new Button(this.#viewerPage,
            '//*[contains(@class,"filter-toggle")]', 'Filter Button');
        this.reset = new Button(this.#viewerPage,
            '//*[contains(@class, "search-reset-filters")]', 'Reset');
        this.searchButton = new Button(this.#viewerPage,
            '//*[contains(@data-mode,"search-mode")]', 'Search');
        this.searchInput = new TextInput(this.#viewerPage,
            '//*[@id="ixbrl-search"]', 'Search Input');
    }

    async getSearchResults() {
        return this.#viewerPage.page.locator('.search-results .fact-list-item .title').allTextContents();
    }

    async assertSearchResults(included, excluded = []) {
        this.#viewerPage.log(`Asserting search results include ${included} and exclude ${excluded}`);
        await expect(async () => {
            const results = await this.getSearchResults();
            expect(results).toEqual(expect.arrayContaining(included));
            for (const concept of excluded) {
                expect(results).not.toContain(concept);
            }
        }).toPass({ timeout: 5000 });
    }

    async filterConceptType(option) {
        const checkbox = this.#viewerPage.page
            .locator(`#search-filter-concept-type input[value = "${option}"]`);
        await checkbox.click();
    }

    async filterPeriod(option) {
        const checkbox = this.#viewerPage.page
            .locator(`#search-filter-period input[value = "${option}"]`);
        await checkbox.click();
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
        this.locator = `//*[contains(@class,"search-results")]//*[contains(@class,"title")
            and contains(text(),"${this.conceptName}")]
            //ancestor::*[contains(@class,"fact-list-item")]`;
        this.selectButton = new Button(this.#viewerPage, this.locator, 'Select Button');
    }
}
