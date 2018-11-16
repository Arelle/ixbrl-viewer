all: dev tests

tests:
	$(MAKE) -C $@

dev: js/dist/ixbrlviewer.dev.js

prod: js/dist/ixbrlviewer.js

js/dist/ixbrlviewer.dev.js:	js/src/*
	cd js && npx webpack --config webpack.dev.js --optimize-minimize

js/dist/ixbrlviewer.js:	js/src/*
	cd js && npx webpack --config webpack.prod.js --optimize-minimize


DATE ::= $(shell date "+%Y%m%d")
DIST ::= ixbrl-viewer-$(DATE)
dist: prod
	mkdir -p $(DIST)
	cp -r iXBRLViewerPlugin js/dist/ixbrlviewer.js $(DIST)
	zip -r $(DIST).zip $(DIST) -x \*/__pycache__/\* \*/.\*
	
.PHONY: tests
