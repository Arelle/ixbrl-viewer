import { Button } from '../core_elements.js';

export class Toolbar {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
        this.xbrlElementHighlight = new Button(this.#viewerPage,
            '//button[@id="highlight-tags"]',
            'XBRL Element Highlight');
        this.unTaggedDateHighlight = new Button(this.#viewerPage,
            '//button[@id="highlight-untagged-dates"]',
            'Untagged Dates');
        this.unTaggedNumberHighlight = new Button(this.#viewerPage,
            '//button[@id="highlight-untagged-numbers"]',
            'Untagged Numbers');
    }
}
