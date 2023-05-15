#!/bin/bash

set -e

testFilingDir=tests/puppeteer/test_filings
genDir=tests/puppeteer/artifacts/generated_output
mkdir -p $genDir

for file in "$testFilingDir"/*.zip; do
    echo "Generating ixbrl-viewer for: $file"
    outputFilename=$(basename -- "$file")
    viewerName=${outputFilename%.zip}.htm
    arelleCmdLine --plugins ixbrl-viewer -f $file --save-viewer $genDir/$viewerName --viewer-url ../../../../iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js
done
echo "iXBRL-Viewer Generation Complete"
