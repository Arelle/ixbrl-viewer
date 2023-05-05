import {ElementHandle, Frame} from "puppeteer";
import {ViewerPage} from "../viewer_page";

export class DocFrame {
    #viewerPage;

    constructor(viewerPage){
        this.#viewerPage = viewerPage;
    }

    async getDocumentIframe() {
        let iframe = await this.#viewerPage.page.waitForSelector('xpath/' + '//iframe[@title="iXBRL document view"]');
        return iframe.contentFrame();
    }

    async getSelectedFact() {
        let iframe = await this.getDocumentIframe();
        return iframe.waitForSelector('xpath/' + '//*[contains(@class,"ixbrl-selected")]');
    }

    // Selects a fact in the document based on name
    // Ex: "dei:DocumentType"
    async selectFact(name) {
        this.#viewerPage.log(`Selecting fact ${name}`);
        let iframe = await this.getDocumentIframe();
        let fact = await iframe.waitForSelector('xpath/' + `//*[@name="${name}"]`);
        return fact.click();
    }
}
