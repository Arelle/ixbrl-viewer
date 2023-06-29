import { ViewerPage } from '../framework/viewer_page.js';
import { Highlight } from '../framework/page_objects/doc_frame.js';

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

    test('Highlight Test', async () => {
        const gaapFactValues = [
            'Feb 2023',
            'March 2023',
            'Apr 15, 2023',
            'zero',
            'one hundred',
            'none',
            'two trillion three hundred thirty-four billion five hundred sixty-seven million eight hundred ninety thousand',
            '5', // 5 Months
            '26', // 26 Months
            '123,000', // $123,000
            '12', // ¢12
            '22,213', // US$22,213
            '123,456', // €123,456
            '332,234', // £332,234
            '312,321', // ¥312,321
            '77,986', // C$77,986
            '12,134', // A$12,134
            '123,421', // NT$123,421
            '565,928', // S$565,928
            '13,123', // ₩13,123
            '33,445', // ₱33,445
            '88,123', // ₨88,123
            '99,192', // kr99,192
            '123,234', // Fr.123,234
            '84,234', // RM84,234
            '11,234', // R$11,234
            '93,383', // R93,383
        ];

        const deiFactValues = ['Jan 23', 'Aug 1st 2023'];

        const activeGaapFactHighlights = gaapFactValues
            .map((entry) => Highlight.fact(entry));

        const inactiveGaapFactHighlights = gaapFactValues
            .map((entry) => Highlight.fact(entry, false));

        const activeDeiFactHighlights = deiFactValues
            .map((entry) => Highlight.factNamespace2(entry));

        const inactiveDeiFactHighlights = deiFactValues
            .map((entry) => Highlight.factNamespace2(entry, false));

        await viewerPage.navigateToViewer('highlights.zip');

        // Enable fact highlights and assert values
        await viewerPage.toolbar.xbrlElementHighlight.toggleOn();
        await viewerPage.docFrame.assertHighlights([
            ...activeGaapFactHighlights, ...activeDeiFactHighlights]);

        // Disable highlights
        await viewerPage.toolbar.xbrlElementHighlight.toggleOff();

        // Assert values are no longer highlighted
        await viewerPage.docFrame.assertHighlights([
            ...inactiveGaapFactHighlights, ...inactiveDeiFactHighlights]);
    });
});
