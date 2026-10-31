import { test, expect } from '../framework/fixtures.js';

test.describe('report assets:', () => {
    test('files referenced by the report are copied next to the viewer', async ({ viewerPage }) => {
        const background = viewerPage.page.waitForResponse(
            (response) => response.url().endsWith('/report_assets_files/images/background.png'));
        await viewerPage.navigateToViewer('report_assets.zip');

        const docFrame = viewerPage.docFrame.getDocumentIframe();
        for (const id of ['flat-image', 'nested-image']) {
            await expect.poll(() => docFrame.locator(`#${id}`).evaluate((img) => img.complete && img.naturalWidth))
                .toBeGreaterThan(0);
        }
        expect((await background).status()).toBe(200);
    });
});
