import { test as base, expect } from '@playwright/test';
import { ViewerPage } from './viewer_page.js';

export const test = base.extend({
    viewerPage: async ({ page }, use, testInfo) => {
        const viewerPage = new ViewerPage(page);
        try {
            await use(viewerPage);
        } finally {
            await testInfo.attach('browser.log', {
                body: viewerPage.logs.join('\n'),
                contentType: 'text/plain',
            });
        }
    },
});

export { expect };
