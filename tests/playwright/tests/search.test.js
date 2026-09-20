import { test } from '../framework/fixtures.js';
import { Highlight } from '../framework/page_objects/doc_frame.js';

test.describe('ixbrl-viewer:', () => {
    test('Search Test', async ({ viewerPage }) => {
        const concept1 = 'Entity Address, City or Town';
        const concept2 = 'Entity Address, State or Province';
        const concept3 = 'Contact Personnel Name';
        const concept4 = 'Entity Public Float';

        const docFrame = viewerPage.docFrame;
        const search = viewerPage.search;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

        // // Open search and assert all concepts are shown
        await search.searchButton.select();
        await search.assertSearchResults(
            [concept1, concept2, concept3, concept4]);

        // Search for Entity Address and assert results update
        await search.searchInput.enterText('Entity Address', true);
        await search.assertSearchResults([concept1, concept2, concept4], [concept3]);

        // Navigate to the fact details for concept1
        await search.getSearchResultCard(concept1).selectButton.doubleClick();
        await viewerPage.factDetailsPanel.concept
            .assertText('Entity Address, City or Town');

        // Assert the fact was highlighted in the document
        await docFrame.assertHighlights([Highlight.selectedFact('Ames')]);

        // Go back to search and assert it still contains our results
        await search.searchButton.select();
        await search.assertSearchResults([concept1, concept2, concept4], [concept3]);

        // Select concept2 fact and assert selection changes
        await search.getSearchResultCard(concept2).selectButton.doubleClick();
        await docFrame.assertHighlights(
            [Highlight.selectedFact('Ames', false)]);
        await docFrame.assertHighlights([
            Highlight.selectedFact('IA', true, 'dei:EntityAddressStateOrProvince')]);
        await viewerPage.factDetailsPanel.concept.assertText(
            'Entity Address, State or Province');

        // Return to search and test hover highlight
        await search.searchButton.select();
        await search.getSearchResultCard(concept1).selectButton.hover();
        await docFrame.assertHighlights([Highlight.searchHover('Ames')]);

        // Mouse off and assert hover is removed
        await search.searchButton.hover();
        await docFrame
            .assertHighlights([Highlight.searchHover('Ames', false)]);

        // Filter by concept type and assert values have been filtered
        await search.filterButton.select();
        await search.filterConceptType('numeric');
        await search.assertSearchResults([concept4], [concept1, concept2]);

        // Reset concept type filter
        await search.reset.select();
        await search.assertSearchResults([concept4, concept1, concept2]);

        // Filter by period
        await search.filterPeriod('2020-10-01');
        await search.assertSearchResults([concept4], [concept1, concept2]);
    });
});
