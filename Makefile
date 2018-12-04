all: dev tests

tests:
	$(MAKE) -C $@

dev: viewer/dist/ixbrlviewer.dev.js

prod: viewer/dist/ixbrlviewer.js

viewer/dist/ixbrlviewer.dev.js:	viewer/src/*/*
	cd viewer && npx webpack --config webpack.dev.js --optimize-minimize

viewer/dist/ixbrlviewer.js:	viewer/src/*/*
	cd viewer && npx webpack --config webpack.prod.js --optimize-minimize


DATE ::= $(shell date "+%Y%m%d")
DIST ::= ixbrl-viewer-$(DATE)
dist: prod
	mkdir -p $(DIST)
	cp -r iXBRLViewerPlugin js/dist/ixbrlviewer.js $(DIST)
	zip -r $(DIST).zip $(DIST) -x \*/__pycache__/\* \*/.\*
	
.PHONY: tests
