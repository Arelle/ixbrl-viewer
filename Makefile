all: dev tests

tests:
	$(MAKE) -C $@

dev: js/dist/ixbrlviewer.js

js/dist/ixbrlviewer.js:	js/src/*
	cd js && npx webpack --config webpack.dev.js --optimize-minimize

	
.PHONY: tests
