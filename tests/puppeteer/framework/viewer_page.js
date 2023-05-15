import fs from 'fs';
import puppeteer from "puppeteer";
import {DocFrame} from "./page_objects/doc_frame";
import {FactDetailsPanel} from "./page_objects/fact_details_panel";
import {PuppeteerScreenRecorder} from "puppeteer-screen-recorder";

export class ViewerPage {
    browser;
    page;
    docFrame;
    factDetailsPanel;

    #artifactDirectory = './tests/puppeteer/artifacts';
    #cleanedTestName = expect.getState().currentTestName.replaceAll(/[^a-zA-Z0-9-]/g, '_');
    #isCi = process.env.CI === 'true';
    #logMsgs = [];
    #recorder;

    async buildPage() {
        // Launch the browser
        this.browser = await puppeteer.launch({
            headless: this.#isCi,
            args: [`--window-size=1440,900`],
            defaultViewport: {width: 1440, height: 821}
        });
        this.page = await this.browser.newPage()
        this.docFrame = new DocFrame(this);
        this.factDetailsPanel = new FactDetailsPanel(this);
        this.#recorder = new PuppeteerScreenRecorder(this.page);

        // Set up the video recording
        const videoDir = `${this.#artifactDirectory}/video`
        const videoPath = `${videoDir}/${this.#cleanedTestName}.mp4`
        await this.#createDirectory(videoDir);
        await this.#recorder.start(videoPath);
    }

    log(message) {
        this.#logMsgs.push(message);
    }

    async navigateToViewer(filingZipName) {
        const filingName = filingZipName.replace('.zip', '');
        const url = `http://localhost:8080/tests/puppeteer/artifacts/generated_output/${filingName}.htm`;
        await this.page.goto(url,
                {waitUntil: 'networkidle0'});
    }

    async tearDown() {
        console.log(this.#logMsgs.join('\n'));
        await this.#recorder.stop();
        await this.browser.close();
    }

    async #createDirectory(path) {
        if (!fs.existsSync(path)){
            fs.mkdirSync(path, { recursive: true });
        }
    }
}
