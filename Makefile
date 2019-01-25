all: dev samples

samples:
	$(MAKE) -C $@

dev: iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.dev.js

prod: iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.js

iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.dev.js:	iXBRLViewerPlugin/viewer/src/*/*
	cd iXBRLViewerPlugin/viewer && npx webpack --config webpack.dev.js --optimize-minimize

iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.js:	iXBRLViewerPlugin/viewer/src/*/*
	cd iXBRLViewerPlugin/viewer && npx webpack --config webpack.prod.js --optimize-minimize

test: testplugin testviewer

testplugin:
	PYTHONPATH=Arelle python3 iXBRLViewerPlugin/tests/iXBRLViewerTests.py

testviewer:
	cd iXBRLViewerPlugin/viewer && jest



DATE ::= $(shell date "+%Y%m%d")
DIST ::= ixbrl_viewer-$(DATE)
dist: prod
	mkdir -p $(DIST)
	cp -r iXBRLViewerPlugin js/dist/ixbrlviewer.js $(DIST)
	zip -r $(DIST).zip $(DIST) -x \*/__pycache__/\* \*/.\*
	
.PHONY: tests
