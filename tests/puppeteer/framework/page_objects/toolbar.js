import { Checkbox } from '../core_elements.js';

export class Toolbar {
    #viewerPage;

    constructor(viewerPage) {
        this.#viewerPage = viewerPage;
        this.xbrlElementHighlight = new Checkbox(this.#viewerPage,
            '//*[contains(@class,"top-bar-controls")]//*[contains(text(),"XBRL Elements")]//input',
            'XBRL Element Highlight');
        this.unTaggedDateHighlight = new Checkbox(this.#viewerPage,
            '//*[contains(@class,"top-bar-controls")]//*[contains(text(),"Untagged Dates")]//input',
            'Untagged Dates');
        this.unTaggedNumberHighlight = new Checkbox(this.#viewerPage,
            '//*[contains(@class,"top-bar-controls")]//*[contains(text(),"Untagged Numbers")]//input',
            'Untagged Numbers');
    }
}
