import { test, expect } from '../framework/fixtures.js';

test.describe('absolute-position highlighting:', () => {
    test('verify absolute position wrappers are correctly classified', async ({ viewerPage }) => {
        await viewerPage.navigateToViewer('absolute_position_highlighting.zip');
        await expect(viewerPage.page.locator('#ixv')).toHaveClass(/post-processing-complete/);

        await expect.poll(() => viewerPage.docFrame.countElements('.ixbrl-contains-absolute')).toEqual(100);
        await expect.poll(() => viewerPage.docFrame.countElements('.ixbrl-no-highlight')).toEqual(100);
        await expect.poll(() => viewerPage.docFrame.countElements('.ixbrl-sub-element')).toEqual(10000);
    });
});
