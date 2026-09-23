import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/playwright/tests',
    timeout: 60000,
    forbidOnly: !!process.env.CI,
    workers: process.env.CI ? 1 : undefined,
    outputDir: './tests/playwright/artifacts/test-results',
    reporter: [
        ['list'],
        ['html', { outputFolder: './tests/playwright/artifacts/report', open: 'never' }],
    ],
    use: {
        browserName: 'chromium',
        channel: 'chromium',
        baseURL: 'http://localhost:8080',
        viewport: { width: 1440, height: 821 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'npx http-server . -a 0.0.0.0 -p 8080 -c-1',
        url: 'http://localhost:8080/tests/playwright/artifacts/generated_output/filing_documents_smoke_test.htm',
        reuseExistingServer: !process.env.CI,
    },
});
