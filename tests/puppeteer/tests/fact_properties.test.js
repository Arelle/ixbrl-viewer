import { ViewerPage } from '../framework/viewer_page.js';
import { getTextContent } from '../framework/utils.js';

jest.setTimeout(60000);

describe('ixbrl-viewer',() => {
        let viewerPage;

        beforeEach(async () => {
                viewerPage = new ViewerPage();
                await viewerPage.buildPage();
        })

        afterEach(async () => {
                await viewerPage.tearDown();
        });

        test('Fact Properties', async () => {
                const detailsPanel = viewerPage.factDetailsPanel;
                const documentType = '10-K';

                await viewerPage.navigateToViewer('filing_documents_smoke_test.zip');

                await expect(await viewerPage.page.title()).toContain('Inline Viewer');

                // Click on the Document Type fact
                await viewerPage.docFrame.selectFact('dei:DocumentType');

                // Assert the fact details
                await detailsPanel.concept.assertText('(dei) Document Type');
                await detailsPanel.date.assertText('1 Jan 2020 to 30 Sep 2020');
                await detailsPanel.factValue.assertText(documentType);
                await detailsPanel.accuracy.assertText('n/a');
                await detailsPanel.entity.assertText('[CIK] 0000990763');

                // Navigate to the previous fact (last fact in document)
                await detailsPanel.previousFact.select();

                // Assert the previous fact was selected
                await detailsPanel.concept.assertText('(us-gaap) Revenues');
                await detailsPanel.date.assertText('1 Jan 2011 to 31 Mar 2011');
                await detailsPanel.factValue.assertText('US $ 5,117,000,000');
                await detailsPanel.accuracy.assertText('millions');
                await detailsPanel.entity.assertText('[CIK] 0000990763');

                // Assert Calculations
                await detailsPanel.assertCalculation('1001002 - Statement - Statement', {
                        'Gain (Loss) on Investments': '+ ',
                        'Other Income': '+ ',
                        'Net Investment Income': '+ ',
                        'Premiums Earned, Net': '+ ',
                        'Revenues': ''
                });

                // Assert footnotes applied
                await detailsPanel.assertFootnotes(['This is a footnote']);

                // Navigate to next fact and assert it takes us back to the first one
                await detailsPanel.nextFact.select();
                await detailsPanel.concept.assertText('(dei) Document Type');

                // Duplicate Facts - Verify we're looking at fact 1 of 2
                await detailsPanel.duplicateText.assertText('1 of 2');
                const oldFact = await viewerPage.docFrame.getSelectedFact();
                const oldFactBox = await oldFact.boundingBox();
                const oldFactText = await getTextContent(oldFact);
                expect(oldFactText).toEqual(documentType);

                // Duplicate Facts - Test navigation to fact 2
                await detailsPanel.duplicateNext.select();
                await detailsPanel.duplicateText.assertText('2 of 2');
                const newFact = await viewerPage.docFrame.getSelectedFact();
                const newFactBox = await newFact.boundingBox();
                const newFactText = await getTextContent(newFact);
                expect(newFactText).toEqual(documentType);
                expect(newFactBox).not.toEqual(oldFactBox);
        });
});
