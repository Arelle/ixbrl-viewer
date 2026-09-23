import { test } from '../framework/fixtures.js';
import { Button, Element } from '../framework/core_elements.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe('ixbrl-viewer:', () => {
    test('Mobile inspector pane', async ({ viewerPage }) => {
        const inspector = new Element(viewerPage, '//div[@id="pane-right"]', 'Inspector pane');
        const openButton = new Button(viewerPage, '//button[@id="inspector-toggle"]', 'Open inspector');
        const closeButton = new Button(viewerPage, '//button[@id="inspector-close"]', 'Close inspector');
        const detailsPanel = viewerPage.factDetailsPanel;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        // The inspector is hidden until it has something to show
        await inspector.assertNotVisible();

        // Tapping a fact opens the inspector on that fact
        await viewerPage.docFrame.selectFact('dei:DocumentType');
        await inspector.assertVisible();
        await detailsPanel.concept.assertText('Document Type');

        // The close button returns to the document
        await closeButton.select();
        await inspector.assertNotVisible();

        // The toolbar button reopens it on the same fact
        await openButton.select();
        await inspector.assertVisible();
        await detailsPanel.concept.assertText('Document Type');
    });
});
