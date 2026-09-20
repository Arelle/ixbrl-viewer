import { ViewerPage } from '../framework/viewer_page.js';

jest.setTimeout(60000);

describe('absolute-position highlighting:', () => {
    let viewerPage;

    beforeEach(async () => {
        viewerPage = new ViewerPage();
        await viewerPage.buildPage();
    });

    afterEach(async () => {
        await viewerPage.tearDown();
    });

    test('verify absolute position wrappers are correctly classified', async () => {
        await viewerPage.navigateToViewer('absolute_position_highlighting.zip');
        await viewerPage.page.waitForSelector('#ixv.post-processing-complete');

        expect(await viewerPage.docFrame.countElements('.ixbrl-contains-absolute')).toEqual(100);
        expect(await viewerPage.docFrame.countElements('.ixbrl-no-highlight')).toEqual(100);
        expect(await viewerPage.docFrame.countElements('.ixbrl-sub-element')).toEqual(10000);
    });
});
