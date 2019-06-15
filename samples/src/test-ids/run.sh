#!/bin/bash

arelle -v -f '[{"ixds":[{"file":"doc1.html"},{"file":"doc2.html"}]}]' --plugins 'inlineXbrlDocumentSet|/home/pdw/c.b.c/clients/workiva/ixbrl-viewer/iXBRLViewerPlugin/' --save-viewer=viewer.html --viewer-url=../../../iXBRLViewerPlugin/viewer/dist/ixbrlviewer.dev.js 
