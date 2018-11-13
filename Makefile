all: dev tests

tests:
	$(MAKE) -C $@

dev: js/dist/ixbrlviewer.js

js/dist/ixbrlviewer.js:	js/src/*
	cd js && npx webpack --config webpack.dev.js --optimize-minimize

DATE ::= $(shell date "+%Y%m%d")
DIST ::= ixbrl-viewer-$(DATE)
dist:
	mkdir -p $(DIST)
	cp -r iXBRLViewerPlugin js/dist/ixbrlviewer.js $(DIST)
	zip -r $(DIST).zip $(DIST)
	
.PHONY: tests
