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

    test('Search Test', async () => {
        const concept1 = 'Entity Address, City or Town';
        const concept2 = 'Entity Address, State or Province';
        const concept3 = 'Contact Personnel Name';
        const concept4 = 'Entity Public Float';

        const docFrame = viewerPage.docFrame;
        const search = viewerPage.search;

        await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');
        await viewerPage.waitMilliseconds('3000'); // Give search time to index

        // // Open search and assert all concepts are shown
        await search.searchButton.select();
        await search.assertSearchResultsContain(
            [concept1, concept2, concept3, concept4]);

        // Search for Entity Address and assert results update
        await search.searchInput.enterText('Entity Address', true);
        await search.assertSearchResultsDoNotContain([concept3]);
        await search.assertSearchResultsContain([concept1, concept2, concept4]);

        // Navigate to the fact details for concept1
        await search.getSearchResultCard(concept1).selectButton.select();
        await viewerPage.factDetailsPanel.concept
            .assertText('(dei) Entity Address, City or Town');

        // Assert the fact was highlighted in the document
        await docFrame.assertHighlights([Highlight.selectedFact('Ames')]);

        // Go back to search and assert it still contains our results
        await search.searchButton.select();
        await search.assertSearchResultsDoNotContain([concept3]);
        await search.assertSearchResultsContain([concept1, concept2, concept4]);

        // Select concept2 fact and assert selection changes
        await search.getSearchResultCard(concept2).selectButton.select();
        await docFrame.assertHighlights(
            [Highlight.selectedFact('Ames', false)]);
        await docFrame.assertHighlights([Highlight.selectedFact('IA')]);
        await viewerPage.factDetailsPanel.concept.assertText(
            '(dei) Entity Address, State or Province');

        // Return to search and test hover highlight
        await search.searchButton.select();
        await search.getSearchResultCard(concept1).selectButton.hover();
        await docFrame.assertHighlights([Highlight.searchHover('Ames')]);

        // Mouse off and assert hover is removed
        await search.searchButton.hover();
        await docFrame
            .assertHighlights([Highlight.searchHover('Ames', false)]);

        // Filter by concept type and assert values have been filtered
        await search.filterToggle.select();
        await search.filterConceptType('numeric');
        await search.assertSearchResultsContain([concept4]);
        await search.assertSearchResultsDoNotContain([concept1, concept2]);

        // Reset concept type filter
        await search.reset.select();
        await search.assertSearchResultsContain([concept4, concept1, concept2]);

        // Filter by period
        await search.filterPeriod('2020-10-01');
        await search.assertSearchResultsContain([concept4]);
        await search.assertSearchResultsDoNotContain([concept1, concept2]);
    });
});
