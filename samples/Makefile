SRCS = $(wildcard *.ixtmpl)
DOCS = $(SRCS:%.ixtmpl=%)


all: $(DOCS:%=%-viewer.html)

%-viewer.html: %.html
	python3 ../Arelle/arelleCmdLine.py '--packages=packages/us-gaap-2016-01-31-package.zip|packages/IFRST_2017-03-09-es.zip' --plugins=$(shell pwd)/../iXBRLViewerPlugin/ -v -f $< --save-viewer=$@ --viewer-url=../viewer/dist/ixbrlviewer.dev.js
	
#%.html: %.ixtmpl
#	/home/pdw/c.b.c/xbrl/ixbrl-templates/ixbrltemplate.py $< -o $@
