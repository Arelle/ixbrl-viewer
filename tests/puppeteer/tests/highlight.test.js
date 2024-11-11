import { ViewerPage } from '../framework/viewer_page.js';
import { Highlight } from '../framework/page_objects/doc_frame.js';

jest.setTimeout(60000);

describe('ixbrl-viewer:', () => {
    let viewerPage;

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

    const untaggedDates = [
        'Jan 22',
        'Feb 2022',
        'March 2022',
        'Apr 15, 2022',
        'Aug 1st',
        '2022'
    ];

    const untaggedNumbers = [
        'zero',
        'two hundred',
        'no',
        'none',
        'three trillion four hundred thirty-four billion five hundred sixty-seven million eight hundred ninety thousand',
        '4 months',
        '25 months',
        '$123,001',
        '¢13',
        'US$22,214',
        '€123,457',
        '£332,235',
        '¥312,322',
        'C$77,987',
        'A$12,135',
        'NT$123,422',
        'S$565,929',
        '₩13,124',
        '₱33,446',
        '₨88,124',
        'kr99,193',
        'Fr.123,235',
        'RM84,235',
        'R$11,235',
        'R93,384'
    ];

    const deiFactValues = ['Jan 23', 'Aug 1st 2023'];

    const activeDeiFactHighlights = deiFactValues
        .map((entry) => Highlight.factNamespace2(entry));

    const activeGaapFactHighlights = gaapFactValues
        .map((entry) => Highlight.fact(entry));

    const activeReviewFactHighlights = [...deiFactValues, ...gaapFactValues]
        .map((entry) => Highlight.fact(entry));

    const activeUntaggedDateHighlights = untaggedDates
        .map((entry) => Highlight.untaggedDate(entry))

    const activeUntaggedNumberHighlights = untaggedNumbers
        .map((entry) => Highlight.untaggedNumber(entry))

    const inactiveGaapFactHighlights = gaapFactValues
        .map((entry) => Highlight.fact(entry, false));

    const inactiveDeiFactHighlights = deiFactValues
        .map((entry) => Highlight.factNamespace2(entry, false));

    const inactiveReviewFactHighlights = [...deiFactValues, ...gaapFactValues]
        .map((entry) => Highlight.fact(entry, false));

    const inactiveUntaggedDateHighlights = untaggedDates
        .map((entry) => Highlight.untaggedDate(entry, false));

    const  inactiveUntaggedNumberHighlights = untaggedNumbers
        .map((entry) => Highlight.untaggedNumber(entry, false));

    beforeEach(async () => {
        viewerPage = new ViewerPage();
        await viewerPage.buildPage();
    });

    afterEach(async () => {
        await viewerPage.tearDown();
    });

    test('Highlight Test', async () => {
        await viewerPage.navigateToViewer('highlights.zip');

        // Assert on load values are not highlighted
        await viewerPage.docFrame.assertHighlights([
            ...inactiveGaapFactHighlights, ...inactiveDeiFactHighlights]);

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

    test('Highlight Test - Review', async () => {
        await viewerPage.navigateToViewer('highlights.zip', '?review=true');

        // Assert on load values are not highlighted
        await viewerPage.docFrame.assertHighlights([
            ...inactiveReviewFactHighlights,
            ...inactiveUntaggedDateHighlights,
            ...inactiveUntaggedNumberHighlights
        ]);

        // Enable untagged date highlighting and assert values
        await viewerPage.toolbar.unTaggedDateHighlight.toggleOn();
        await viewerPage.docFrame.assertHighlights([
            ...activeUntaggedDateHighlights,
            ...inactiveUntaggedNumberHighlights,
            ...inactiveReviewFactHighlights
        ]);

        // Enable untagged number highlighting and assert values
        await viewerPage.toolbar.unTaggedNumberHighlight.toggleOn();
        await viewerPage.docFrame.assertHighlights([
            ...activeUntaggedNumberHighlights,
            ...activeUntaggedDateHighlights,
            ...inactiveGaapFactHighlights,
            ...inactiveDeiFactHighlights
        ]);

        // Enable fact highlights and assert values
        await viewerPage.toolbar.xbrlElementHighlight.toggleOn();
        await viewerPage.docFrame.assertHighlights([
            ...activeReviewFactHighlights,
            ...activeUntaggedNumberHighlights,
            ...activeUntaggedDateHighlights,
        ]);

        // Disable highlights
        await viewerPage.toolbar.unTaggedDateHighlight.toggleOff();
        await viewerPage.waitMilliseconds(100);
        await viewerPage.toolbar.unTaggedNumberHighlight.toggleOff();
        await viewerPage.waitMilliseconds(100);
        await viewerPage.toolbar.xbrlElementHighlight.toggleOff();

        // Assert values are no longer highlighted
        await viewerPage.docFrame.assertHighlights([
            ...inactiveReviewFactHighlights,
            ...inactiveUntaggedDateHighlights,
            ...inactiveUntaggedNumberHighlights
        ]);
    });
});
