import { test } from '../framework/fixtures.js';

test.describe('ixbrl-viewer:', () => {
    test('Section List Test', async ({ viewerPage }) => {
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

    test('Section List Bulk Toggle Test', async ({ viewerPage }) => {
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

    test('Section List Bulk Toggle Availability Test', async ({ viewerPage }) => {
        const sectionList = viewerPage.sectionList;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        await sectionList.collapseAll.assertUnavailable();
        await sectionList.expandAll.assertAvailable();

        await sectionList.expandAll.pressKey('Enter');

        await sectionList.expandAll.assertUnavailable();
        await sectionList.expandAll.assertFocused();
        await sectionList.collapseAll.assertAvailable();

        await sectionList.expandAll.pressShiftTab();

        await sectionList.collapseAll.assertFocused();
    });

    test('Section List Toolbar Visibility Test', async ({ viewerPage }) => {
        const sectionList = viewerPage.sectionList;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        await sectionList.controls.assertVisible();

        const [first] = await sectionList.getSections();
        await first.header.select();
        await first.body.assertVisible();
        await first.firstFact.doubleClick();
        await sectionList.controls.assertNotVisible();

        await sectionList.factsTab.select();
        await sectionList.controls.assertVisible();
    });
});
