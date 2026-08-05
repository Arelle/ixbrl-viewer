import { ViewerPage } from '../framework/viewer_page.js';

jest.setTimeout(60000);

describe('ixbrl-viewer:', () => {
    let viewerPage;

    beforeEach(async () => {
        viewerPage = new ViewerPage();
        await viewerPage.buildPage();
    });

    afterEach(async () => {
        await viewerPage.tearDown();
    });

    test('Section List Test', async () => {
        const sectionList = viewerPage.sectionList;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        await sectionList.assertSectionCount(2);
        for (const section of await sectionList.getSections()) {
            await section.header.assertVisible();
            await section.body.assertNotVisible();
        }

        const [first, second] = await sectionList.getSections();
        await first.header.select();
        await first.body.assertVisible();
        await second.body.assertNotVisible();

        await first.header.select();
        await first.body.assertNotVisible();
    });
});
