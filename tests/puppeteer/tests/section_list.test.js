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

    test('Section List Bulk Toggle Test', async () => {
        const sectionList = viewerPage.sectionList;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        await sectionList.controls.assertVisible();

        await sectionList.expandAll.select();
        for (const section of await sectionList.getSections()) {
            await section.body.assertVisible();
        }

        await sectionList.collapseAll.select();
        for (const section of await sectionList.getSections()) {
            await section.body.assertNotVisible();
        }
    });

    test('Section List Toolbar Visibility Test', async () => {
        const sectionList = viewerPage.sectionList;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        await sectionList.controls.assertVisible();

        const [first] = await sectionList.getSections();
        await first.header.select();
        await first.body.assertVisible();
        await viewerPage.waitMilliseconds(500);
        await first.firstFact.doubleClick();
        await sectionList.controls.assertNotVisible();

        await sectionList.factsTab.select();
        await sectionList.controls.assertVisible();
    });
});
