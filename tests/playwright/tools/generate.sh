#!/bin/bash

set -e

testFilingDir=tests/playwright/test_filings
genDir=tests/playwright/artifacts/generated_output
mkdir -p $genDir

for file in "$testFilingDir"/*.zip; do
    echo "Generating ixbrl-viewer for: $file"
    outputFilename=$(basename -- "$file")
    viewerName=${outputFilename%.zip}.htm
    arelleCmdLine --plugins ixbrl-viewer -f $file --save-viewer $genDir/$viewerName --viewer-url ../../../../iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js --viewer-no-copy-script
done
echo "iXBRL-Viewer Generation Complete"
